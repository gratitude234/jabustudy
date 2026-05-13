"use client";

import { cn } from "@/lib/utils";
import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Upload, X, CheckCircle2, AlertCircle, Loader2, FileText } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Faculty = { id: string; name: string };
type Department = { id: string; name: string; faculty_id: string };
type Course = { id: string; course_code: string; course_title: string | null };

type InlineCourseForm = {
  code: string;
  title: string;
  busy: boolean;
  err: string | null;
};

type MaterialType = "past_question" | "handout" | "slides" | "note" | "timetable" | "other";
type FileStatus = "pending" | "uploading" | "done" | "error";

type FileEntry = {
  id: string;
  file: File;
  status: FileStatus;
  error?: string;
  material_id?: string;
};

const LEVELS = [100, 200, 300, 400, 500, 600, 700];
const SEMESTERS = ["first", "second", "summer"] as const;
const MATERIAL_TYPES: { value: MaterialType; label: string }[] = [
  { value: "past_question", label: "Past Question" },
  { value: "handout", label: "Handout" },
  { value: "slides", label: "Slides" },
  { value: "note", label: "Note" },
  { value: "timetable", label: "Timetable" },
  { value: "other", label: "Other" },
];
const ACCEPT = ".pdf,.docx,.pptx,.png,.jpg,.jpeg,.zip";
const MAX_SIZE_MB = 50;
const MAX_FILES = 20;
const CONCURRENCY = 3;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function UploadClient() {
  const router = useRouter();

  // Dropdowns
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);

  // Form state
  const [facultyId, setFacultyId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [level, setLevel] = useState<number | "">("");
  const [semester, setSemester] = useState("");
  const [courseId, setCourseId] = useState("");
  const [showInlineCourse, setShowInlineCourse] = useState(false);
  const [inlineCourse, setInlineCourse] = useState<InlineCourseForm>({ code: "", title: "", busy: false, err: null });
  const [materialType, setMaterialType] = useState<MaterialType | "">("");
  const [session, setSession] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  // Files
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [summary, setSummary] = useState<{ done: number; failed: number } | null>(null);
  const [formErr, setFormErr] = useState<string | null>(null);

  // ── Load faculties on mount
  useEffect(() => {
    supabase
      .from("study_faculties")
      .select("id, name")
      .eq("is_active", true)
      .order("sort_order")
      .then(({ data }) => setFaculties((data as Faculty[]) ?? []));
  }, []);

  // ── Load departments when faculty changes
  useEffect(() => {
    setDepartmentId("");
    setCourseId("");
    setDepartments([]);
    if (!facultyId) return;
    supabase
      .from("study_departments")
      .select("id, name, faculty_id")
      .eq("faculty_id", facultyId)
      .eq("is_active", true)
      .order("sort_order")
      .then(({ data }) => setDepartments((data as Department[]) ?? []));
  }, [facultyId]);

  // ── Load courses when dept+level+semester change
  useEffect(() => {
    setCourseId("");
    setCourses([]);
    setShowInlineCourse(false);
    setInlineCourse({ code: "", title: "", busy: false, err: null });
    if (!departmentId || !level || !semester) return;
    supabase
      .from("study_courses")
      .select("id, course_code, course_title")
      .eq("department_id", departmentId)
      .eq("level", level)
      .eq("semester", semester)
      .eq("status", "approved")
      .order("course_code")
      .then(({ data }) => setCourses((data as Course[]) ?? []));
  }, [departmentId, level, semester]);

  // ── Save inline course
  async function saveCourse() {
    if (!inlineCourse.code.trim()) {
      setInlineCourse((prev) => ({ ...prev, err: "Course code is required." }));
      return;
    }
    setInlineCourse((prev) => ({ ...prev, busy: true, err: null }));
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        router.replace(`/login?next=${encodeURIComponent("/study-admin/upload")}`);
        return;
      }
      const res = await fetch("/api/study-admin/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          course_code: inlineCourse.code.trim(),
          course_title: inlineCourse.title.trim() || null,
          faculty_id: facultyId || null,
          department_id: departmentId,
          level,
          semester,
        }),
      });
      const json = await res.json() as { ok: boolean; course?: Course; message?: string };
      if (!res.ok || !json.ok) throw new Error(json.message || "Failed to create course");
      const newCourse = json.course as Course;
      setCourses((prev) => [...prev, newCourse].sort((a, b) => a.course_code.localeCompare(b.course_code)));
      setCourseId(newCourse.id);
      setShowInlineCourse(false);
      setInlineCourse({ code: "", title: "", busy: false, err: null });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to create course";
      setInlineCourse((prev) => ({ ...prev, busy: false, err: msg }));
    }
  }

  // ── File helpers
  const addFiles = useCallback((incoming: File[]) => {
    const valid = incoming.filter((f) => f.size <= MAX_SIZE_MB * 1024 * 1024);
    setFiles((prev) => {
      const next = [...prev];
      for (const f of valid) {
        if (next.length >= MAX_FILES) break;
        next.push({ id: crypto.randomUUID(), file: f, status: "pending" });
      }
      return next;
    });
    if (incoming.some((f) => f.size > MAX_SIZE_MB * 1024 * 1024)) {
      setFormErr(`Some files exceeded ${MAX_SIZE_MB} MB and were skipped.`);
    }
  }, []);

  function removeFile(id: string) {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }

  function updateFileStatus(id: string, update: Partial<FileEntry>) {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...update } : f)));
  }

  // ── Drag and drop
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }
  function handleDragLeave() {
    setIsDragging(false);
  }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    addFiles(Array.from(e.dataTransfer.files));
  }
  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) addFiles(Array.from(e.target.files));
    e.target.value = "";
  }

  // ── Upload a single file
  async function uploadOne(entry: FileEntry, token: string): Promise<void> {
    updateFileStatus(entry.id, { status: "uploading" });
    try {
      // Step 1: init
      const initRes = await fetch("/api/study-admin/upload/init", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          filename: entry.file.name,
          filesize: entry.file.size,
          mimetype: entry.file.type,
          faculty_id: facultyId,
          department_id: departmentId,
          level,
          semester,
          course_id: courseId || null,
          material_type: materialType,
          session: session.trim() || null,
          title: title.trim() || null,
          description: description.trim() || null,
        }),
      });
      const initJson = await initRes.json();
      if (!initRes.ok || !initJson.ok) throw new Error(initJson.message || "Init failed");

      const { material_id, signed_url } = initJson as { material_id: string; signed_url: string };

      // Step 2: PUT to signed URL
      const putRes = await fetch(signed_url, {
        method: "PUT",
        headers: { "Content-Type": entry.file.type || "application/octet-stream" },
        body: entry.file,
      });
      if (!putRes.ok) throw new Error(`Storage upload failed (${putRes.status})`);

      // Step 3: complete
      const completeRes = await fetch("/api/study-admin/upload/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ material_id }),
      });
      const completeJson = await completeRes.json();
      if (!completeRes.ok || !completeJson.ok) throw new Error(completeJson.message || "Complete failed");

      updateFileStatus(entry.id, { status: "done", material_id });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Upload error";
      updateFileStatus(entry.id, { status: "error", error: msg });
    }
  }

  // ── Run uploads with max CONCURRENCY parallel
  async function runUploads(entries: FileEntry[], token: string) {
    const queue = [...entries];
    let active = 0;
    let idx = 0;

    await new Promise<void>((resolve) => {
      function next() {
        while (active < CONCURRENCY && idx < queue.length) {
          const entry = queue[idx++];
          active++;
          uploadOne(entry, token).then(() => {
            active--;
            if (idx < queue.length || active > 0) next();
            else resolve();
          });
        }
        if (active === 0) resolve();
      }
      next();
    });
  }

  async function handleSubmit() {
    setFormErr(null);
    setSummary(null);

    if (!facultyId || !departmentId || !level || !semester || !materialType) {
      setFormErr("Please fill in all required fields (Faculty, Department, Level, Semester, Material Type).");
      return;
    }
    const pending = files.filter((f) => f.status === "pending" || f.status === "error");
    if (pending.length === 0) {
      setFormErr("Add at least one file.");
      return;
    }

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      router.replace(`/login?next=${encodeURIComponent("/study-admin/upload")}`);
      return;
    }

    // Reset error files to pending for retry
    setFiles((prev) => prev.map((f) => (f.status === "error" ? { ...f, status: "pending", error: undefined } : f)));

    setUploading(true);
    await runUploads(pending, token);
    setUploading(false);

    setFiles((prev) => {
      const done = prev.filter((f) => f.status === "done").length;
      const failed = prev.filter((f) => f.status === "error").length;
      setSummary({ done, failed });
      return prev;
    });
  }

  function retryFailed() {
    setSummary(null);
    setFiles((prev) => prev.map((f) => (f.status === "error" ? { ...f, status: "pending", error: undefined } : f)));
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-3xl border bg-white p-4 shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight">Upload Materials</h1>
        <p className="mt-1 text-sm text-zinc-600">Upload study materials for any department, level, or semester.</p>
      </div>

      {/* Form */}
      <div className="rounded-3xl border bg-white p-5 shadow-sm space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Faculty */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700">Faculty <span className="text-red-500">*</span></label>
            <select
              className="h-10 rounded-2xl border bg-white px-3 text-sm"
              value={facultyId}
              onChange={(e) => setFacultyId(e.target.value)}
            >
              <option value="">Select faculty…</option>
              {faculties.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>

          {/* Department */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700">Department <span className="text-red-500">*</span></label>
            <select
              className="h-10 rounded-2xl border bg-white px-3 text-sm"
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              disabled={!facultyId}
            >
              <option value="">Select department…</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          {/* Level */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700">Level <span className="text-red-500">*</span></label>
            <select
              className="h-10 rounded-2xl border bg-white px-3 text-sm"
              value={level}
              onChange={(e) => setLevel(e.target.value ? Number(e.target.value) : "")}
            >
              <option value="">Select level…</option>
              {LEVELS.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>

          {/* Semester */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700">Semester <span className="text-red-500">*</span></label>
            <select
              className="h-10 rounded-2xl border bg-white px-3 text-sm"
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
            >
              <option value="">Select semester…</option>
              {SEMESTERS.map((s) => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </div>

          {/* Course (optional) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700">Course <span className="text-xs text-zinc-400">(optional)</span></label>
            <select
              className="h-10 rounded-2xl border bg-white px-3 text-sm"
              value={courseId}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "__create__") {
                  if (!facultyId || !departmentId || !level || !semester) {
                    setFormErr("Select faculty, department, level and semester first.");
                    return;
                  }
                  setCourseId("");
                  setShowInlineCourse(true);
                } else {
                  setShowInlineCourse(false);
                  setCourseId(val);
                }
              }}
              disabled={!departmentId || !level || !semester}
            >
              <option value="">Select course…</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.course_code}{c.course_title ? ` — ${c.course_title}` : ""}</option>
              ))}
              <option disabled value="">────────────────</option>
              <option value="__create__" style={{ color: "#6366f1", fontWeight: 600 }}>＋ Create new course</option>
            </select>
          </div>

          {/* Material type */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700">Material Type <span className="text-red-500">*</span></label>
            <select
              className="h-10 rounded-2xl border bg-white px-3 text-sm"
              value={materialType}
              onChange={(e) => setMaterialType(e.target.value as MaterialType)}
            >
              <option value="">Select type…</option>
              {MATERIAL_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Session */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700">Session <span className="text-xs text-zinc-400">(optional)</span></label>
            <input
              className="h-10 rounded-2xl border bg-white px-3 text-sm"
              placeholder="e.g. 2023/2024"
              value={session}
              onChange={(e) => setSession(e.target.value)}
            />
          </div>

          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700">Title <span className="text-xs text-zinc-400">(optional)</span></label>
            <input
              className="h-10 rounded-2xl border bg-white px-3 text-sm"
              placeholder="Derived from filename if blank"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
        </div>

        {/* Inline create course */}
        {showInlineCourse && (
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 space-y-3">
            <p className="text-sm font-semibold text-indigo-800">New course</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-indigo-700">Course Code <span className="text-red-500">*</span></label>
                <input
                  className="h-9 rounded-xl border border-indigo-200 bg-white px-3 text-sm font-mono uppercase"
                  placeholder="e.g. BCH201"
                  value={inlineCourse.code}
                  onChange={(e) => setInlineCourse((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
                  onKeyDown={(e) => { if (e.key === "Enter") saveCourse(); }}
                  autoFocus
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-indigo-700">Course Title</label>
                <input
                  className="h-9 rounded-xl border border-indigo-200 bg-white px-3 text-sm"
                  placeholder="e.g. Biochemistry"
                  value={inlineCourse.title}
                  onChange={(e) => setInlineCourse((prev) => ({ ...prev, title: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === "Enter") saveCourse(); }}
                />
              </div>
            </div>
            {inlineCourse.err && <p className="text-xs text-red-600">{inlineCourse.err}</p>}
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={inlineCourse.busy}
                onClick={saveCourse}
                className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-indigo-600 px-4 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {inlineCourse.busy ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                Save course
              </button>
              <button
                type="button"
                onClick={() => { setShowInlineCourse(false); setInlineCourse({ code: "", title: "", busy: false, err: null }); }}
                className="text-xs text-indigo-600 hover:underline"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Description */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-zinc-700">Description <span className="text-xs text-zinc-400">(optional)</span></label>
          <textarea
            className="min-h-[80px] rounded-2xl border bg-white p-3 text-sm"
            placeholder="Brief description of the material…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
      </div>

      {/* Drop zone */}
      <div className="rounded-3xl border bg-white p-5 shadow-sm space-y-4">
        <div
          className={cn(
            "flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed p-8 text-center transition",
            isDragging ? "border-black bg-zinc-50" : "border-zinc-200 hover:border-zinc-400"
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="h-8 w-8 text-zinc-400" />
          <div>
            <p className="text-sm font-medium text-zinc-700">Drag files here or click to browse</p>
            <p className="mt-1 text-xs text-zinc-500">PDF, DOCX, PPTX, PNG, JPG, ZIP — max {MAX_SIZE_MB} MB each, up to {MAX_FILES} files</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPT}
            className="hidden"
            onChange={handleFileInput}
          />
        </div>

        {/* File list */}
        {files.length > 0 && (
          <div className="divide-y rounded-2xl border">
            {files.map((entry) => (
              <div key={entry.id} className="flex items-center gap-3 px-4 py-3">
                <FileText className="h-4 w-4 shrink-0 text-zinc-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-900">{entry.file.name}</p>
                  <p className="text-xs text-zinc-500">{formatBytes(entry.file.size)}</p>
                  {entry.error ? <p className="text-xs text-red-600">{entry.error}</p> : null}
                </div>
                <StatusChip status={entry.status} />
                {entry.status !== "uploading" && (
                  <button
                    type="button"
                    onClick={() => removeFile(entry.id)}
                    className="ml-1 text-zinc-400 hover:text-zinc-700"
                    aria-label="Remove file"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Errors / Summary */}
      {formErr && (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{formErr}</div>
      )}

      {summary && (
        <div className={cn(
          "rounded-3xl border p-4 text-sm",
          summary.failed > 0 ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"
        )}>
          <p className="font-medium">
            {summary.done} uploaded successfully{summary.failed > 0 ? `, ${summary.failed} failed` : ""}.
          </p>
          {summary.failed > 0 && (
            <button
              type="button"
              onClick={retryFailed}
              className="mt-2 rounded-2xl bg-amber-700 px-4 py-1.5 text-xs font-medium text-white hover:bg-amber-800"
            >
              Retry failed
            </button>
          )}
        </div>
      )}

      {/* Submit */}
      <div className="flex justify-end">
        <button
          type="button"
          disabled={uploading || files.length === 0}
          onClick={handleSubmit}
          className={cn(
            "inline-flex h-11 items-center gap-2 rounded-2xl bg-black px-6 text-sm font-medium text-white",
            uploading || files.length === 0 ? "opacity-50" : "hover:bg-zinc-800"
          )}
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {uploading ? "Uploading…" : "Upload Files"}
        </button>
      </div>
    </div>
  );
}

function StatusChip({ status }: { status: FileStatus }) {
  if (status === "pending") return <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">Pending</span>;
  if (status === "uploading") return (
    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
      <Loader2 className="h-3 w-3 animate-spin" /> Uploading
    </span>
  );
  if (status === "done") return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
      <CheckCircle2 className="h-3 w-3" /> Done
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700">
      <AlertCircle className="h-3 w-3" /> Error
    </span>
  );
}
