import { describe, expect, it } from "vitest";
import {
  buildExamQuestionHistory,
  calculateExamQuestionCoverage,
  selectExamQuestions,
  type ExamQuestionExposure,
} from "../lib/examSprint/coverage";

const keepOrder = <T,>(items: readonly T[]) => [...items];

describe("Exam Sprint question coverage", () => {
  it("uses every unseen question before filling from revision questions", () => {
    const candidates = Array.from({ length: 150 }, (_, index) => ({ id: `q${index + 1}` }));
    const exposures: ExamQuestionExposure[] = [];
    const attempts: string[][] = [];

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const selected = selectExamQuestions({
        candidates,
        history: buildExamQuestionHistory(exposures),
        questionCount: 40,
        shuffle: keepOrder,
      });
      attempts.push(selected.questions.map((question) => question.id));
      exposures.push(...selected.questions.map((question) => ({
        questionId: question.id,
        deliveredAt: attempt + 1,
        outcome: "correct" as const,
        flagged: false,
      })));
    }

    expect(new Set(attempts.slice(0, 3).flat()).size).toBe(120);
    expect(attempts[3].slice(0, 30)).toEqual(candidates.slice(120).map((question) => question.id));
    expect(new Set(attempts.flat()).size).toBe(150);
    expect(calculateExamQuestionCoverage(
      candidates.map((question) => question.id),
      buildExamQuestionHistory(exposures),
    )).toEqual({ bankTotal: 150, delivered: 150, remaining: 0, complete: true });
  });

  it("prioritizes latest unanswered, incorrect, flagged-correct, then oldest correct questions", () => {
    const candidates = ["unanswered", "incorrect", "flagged", "correct"].map((id) => ({ id }));
    const history = buildExamQuestionHistory([
      { questionId: "correct", deliveredAt: 1, outcome: "correct", flagged: false },
      { questionId: "flagged", deliveredAt: 2, outcome: "correct", flagged: true },
      { questionId: "incorrect", deliveredAt: 3, outcome: "incorrect", flagged: false },
      { questionId: "unanswered", deliveredAt: 4, outcome: "unanswered", flagged: false },
    ]);

    expect(selectExamQuestions({ candidates, history, questionCount: 4, shuffle: keepOrder }).questions.map(({ id }) => id))
      .toEqual(["unanswered", "incorrect", "flagged", "correct"]);
  });

  it("uses the latest outcome so a corrected question leaves the weak priority group", () => {
    const candidates = ["fixed", "still-wrong", "correct"].map((id) => ({ id }));
    const history = buildExamQuestionHistory([
      { questionId: "fixed", deliveredAt: 1, outcome: "incorrect", flagged: false },
      { questionId: "fixed", deliveredAt: 4, outcome: "correct", flagged: false },
      { questionId: "still-wrong", deliveredAt: 2, outcome: "incorrect", flagged: false },
      { questionId: "correct", deliveredAt: 3, outcome: "correct", flagged: false },
    ]);

    expect(selectExamQuestions({ candidates, history, questionCount: 1, shuffle: keepOrder }).questions[0].id)
      .toBe("still-wrong");
  });

  it("intersects coverage with the current eligible bank and treats additions as unseen", () => {
    const history = buildExamQuestionHistory([
      { questionId: "kept", deliveredAt: 1, outcome: "correct", flagged: false },
      { questionId: "removed", deliveredAt: 1, outcome: "correct", flagged: false },
    ]);

    expect(calculateExamQuestionCoverage(["kept", "new"], history))
      .toEqual({ bankTotal: 2, delivered: 1, remaining: 1, complete: false });
    expect(selectExamQuestions({
      candidates: [{ id: "kept" }, { id: "new" }],
      history,
      questionCount: 1,
      shuffle: keepOrder,
    }).questions[0].id).toBe("new");
  });
});
