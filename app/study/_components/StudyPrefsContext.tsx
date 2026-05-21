"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

// ── Types ────────────────────────────────────────────────────────────────────

export type Prefs = {
  faculty?: string | null;
  department?: string | null;
  level?: number | null;
  faculty_id?: string | null;
  department_id?: string | null;
  semester?: string | null;
  session?: string | null;
};

export type StudyCourseScope = {
  id: string;
  course_code: string;
  course_title: string | null;
  level: number | null;
  semester: string | null;
};

export type StudyProfileStatus = "complete" | "incomplete" | "missing";

export type RepRole = "course_rep" | "dept_librarian" | null;
export type RepStatus = "not_applied" | "pending" | "approved" | "rejected";

type RepMeResponse =
  | {
      ok: true;
      status: RepStatus;
      role: RepRole;
      scope: {
        faculty_id: string | null;
        department_id: string | null;
        levels: number[] | null;
        all_levels: boolean;
      } | null;
      courses_setup_done?: boolean;
    }
  | { ok: false; code?: string; message?: string };

type PersonalizationResponse =
  | {
      ok: true;
      profileStatus: StudyProfileStatus;
      prefs: Prefs | null;
      missingFields: string[];
      scopeLabel: string | null;
      courses: StudyCourseScope[];
      courseIds: string[];
      courseCodes: string[];
    }
  | { ok: false; error?: string };

export type RepState = {
  loading: boolean;
  status: RepStatus;
  role: RepRole;
  scope: Extract<RepMeResponse, { ok: true }>["scope"];
  courses_setup_done: boolean;
};

// ── Context shape ─────────────────────────────────────────────────────────────

interface StudyPrefsCtx {
  /** True while auth + prefs are still resolving on first load */
  loading: boolean;
  /** Authenticated user id — null until auth resolves */
  userId: string | null;
  /** Authenticated user email — null until auth resolves */
  userEmail: string | null;
  /** Human-readable display name derived from auth metadata */
  displayName: string | null;
  /** Saved study preferences for this user — null if not yet set */
  prefs: Prefs | null;
  /** True when the user has at least one meaningful pref set */
  hasPrefs: boolean;
  isProfileComplete: boolean;
  profileStatus: StudyProfileStatus;
  missingFields: string[];
  scopeLabel: string | null;
  courses: StudyCourseScope[];
  courseIds: string[];
  courseCodes: string[];
  /** Rep / librarian application state */
  rep: RepState;
  /**
   * Update the semester in prefs state locally (after an upsert).
   * Used by StudyHomeClient after applySuggestedSemester() succeeds.
   */
  updateSemester: (semester: string, session: string) => void;
}

// ── Context ───────────────────────────────────────────────────────────────────

const StudyPrefsContext = createContext<StudyPrefsCtx | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function StudyPrefsProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [profileStatus, setProfileStatus] = useState<StudyProfileStatus>("missing");
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [scopeLabel, setScopeLabel] = useState<string | null>(null);
  const [courses, setCourses] = useState<StudyCourseScope[]>([]);
  const [courseIds, setCourseIds] = useState<string[]>([]);
  const [courseCodes, setCourseCodes] = useState<string[]>([]);
  const [rep, setRep] = useState<RepState>({
    loading: true,
    status: "not_applied",
    role: null,
    scope: null,
    courses_setup_done: true,
  });

  useEffect(() => {
    let mounted = true;

    async function run() {
      setLoading(true);

      // ── Auth ───────────────────────────────────────────────────────────────
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user ?? null;

      if (!mounted) return;
      if (!user) {
        router.replace("/login");
        return;
      }

      setUserId(user.id);
      setUserEmail(user.email ?? null);

      // Resolve human-readable display name from auth metadata
      const meta = user.user_metadata as Record<string, unknown> | null | undefined;
      const resolvedName =
        (meta?.full_name as string | undefined) ||
        (meta?.name as string | undefined) ||
        (meta?.preferred_username as string | undefined) ||
        (user.email ? user.email.split("@")[0].replace(/[._-]+/g, " ") : null);
      setDisplayName(resolvedName ?? null);

      // ── Rep status + Prefs — run in parallel ──────────────────────────────
      const repPromise = fetch("/api/study/rep-applications/me", {
        cache: "no-store",
      })
        .then((r) => r.json() as Promise<RepMeResponse>)
        .catch(() => null);

      const prefsPromise = fetch("/api/study/personalization", { cache: "no-store" })
        .then((r) => r.json() as Promise<PersonalizationResponse>)
        .catch(() => null);

      const [repJson, prefsRes] = await Promise.all([repPromise, prefsPromise]);

      if (!mounted) return;

      // ── Rep state ──────────────────────────────────────────────────────────
      if (repJson && (repJson as any).ok) {
        const ok = repJson as Extract<RepMeResponse, { ok: true }>;
        const setupDone = ok.courses_setup_done ?? true;
        setRep({ loading: false, status: ok.status, role: ok.role, scope: ok.scope, courses_setup_done: setupDone });

        // Gate: approved course_reps who haven't set up their courses must do so first
        if (
          ok.status === "approved" &&
          ok.role === "course_rep" &&
          !setupDone &&
          !pathname.startsWith("/study/rep-setup")
        ) {
          router.replace("/study/rep-setup");
          return;
        }
      } else {
        setRep((p) => ({ ...p, loading: false }));
      }

      // ── Prefs ──────────────────────────────────────────────────────────────
      if (prefsRes && (prefsRes as any).ok) {
        const p = prefsRes as Extract<PersonalizationResponse, { ok: true }>;
        setPrefs(p.prefs);
        setProfileStatus(p.profileStatus);
        setMissingFields(p.missingFields ?? []);
        setScopeLabel(p.scopeLabel ?? null);
        setCourses(p.courses ?? []);
        setCourseIds(p.courseIds ?? []);
        setCourseCodes(p.courseCodes ?? []);
      } else {
        setPrefs(null);
        setProfileStatus("missing");
        setMissingFields([]);
        setScopeLabel(null);
        setCourses([]);
        setCourseIds([]);
        setCourseCodes([]);
      }

      setLoading(false);
    }

    run();
    return () => {
      mounted = false;
    };
  }, [router]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const hasPrefs = useMemo(
    () =>
      !!(
        prefs?.faculty_id ||
        prefs?.department_id ||
        prefs?.faculty ||
        prefs?.department ||
        prefs?.level
      ),
    [prefs]
  );
  const isProfileComplete = profileStatus === "complete";

  // ── Helpers exposed to consumers ───────────────────────────────────────────
  function updateSemester(semester: string, session: string) {
    setPrefs((p) => ({ ...(p ?? {}), semester, session }));
  }

  return (
    <StudyPrefsContext.Provider
      value={{
        loading,
        userId,
        userEmail,
        displayName,
        prefs,
        hasPrefs,
        isProfileComplete,
        profileStatus,
        missingFields,
        scopeLabel,
        courses,
        courseIds,
        courseCodes,
        rep,
        updateSemester,
      }}
    >
      {children}
    </StudyPrefsContext.Provider>
  );
}

// ── Consumer hook ─────────────────────────────────────────────────────────────

/**
 * Access auth, prefs, and rep state from any component inside StudyPrefsProvider.
 *
 * @throws if called outside of a StudyPrefsProvider
 */
export function useStudyPrefs(): StudyPrefsCtx {
  const ctx = useContext(StudyPrefsContext);
  if (!ctx) {
    throw new Error("useStudyPrefs must be used inside <StudyPrefsProvider>");
  }
  return ctx;
}
