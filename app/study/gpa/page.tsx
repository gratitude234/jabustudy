"use client";
// app/study/gpa/page.tsx — Enhanced GPA Calculator

import { cn } from "@/lib/utils";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Calculator,
  Target,
  Copy,
  ShieldCheck,
  Check,
  X,
  Cloud,
  CloudOff,
  FileUp,
  AlertCircle,
  Table2,
  Award,
  Wand2,
  TrendingUp,
  BarChart2,
  ArrowRight,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

type ScaleKey = "ng_5" | "us_4" | "custom";
type Banner = { type: "success" | "error" | "info"; text: string } | null;
type GradeMap = Record<string, number>;

type CourseRow = {
  id: string;
  code: string;
  units: string;
  grade: string;
  whatIfGrade?: string; // hypothetical grade for what-if mode
};

type Semester = {
  id: string;
  name: string;
  open: boolean;
  courses: CourseRow[];
};

const STORAGE_KEY = "jabuStudy.gpa.v1";
type SyncStatus = "idle" | "syncing" | "synced" | "offline";

type GpaPayload = {
  scaleKey: ScaleKey;
  customScale: GradeMap;
  semesters: Semester[];
  targetTool: {
    currentCgpa: string;
    completedUnits: string;
    targetCgpa: string;
    nextUnits: string;
  };
  updated_at?: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const NG_5: GradeMap = { A: 5, B: 4, C: 3, D: 2, E: 1, F: 0 };
const US_4: GradeMap = { A: 4, B: 3, C: 2, D: 1, F: 0 };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: any = typeof crypto !== "undefined" ? crypto : null;
  if (c?.randomUUID) return c.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalize(v: string) {
  return v.trim().replace(/\s+/g, " ");
}

function toNum(v: string) {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function format2(n: number) {
  return n.toFixed(2);
}

function safeParseJSON<T>(s: string | null): T | null {
  if (!s) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

function gradeLabelForScale(scale: GradeMap, grade: string) {
  const g = normalize(grade).toUpperCase();
  if (!g) return "—";
  if (scale[g] === undefined) return "—";
  return `${g} (${scale[g]})`;
}

function semesterStats(sem: Semester, scale: GradeMap, useWhatIf = false) {
  let unitsTotal = 0;
  let pointsTotal = 0;
  let validRows = 0;
  let invalidRows = 0;
  const gradeCount: Record<string, number> = {};

  for (const c of sem.courses) {
    const u = toNum(c.units);
    const rawGrade = useWhatIf && c.whatIfGrade ? c.whatIfGrade : c.grade;
    const g = normalize(rawGrade).toUpperCase();
    const gp = scale[g];

    if (!Number.isFinite(u) || u <= 0 || gp === undefined) {
      invalidRows += 1;
      continue;
    }

    validRows += 1;
    unitsTotal += u;
    pointsTotal += u * gp;
    gradeCount[g] = (gradeCount[g] ?? 0) + 1;
  }

  const gpa = unitsTotal > 0 ? pointsTotal / unitsTotal : 0;
  return { unitsTotal, pointsTotal, gpa, validRows, invalidRows, gradeCount };
}

function classifyGpa(gpa: number, max: number) {
  if (gpa <= 0) {
    return {
      label: "No GPA yet",
      hint: "Add courses to calculate.",
      tone: "border-border bg-card text-foreground",
    };
  }
  const pct = max > 0 ? gpa / max : 0;
  if (pct >= 0.8)
    return { label: "Excellent", hint: "You're doing great — keep it up.", tone: "border-emerald-200 bg-emerald-50 text-emerald-900" };
  if (pct >= 0.65)
    return { label: "Good", hint: "Solid performance — push a bit more.", tone: "border-blue-200 bg-blue-50 text-blue-900" };
  if (pct >= 0.5)
    return { label: "Fair", hint: "You can improve — focus on weak courses.", tone: "border-amber-200 bg-amber-50 text-amber-900" };
  return { label: "Needs work", hint: "Make a plan and get support early.", tone: "border-red-200 bg-red-50 text-red-900" };
}

// ─── Honours Classification ───────────────────────────────────────────────────

type HonoursInfo = {
  label: string;
  abbr: string;
  colorClass: string;
  borderClass: string;
  textClass: string;
  bgClass: string;
};

function getHonours(cgpa: number, scaleMax: number): HonoursInfo | null {
  if (cgpa <= 0) return null;

  if (scaleMax >= 4.5) {
    // Nigerian 5.0 scale
    if (cgpa >= 4.5)
      return { label: "First Class Honours", abbr: "1st Class", colorClass: "text-emerald-700", borderClass: "border-emerald-300", textClass: "text-emerald-900", bgClass: "bg-emerald-50" };
    if (cgpa >= 3.5)
      return { label: "Second Class Upper", abbr: "2:1", colorClass: "text-blue-700", borderClass: "border-blue-300", textClass: "text-blue-900", bgClass: "bg-blue-50" };
    if (cgpa >= 2.4)
      return { label: "Second Class Lower", abbr: "2:2", colorClass: "text-sky-700", borderClass: "border-sky-300", textClass: "text-sky-900", bgClass: "bg-sky-50" };
    if (cgpa >= 1.5)
      return { label: "Third Class Honours", abbr: "3rd Class", colorClass: "text-amber-700", borderClass: "border-amber-300", textClass: "text-amber-900", bgClass: "bg-amber-50" };
    if (cgpa >= 1.0)
      return { label: "Pass", abbr: "Pass", colorClass: "text-orange-700", borderClass: "border-orange-300", textClass: "text-orange-900", bgClass: "bg-orange-50" };
    return { label: "Fail", abbr: "Fail", colorClass: "text-red-700", borderClass: "border-red-300", textClass: "text-red-900", bgClass: "bg-red-50" };
  }

  // US 4.0 scale
  if (cgpa >= 3.9)
    return { label: "Summa Cum Laude", abbr: "Summa", colorClass: "text-emerald-700", borderClass: "border-emerald-300", textClass: "text-emerald-900", bgClass: "bg-emerald-50" };
  if (cgpa >= 3.7)
    return { label: "Magna Cum Laude", abbr: "Magna", colorClass: "text-blue-700", borderClass: "border-blue-300", textClass: "text-blue-900", bgClass: "bg-blue-50" };
  if (cgpa >= 3.5)
    return { label: "Cum Laude", abbr: "C.L.", colorClass: "text-sky-700", borderClass: "border-sky-300", textClass: "text-sky-900", bgClass: "bg-sky-50" };
  if (cgpa >= 3.0)
    return { label: "Dean's List", abbr: "Dean's", colorClass: "text-amber-700", borderClass: "border-amber-300", textClass: "text-amber-900", bgClass: "bg-amber-50" };
  if (cgpa >= 2.0)
    return { label: "Good Standing", abbr: "Good", colorClass: "text-orange-700", borderClass: "border-orange-300", textClass: "text-orange-900", bgClass: "bg-orange-50" };
  return { label: "Academic Probation", abbr: "Probation", colorClass: "text-red-700", borderClass: "border-red-300", textClass: "text-red-900", bgClass: "bg-red-50" };
}

// ─── Semester GPA Chart ───────────────────────────────────────────────────────

function SemesterChart({
  semesters,
  scale,
  scaleMax,
  cgpa,
  whatIfCgpa,
  whatIfMode,
}: {
  semesters: Semester[];
  scale: GradeMap;
  scaleMax: number;
  cgpa: number;
  whatIfCgpa: number;
  whatIfMode: boolean;
}) {
  const items = semesters.map((s) => {
    const real = semesterStats(s, scale, false);
    const wi = semesterStats(s, scale, true);
    return {
      name: s.name,
      gpa: real.gpa,
      whatIfGpa: wi.gpa,
      units: real.unitsTotal,
      hasData: real.unitsTotal > 0,
    };
  });

  const hasAnyData = items.some((i) => i.hasData);
  if (!hasAnyData) {
    return (
      <div className="flex h-32 items-center justify-center rounded-2xl border border-dashed border-border">
        <p className="text-sm text-muted-foreground">Chart will appear once you add course data.</p>
      </div>
    );
  }

  const W = 600;
  const H = 160;
  const padLeft = 28;
  const padRight = 12;
  const padTop = 12;
  const padBottom = 28;
  const chartW = W - padLeft - padRight;
  const chartH = H - padTop - padBottom;
  const n = items.length;
  const barW = Math.min(48, (chartW / n) * 0.55);
  const gap = chartW / n;

  function yOf(gpa: number) {
    if (scaleMax <= 0) return padTop + chartH;
    return padTop + chartH - (gpa / scaleMax) * chartH;
  }

  // Y-axis labels
  const yTicks = scaleMax >= 4.5 ? [0, 1, 2, 3, 4, 5] : [0, 1, 2, 3, 4];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      role="img"
      aria-label="Semester GPA chart"
    >
      {/* Grid lines */}
      {yTicks.map((tick) => {
        const y = yOf(tick);
        return (
          <g key={tick}>
            <line
              x1={padLeft}
              y1={y}
              x2={W - padRight}
              y2={y}
              stroke="currentColor"
              strokeOpacity={0.08}
              strokeWidth={1}
            />
            <text
              x={padLeft - 4}
              y={y + 4}
              textAnchor="end"
              fontSize={9}
              fill="currentColor"
              fillOpacity={0.4}
            >
              {tick}
            </text>
          </g>
        );
      })}

      {/* Bars */}
      {items.map((item, i) => {
        const cx = padLeft + i * gap + gap / 2;
        const barGpa = whatIfMode ? item.whatIfGpa : item.gpa;
        const realBarY = yOf(item.gpa);
        const wiBarY = yOf(item.whatIfGpa);
        const barY = yOf(barGpa);
        const barH2 = padTop + chartH - barY;
        if (!item.hasData) return null;

        const pct = scaleMax > 0 ? item.gpa / scaleMax : 0;
        const barColor =
          pct >= 0.8
            ? "#10b981"
            : pct >= 0.65
            ? "#3b82f6"
            : pct >= 0.5
            ? "#f59e0b"
            : "#ef4444";

        return (
          <g key={item.name}>
            {/* What-if ghost bar */}
            {whatIfMode && item.whatIfGpa !== item.gpa && (
              <rect
                x={cx - barW / 2 - 2}
                y={wiBarY}
                width={barW + 4}
                height={padTop + chartH - wiBarY}
                rx={4}
                fill={barColor}
                fillOpacity={0.2}
              />
            )}

            {/* Real bar */}
            <rect
              x={cx - barW / 2}
              y={barY}
              width={barW}
              height={barH2}
              rx={4}
              fill={barColor}
              fillOpacity={0.85}
            />

            {/* GPA label on bar */}
            {barH2 > 14 && (
              <text
                x={cx}
                y={barY + 11}
                textAnchor="middle"
                fontSize={8.5}
                fontWeight="700"
                fill="white"
                fillOpacity={0.9}
              >
                {format2(barGpa)}
              </text>
            )}

            {/* Semester label */}
            <text
              x={cx}
              y={H - 4}
              textAnchor="middle"
              fontSize={8.5}
              fill="currentColor"
              fillOpacity={0.55}
            >
              {item.name.replace(/semester\s*/i, "S").slice(0, 6)}
            </text>
          </g>
        );
      })}

      {/* CGPA average line */}
      {cgpa > 0 && (
        <line
          x1={padLeft}
          y1={yOf(cgpa)}
          x2={W - padRight}
          y2={yOf(cgpa)}
          stroke="#5B35D5"
          strokeWidth={1.5}
          strokeDasharray="5,4"
          strokeOpacity={0.7}
        />
      )}

      {/* What-if CGPA line */}
      {whatIfMode && whatIfCgpa > 0 && whatIfCgpa !== cgpa && (
        <line
          x1={padLeft}
          y1={yOf(whatIfCgpa)}
          x2={W - padRight}
          y2={yOf(whatIfCgpa)}
          stroke="#f59e0b"
          strokeWidth={1.5}
          strokeDasharray="5,4"
          strokeOpacity={0.7}
        />
      )}

      {/* Legend */}
      {cgpa > 0 && (
        <g transform={`translate(${padLeft}, ${padTop - 4})`}>
          <line x1={0} y1={0} x2={14} y2={0} stroke="#5B35D5" strokeWidth={1.5} strokeDasharray="4,3" />
          <text x={17} y={3} fontSize={8} fill="currentColor" fillOpacity={0.55}>
            CGPA {format2(cgpa)}
          </text>
          {whatIfMode && whatIfCgpa !== cgpa && (
            <>
              <line x1={80} y1={0} x2={94} y2={0} stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4,3" />
              <text x={97} y={3} fontSize={8} fill="currentColor" fillOpacity={0.55}>
                What-if {format2(whatIfCgpa)}
              </text>
            </>
          )}
        </g>
      )}
    </svg>
  );
}

// ─── Grade Distribution ───────────────────────────────────────────────────────

function GradeDistribution({
  gradeCount,
  scale,
}: {
  gradeCount: Record<string, number>;
  scale: GradeMap;
}) {
  const entries = Object.entries(gradeCount).sort((a, b) => (scale[b[0]] ?? 0) - (scale[a[0]] ?? 0));
  const total = entries.reduce((s, [, c]) => s + c, 0);

  if (!total) return null;

  const colors: Record<string, string> = {
    A: "bg-emerald-400",
    B: "bg-blue-400",
    C: "bg-amber-400",
    D: "bg-orange-400",
    E: "bg-red-400",
    F: "bg-red-600",
  };

  return (
    <div className="space-y-2">
      {/* Segmented bar */}
      <div className="flex h-3 w-full overflow-hidden rounded-full">
        {entries.map(([g, count]) => (
          <div
            key={g}
            className={cn("h-full transition-all", colors[g] ?? "bg-muted")}
            style={{ width: `${(count / total) * 100}%` }}
            title={`${g}: ${count}`}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {entries.map(([g, count]) => (
          <div key={g} className="flex items-center gap-1.5">
            <span className={cn("h-2.5 w-2.5 rounded-full", colors[g] ?? "bg-muted")} />
            <span className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{g}</span> × {count}
              <span className="ml-1 opacity-60">({Math.round((count / total) * 100)}%)</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Banner ───────────────────────────────────────────────────────────────────

function BannerBox({ banner, onClose }: { banner: Banner; onClose: () => void }) {
  if (!banner) return null;

  const tone =
    banner.type === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : banner.type === "error"
      ? "border-red-200 bg-red-50 text-red-700"
      : "border-border bg-card text-foreground";

  const icon =
    banner.type === "success" ? (
      <Check className="h-4 w-4" />
    ) : banner.type === "error" ? (
      <X className="h-4 w-4" />
    ) : (
      <ShieldCheck className="h-4 w-4" />
    );

  return (
    <div className={cn("rounded-2xl border p-4 text-sm", tone)} role="status" aria-live="polite">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <div className="mt-0.5">{icon}</div>
          <p>{banner.text}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl p-1 hover:bg-black/5"
          aria-label="Close banner"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return <section className="space-y-4 rounded-3xl border bg-card p-4 shadow-sm sm:p-5">{children}</section>;
}

// ─── CSV helpers (unchanged from original) ────────────────────────────────────

type CsvRow = {
  semester: string;
  course: string;
  units: string;
  grade: string;
  _valid: boolean;
  _error: string;
};

type ParseResult = { ok: true; rows: CsvRow[] } | { ok: false; error: string };

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQuote = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuote = !inQuote;
    } else if (ch === "," && !inQuote) {
      result.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}

function parseCsv(text: string): ParseResult {
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2)
    return { ok: false, error: "File must have a header row and at least one data row." };

  const headerCols = splitCsvLine(lines[0]).map((h) => h.toLowerCase().trim());
  const colIdx = (aliases: string[]) => {
    for (const a of aliases) {
      const i = headerCols.indexOf(a);
      if (i !== -1) return i;
    }
    return -1;
  };

  const semCol    = colIdx(["semester", "sem", "semester_name", "term"]);
  const courseCol = colIdx(["course", "course_code", "code", "subject"]);
  const unitsCol  = colIdx(["units", "unit", "credit", "credits", "credit_units", "credit_hours"]);
  const gradeCol  = colIdx(["grade", "grades", "score", "letter"]);

  if (unitsCol === -1) return { ok: false, error: "No 'units' column found in header." };
  if (gradeCol === -1) return { ok: false, error: "No 'grade' column found in header." };

  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const get  = (idx: number) => (idx === -1 ? "" : (cols[idx] ?? "").trim());

    const semester = normalize(get(semCol)) || "Imported";
    const course   = normalize(get(courseCol)).toUpperCase();
    const units    = get(unitsCol);
    const grade    = get(gradeCol).toUpperCase();

    const uNum   = Number(units);
    const errors: string[] = [];
    if (!units || !Number.isFinite(uNum) || uNum <= 0) errors.push("invalid units");
    if (!grade) errors.push("missing grade");

    rows.push({ semester, course, units, grade, _valid: errors.length === 0, _error: errors.join(", ") });
  }

  if (!rows.length) return { ok: false, error: "No data rows found after the header." };
  return { ok: true, rows };
}

function csvRowsToSemesters(rows: CsvRow[]): Semester[] {
  const semMap = new Map<string, CourseRow[]>();
  for (const row of rows) {
    if (!semMap.has(row.semester)) semMap.set(row.semester, []);
    semMap.get(row.semester)!.push({ id: uid(), code: row.course, units: row.units, grade: row.grade });
  }
  return Array.from(semMap.entries()).map(([name, courses], idx) => ({
    id: uid(),
    name,
    open: idx === 0,
    courses: courses.length ? courses : [{ id: uid(), code: "", units: "", grade: "" }],
  }));
}

// ─── Import Modal (unchanged from original) ───────────────────────────────────

function ImportModal({
  result,
  scale,
  onClose,
  onImport,
}: {
  result: ParseResult | null;
  scale: GradeMap;
  onClose: () => void;
  onImport: (semesters: Semester[], mode: "replace" | "merge") => void;
}) {
  const [mode, setMode] = useState<"replace" | "merge">("merge");

  useEffect(() => {
    if (!result) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [result, onClose]);

  if (!result) return null;

  const validRows     = result.ok ? result.rows.filter((r) => r._valid) : [];
  const invalidRows   = result.ok ? result.rows.filter((r) => !r._valid) : [];
  const semesterNames = result.ok ? [...new Set(result.rows.filter((r) => r._valid).map((r) => r.semester))] : [];
  const unknownGrades = result.ok
    ? [...new Set(validRows.map((r) => r.grade.toUpperCase()).filter((g) => scale[g] === undefined && g !== ""))]
    : [];

  function doImport() {
    if (!result?.ok) return;
    onImport(csvRowsToSemesters(validRows), mode);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 mx-auto mt-auto w-full max-w-2xl rounded-t-3xl border-t border-border bg-card shadow-2xl md:my-auto md:rounded-3xl md:border">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <Table2 className="h-5 w-5 text-muted-foreground" />
            <p className="text-base font-semibold text-foreground">CSV Import Preview</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-2xl border border-border bg-background hover:bg-secondary/50" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[65vh] overflow-y-auto p-5 space-y-4">
          {!result.ok && (
            <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{result.error}</p>
            </div>
          )}

          {result.ok && (
            <>
              <div className="flex flex-wrap gap-2 text-xs font-semibold">
                <span className="rounded-full border border-border bg-background px-3 py-1.5 text-foreground">{result.rows.length} rows total</span>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-emerald-800">{validRows.length} valid</span>
                {invalidRows.length > 0 && <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-red-700">{invalidRows.length} invalid (skipped)</span>}
                <span className="rounded-full border border-border bg-background px-3 py-1.5 text-foreground">{semesterNames.length} semester{semesterNames.length !== 1 ? "s" : ""}</span>
              </div>

              {unknownGrades.length > 0 && (
                <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>Unknown grades for current scale: <strong>{unknownGrades.join(", ")}</strong>. These rows are imported but won't contribute to GPA until the grade is corrected.</span>
                </div>
              )}

              {semesterNames.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Semesters to import</p>
                  {semesterNames.map((name) => {
                    const semRows = validRows.filter((r) => r.semester === name);
                    return (
                      <div key={name} className="rounded-2xl border border-border bg-background p-3">
                        <p className="text-sm font-semibold text-foreground">{name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{semRows.length} course{semRows.length !== 1 ? "s" : ""}</p>
                        <div className="mt-2 space-y-1">
                          {semRows.slice(0, 5).map((r, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span className="w-20 truncate font-mono">{r.course || "—"}</span>
                              <span>{r.units}u</span>
                              <span className="rounded-full border border-border bg-secondary px-1.5 py-0.5 font-semibold text-foreground">{r.grade}</span>
                            </div>
                          ))}
                          {semRows.length > 5 && <p className="text-xs text-muted-foreground">…and {semRows.length - 5} more</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {invalidRows.length > 0 && (
                <div className="rounded-2xl border border-red-100 bg-red-50/60 p-3">
                  <p className="text-xs font-semibold text-red-700">Skipped rows ({invalidRows.length})</p>
                  <div className="mt-2 space-y-1">
                    {invalidRows.slice(0, 5).map((r, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-red-600">
                        <span className="w-20 truncate font-mono">{r.course || "(no code)"}</span>
                        <span className="text-red-500">{r._error}</span>
                      </div>
                    ))}
                    {invalidRows.length > 5 && <p className="text-xs text-red-500">…and {invalidRows.length - 5} more</p>}
                  </div>
                </div>
              )}

              {validRows.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Import mode</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(["merge", "replace"] as const).map((m) => (
                      <button key={m} type="button" onClick={() => setMode(m)}
                        className={cn("rounded-2xl border p-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          mode === m ? "border-foreground bg-secondary font-semibold text-foreground" : "border-border bg-background text-muted-foreground hover:bg-secondary/50"
                        )}>
                        <p className="font-semibold">{m === "merge" ? "Merge" : "Replace all"}</p>
                        <p className="mt-0.5 text-xs opacity-80">{m === "merge" ? "Add imported semesters alongside your existing ones." : "Delete all existing semesters and replace with the import."}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-2xl border border-border bg-background px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-secondary/50">Cancel</button>
          {result.ok && validRows.length > 0 && (
            <button type="button" onClick={doImport} className="rounded-2xl border border-[#5B35D5]/20 bg-[#EEEDFE] px-4 py-2.5 text-sm font-semibold text-[#3B24A8] hover:bg-[#5B35D5]/10">
              Import {validRows.length} row{validRows.length !== 1 ? "s" : ""}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function GpaPage() {
  const [banner, setBanner]           = useState<Banner>(null);
  const [syncStatus, setSyncStatus]   = useState<SyncStatus>("idle");
  const [isAuthed, setIsAuthed]       = useState<boolean | null>(null);
  const [scaleKey, setScaleKey]       = useState<ScaleKey>("ng_5");
  const [customScale, setCustomScale] = useState<GradeMap>({ ...NG_5 });
  const [whatIfMode, setWhatIfMode]   = useState(false);

  const [semesters, setSemesters] = useState<Semester[]>([
    {
      id: uid(),
      name: "Semester 1",
      open: true,
      courses: [
        { id: uid(), code: "", units: "", grade: "" },
        { id: uid(), code: "", units: "", grade: "" },
      ],
    },
  ]);

  const [currentCgpa, setCurrentCgpa]       = useState("");
  const [completedUnits, setCompletedUnits] = useState("");
  const [targetCgpa, setTargetCgpa]         = useState("");
  const [nextUnits, setNextUnits]           = useState("");

  const [importResult, setImportResult] = useState<ParseResult | null>(null);
  const csvInputRef = useRef<HTMLInputElement | null>(null);

  function openFilePicker() { csvInputRef.current?.click(); }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result;
      if (typeof text !== "string") { setImportResult({ ok: false, error: "Could not read file." }); return; }
      setImportResult(parseCsv(text));
    };
    reader.onerror = () => setImportResult({ ok: false, error: "File read error." });
    reader.readAsText(file);
  }

  function handleImport(newSemesters: Semester[], mode: "replace" | "merge") {
    setSemesters((prev) => {
      if (mode === "replace") return newSemesters;
      const existing = prev.map((s) => ({ ...s, open: false }));
      return [...existing, ...newSemesters.map((s, i) => ({ ...s, open: i === 0 }))];
    });
    setImportResult(null);
    setBanner({ type: "success", text: `Imported ${newSemesters.length} semester${newSemesters.length !== 1 ? "s" : ""} via CSV.` });
  }

  const scale: GradeMap = useMemo(() => {
    if (scaleKey === "ng_5") return NG_5;
    if (scaleKey === "us_4") return US_4;
    return customScale;
  }, [scaleKey, customScale]);

  const scaleMax = useMemo(() => {
    const vals = Object.values(scale);
    return vals.length ? Math.max(...vals) : 0;
  }, [scale]);

  // ── Load from local + Supabase ────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    function applyPayload(saved: GpaPayload) {
      if (saved.scaleKey) setScaleKey(saved.scaleKey);
      if (saved.customScale) setCustomScale(saved.customScale);

      if (Array.isArray(saved.semesters) && saved.semesters.length) {
        setSemesters(
          saved.semesters.map((s, idx) => ({
            id: s.id || uid(),
            name: s.name || `Semester ${idx + 1}`,
            open: typeof s.open === "boolean" ? s.open : idx === 0,
            courses: Array.isArray(s.courses)
              ? s.courses.map((c) => ({
                  id: c.id || uid(),
                  code: String(c.code ?? ""),
                  units: String(c.units ?? ""),
                  grade: String(c.grade ?? ""),
                  whatIfGrade: c.whatIfGrade ? String(c.whatIfGrade) : undefined,
                }))
              : [{ id: uid(), code: "", units: "", grade: "" }],
          }))
        );
      }

      if (saved.targetTool) {
        setCurrentCgpa(String(saved.targetTool.currentCgpa ?? ""));
        setCompletedUnits(String(saved.targetTool.completedUnits ?? ""));
        setTargetCgpa(String(saved.targetTool.targetCgpa ?? ""));
        setNextUnits(String(saved.targetTool.nextUnits ?? ""));
      }
    }

    async function load() {
      const localRaw = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
      const local = safeParseJSON<GpaPayload>(localRaw);
      if (local && !cancelled) applyPayload(local);

      try {
        const { data: auth } = await supabase.auth.getUser();
        const user = auth?.user ?? null;
        if (!cancelled) setIsAuthed(!!user);
        if (!user || cancelled) return;

        setSyncStatus("syncing");
        const { data: dbRow, error } = await supabase.from("study_gpa_data").select("data").eq("user_id", user.id).maybeSingle();
        if (cancelled) return;
        if (error) { setSyncStatus("offline"); return; }

        const dbPayload = safeParseJSON<GpaPayload>(dbRow?.data ? JSON.stringify(dbRow.data) : null);
        const localTs = local?.updated_at ? new Date(local.updated_at).getTime() : 0;
        const dbTs    = dbPayload?.updated_at ? new Date(dbPayload.updated_at).getTime() : 0;

        if (dbPayload && dbTs >= localTs) {
          applyPayload(dbPayload);
          try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(dbPayload)); } catch { /**/ }
        }
        setSyncStatus("synced");
      } catch {
        if (!cancelled) setSyncStatus("offline");
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  // ── Auto-save ─────────────────────────────────────────────────────────────

  const saveTimer = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);

    saveTimer.current = window.setTimeout(async () => {
      const payload: GpaPayload = {
        scaleKey, customScale, semesters,
        targetTool: { currentCgpa, completedUnits, targetCgpa, nextUnits },
        updated_at: new Date().toISOString(),
      };

      try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload)); } catch { /**/ }

      try {
        const { data: auth } = await supabase.auth.getUser();
        const user = auth?.user ?? null;
        if (!user) return;
        setSyncStatus("syncing");
        const { error } = await supabase.from("study_gpa_data").upsert(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          { user_id: user.id, data: payload as any, updated_at: payload.updated_at },
          { onConflict: "user_id" }
        );
        setSyncStatus(error ? "offline" : "synced");
      } catch { setSyncStatus("offline"); }
    }, 250);

    return () => { if (saveTimer.current) window.clearTimeout(saveTimer.current); };
  }, [scaleKey, customScale, semesters, currentCgpa, completedUnits, targetCgpa, nextUnits]);

  // ── Computed totals ───────────────────────────────────────────────────────

  const totals = useMemo(() => {
    let unitsTotal = 0;
    let pointsTotal = 0;
    let validRows = 0;
    let invalidRows = 0;
    const gradeCount: Record<string, number> = {};

    for (const s of semesters) {
      const st = semesterStats(s, scale, false);
      unitsTotal  += st.unitsTotal;
      pointsTotal += st.pointsTotal;
      validRows   += st.validRows;
      invalidRows += st.invalidRows;
      for (const [g, c] of Object.entries(st.gradeCount)) {
        gradeCount[g] = (gradeCount[g] ?? 0) + c;
      }
    }

    const cgpa = unitsTotal > 0 ? pointsTotal / unitsTotal : 0;
    return { unitsTotal, pointsTotal, cgpa, validRows, invalidRows, gradeCount };
  }, [semesters, scale]);

  const whatIfTotals = useMemo(() => {
    let unitsTotal = 0;
    let pointsTotal = 0;
    for (const s of semesters) {
      const st = semesterStats(s, scale, true);
      unitsTotal  += st.unitsTotal;
      pointsTotal += st.pointsTotal;
    }
    const cgpa = unitsTotal > 0 ? pointsTotal / unitsTotal : 0;
    return { unitsTotal, cgpa };
  }, [semesters, scale]);

  const hasWhatIfChanges = useMemo(() =>
    semesters.some((s) => s.courses.some((c) => c.whatIfGrade && c.whatIfGrade !== c.grade)),
    [semesters]
  );

  const cgpaTone    = useMemo(() => classifyGpa(totals.cgpa, scaleMax), [totals.cgpa, scaleMax]);
  const honours     = useMemo(() => getHonours(totals.cgpa, scaleMax), [totals.cgpa, scaleMax]);
  const whatIfHonours = useMemo(() => getHonours(whatIfTotals.cgpa, scaleMax), [whatIfTotals.cgpa, scaleMax]);

  const requiredGpa = useMemo(() => {
    const cur   = toNum(currentCgpa);
    const doneU = toNum(completedUnits);
    const tgt   = toNum(targetCgpa);
    const nxtU  = toNum(nextUnits);
    if (!Number.isFinite(cur) || !Number.isFinite(doneU) || !Number.isFinite(tgt) || !Number.isFinite(nxtU)) return null;
    if (doneU <= 0 || nxtU <= 0) return null;
    const req = (tgt * (doneU + nxtU) - cur * doneU) / nxtU;
    return Number.isFinite(req) ? req : null;
  }, [currentCgpa, completedUnits, targetCgpa, nextUnits]);

  const requiredStatus = useMemo(() => {
    if (requiredGpa === null) return null;
    if (requiredGpa < 0)         return { type: "success" as const, text: "You're already above your target. Keep it steady." };
    if (requiredGpa > scaleMax)  return { type: "error" as const, text: "Target might be unrealistic for next semester with these units." };
    if (requiredGpa >= scaleMax * 0.8) return { type: "info" as const, text: "You'll need a very strong semester. Start early and stay consistent." };
    if (requiredGpa >= scaleMax * 0.65) return { type: "info" as const, text: "Achievable — stay focused and prioritize tough courses." };
    return { type: "success" as const, text: "Achievable — keep up a steady routine." };
  }, [requiredGpa, scaleMax]);

  const parsedCurrent = parseFloat(currentCgpa);
  const parsedTarget = parseFloat(targetCgpa);
  const showPlanCta =
    Number.isFinite(parsedCurrent) &&
    Number.isFinite(parsedTarget) &&
    parsedCurrent > 0 &&
    parsedTarget > parsedCurrent;

  // ── Mutations ─────────────────────────────────────────────────────────────

  function updateSemester(semId: string, patch: Partial<Semester>) {
    setSemesters((prev) => prev.map((s) => (s.id === semId ? { ...s, ...patch } : s)));
  }

  function updateCourse(semId: string, courseId: string, patch: Partial<CourseRow>) {
    setSemesters((prev) =>
      prev.map((s) => {
        if (s.id !== semId) return s;
        return { ...s, courses: s.courses.map((c) => (c.id === courseId ? { ...c, ...patch } : c)) };
      })
    );
  }

  function addCourse(semId: string) {
    setSemesters((prev) =>
      prev.map((s) => {
        if (s.id !== semId) return s;
        return { ...s, courses: [...s.courses, { id: uid(), code: "", units: "", grade: "" }] };
      })
    );
  }

  function removeCourse(semId: string, courseId: string) {
    setSemesters((prev) =>
      prev.map((s) => {
        if (s.id !== semId) return s;
        const next = s.courses.filter((c) => c.id !== courseId);
        return { ...s, courses: next.length ? next : [{ id: uid(), code: "", units: "", grade: "" }] };
      })
    );
  }

  function addSemester() {
    const n = semesters.length + 1;
    setSemesters((prev) => [
      ...prev.map((s) => ({ ...s, open: false })),
      { id: uid(), name: `Semester ${n}`, open: true, courses: [{ id: uid(), code: "", units: "", grade: "" }] },
    ]);
  }

  function removeSemester(semId: string) {
    setSemesters((prev) => {
      const next = prev.filter((s) => s.id !== semId);
      if (!next.length)
        return [{ id: uid(), name: "Semester 1", open: true, courses: [{ id: uid(), code: "", units: "", grade: "" }] }];
      if (!next.some((s) => s.open)) next[0] = { ...next[0], open: true };
      return next;
    });
  }

  function clearWhatIf() {
    setSemesters((prev) =>
      prev.map((s) => ({
        ...s,
        courses: s.courses.map((c) => ({ ...c, whatIfGrade: undefined })),
      }))
    );
  }

  async function clearCloudData() {
    try {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user ?? null;
      if (user) await supabase.from("study_gpa_data").delete().eq("user_id", user.id);
    } catch { /**/ }
  }

  async function copySummary() {
    const lines: string[] = [];
    lines.push("Jabu Study GPA Summary");
    lines.push(`Scale: ${scaleKey === "ng_5" ? "Nigeria (5.0)" : scaleKey === "us_4" ? "4.0" : "Custom"}`);
    lines.push(`CGPA: ${format2(totals.cgpa)} / ${scaleMax}`);
    if (honours) lines.push(`Class: ${honours.label}`);
    lines.push(`Total Units: ${totals.unitsTotal}`);
    lines.push("");
    for (const s of semesters) {
      const st = semesterStats(s, scale);
      lines.push(`${s.name}: GPA ${format2(st.gpa)} | Units ${st.unitsTotal} | Courses ${st.validRows}/${s.courses.length} valid`);
    }
    const text = lines.join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setBanner({ type: "success", text: "Copied summary to clipboard." });
    } catch {
      setBanner({ type: "error", text: "Failed to copy. Your browser may block clipboard access." });
    }
  }

  async function resetAll() {
    setBanner(null);
    setScaleKey("ng_5");
    setCustomScale({ ...NG_5 });
    setWhatIfMode(false);
    setSemesters([{
      id: uid(), name: "Semester 1", open: true,
      courses: [{ id: uid(), code: "", units: "", grade: "" }, { id: uid(), code: "", units: "", grade: "" }],
    }]);
    setCurrentCgpa(""); setCompletedUnits(""); setTargetCgpa(""); setNextUnits("");
    if (typeof window !== "undefined") window.localStorage.removeItem(STORAGE_KEY);
    setSyncStatus("idle");
    await clearCloudData();
    setBanner({ type: "success", text: "Reset done." });
  }

  const canCalculate = useMemo(() => totals.validRows > 0 && totals.unitsTotal > 0, [totals.validRows, totals.unitsTotal]);

  // ─── Keyboard: Enter in a course input focuses the next field in that row,
  //     or creates a new row when pressing Enter in the last grade field.
  const handleCourseKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>, semId: string, courseId: string, field: "code" | "units" | "grade") => {
      if (e.key !== "Enter") return;
      e.preventDefault();

      const sem = semesters.find((s) => s.id === semId);
      if (!sem) return;
      const courseIdx = sem.courses.findIndex((c) => c.id === courseId);

      if (field === "code") {
        // Focus units field of same row
        const el = document.querySelector<HTMLInputElement>(`[data-course-field="${semId}-${courseId}-units"]`);
        el?.focus();
      } else if (field === "units") {
        // Focus grade select of same row
        const el = document.querySelector<HTMLSelectElement>(`[data-course-field="${semId}-${courseId}-grade"]`);
        el?.focus();
      } else if (field === "grade") {
        if (courseIdx === sem.courses.length - 1) {
          // Last row — add new row and focus its code field
          addCourse(semId);
          // Wait for DOM update
          setTimeout(() => {
            const allRows = document.querySelectorAll<HTMLInputElement>(`[data-sem-id="${semId}"] [data-course-field*="-code"]`);
            const last = allRows[allRows.length - 1];
            last?.focus();
          }, 30);
        } else {
          // Focus code field of next row
          const nextCourse = sem.courses[courseIdx + 1];
          const el = document.querySelector<HTMLInputElement>(`[data-course-field="${semId}-${nextCourse.id}-code"]`);
          el?.focus();
        }
      }
    },
    [semesters, addCourse]
  );

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4 pb-24 md:pb-6">
      {/* ── Unauthenticated warning ─────────────────────────────────────────── */}
      {isAuthed === false && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-secondary/40 px-4 py-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Sign in to sync your GPA data across devices.</p>
          </div>
          <Link href="/login?next=/study/gpa"
            className="shrink-0 rounded-2xl border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground no-underline hover:bg-secondary/50">
            Sign in
          </Link>
        </div>
      )}

      {/* ── Hero CGPA card ─────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-3xl bg-[#5B35D5]">
        {/* Top section */}
        <div className="p-5 pb-4">
          {/* Scale selector row */}
          <div className="mb-4 flex items-center justify-between gap-3">
            <label className="flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-white/60">Scale</span>
              <select
                value={scaleKey}
                onChange={(e) => setScaleKey(e.target.value as ScaleKey)}
                className="rounded-xl bg-white/15 px-2.5 py-1.5 text-xs font-semibold text-white outline-none"
              >
                <option value="ng_5">Nigeria 5.0</option>
                <option value="us_4">4.0 scale</option>
                <option value="custom">Custom</option>
              </select>
            </label>
            <button
              type="button"
              onClick={resetAll}
              className="rounded-xl border border-white/25 bg-white/15 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/25"
            >
              Reset
            </button>
          </div>

          {/* CGPA + classification */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-white/60">
                CGPA
              </p>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="font-mono text-5xl font-extrabold leading-none tracking-tight text-white">
                  {canCalculate ? format2(totals.cgpa) : "0.00"}
                </span>
                <span className="text-lg font-semibold text-white/50">
                  / {scaleMax}
                </span>
              </div>
              {/* What-if CGPA */}
              {whatIfMode && hasWhatIfChanges && whatIfTotals.cgpa !== totals.cgpa && (
                <span className="mt-1 inline-flex items-center rounded-full border border-amber-300/50 bg-amber-50/20 px-2 py-0.5 text-xs font-bold text-amber-100">
                  What-if: {format2(whatIfTotals.cgpa)}
                </span>
              )}
            </div>

            <div className="flex flex-col items-end gap-2">
              {canCalculate && honours && (
                <div className="inline-flex items-center gap-1.5 rounded-2xl border border-white/25 bg-white/15 px-3 py-1.5 text-sm font-bold text-white">
                  <Award className="h-3.5 w-3.5" />
                  {honours.abbr}
                </div>
              )}
              <p className="text-right text-sm font-semibold text-white/70">
                {canCalculate ? cgpaTone.label : "Add a course below to get started"}
              </p>
            </div>
          </div>

          {/* Stats row */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-white/10 px-3 py-2.5">
              <p className="font-mono text-lg font-extrabold leading-none text-white">
                {totals.unitsTotal}
              </p>
              <p className="mt-1 text-[10px] text-white/55">total units</p>
            </div>
            <div className="rounded-2xl bg-white/10 px-3 py-2.5">
              <p className="font-mono text-lg font-extrabold leading-none text-white">
                {totals.validRows}
              </p>
              <p className="mt-1 text-[10px] text-white/55">courses</p>
            </div>
            <div className="rounded-2xl bg-white/10 px-3 py-2.5">
              <p className="font-mono text-lg font-extrabold leading-none text-white">
                {semesters.length}
              </p>
              <p className="mt-1 text-[10px] text-white/55">
                semester{semesters.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
        </div>

        {/* Progress to next class strip */}
        {canCalculate && (() => {
          // Calculate the next classification threshold above current CGPA
          type NextThreshold = { label: string; value: number } | null;
          let nextThreshold: NextThreshold = null;

          if (scaleMax >= 4.5) {
            // Nigerian 5.0 scale — thresholds in ascending order
            const ng5Thresholds = [
              { label: "Pass",        value: 1.0 },
              { label: "Third Class", value: 1.5 },
              { label: "2nd Class Lower", value: 2.4 },
              { label: "2nd Class Upper", value: 3.5 },
              { label: "First Class", value: 4.5 },
            ];
            nextThreshold = ng5Thresholds.find((t) => t.value > totals.cgpa) ?? null;
          } else {
            // 4.0 scale
            const us4Thresholds = [
              { label: "Good Standing", value: 2.0 },
              { label: "Dean's List",   value: 3.0 },
              { label: "Cum Laude",     value: 3.5 },
              { label: "Magna Cum Laude", value: 3.7 },
              { label: "Summa Cum Laude", value: 3.9 },
            ];
            nextThreshold = us4Thresholds.find((t) => t.value > totals.cgpa) ?? null;
          }

          if (!nextThreshold) return null; // already at the highest class

          // Find the lower bound of the current class (the threshold just below current CGPA)
          let lowerBound = 0;
          if (scaleMax >= 4.5) {
            if (totals.cgpa >= 4.5) lowerBound = 4.5;
            else if (totals.cgpa >= 3.5) lowerBound = 3.5;
            else if (totals.cgpa >= 2.4) lowerBound = 2.4;
            else if (totals.cgpa >= 1.5) lowerBound = 1.5;
            else if (totals.cgpa >= 1.0) lowerBound = 1.0;
          } else {
            if (totals.cgpa >= 3.9) lowerBound = 3.9;
            else if (totals.cgpa >= 3.7) lowerBound = 3.7;
            else if (totals.cgpa >= 3.5) lowerBound = 3.5;
            else if (totals.cgpa >= 3.0) lowerBound = 3.0;
            else if (totals.cgpa >= 2.0) lowerBound = 2.0;
          }

          const rangeSize = nextThreshold.value - lowerBound;
          const progress = rangeSize > 0
            ? Math.min(100, ((totals.cgpa - lowerBound) / rangeSize) * 100)
            : 100;
          const gap = Math.max(0, nextThreshold.value - totals.cgpa);

          return (
            <div className="border-t border-white/15 px-5 py-3 pb-4">
              <div className="mb-1.5 flex items-center justify-between text-[10px] font-semibold text-white/60">
                <span>Progress to {nextThreshold.label}</span>
                <span>{format2(totals.cgpa)} / {format2(nextThreshold.value)}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/20">
                <div
                  className="h-full rounded-full bg-white transition-all duration-700"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-1.5 text-[11px] font-semibold text-white/65">
                {format2(gap)} point{gap !== 1 ? "s" : ""} away from {nextThreshold.label}
              </p>
            </div>
          );
        })()}

        {/* Custom scale editor — shown inline when custom selected */}
        {scaleKey === "custom" && (
          <div className="border-t border-white/15 px-5 py-4">
            <p className="text-xs font-semibold text-white/70 mb-3">Custom grade scale</p>
            <div className="grid grid-cols-3 gap-2">
              {Object.keys(customScale).sort().map((g) => (
                <label key={g} className="rounded-xl bg-white/10 px-2.5 py-2">
                  <span className="text-[10px] font-semibold text-white/55">{g}</span>
                  <input
                    value={String(customScale[g])}
                    onChange={(e) => {
                      const v = toNum(e.target.value);
                      setCustomScale((prev) => ({ ...prev, [g]: Number.isFinite(v) ? v : prev[g] }));
                    }}
                    inputMode="decimal"
                    className="mt-0.5 w-full bg-transparent text-sm font-semibold text-white outline-none"
                  />
                </label>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => setCustomScale({ ...NG_5 })} className="rounded-xl border border-white/25 bg-white/15 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/25">Nigeria 5.0 preset</button>
              <button type="button" onClick={() => setCustomScale({ ...US_4 })} className="rounded-xl border border-white/25 bg-white/15 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/25">4.0 preset</button>
            </div>
          </div>
        )}
      </div>

      <BannerBox banner={banner} onClose={() => setBanner(null)} />

      {/* ── Honours Classification ─────────────────────────────────────────── */}
      {canCalculate && honours && (
        <section className={cn("rounded-3xl border p-4 shadow-sm sm:p-5", honours.bgClass, honours.borderClass)}>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-2xl border", honours.borderClass, honours.bgClass)}>
                <Award className={cn("h-5 w-5", honours.colorClass)} />
              </div>
              <div>
                <p className={cn("text-xs font-semibold uppercase tracking-wide opacity-70", honours.textClass)}>Degree Classification</p>
                <p className={cn("text-base font-bold", honours.textClass)}>{honours.label}</p>
              </div>
            </div>
            <span className={cn("rounded-2xl border px-3 py-1.5 text-sm font-bold", honours.borderClass, honours.bgClass, honours.colorClass)}>
              {honours.abbr}
            </span>
          </div>

          {/* What-if honours comparison */}
          {whatIfMode && hasWhatIfChanges && whatIfHonours && whatIfHonours.label !== honours.label && (
            <div className={cn("mt-3 rounded-2xl border px-3 py-2 text-sm font-semibold flex items-center gap-2", whatIfHonours.borderClass, whatIfHonours.bgClass, whatIfHonours.colorClass)}>
              <Wand2 className="h-4 w-4 shrink-0" />
              What-if: <span className="font-bold">{whatIfHonours.label}</span>
            </div>
          )}

          {/* Honours scale reference */}
          {(() => {
            const thresholds = scaleMax >= 4.5
              ? [
                  { abbr: "1st",  range: "≥ 4.50",    active: totals.cgpa >= 4.5 },
                  { abbr: "2:1",  range: "3.50–4.49", active: totals.cgpa >= 3.5 && totals.cgpa < 4.5 },
                  { abbr: "2:2",  range: "2.40–3.49", active: totals.cgpa >= 2.4 && totals.cgpa < 3.5 },
                  { abbr: "3rd",  range: "1.50–2.39", active: totals.cgpa >= 1.5 && totals.cgpa < 2.4 },
                  { abbr: "Pass", range: "1.00–1.49", active: totals.cgpa >= 1.0 && totals.cgpa < 1.5 },
                ]
              : [
                  { abbr: "Summa",  range: "≥ 3.90",    active: totals.cgpa >= 3.9 },
                  { abbr: "Magna",  range: "3.70–3.89", active: totals.cgpa >= 3.7 && totals.cgpa < 3.9 },
                  { abbr: "Cum L.", range: "3.50–3.69", active: totals.cgpa >= 3.5 && totals.cgpa < 3.7 },
                  { abbr: "Dean's", range: "3.00–3.49", active: totals.cgpa >= 3.0 && totals.cgpa < 3.5 },
                ];
            return (
              <div className="mt-3 border-t border-current/10 pt-3">
                <p className={cn("text-[11px] font-semibold uppercase tracking-wide opacity-60 mb-2", honours.textClass)}>
                  {scaleMax >= 4.5 ? "Nigerian 5.0 scale" : "4.0 scale"} thresholds
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {thresholds.map((t) => (
                    <span
                      key={t.abbr}
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                        t.active
                          ? cn("border-current/40", honours.textClass)
                          : "border-current/10 opacity-40",
                        honours.textClass
                      )}
                    >
                      {t.abbr} {t.range}
                    </span>
                  ))}
                </div>
              </div>
            );
          })()}
        </section>
      )}

      {/* ── Analytics: Chart + Grade Distribution ─────────────────────────── */}
      {canCalculate && (
        <SectionCard>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
              <p className="text-base font-semibold text-foreground">Semester trend</p>
            </div>
          </div>

          <SemesterChart
            semesters={semesters}
            scale={scale}
            scaleMax={scaleMax}
            cgpa={totals.cgpa}
            whatIfCgpa={whatIfTotals.cgpa}
            whatIfMode={whatIfMode && hasWhatIfChanges}
          />

          {Object.keys(totals.gradeCount).length > 0 && (
            <div className="space-y-2 border-t border-border pt-4">
              <div className="flex items-center gap-2">
                <BarChart2 className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-semibold text-foreground">Grade distribution</p>
                <span className="text-xs text-muted-foreground">({totals.validRows} courses)</span>
              </div>
              <GradeDistribution gradeCount={totals.gradeCount} scale={scale} />
            </div>
          )}
        </SectionCard>
      )}

      {/* ── Semesters ──────────────────────────────────────────────────────── */}
      <SectionCard>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-base font-semibold text-foreground">Semesters</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add courses and grades. Press <kbd className="rounded border border-border px-1 py-0.5 text-[10px] font-mono">Enter</kbd> to advance between fields.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* What-if toggle */}
            <button
              type="button"
              onClick={() => { setWhatIfMode((v) => !v); if (!whatIfMode) clearWhatIf(); }}
              className={cn(
                "inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-semibold transition-colors",
                whatIfMode
                  ? "border-amber-300 bg-amber-50 text-amber-900"
                  : "border-border bg-background text-foreground hover:bg-secondary/50"
              )}
              title="Toggle what-if mode to simulate grade changes"
            >
              <Wand2 className="h-4 w-4" />
              What-if {whatIfMode ? "on" : "off"}
            </button>

            <input ref={csvInputRef} type="file" accept=".csv,text/csv" onChange={handleFileChange} className="sr-only" aria-label="Import CSV" />
            <button
              type="button"
              onClick={openFilePicker}
              className="inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground hover:bg-secondary/50"
              title="Import courses from a CSV file"
            >
              <FileUp className="h-4 w-4" />
              Import CSV
            </button>

            <button
              type="button"
              onClick={addSemester}
              className="inline-flex items-center gap-2 rounded-2xl border border-[#5B35D5]/20 bg-[#EEEDFE] px-3 py-2 text-sm font-semibold text-[#3B24A8] hover:bg-[#5B35D5]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B35D5] focus-visible:ring-offset-2"
            >
              <Plus className="h-4 w-4" />
              Add semester
            </button>
          </div>
        </div>

        {/* What-if info strip */}
        {whatIfMode && (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-900">
            <Wand2 className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold">What-if mode is on</p>
              <p className="mt-0.5 text-xs opacity-80">
                Each course now has a "What-if" grade field. Change it to see how your CGPA and honours would shift — your real grades stay untouched.
              </p>
            </div>
            {hasWhatIfChanges && (
              <button
                type="button"
                onClick={clearWhatIf}
                className="shrink-0 rounded-xl border border-amber-300 bg-amber-100 px-2 py-1 text-xs font-semibold hover:bg-amber-200"
              >
                Clear all
              </button>
            )}
          </div>
        )}

        <div className="space-y-3">
          {semesters.map((s, idx) => {
            const st   = semesterStats(s, scale);
            const wiSt = semesterStats(s, scale, true);
            const tone = classifyGpa(st.gpa, scaleMax);

            return (
              <div key={s.id} className="rounded-3xl border bg-card" data-sem-id={s.id}>
                {/* Semester header */}
                <div className="flex items-start justify-between gap-3 p-4">
                  <button
                    type="button"
                    onClick={() => updateSemester(s.id, { open: !s.open })}
                    className="flex min-w-0 flex-1 items-start gap-3 text-left"
                  >
                    <div className={cn("mt-0.5 rounded-2xl border p-2", tone.tone)}>
                      {s.open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <input
                        value={s.name}
                        onChange={(e) => updateSemester(s.id, { name: e.target.value })}
                        className="w-full bg-transparent text-base font-semibold text-foreground outline-none"
                        aria-label={`Semester ${idx + 1} name`}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted-foreground">
                        <span>GPA: <span className="font-semibold text-foreground">{st.unitsTotal > 0 ? format2(st.gpa) : "—"}</span></span>
                        {whatIfMode && wiSt.gpa !== st.gpa && wiSt.unitsTotal > 0 && (
                          <span className="rounded-full border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-900">
                            What-if: {format2(wiSt.gpa)}
                          </span>
                        )}
                        <span>• Units {st.unitsTotal}</span>
                        <span>• {st.validRows}/{s.courses.length} valid</span>
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => removeSemester(s.id)}
                    className="inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-semibold text-foreground hover:bg-muted/50"
                    aria-label="Remove semester"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="hidden sm:inline">Remove</span>
                  </button>
                </div>

                {/* Semester body */}
                {s.open && (
                  <div className="space-y-2 border-t p-4">
                    {s.courses.map((c) => {
                      const u       = toNum(c.units);
                      const g       = normalize(c.grade).toUpperCase();
                      const wiG     = normalize(c.whatIfGrade ?? "").toUpperCase();
                      const invalid = (!Number.isFinite(u) || u <= 0) && c.units.trim() !== "";
                      const gInvalid = c.grade.trim() !== "" && scale[g] === undefined;
                      const hasWhatIf = whatIfMode && c.whatIfGrade && c.whatIfGrade !== c.grade;

                      return (
                        <div
                          key={c.id}
                          className={cn(
                            "rounded-3xl border bg-card p-3 transition-colors",
                            hasWhatIf && "border-amber-200 bg-amber-50/30"
                          )}
                        >
                          {/* Main fields row */}
                          <div className="flex flex-col gap-2 sm:flex-row">
                            {/* Course code */}
                            <label className="flex-1 rounded-2xl border bg-card px-3 py-2">
                              <span className="block text-[11px] font-semibold text-muted-foreground">Course</span>
                              <input
                                value={c.code}
                                onChange={(e) => updateCourse(s.id, c.id, { code: e.target.value })}
                                onKeyDown={(e) => handleCourseKeyDown(e, s.id, c.id, "code")}
                                placeholder="e.g. GST101"
                                data-course-field={`${s.id}-${c.id}-code`}
                                className="mt-1 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                              />
                            </label>

                            {/* Units */}
                            <label className="w-full sm:w-24 rounded-2xl border bg-card px-3 py-2">
                              <span className="block text-[11px] font-semibold text-muted-foreground">Units *</span>
                              <input
                                value={c.units}
                                onChange={(e) => updateCourse(s.id, c.id, { units: e.target.value })}
                                onKeyDown={(e) => handleCourseKeyDown(e, s.id, c.id, "units")}
                                placeholder="e.g. 2"
                                inputMode="numeric"
                                data-course-field={`${s.id}-${c.id}-units`}
                                className={cn(
                                  "mt-1 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground",
                                  invalid ? "text-red-600" : "text-foreground"
                                )}
                              />
                              {invalid && <p className="mt-0.5 text-[10px] font-semibold text-red-600">Must be &gt; 0</p>}
                            </label>

                            {/* Grade */}
                            <label className="w-full sm:w-32 rounded-2xl border bg-card px-3 py-2">
                              <span className="block text-[11px] font-semibold text-muted-foreground">Grade *</span>
                              <select
                                value={c.grade}
                                onChange={(e) => updateCourse(s.id, c.id, { grade: e.target.value })}
                                onKeyDown={(e) => handleCourseKeyDown(e as React.KeyboardEvent<HTMLSelectElement>, s.id, c.id, "grade")}
                                data-course-field={`${s.id}-${c.id}-grade`}
                                className={cn(
                                  "mt-1 w-full bg-transparent text-sm outline-none",
                                  gInvalid ? "text-red-600" : "text-foreground"
                                )}
                              >
                                <option value="">Select</option>
                                {Object.keys(scale).sort().map((gr) => (
                                  <option key={gr} value={gr}>{gradeLabelForScale(scale, gr)}</option>
                                ))}
                              </select>
                              {gInvalid && <p className="mt-0.5 text-[10px] font-semibold text-red-600">Invalid grade</p>}
                            </label>

                            {/* What-if grade (shown only in what-if mode) */}
                            {whatIfMode && (
                              <label className={cn("w-full sm:w-32 rounded-2xl border px-3 py-2", hasWhatIf ? "border-amber-300 bg-amber-50" : "bg-card")}>
                                <span className="block text-[11px] font-semibold text-amber-700">What-if</span>
                                <select
                                  value={c.whatIfGrade ?? c.grade}
                                  onChange={(e) => updateCourse(s.id, c.id, { whatIfGrade: e.target.value || undefined })}
                                  className="mt-1 w-full bg-transparent text-sm text-foreground outline-none"
                                >
                                  <option value="">Same as real</option>
                                  {Object.keys(scale).sort().map((gr) => (
                                    <option key={gr} value={gr}>{gradeLabelForScale(scale, gr)}</option>
                                  ))}
                                </select>
                              </label>
                            )}
                          </div>

                          {/* Row footer */}
                          <div className="mt-2 flex items-center justify-between gap-2">
                            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                              <span>
                                Points:{" "}
                                <span className="font-semibold text-foreground">
                                  {Number.isFinite(u) && u > 0 && scale[g] !== undefined ? format2(u * scale[g]) : "—"}
                                </span>
                              </span>
                              {whatIfMode && hasWhatIf && scale[wiG] !== undefined && Number.isFinite(u) && u > 0 && (
                                <span className="font-semibold text-amber-700">
                                  What-if: {format2(u * scale[wiG])}
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => removeCourse(s.id, c.id)}
                              className="inline-flex items-center gap-1.5 rounded-2xl border px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-muted/50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Remove
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button
                        type="button"
                        onClick={() => addCourse(s.id)}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border px-4 py-3 text-sm font-semibold text-muted-foreground transition-colors hover:border-[#5B35D5]/40 hover:bg-[#EEEDFE] hover:text-[#3B24A8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B35D5] focus-visible:ring-offset-2"
                      >
                        <Plus className="h-4 w-4" />
                        Add course row
                      </button>

                      <div className="flex-1 rounded-2xl border bg-muted/50 p-3">
                        <p className="text-xs font-semibold text-foreground">Semester GPA</p>
                        <div className="mt-1 flex items-baseline gap-2 flex-wrap">
                          <p className="text-xl font-bold text-foreground">{st.unitsTotal > 0 ? format2(st.gpa) : "—"}</p>
                          {whatIfMode && wiSt.gpa !== st.gpa && wiSt.unitsTotal > 0 && (
                            <span className="text-sm font-semibold text-amber-700">/ {format2(wiSt.gpa)} what-if</span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">Units: {st.unitsTotal} • Valid: {st.validRows}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </SectionCard>

      {/* ── Target GPA Tool ─────────────────────────────────────────────────── */}
      <SectionCard>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-base font-semibold text-foreground">Target GPA tool</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Enter your current CGPA and units to estimate the GPA you need next semester.
            </p>
          </div>
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border bg-muted/50">
            <Target className="h-5 w-5" />
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {[
            { label: "Current CGPA", value: currentCgpa, set: setCurrentCgpa, placeholder: "e.g. 3.45", mode: "decimal", hint: null },
            { label: "Completed units", value: completedUnits, set: setCompletedUnits, placeholder: "e.g. 84", mode: "numeric", hint: null },
            { label: "Target CGPA", value: targetCgpa, set: setTargetCgpa, placeholder: "e.g. 4.00", mode: "decimal", hint: `Max on this scale: ${scaleMax}` },
            { label: "Next semester units", value: nextUnits, set: setNextUnits, placeholder: "e.g. 24", mode: "numeric", hint: null },
          ].map(({ label, value, set, placeholder, mode, hint }) => (
            <label key={label} className="rounded-2xl border bg-card p-3">
              <span className="text-xs font-semibold text-muted-foreground">{label}</span>
              <input
                value={value}
                onChange={(e) => set(e.target.value)}
                placeholder={placeholder}
                inputMode={mode as React.HTMLAttributes<HTMLInputElement>["inputMode"]}
                className="mt-1 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
              {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
            </label>
          ))}
        </div>

        <div className="rounded-3xl border bg-muted/50 p-4">
          <p className="text-xs font-semibold text-foreground">Required next GPA</p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {requiredGpa === null ? "—" : `${format2(clamp(requiredGpa, -99, 999))} / ${scaleMax}`}
          </p>

          {requiredStatus ? (
            <p className={cn(
              "mt-2 rounded-2xl border px-3 py-2 text-sm font-semibold",
              requiredStatus.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : requiredStatus.type === "error" ? "border-red-200 bg-red-50 text-red-900"
              : "border-border bg-card text-foreground"
            )}>
              {requiredStatus.text}
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Fill all fields with valid numbers to see the required GPA.</p>
          )}
        </div>

        {showPlanCta && (
          <Link
            href={`/study/ai-plan?currentCgpa=${encodeURIComponent(currentCgpa)}&targetCgpa=${encodeURIComponent(targetCgpa)}`}
            className={cn(
              "mt-3 flex items-center justify-between gap-3 rounded-2xl px-4 py-3.5 no-underline transition",
              "bg-[#5B35D5] hover:bg-[#4526B8]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B35D5] focus-visible:ring-offset-2"
            )}
          >
            <div className="min-w-0">
              <p className="text-sm font-extrabold text-white">
                Build a plan to reach {targetCgpa}
              </p>
              <p className="mt-0.5 text-xs text-white/65">
                AI generates a week-by-week study schedule
              </p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-white" />
          </Link>
        )}
      </SectionCard>

      {/* ── Sticky footer ──────────────────────────────────────────────────── */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 backdrop-blur">
        <div className="mx-auto max-w-5xl px-4 py-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={copySummary}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold text-foreground hover:bg-muted/50"
            >
              <Copy className="h-4 w-4" />
              Copy summary
            </button>

            <div
              className={cn(
                "inline-flex flex-none items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold",
                syncStatus === "syncing"
                  ? "border-[#5B35D5]/20 bg-[#EEEDFE] text-[#3B24A8]"
                  : syncStatus === "synced"
                  ? "border-teal-200 bg-teal-50 text-teal-800 dark:border-teal-700/40 dark:bg-teal-950/20 dark:text-teal-300"
                  : syncStatus === "offline"
                  ? "border-border bg-background text-muted-foreground"
                  : "border-border bg-background text-muted-foreground"
              )}
              role="status"
              aria-live="polite"
            >
              {syncStatus === "syncing" ? (
                <><Cloud className="h-4 w-4 animate-pulse" /> Syncing…</>
              ) : syncStatus === "synced" ? (
                <><Cloud className="h-4 w-4" /> Synced</>
              ) : syncStatus === "offline" ? (
                <><CloudOff className="h-4 w-4" /> Saved locally</>
              ) : (
                <><Calculator className="h-4 w-4" /> Saved</>
              )}
            </div>
          </div>
        </div>
      </div>

      <ImportModal
        result={importResult}
        scale={scale}
        onClose={() => setImportResult(null)}
        onImport={handleImport}
      />
    </div>
  );
}
