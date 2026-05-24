import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const STUDY_POINT_RULES = {
  practiceDailyCap: 100,
  questionDailyCap: 5,
  answerDailyCap: 20,
  questionAsked: 1,
  answerPosted: 2,
  answerAccepted: 10,
  questionUpvote: 1,
  answerUpvote: 2,
  practiceCompletion: 3,
} as const;

type JsonRecord = Record<string, unknown>;

export async function awardStudyPoints(args: {
  userId: string | null | undefined;
  eventType: string;
  sourceTable: string;
  sourceId: string | null | undefined;
  points: number;
  metadata?: JsonRecord;
  occurredAt?: string;
}) {
  if (!args.userId || !args.sourceId || !Number.isFinite(args.points) || args.points === 0) {
    return 0;
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("award_study_points", {
    p_user_id: args.userId,
    p_event_type: args.eventType,
    p_source_table: args.sourceTable,
    p_source_id: args.sourceId,
    p_points: Math.trunc(args.points),
    p_metadata: args.metadata ?? {},
    p_occurred_at: args.occurredAt ?? new Date().toISOString(),
  });

  if (error) {
    console.warn("[studyPoints] award failed:", error.message);
    return 0;
  }

  return typeof data === "number" ? data : 0;
}

export async function awardCappedStudyPoints(args: {
  userId: string | null | undefined;
  eventType: string;
  sourceTable: string;
  sourceId: string | null | undefined;
  points: number;
  dailyCap: number;
  metadata?: JsonRecord;
  occurredAt?: string;
}) {
  if (!args.userId || !args.sourceId || !Number.isFinite(args.points) || args.points <= 0) {
    return 0;
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("award_capped_study_points", {
    p_user_id: args.userId,
    p_event_type: args.eventType,
    p_source_table: args.sourceTable,
    p_source_id: args.sourceId,
    p_points: Math.trunc(args.points),
    p_daily_cap: Math.trunc(args.dailyCap),
    p_metadata: args.metadata ?? {},
    p_occurred_at: args.occurredAt ?? new Date().toISOString(),
  });

  if (error) {
    console.warn("[studyPoints] capped award failed:", error.message);
    return 0;
  }

  return typeof data === "number" ? data : 0;
}
