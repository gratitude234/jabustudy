"use client";

import { cn } from "@/lib/utils";
import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Plus, Loader2, Pencil, Check, X, Ban, Trash2, ClipboardList, CheckCircle2 } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type CourseRow = {
  id: string;
  course_code: string;
  course_title: string | null;
  level: number;
  semester: string;
  department: string | null;
  department_id: string | null;
  faculty: string | null;
  faculty_id: string | null;
  status: string;
  created_at: string;
};

type Faculty = { id: string; name: string };
type Department = { id: string; name: string; faculty_id: string; is_active?: boolean | null };
type ScopeRole = "super" | "course_rep" | "dept_librarian" | "rep" | "librarian";
type CourseSetupItem = {
  facultyId: string | null;
  departmentId: string | null;
  level: number;
  semester: string;
  courseCount: number;
  status: "in_progress" | "complete";
  completedAt: string | null;
};
type SummaryResponse = {
  scope: {
    role: ScopeRole;
    facultyId: string | null;
    departmentId: string | null;
    levels?: number[] | null;
  };
  courseSetup?: CourseSetupItem[];
};
type ParsedCourseRow = {
  course_code: string;
  course_title: string;
};

const LEVELS = [100, 200, 300, 400, 500, 600, 700];
const SEMESTERS = ["first", "second", "summer"];

// ─── Component ────────────────────────────────────────────────────────────────

