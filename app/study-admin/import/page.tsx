"use client";

import React, { useState, useCallback } from "react";
import { Card, PageHeader } from "@/app/study/_components/StudyUI";

const STEPS = ["paste", "meta", "preview", "sql"] as const;
type Step = typeof STEPS[number];

const STEP_LABELS = {
  paste: "01 — Paste Text",
  meta: "02 — Set Details",
  preview: "03 — Review Questions",
  sql: "04 — Get SQL",
};

const LEVELS = ["100", "200", "300", "400", "500", "600"];
const SEMESTERS = ["first", "second", "summer"];
const DIFFICULTIES = ["easy", "medium", "hard"];

function genUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function StepIndicator({ current }: { current: Step }) {
  return (
    <div className="flex gap-0 mb-8">
      {STEPS.map((s, i) => {
        const done = STEPS.indexOf(current) > i;
        const active = current === s;
        return (
          <div key={s} className="flex items-center flex-1">
            <div className="flex-1 flex flex-col items-center gap-1.5">
              <div className={[
                "w-7 h-7 rounded-full border-2 flex items-center justify-center text-[11px] font-bold transition-all",
                done ? "bg-emerald-500 border-emerald-500 text-white" : active ? "bg-white border-zinc-900 text-zinc-900" : "bg-zinc-100 border-zinc-200 text-zinc-400",
              ].join(" ")}>
                {done ? "✓" : i + 1}
              </div>
              <span className={[
                "text-[10px] font-semibold text-center leading-tight tracking-wide",
                active ? "text-zinc-900" : done ? "text-emerald-600" : "text-zinc-400",
              ].join(" ")}>
                {STEP_LABELS[s].split("—")[1].trim()}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={["h-px w-6 shrink-0 mb-5", done ? "bg-emerald-500" : "bg-zinc-200"].join(" ")} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function Btn({ children, onClick, variant = "primary", disabled }: { children: React.ReactNode; onClick?: () => void; variant?: "primary" | "ghost" | "danger"; disabled?: boolean }) {
  const base = "px-4 py-3 rounded-2xl text-sm font-semibold transition-all disabled:opacity-45 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-black text-white hover:bg-zinc-800",
    ghost: "border bg-white text-zinc-600 hover:bg-zinc-50",
    danger: "border border-red-200 bg-red-50 text-red-600 hover:bg-red-100",
  };
  return (
    <button onClick={onClick} disabled={disabled} className={[base, variants[variant]].join(" ")}>
      {children}
    </button>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-semibold text-zinc-500 tracking-widest uppercase mb-1.5">
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = "text" }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-2xl border bg-white px-4 py-3 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-400"
    />
  );
}

function Select({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: string[]; placeholder?: string }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full rounded-2xl border bg-white px-4 py-3 text-sm text-zinc-900 outline-none appearance-none cursor-pointer focus:border-zinc-400"
    >
      <option value="" disabled>{placeholder}</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

// ─── Step 1: Paste ─────────────────────────────────────────────────────────────

function StepPaste({ text, setText, onNext }: { text: string; setText: (v: string) => void; onNext: () => void }) {
  return (
    <div>
      <h2 className="text-lg font-bold text-zinc-900 mb-1.5">Paste your document text</h2>
      <p className="text-sm text-zinc-500 mb-5 leading-relaxed">
        Copy all text from your Word/PDF file and paste it below. Include question numbers, options (A–D), and correct answers if marked.
      </p>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder={"Example:\n\n1. What is the powerhouse of the cell?\nA. Nucleus\nB. Mitochondria\nC. Ribosome\nD. Golgi body\nAnswer: B\n\n2. Which gas do plants absorb?\n..."}
        className="w-full min-h-[320px] rounded-2xl border bg-white px-4 py-3 text-sm text-zinc-800 outline-none resize-y leading-relaxed placeholder:text-zinc-400 focus:border-zinc-400"
      />
      <div className="flex justify-between items-center mt-3">
        <span className="text-xs text-zinc-400">
          {text.trim().split(/\n/).length} lines · {text.length} chars
        </span>
        <Btn onClick={onNext} disabled={text.trim().length < 20}>Continue →</Btn>
      </div>
    </div>
  );
}

// ─── Step 2: Meta ──────────────────────────────────────────────────────────────

type MetaState = { title: string; course_code: string; level: string; semester: string; difficulty: string; time_limit: string; description: string };
function StepMeta({ meta, setMeta, onNext, onBack }: { meta: MetaState; setMeta: React.Dispatch<React.SetStateAction<MetaState>>; onNext: () => void; onBack: () => void }) {
  const set = (k: keyof MetaState, v: string) => setMeta(m => ({ ...m, [k]: v }));
  const valid = meta.title.trim() && meta.course_code.trim();
  return (
    <div>
      <h2 className="text-lg font-bold text-zinc-900 mb-1.5">Quiz set details</h2>
      <p className="text-sm text-zinc-500 mb-6 leading-relaxed">
        These go into <code className="rounded bg-zinc-100 px-1 text-zinc-700">study_quiz_sets</code>. Title and course code are required.
      </p>
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label>Quiz Set Title *</Label>
          <Input value={meta.title} onChange={v => set("title", v)} placeholder="e.g. BCH 201 — First Semester Objectives" />
        </div>
        <div>
          <Label>Course Code *</Label>
          <Input value={meta.course_code} onChange={v => set("course_code", v)} placeholder="e.g. BCH201" />
        </div>
        <div>
          <Label>Level</Label>
          <Select value={meta.level} onChange={v => set("level", v)} options={LEVELS} placeholder="Select level" />
        </div>
        <div>
          <Label>Semester</Label>
          <Select value={meta.semester} onChange={v => set("semester", v)} options={SEMESTERS} placeholder="Select semester" />
        </div>
        <div>
          <Label>Difficulty</Label>
          <Select value={meta.difficulty} onChange={v => set("difficulty", v)} options={DIFFICULTIES} placeholder="Select difficulty" />
        </div>
        <div>
          <Label>Time Limit (minutes)</Label>
          <Input type="number" value={meta.time_limit} onChange={v => set("time_limit", v)} placeholder="e.g. 30 (optional)" />
        </div>
        <div className="col-span-2">
          <Label>Description (optional)</Label>
          <Input value={meta.description} onChange={v => set("description", v)} placeholder="Brief description of this set" />
        </div>
      </div>
      <div className="flex gap-2.5 justify-end mt-6">
        <Btn onClick={onBack} variant="ghost">← Back</Btn>
        <Btn onClick={onNext} disabled={!valid}>Parse Questions →</Btn>
      </div>
    </div>
  );
}

// ─── Step 3: Preview ───────────────────────────────────────────────────────────

type QuestionOption = { text: string; is_correct: boolean };
type Question = { prompt: string; options: QuestionOption[]; explanation?: string };
function QuestionCard({ q, idx, onChange, onDelete }: { q: Question; idx: number; onChange: (q: Question) => void; onDelete: () => void }) {
  const setField = (k: keyof Question, v: string) => onChange({ ...q, [k]: v });
  const setOption = (oi: number, k: keyof QuestionOption, v: string | boolean) => {
    const opts = q.options.map((o, i) => i === oi ? { ...o, [k]: v } : o);
    onChange({ ...q, options: opts });
  };
  const setCorrect = (oi: number) => {
    const opts = q.options.map((o, i) => ({ ...o, is_correct: i === oi }));
    onChange({ ...q, options: opts });
  };

  return (
    <div className="rounded-2xl border bg-zinc-50 p-4 mb-3">
      <div className="flex justify-between items-start gap-2.5 mb-3">
        <span className="text-[11px] font-semibold rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-emerald-700">
          Q{idx + 1}
        </span>
        <button
          onClick={onDelete}
          className="text-zinc-400 hover:text-red-500 transition-colors text-base leading-none bg-transparent border-0 cursor-pointer"
        >
          ×
        </button>
      </div>
      <textarea
        value={q.prompt}
        onChange={e => setField("prompt", e.target.value)}
        className="w-full rounded-2xl border bg-white px-4 py-3 text-sm text-zinc-800 resize-y outline-none leading-relaxed focus:border-zinc-400"
      />
      <div className="mt-2.5 flex flex-col gap-1.5">
        {q.options.map((opt, oi) => (
          <div key={oi} className="flex gap-2 items-center">
            <button
              onClick={() => setCorrect(oi)}
              title="Mark as correct"
              className={[
                "w-5 h-5 rounded-full border-2 cursor-pointer shrink-0 transition-colors",
                opt.is_correct ? "border-emerald-500 bg-emerald-500" : "border-zinc-300 bg-transparent hover:border-emerald-400",
              ].join(" ")}
            />
            <span className="text-[11px] font-semibold text-zinc-400 w-4">
              {String.fromCharCode(65 + oi)}.
            </span>
            <input
              value={opt.text}
              onChange={e => setOption(oi, "text", e.target.value)}
              className={[
                "flex-1 rounded-xl border px-3 py-1.5 text-sm outline-none focus:border-zinc-400",
                opt.is_correct ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-zinc-200 bg-white text-zinc-800",
              ].join(" ")}
            />
          </div>
        ))}
      </div>
      {q.explanation && (
        <div className="mt-2.5">
          <Label>Explanation</Label>
          <input
            value={q.explanation || ""}
            onChange={e => setField("explanation", e.target.value)}
            className="w-full rounded-2xl border bg-white px-4 py-2.5 text-sm text-zinc-600 outline-none focus:border-zinc-400"
          />
        </div>
      )}
    </div>
  );
}

function StepPreview({ questions, setQuestions, onNext, onBack, parsing }: { questions: Question[]; setQuestions: React.Dispatch<React.SetStateAction<Question[]>>; onNext: () => void; onBack: () => void; parsing: boolean }) {
  const update = useCallback((i: number, q: Question) => {
    setQuestions(qs => qs.map((x, j) => j === i ? q : x));
  }, [setQuestions]);
  const del = (i: number) => setQuestions(qs => qs.filter((_, j) => j !== i));

  const issues = questions.filter(q => !q.options.some(o => o.is_correct)).length;

  return (
    <div>
      <div className="flex justify-between items-start mb-5">
        <div>
          <h2 className="text-lg font-bold text-zinc-900 mb-1">
            Review {questions.length} questions
          </h2>
          <p className="text-sm text-zinc-500">Click the circle to mark the correct answer. Edit any text inline.</p>
        </div>
        {issues > 0 && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
            ⚠ {issues} question{issues > 1 ? "s" : ""} missing correct answer
          </div>
        )}
      </div>
      {parsing ? (
        <div className="text-center py-16 text-zinc-500 text-sm">
          <div className="text-3xl mb-3">⟳</div>
          Parsing your questions with AI...
        </div>
      ) : (
        <div className="max-h-[480px] overflow-y-auto pr-1">
          {questions.map((q, i) => (
            <QuestionCard key={i} q={q} idx={i} onChange={q => update(i, q)} onDelete={() => del(i)} />
          ))}
        </div>
      )}
      <div className="flex gap-2.5 justify-end mt-5">
        <Btn onClick={onBack} variant="ghost">← Back</Btn>
        <Btn onClick={onNext} disabled={parsing || questions.length === 0 || issues > 0}>Generate SQL →</Btn>
      </div>
    </div>
  );
}

// ─── Step 4: SQL ───────────────────────────────────────────────────────────────

function StepSQL({ sql, onBack }: { sql: string; onBack: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(sql).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div>
      <h2 className="text-lg font-bold text-zinc-900 mb-1.5">Your SQL is ready</h2>
      <p className="text-sm text-zinc-500 mb-4 leading-relaxed">
        Go to your Supabase dashboard → <strong className="text-zinc-700">SQL Editor</strong> → paste and run.
      </p>
      <div className="relative">
        <pre className="rounded-2xl border bg-zinc-50 p-4 text-xs text-zinc-700 leading-relaxed overflow-x-auto max-h-[400px] overflow-y-auto whitespace-pre-wrap break-all">
          {sql}
        </pre>
        <button
          onClick={copy}
          className={[
            "absolute top-2.5 right-2.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer",
            copied ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100",
          ].join(" ")}
        >
          {copied ? "✓ Copied" : "Copy"}
        </button>
      </div>
      <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5">
        <p className="m-0 text-xs text-emerald-700 leading-relaxed">
          💡 The set is inserted with <strong>published = false</strong>. After running, go to your admin panel → Study → Quiz Sets to review and publish it.
        </p>
      </div>
      <div className="flex gap-2.5 justify-end mt-5">
        <Btn onClick={onBack} variant="ghost">← Back to Edit</Btn>
      </div>
    </div>
  );
}

// ─── SQL Generator ─────────────────────────────────────────────────────────────

function buildSQL(meta: MetaState, questions: Question[]) {
  const setId = genUUID();
  const now = new Date().toISOString();
  const esc = (s: string) => (s || "").replace(/'/g, "''");

  const lines: string[] = [];
  lines.push(`-- ============================================================`);
  lines.push(`-- Jabumarket Quiz Import`);
  lines.push(`-- Generated: ${now}`);
  lines.push(`-- Set: ${meta.title}`);
  lines.push(`-- Questions: ${questions.length}`);
  lines.push(`-- ============================================================`);
  lines.push(``);
  lines.push(`BEGIN;`);
  lines.push(``);

  // Insert set
  lines.push(`-- 1. Quiz Set`);
  lines.push(`INSERT INTO public.study_quiz_sets (id, title, description, course_code, level, semester, difficulty, time_limit_minutes, questions_count, published, created_at)`);
  lines.push(`VALUES (`);
  lines.push(`  '${setId}',`);
  lines.push(`  '${esc(meta.title)}',`);
  lines.push(`  ${meta.description ? `'${esc(meta.description)}'` : "NULL"},`);
  lines.push(`  '${esc(meta.course_code)}',`);
  lines.push(`  ${meta.level ? `'${meta.level}'` : "NULL"},`);
  lines.push(`  ${meta.semester ? `'${meta.semester}'` : "NULL"},`);
  lines.push(`  ${meta.difficulty ? `'${meta.difficulty}'` : "NULL"},`);
  lines.push(`  ${meta.time_limit ? parseInt(meta.time_limit) : "NULL"},`);
  lines.push(`  ${questions.length},`);
  lines.push(`  false,`);
  lines.push(`  now()`);
  lines.push(`);`);
  lines.push(``);
  lines.push(`-- 2. Questions + Options`);

  questions.forEach((q, qi) => {
    const qId = genUUID();
    lines.push(``);
    lines.push(`-- Q${qi + 1}: ${q.prompt.substring(0, 50)}...`);
    lines.push(`INSERT INTO public.study_quiz_questions (id, set_id, prompt, explanation, position, created_at)`);
    lines.push(`VALUES ('${qId}', '${setId}', '${esc(q.prompt)}', ${q.explanation ? `'${esc(q.explanation)}'` : "NULL"}, ${qi}, now());`);

    q.options.forEach((opt, oi) => {
      const oId = genUUID();
      lines.push(`INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position)`);
      lines.push(`VALUES ('${oId}', '${qId}', '${esc(opt.text)}', ${opt.is_correct}, ${oi});`);
    });
  });

  lines.push(``);
  lines.push(`COMMIT;`);
  return lines.join("\n");
}

// ─── Main App ──────────────────────────────────────────────────────────────────

export default function MCQImporter() {
  const [step, setStep] = useState<Step>("paste");
  const [text, setText] = useState("");
  const [meta, setMeta] = useState({ title: "", course_code: "", level: "", semester: "", difficulty: "", time_limit: "", description: "" });
  const [questions, setQuestions] = useState<Question[]>([]);
  const [sql, setSQL] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState("");

  const parseWithAI = async () => {
    setParsing(true);
    setParseError("");
    setStep("preview");
    try {
      const response = await fetch("/api/ai/parse-mcq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Parse failed");
      setQuestions(data.questions);
    } catch (e) {
      setParseError("Parsing failed: " + (e instanceof Error ? e.message : String(e)));
      setStep("meta");
    } finally {
      setParsing(false);
    }
  };

  const generateSQL = () => {
    const generatedSQL = buildSQL(meta, questions);
    setSQL(generatedSQL);
    setStep("sql");
  };

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 pb-24">
      <PageHeader
        title="MCQ Import Tool"
        subtitle="Paste → Parse → Review → Deploy to Supabase"
      />

      <Card>
        <StepIndicator current={step} />

        {parseError && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mb-5">
            {parseError}
          </div>
        )}
        {step === "paste" && (
          <StepPaste text={text} setText={setText} onNext={() => setStep("meta")} />
        )}
        {step === "meta" && (
          <StepMeta meta={meta} setMeta={setMeta} onNext={parseWithAI} onBack={() => setStep("paste")} />
        )}
        {step === "preview" && (
          <StepPreview questions={questions} setQuestions={setQuestions} onNext={generateSQL} onBack={() => setStep("meta")} parsing={parsing} />
        )}
        {step === "sql" && (
          <StepSQL sql={sql} onBack={() => setStep("preview")} />
        )}
      </Card>

      <p className="text-center text-xs text-zinc-400">
        Jabumarket internal tooling · questions are inserted as unpublished
      </p>
    </div>
  );
}