"use client";

import { cn } from "@/lib/utils";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Filter,
  Loader2,
  Search,
  UserRound,
  Users,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type CommunityStatus = "joined" | "clicked" | "dismissed" | "not_joined";

type AdminUser = {
  id: string;
  email: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  createdAt: string | null;
  faculty: string | null;
  department: string | null;
  level: number | null;
  semester: string | null;
  lastActiveDate: string | null;
  activeToday: boolean;
  activeThisWeek: boolean;
  streak: number;
  practiceSessions: number;
  avgScore: number | null;
  uploadedMaterials: number;
  communityStatus: CommunityStatus;
};

type UsersResponse = {
  ok?: boolean;
  users?: AdminUser[];
  total?: number;
  page?: number;
  limit?: number;
  message?: string;
};

const LIMIT = 25;

function formatDate(value: string | null | undefined) {
  if (!value) return "Never";
  const ms = new Date(value).getTime();
  if (!Number.isFinite(ms)) return "Never";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatNumber(value: number | null | undefined) {
  return new Intl.NumberFormat("en-US").format(Math.max(0, Number(value ?? 0)));
}

function statusLabel(status: CommunityStatus) {
  if (status === "not_joined") return "Not joined";
  if (status === "clicked") return "Clicked";
  if (status === "dismissed") return "Dismissed";
  return "Joined";
}

function communityClass(status: CommunityStatus) {
  if (status === "joined") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
  if (status === "clicked") return "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300";
  if (status === "dismissed") return "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300";
  return "bg-secondary text-muted-foreground";
}

function initials(user: AdminUser) {
  const name = user.fullName || user.email || "User";
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function scopeLine(user: AdminUser) {
  const parts = [
    user.department,
    typeof user.level === "number" ? `${user.level}L` : null,
    user.semester ? `${user.semester} semester` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" - ") : "No study profile";
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="min-w-0 text-xs font-semibold text-muted-foreground">
      <span className="mb-1 block">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm font-medium text-foreground outline-none transition focus:border-primary"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function UserAvatar({ user }: { user: AdminUser }) {
  return (
    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
      {initials(user)}
    </div>
  );
}

function DesktopTable({ users }: { users: AdminUser[] }) {
  return (
    <div className="hidden overflow-hidden rounded-2xl border border-border bg-card shadow-sm md:block">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-secondary/70 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-semibold">Student</th>
            <th className="px-4 py-3 font-semibold">Scope</th>
            <th className="px-4 py-3 font-semibold">Activity</th>
            <th className="px-4 py-3 font-semibold">Practice</th>
            <th className="px-4 py-3 font-semibold">Uploads</th>
            <th className="px-4 py-3 font-semibold">Community</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {users.map((user) => (
            <tr key={user.id} className="transition hover:bg-secondary/40">
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <UserAvatar user={user} />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-foreground">{user.fullName || "Unnamed student"}</p>
                    <p className="truncate text-xs text-muted-foreground">{user.email || "No email"}</p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3">
                <p className="max-w-[220px] truncate text-foreground">{scopeLine(user)}</p>
                <p className="text-xs text-muted-foreground">Joined {formatDate(user.createdAt)}</p>
              </td>
              <td className="px-4 py-3">
                <p className={cn("font-semibold", user.activeToday ? "text-emerald-600" : "text-foreground")}>
                  {user.activeToday ? "Active today" : user.activeThisWeek ? "Active this week" : "Inactive"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {user.lastActiveDate ? `Last active ${formatDate(user.lastActiveDate)}` : "No recorded activity"} - {user.streak}d streak
                </p>
              </td>
              <td className="px-4 py-3">
                <p className="font-semibold text-foreground">{formatNumber(user.practiceSessions)} sessions</p>
                <p className="text-xs text-muted-foreground">{user.avgScore === null ? "No avg score" : `${user.avgScore}% avg score`}</p>
              </td>
              <td className="px-4 py-3">
                <p className="font-semibold text-foreground">{formatNumber(user.uploadedMaterials)}</p>
                <p className="text-xs text-muted-foreground">materials</p>
              </td>
              <td className="px-4 py-3">
                <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold", communityClass(user.communityStatus))}>
                  {statusLabel(user.communityStatus)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MobileList({ users }: { users: AdminUser[] }) {
  return (
    <div className="space-y-3 md:hidden">
      {users.map((user) => (
        <article key={user.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <UserAvatar user={user} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-foreground">{user.fullName || "Unnamed student"}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email || "No email"}</p>
              <p className="mt-2 text-sm text-foreground">{scopeLine(user)}</p>
            </div>
            <span className={cn("shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold", communityClass(user.communityStatus))}>
              {statusLabel(user.communityStatus)}
            </span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-secondary/70 px-2 py-2">
              <p className="text-sm font-bold text-foreground">{user.streak}d</p>
              <p className="text-[11px] text-muted-foreground">streak</p>
            </div>
            <div className="rounded-xl bg-secondary/70 px-2 py-2">
              <p className="text-sm font-bold text-foreground">{formatNumber(user.practiceSessions)}</p>
              <p className="text-[11px] text-muted-foreground">sessions</p>
            </div>
            <div className="rounded-xl bg-secondary/70 px-2 py-2">
              <p className="text-sm font-bold text-foreground">{formatNumber(user.uploadedMaterials)}</p>
              <p className="text-[11px] text-muted-foreground">uploads</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {user.activeToday ? "Active today" : user.lastActiveDate ? `Last active ${formatDate(user.lastActiveDate)}` : "No recorded activity"}
            {user.avgScore === null ? "" : ` - ${user.avgScore}% avg score`}
          </p>
        </article>
      ))}
    </div>
  );
}

export default function StudyAdminUsersPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [qInput, setQInput] = useState(searchParams.get("q") ?? "");

  const q = searchParams.get("q") ?? "";
  const activity = searchParams.get("activity") ?? "all";
  const level = searchParams.get("level") ?? "all";
  const hasUploads = searchParams.get("hasUploads") ?? "0";
  const community = searchParams.get("community") ?? "all";
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const pageCount = Math.max(1, Math.ceil(total / LIMIT));

  const queryString = useMemo(() => searchParams.toString(), [searchParams]);

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value || value === "all" || value === "0") params.delete(key);
    else params.set(key, value);
    params.delete("page");
    router.replace(`${pathname}?${params.toString()}`);
  }

  function goToPage(nextPage: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (nextPage <= 1) params.delete("page");
    else params.set("page", String(nextPage));
    router.replace(`${pathname}?${params.toString()}`);
  }

  useEffect(() => {
    const timer = setTimeout(() => updateParam("q", qInput.trim()), 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qInput]);

  useEffect(() => {
    setQInput(q);
  }, [q]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const { data: sess } = await supabase.auth.getSession();
        const token = sess.session?.access_token;
        if (!token) {
          router.replace(`/login?next=${encodeURIComponent("/study-admin/users")}`);
          return;
        }

        const params = new URLSearchParams(queryString);
        params.set("limit", String(LIMIT));
        if (!params.get("page")) params.set("page", "1");

        const res = await fetch(`/api/study-admin/users?${params.toString()}`, {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = (await res.json().catch(() => null)) as UsersResponse | null;

        if (res.status === 401) {
          router.replace(`/login?next=${encodeURIComponent("/study-admin/users")}`);
          return;
        }
        if (res.status === 403) {
          router.replace("/study");
          return;
        }
        if (!res.ok || !json?.ok) throw new Error(json?.message || "Could not load users.");

        if (mounted) {
          setUsers(json.users ?? []);
          setTotal(json.total ?? 0);
        }
      } catch (error) {
        if (mounted) setErr(error instanceof Error ? error.message : "Could not load users.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [queryString, router]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => router.push("/study-admin")}
            className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
          </button>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
            <Users className="h-6 w-6 text-primary" /> Users
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Search students, activity, practice progress, uploads, and community status.
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total</p>
          <p className="text-2xl font-bold text-foreground tabular-nums">{formatNumber(total)}</p>
        </div>
      </div>

      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Filter className="h-4 w-4 text-primary" /> Filters
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1.5fr)_repeat(4,minmax(120px,1fr))]">
          <label className="min-w-0 text-xs font-semibold text-muted-foreground">
            <span className="mb-1 block">Search</span>
            <span className="flex h-10 items-center gap-2 rounded-xl border border-border bg-background px-3 focus-within:border-primary">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                value={qInput}
                onChange={(event) => setQInput(event.target.value)}
                placeholder="Name or email"
                className="min-w-0 flex-1 bg-transparent text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground"
              />
            </span>
          </label>
          <FilterSelect
            label="Activity"
            value={activity}
            onChange={(value) => updateParam("activity", value)}
            options={[
              { value: "all", label: "All" },
              { value: "today", label: "Active today" },
              { value: "week", label: "Active week" },
              { value: "inactive", label: "Inactive week" },
            ]}
          />
          <FilterSelect
            label="Level"
            value={level}
            onChange={(value) => updateParam("level", value)}
            options={[
              { value: "all", label: "All levels" },
              ...[100, 200, 300, 400, 500, 600].map((item) => ({ value: String(item), label: `${item}L` })),
            ]}
          />
          <FilterSelect
            label="Uploads"
            value={hasUploads}
            onChange={(value) => updateParam("hasUploads", value)}
            options={[
              { value: "0", label: "Any" },
              { value: "1", label: "Has uploads" },
            ]}
          />
          <FilterSelect
            label="Community"
            value={community}
            onChange={(value) => updateParam("community", value)}
            options={[
              { value: "all", label: "Any" },
              { value: "joined", label: "Joined" },
              { value: "clicked", label: "Clicked" },
              { value: "dismissed", label: "Dismissed" },
              { value: "not_joined", label: "Not joined" },
            ]}
          />
        </div>
      </section>

      {err ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {err}
        </div>
      ) : loading ? (
        <div className="grid place-items-center rounded-2xl border border-border bg-card py-16 text-sm text-muted-foreground">
          <Loader2 className="mb-3 h-5 w-5 animate-spin text-primary" />
          Loading users...
        </div>
      ) : users.length === 0 ? (
        <div className="grid place-items-center rounded-2xl border border-border bg-card py-16 text-center">
          <UserRound className="mb-3 h-8 w-8 text-muted-foreground" />
          <p className="font-semibold text-foreground">No users found</p>
          <p className="mt-1 text-sm text-muted-foreground">Try a different search or filter.</p>
        </div>
      ) : (
        <>
          <DesktopTable users={users} />
          <MobileList users={users} />
        </>
      )}

      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Page <span className="font-semibold text-foreground">{page}</span> of{" "}
          <span className="font-semibold text-foreground">{pageCount}</span>
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => goToPage(page - 1)}
            disabled={page <= 1 || loading}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground transition hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ArrowLeft className="h-4 w-4" /> Previous
          </button>
          <button
            type="button"
            onClick={() => goToPage(page + 1)}
            disabled={page >= pageCount || loading}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground transition hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

    </div>
  );
}