export default function StudyAdminCoursesPage() {
  const router = useRouter();

  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [allDepartments, setAllDepartments] = useState<Department[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  // Filters
  const [deptFilter, setDeptFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState("");
  const [semesterFilter, setSemesterFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [summary, setSummary] = useState<SummaryResponse | null>(null);

  // Data
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Inline edit
  const [editId, setEditId] = useState<string | null>(null);
  const [editCode, setEditCode] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editDeptId, setEditDeptId] = useState("");
  const [editBusy, setEditBusy] = useState(false);

  // Add course modal
  const [showModal, setShowModal] = useState(false);
  const [newFacultyId, setNewFacultyId] = useState("");
  const [newDeptId, setNewDeptId] = useState("");
  const [newLevel, setNewLevel] = useState<number | "">("");
  const [newSemester, setNewSemester] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [addBusy, setAddBusy] = useState(false);
  const [addErr, setAddErr] = useState<string | null>(null);

  // Course setup
  const [bulkText, setBulkText] = useState("");
  const [parsedRows, setParsedRows] = useState<ParsedCourseRow[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);
  const [completeBusy, setCompleteBusy] = useState(false);

  // Departments for modal (filtered by faculty)
  const [modalDepts, setModalDepts] = useState<Department[]>([]);
  const activeDepartments = useMemo(
    () => allDepartments.filter((d) => d.is_active !== false),
    [allDepartments]
  );

  // Load faculties and departments once
  useEffect(() => {
    supabase
      .from("study_faculties")
      .select("id, name")
      .eq("is_active", true)
      .order("sort_order")
      .then(({ data }) => setFaculties((data as Faculty[]) ?? []));

    supabase
      .from("study_departments")
      .select("id, name, faculty_id, is_active")
      .order("name")
      .then(({ data }) => {
        setAllDepartments((data as Department[]) ?? []);
        setDepartments((data as Department[]) ?? []);
      });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const level = params.get("level");
    const semester = params.get("semester");
    if (level) setLevelFilter(level);
    if (semester) setSemesterFilter(semester);
  }, []);

  // Update modal depts when faculty changes
  useEffect(() => {
    setNewDeptId("");
    if (!newFacultyId) {
      setModalDepts(activeDepartments);
    } else {
      setModalDepts(activeDepartments.filter((d) => d.faculty_id === newFacultyId));
    }
  }, [newFacultyId, activeDepartments]);

  async function getToken(): Promise<string | null> {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      router.replace(`/login?next=${encodeURIComponent("/study-admin/courses")}`);
      return null;
    }
    return token;
  }

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const token = await getToken();
      if (!token) return;

      const url = new URL("/api/study-admin/courses", window.location.origin);
      if (deptFilter) url.searchParams.set("dept_id", deptFilter);
      if (levelFilter) url.searchParams.set("level", levelFilter);
      if (semesterFilter) url.searchParams.set("semester", semesterFilter);
      if (statusFilter) url.searchParams.set("status", statusFilter);
      url.searchParams.set("page", String(page));

      const [res, summaryRes] = await Promise.all([
        fetch(url.toString(), {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("/api/study-admin/summary", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      if (res.status === 401) { router.replace("/login?next=/study-admin/courses"); return; }
      if (res.status === 403) { router.replace("/study"); return; }

      const json = await res.json() as { ok: boolean; items: CourseRow[]; total: number; message?: string };
      if (!res.ok || !json.ok) throw new Error(json.message || "Failed to load");
      setCourses(json.items ?? []);
      setTotal(json.total ?? 0);

      if (summaryRes.ok) {
        const summaryJson = (await summaryRes.json()) as SummaryResponse;
        setSummary(summaryJson);
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deptFilter, levelFilter, semesterFilter, statusFilter, page]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!summary?.scope) return;
    const role = summary.scope.role === "rep" ? "course_rep" : summary.scope.role === "librarian" ? "dept_librarian" : summary.scope.role;
    if (role !== "super" && summary.scope.departmentId && !deptFilter) {
      setDeptFilter(summary.scope.departmentId);
    }
    if (role === "course_rep" && !levelFilter) {
      const firstLevel = summary.scope.levels?.[0];
      if (firstLevel) setLevelFilter(String(firstLevel));
    }
    if (!semesterFilter) setSemesterFilter("first");
  }, [deptFilter, levelFilter, semesterFilter, summary]);

  // ── Inline edit save
  async function saveEdit() {
    if (!editId) return;
    setEditBusy(true);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch("/api/study-admin/courses", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          id: editId,
          course_code: editCode,
          course_title: editTitle,
          ...(editDeptId ? { department_id: editDeptId } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.message || "Save failed");
      setEditId(null);
      setEditDeptId("");
      await load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setEditBusy(false);
    }
  }

  // ── Deactivate
  async function deactivate(id: string) {
    if (!window.confirm("Deactivate this course? It will no longer appear in course lists.")) return;
    const token = await getToken();
    if (!token) return;
    const res = await fetch("/api/study-admin/courses", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id, deactivate: true }),
    });
    const json = await res.json();
    if (!res.ok || !json.ok) { setErr(json.message || "Deactivate failed"); return; }
    await load();
  }

  // ── Delete course
  async function deleteCourse(id: string, code: string) {
    if (!window.confirm(`Delete ${code}? All materials attached to this course will also be permanently deleted. This cannot be undone.`)) return;
    const token = await getToken();
    if (!token) return;
    const res = await fetch("/api/study-admin/courses", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ course_id: id }),
    });
    const json = await res.json() as { ok: boolean; code?: string; message?: string };
    if (!res.ok || !json.ok) {
      setErr(json.message || "Delete failed");
      return;
    }
    setCourses((prev) => prev.filter((c) => c.id !== id));
    setTotal((prev) => prev - 1);
  }

  // ── Add course
  async function addCourse() {
    setAddErr(null);
    if (!newCode.trim() || !newLevel || !newSemester || !newDeptId) {
      setAddErr("Course code, level, semester, and department are required.");
      return;
    }
    setAddBusy(true);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch("/api/study-admin/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          course_code: newCode.trim(),
          course_title: newTitle.trim() || null,
          level: newLevel,
          semester: newSemester,
          department_id: newDeptId,
          faculty_id: newFacultyId || null,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.message || "Add failed");
      setShowModal(false);
      resetModal();
      await load();
    } catch (e: unknown) {
      setAddErr(e instanceof Error ? e.message : "Add failed");
    } finally {
      setAddBusy(false);
    }
  }

  function resetModal() {
    setNewFacultyId(""); setNewDeptId(""); setNewLevel(""); setNewSemester("");
    setNewCode(""); setNewTitle(""); setAddErr(null);
  }

  const totalPages = Math.max(1, Math.ceil(total / 50));

  function departmentLabel(departmentId: string | null, fallback?: string | null) {
    const dept = allDepartments.find((d) => d.id === departmentId);
    const name = dept?.name ?? fallback ?? "Unassigned";
    return dept?.is_active === false ? `${name} (inactive)` : name;
  }

  function moveOptions(courseDepartmentId: string | null) {
    return allDepartments.filter((d) => d.is_active !== false || d.id === courseDepartmentId);
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  const normalizedRole = summary?.scope.role === "rep"
    ? "course_rep"
    : summary?.scope.role === "librarian"
      ? "dept_librarian"
      : summary?.scope.role;
  const setupDepartmentId = deptFilter || summary?.scope.departmentId || "";
  const setupLevel = Number(levelFilter || 0);
  const setupSemester = semesterFilter || "";
  const selectedSetup = (summary?.courseSetup ?? []).find(
    (item) => item.departmentId === setupDepartmentId && item.level === setupLevel && item.semester === setupSemester
  );
  const canUseSetupActions = Boolean(setupDepartmentId && setupLevel && setupSemester);
  const scopedLevels =
    normalizedRole === "course_rep" && summary?.scope.levels?.length
      ? summary.scope.levels
      : LEVELS;

  function normalizeCourseCodeForSetup(value: string) {
    const raw = value.trim().toUpperCase().replace(/\s+/g, " ");
    const match = raw.match(/^([A-Z]{2,8})\s*([0-9]{2,4}[A-Z]?)$/);
    return match ? `${match[1]} ${match[2]}` : raw;
  }

  function parseCourseLine(line: string): ParsedCourseRow | null {
    const raw = line.trim();
    if (!raw) return null;

    const dashParts = raw.split(/\s+-\s+/);
    if (dashParts.length >= 2) {
      const code = dashParts.shift() ?? "";
      return { course_code: normalizeCourseCodeForSetup(code), course_title: dashParts.join(" - ").trim() };
    }

    const match = raw.match(/^([A-Za-z]{2,8})\s*([0-9]{2,4}[A-Za-z]?)(?:\s+(.+))?$/);
    if (match) {
      return {
        course_code: `${match[1].toUpperCase()} ${match[2].toUpperCase()}`,
        course_title: (match[3] ?? "").trim(),
      };
    }

    const [first, ...rest] = raw.split(/\s+/);
    return first ? { course_code: normalizeCourseCodeForSetup(first), course_title: rest.join(" ").trim() } : null;
  }

  function parseBulkCourses() {
    const rows = bulkText
      .split(/\r?\n/)
      .map(parseCourseLine)
      .filter((row): row is ParsedCourseRow => Boolean(row?.course_code));
    setParsedRows(rows);
    setBulkMessage(rows.length ? `${rows.length} course row${rows.length === 1 ? "" : "s"} parsed. Review before saving.` : "No valid course rows found.");
  }

  function updateParsedRow(index: number, updates: Partial<ParsedCourseRow>) {
    setParsedRows((prev) => prev.map((row, i) => i === index ? { ...row, ...updates } : row));
  }

  function removeParsedRow(index: number) {
    setParsedRows((prev) => prev.filter((_, i) => i !== index));
  }

  async function saveBulkCourses() {
    if (!canUseSetupActions) {
      setBulkMessage("Select department, level and semester first.");
      return;
    }
    const rows = parsedRows.filter((row) => row.course_code.trim());
    if (!rows.length) {
      setBulkMessage("Parse at least one valid course first.");
      return;
    }

    setBulkBusy(true);
    setBulkMessage(null);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch("/api/study-admin/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          mode: "bulk",
          department_id: setupDepartmentId,
          level: setupLevel,
          semester: setupSemester,
          courses: rows.map((row) => ({
            course_code: normalizeCourseCodeForSetup(row.course_code),
            course_title: row.course_title.trim() || null,
          })),
        }),
      });
      const json = await res.json() as {
        ok: boolean;
        created?: CourseRow[];
        skipped?: Array<{ course_code: string; reason: string }>;
        message?: string;
      };
      if (!res.ok || !json.ok) throw new Error(json.message || "Bulk save failed");

      const created = json.created?.length ?? 0;
      const skipped = json.skipped?.length ?? 0;
      setBulkMessage(`${created} created${skipped ? `, ${skipped} skipped` : ""}.`);
      setParsedRows([]);
      setBulkText("");
      await load();
    } catch (e: unknown) {
      setBulkMessage(e instanceof Error ? e.message : "Bulk save failed");
    } finally {
      setBulkBusy(false);
    }
  }

  async function markSetupComplete() {
    if (!canUseSetupActions) return;
    setCompleteBusy(true);
    setBulkMessage(null);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch("/api/study-admin/course-setup/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          department_id: setupDepartmentId,
          level: setupLevel,
          semester: setupSemester,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.message || "Could not mark setup complete.");
      setBulkMessage("Course list marked complete.");
      await load();
    } catch (e: unknown) {
      setBulkMessage(e instanceof Error ? e.message : "Could not mark setup complete.");
    } finally {
      setCompleteBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-3xl border bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Courses</h1>
            <p className="mt-1 text-sm text-zinc-600">Manage all courses in the study hub.</p>
          </div>
          <button
            type="button"
            onClick={() => { resetModal(); setShowModal(true); }}
            className="inline-flex h-10 items-center gap-2 rounded-2xl bg-black px-4 text-sm font-medium text-white hover:bg-zinc-800"
          >
            <Plus className="h-4 w-4" /> Add Course
          </button>
        </div>
      </div>

      <div className="rounded-3xl border border-violet-200 bg-violet-50 p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-violet-800">
              <ClipboardList className="h-3.5 w-3.5" />
              Course setup
            </div>
            <h2 className="mt-3 text-lg font-semibold tracking-tight text-violet-950">Build the course list for this class</h2>
            <p className="mt-1 max-w-2xl text-sm text-violet-800">
              Paste the courses your classmates offer, review the parsed rows, then mark the list complete when it looks right.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <span className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold",
              selectedSetup?.status === "complete"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-amber-200 bg-amber-50 text-amber-800"
            )}>
              {selectedSetup?.status === "complete" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <ClipboardList className="h-3.5 w-3.5" />}
              {selectedSetup?.status === "complete" ? "Complete" : "In progress"}
            </span>
            <button
              type="button"
              onClick={markSetupComplete}
              disabled={!canUseSetupActions || completeBusy}
              className="inline-flex h-9 items-center gap-2 rounded-2xl bg-violet-700 px-4 text-sm font-medium text-white hover:bg-violet-800 disabled:opacity-50"
            >
              {completeBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Mark complete
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1.1fr]">
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-semibold text-violet-800">Level</span>
                <select
                  className="mt-1 h-10 w-full rounded-2xl border border-violet-200 bg-white px-3 text-sm"
                  value={levelFilter}
                  onChange={(e) => { setLevelFilter(e.target.value); setPage(1); }}
                >
                  <option value="">Select level</option>
                  {scopedLevels.map((l) => <option key={l} value={l}>{l}L</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-violet-800">Semester</span>
                <select
                  className="mt-1 h-10 w-full rounded-2xl border border-violet-200 bg-white px-3 text-sm"
                  value={semesterFilter}
                  onChange={(e) => { setSemesterFilter(e.target.value); setPage(1); }}
                >
                  <option value="">Select semester</option>
                  {SEMESTERS.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
                </select>
              </label>
            </div>
            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              rows={8}
              placeholder={"CSC 201 - Data Structures\nGST111 Communication in English\nMTH 203"}
              className="w-full rounded-2xl border border-violet-200 bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-violet-300"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={parseBulkCourses}
                className="inline-flex h-10 items-center gap-2 rounded-2xl border border-violet-200 bg-white px-4 text-sm font-medium text-violet-900 hover:bg-violet-100"
              >
                Parse courses
              </button>
              <button
                type="button"
                onClick={saveBulkCourses}
                disabled={!canUseSetupActions || parsedRows.length === 0 || bulkBusy}
                className="inline-flex h-10 items-center gap-2 rounded-2xl bg-black px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
              >
                {bulkBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Save parsed rows
              </button>
            </div>
            {bulkMessage ? <p className="text-sm font-medium text-violet-800">{bulkMessage}</p> : null}
          </div>

          <div className="rounded-2xl border border-violet-200 bg-white p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-zinc-900">Parsed rows</p>
              <p className="text-xs text-zinc-500">{parsedRows.length} row{parsedRows.length === 1 ? "" : "s"}</p>
            </div>
            {parsedRows.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-200 p-6 text-center text-sm text-zinc-500">
                Paste courses and click Parse courses.
              </div>
            ) : (
              <div className="max-h-72 space-y-2 overflow-auto pr-1">
                {parsedRows.map((row, index) => (
                  <div key={`${row.course_code}-${index}`} className="grid gap-2 rounded-2xl border border-zinc-200 p-2 sm:grid-cols-[120px_1fr_auto]">
                    <input
                      value={row.course_code}
                      onChange={(e) => updateParsedRow(index, { course_code: e.target.value })}
                      onBlur={() => updateParsedRow(index, { course_code: normalizeCourseCodeForSetup(row.course_code) })}
                      className="h-9 rounded-xl border px-2 text-sm font-mono"
                    />
                    <input
                      value={row.course_title}
                      onChange={(e) => updateParsedRow(index, { course_title: e.target.value })}
                      placeholder="Course title"
                      className="h-9 rounded-xl border px-2 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => removeParsedRow(index)}
                      className="inline-flex h-9 items-center justify-center rounded-xl border px-3 text-xs text-red-700 hover:bg-red-50"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-3xl border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-500">Department</label>
            <select
              className="h-9 rounded-2xl border bg-white px-3 text-sm"
              value={deptFilter}
              onChange={(e) => { setDeptFilter(e.target.value); setPage(1); }}
            >
              <option value="">All</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}{d.is_active === false ? " (inactive)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-500">Level</label>
            <select
              className="h-9 rounded-2xl border bg-white px-3 text-sm"
              value={levelFilter}
              onChange={(e) => { setLevelFilter(e.target.value); setPage(1); }}
            >
              <option value="">All</option>
              {scopedLevels.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-500">Semester</label>
            <select
              className="h-9 rounded-2xl border bg-white px-3 text-sm"
              value={semesterFilter}
              onChange={(e) => { setSemesterFilter(e.target.value); setPage(1); }}
            >
              <option value="">All</option>
              {SEMESTERS.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-500">Status</label>
            <select
              className="h-9 rounded-2xl border bg-white px-3 text-sm"
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            >
              <option value="">All</option>
              <option value="approved">Approved</option>
              <option value="pending">Pending</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <button onClick={load} className="h-9 rounded-2xl bg-black px-4 text-sm font-medium text-white">Refresh</button>
        </div>
      </div>

      {err && <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{err}</div>}

      {/* Table */}
      <div className="rounded-3xl border bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center gap-2 p-8 text-sm text-zinc-600">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : courses.length === 0 ? (
          <div className="p-8 text-center text-sm text-zinc-500">No courses found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-zinc-50 text-left text-xs text-zinc-500">
                  <th className="px-4 py-3 font-medium">Code</th>
                  <th className="px-4 py-3 font-medium">Title</th>
                  <th className="px-4 py-3 font-medium">Level</th>
                  <th className="px-4 py-3 font-medium">Semester</th>
                  <th className="px-4 py-3 font-medium">Department</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {courses.map((c) => (
                  <tr key={c.id} className="hover:bg-zinc-50/50">
                    <td className="px-4 py-3">
                      {editId === c.id ? (
                        <input
                          className="h-8 w-28 rounded-xl border px-2 text-sm font-mono"
                          value={editCode}
                          onChange={(e) => setEditCode(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditId(null); }}
                          autoFocus
                        />
                      ) : (
                        <span className="font-mono font-medium text-zinc-900">{c.course_code}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editId === c.id ? (
                        <input
                          className="h-8 w-48 rounded-xl border px-2 text-sm"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditId(null); }}
                          placeholder="Course title…"
                        />
                      ) : (
                        <span className="text-zinc-700">{c.course_title ?? "—"}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-600">{c.level}</td>
                    <td className="px-4 py-3 text-zinc-600 capitalize">{c.semester}</td>
                    <td className="px-4 py-3">
                      {editId === c.id ? (
                        <select
                          className="h-8 max-w-[260px] rounded-xl border px-2 text-sm"
                          value={editDeptId}
                          onChange={(e) => setEditDeptId(e.target.value)}
                        >
                          <option value="">Select department...</option>
                          {moveOptions(c.department_id).map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name}{d.is_active === false ? " (inactive)" : ""}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-zinc-700">{departmentLabel(c.department_id, c.department)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        c.status === "approved" ? "bg-emerald-50 text-emerald-700" :
                        c.status === "rejected" ? "bg-red-50 text-red-700" :
                        "bg-amber-50 text-amber-700"
                      )}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {editId === c.id ? (
                          <>
                            <button
                              type="button"
                              disabled={editBusy}
                              onClick={saveEdit}
                              className="inline-flex h-7 items-center gap-1 rounded-xl bg-emerald-600 px-3 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                            >
                              {editBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Save
                            </button>
                            <button
                              type="button"
                              onClick={() => { setEditId(null); setEditDeptId(""); }}
                              className="inline-flex h-7 items-center gap-1 rounded-xl border px-3 text-xs"
                            >
                              <X className="h-3 w-3" /> Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => { setEditId(c.id); setEditCode(c.course_code); setEditTitle(c.course_title ?? ""); setEditDeptId(c.department_id ?? ""); }}
                              className="inline-flex h-7 items-center gap-1 rounded-xl border px-3 text-xs hover:bg-zinc-50"
                            >
                              <Pencil className="h-3 w-3" /> Edit
                            </button>
                            {c.status !== "rejected" && (
                              <button
                                type="button"
                                onClick={() => deactivate(c.id)}
                                className="inline-flex h-7 items-center gap-1 rounded-xl border border-red-200 bg-red-50 px-3 text-xs text-red-700 hover:bg-red-100"
                              >
                                <Ban className="h-3 w-3" /> Deactivate
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => deleteCourse(c.id, c.course_code)}
                              className="inline-flex h-7 items-center gap-1 rounded-xl border border-red-300 bg-red-50 px-3 text-xs text-red-800 hover:bg-red-100"
                            >
                              <Trash2 className="h-3 w-3" /> Delete
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-sm text-zinc-500">Page {page} of {totalPages} ({total} total)</p>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="h-8 rounded-2xl border px-3 text-xs disabled:opacity-40"
              >Prev</button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="h-8 rounded-2xl border px-3 text-xs disabled:opacity-40"
              >Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Add course modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-3xl border bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Add Course</h2>
              <button type="button" onClick={() => { setShowModal(false); resetModal(); }} className="text-zinc-400 hover:text-zinc-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-zinc-700">Faculty</label>
                <select
                  className="h-10 rounded-2xl border bg-white px-3 text-sm"
                  value={newFacultyId}
                  onChange={(e) => setNewFacultyId(e.target.value)}
                >
                  <option value="">All faculties</option>
                  {faculties.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-zinc-700">Department <span className="text-red-500">*</span></label>
                <select
                  className="h-10 rounded-2xl border bg-white px-3 text-sm"
                  value={newDeptId}
                  onChange={(e) => setNewDeptId(e.target.value)}
                >
                  <option value="">Select department…</option>
                  {modalDepts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-zinc-700">Level <span className="text-red-500">*</span></label>
                  <select
                    className="h-10 rounded-2xl border bg-white px-3 text-sm"
                    value={newLevel}
                    onChange={(e) => setNewLevel(e.target.value ? Number(e.target.value) : "")}
                  >
                    <option value="">Select…</option>
                    {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-zinc-700">Semester <span className="text-red-500">*</span></label>
                  <select
                    className="h-10 rounded-2xl border bg-white px-3 text-sm"
                    value={newSemester}
                    onChange={(e) => setNewSemester(e.target.value)}
                  >
                    <option value="">Select…</option>
                    {SEMESTERS.map((s) => <option key={s} value={s} className="capitalize">{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-zinc-700">Course Code <span className="text-red-500">*</span></label>
                <input
                  className="h-10 rounded-2xl border bg-white px-3 text-sm font-mono uppercase"
                  placeholder="e.g. CSC301"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-zinc-700">Course Title</label>
                <input
                  className="h-10 rounded-2xl border bg-white px-3 text-sm"
                  placeholder="e.g. Data Structures and Algorithms"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
              </div>

              {addErr && <p className="text-sm text-red-600">{addErr}</p>}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setShowModal(false); resetModal(); }}
                className="h-10 rounded-2xl border px-4 text-sm text-zinc-600 hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={addBusy}
                onClick={addCourse}
                className="inline-flex h-10 items-center gap-2 rounded-2xl bg-black px-5 text-sm font-medium text-white disabled:opacity-50 hover:bg-zinc-800"
              >
                {addBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Add Course
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
