export type ExamQuestionOutcome = "unanswered" | "incorrect" | "correct";

export type ExamQuestionExposure = {
  questionId: string;
  deliveredAt: string | number | Date;
  outcome: ExamQuestionOutcome;
  flagged: boolean;
};

export type ExamQuestionHistoryEntry = {
  questionId: string;
  lastDeliveredAt: number;
  latestOutcome: ExamQuestionOutcome;
  latestFlagged: boolean;
};

export type ExamQuestionHistory = Map<string, ExamQuestionHistoryEntry>;

export type ExamQuestionCoverage = {
  bankTotal: number;
  delivered: number;
  remaining: number;
  complete: boolean;
};

function deliveredAtMs(value: ExamQuestionExposure["deliveredAt"]) {
  const parsed = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

export function buildExamQuestionHistory(exposures: readonly ExamQuestionExposure[]): ExamQuestionHistory {
  const history: ExamQuestionHistory = new Map();

  for (const exposure of exposures) {
    const questionId = exposure.questionId.trim();
    if (!questionId) continue;
    const next: ExamQuestionHistoryEntry = {
      questionId,
      lastDeliveredAt: deliveredAtMs(exposure.deliveredAt),
      latestOutcome: exposure.outcome,
      latestFlagged: exposure.flagged,
    };
    const current = history.get(questionId);
    if (!current || next.lastDeliveredAt >= current.lastDeliveredAt) history.set(questionId, next);
  }

  return history;
}

export function calculateExamQuestionCoverage(
  eligibleQuestionIds: Iterable<string>,
  history: ExamQuestionHistory,
): ExamQuestionCoverage {
  const eligible = new Set([...eligibleQuestionIds].map((id) => id.trim()).filter(Boolean));
  let delivered = 0;
  for (const questionId of eligible) {
    if (history.has(questionId)) delivered += 1;
  }
  const bankTotal = eligible.size;
  return {
    bankTotal,
    delivered,
    remaining: Math.max(0, bankTotal - delivered),
    complete: bankTotal > 0 && delivered >= bankTotal,
  };
}

function revisionPriority(entry: ExamQuestionHistoryEntry) {
  if (entry.latestOutcome === "unanswered") return 0;
  if (entry.latestOutcome === "incorrect") return 1;
  if (entry.latestFlagged) return 2;
  return 3;
}

export function selectExamQuestions<T extends { id: string }>(args: {
  candidates: readonly T[];
  history: ExamQuestionHistory;
  questionCount: number;
  shuffle: (items: readonly T[]) => T[];
}) {
  const randomized = args.shuffle(args.candidates);
  const requested = Math.max(0, Math.min(Math.floor(args.questionCount), randomized.length));
  const unseen = randomized.filter((candidate) => !args.history.has(candidate.id));
  const revision = randomized
    .filter((candidate) => args.history.has(candidate.id))
    .sort((left, right) => {
      const leftHistory = args.history.get(left.id)!;
      const rightHistory = args.history.get(right.id)!;
      return revisionPriority(leftHistory) - revisionPriority(rightHistory)
        || leftHistory.lastDeliveredAt - rightHistory.lastDeliveredAt;
    });

  const unseenSelection = unseen.slice(0, requested);
  const revisionSlots = Math.max(0, requested - unseenSelection.length);
  const selected = [...unseenSelection, ...revision.slice(0, revisionSlots)];

  return {
    questions: args.shuffle(selected),
    newQuestionCount: unseenSelection.length,
  };
}
