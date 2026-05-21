export type QuizSet = {
  id: string;
  title: string;
  description: string | null;
  course_code: string | null;
  level: string | null;
  time_limit_minutes: number | null;
  source_material_id?: string | null;
};

export type QuizQuestion = {
  id: string;
  prompt: string;
  explanation: string | null;
  question_type?: "mcq" | "short_answer" | "theory" | null;
  model_answer?: string | null;
  marking_points?: string[] | null;
  ai_explanation?: string | null;
  question_kind?: string | null;
  difficulty_level?: string | null;
  cognitive_level?: string | null;
  source_topic?: string | null;
  question_fingerprint?: string | null;
  generation_meta?: Record<string, unknown> | null;
  study_ref?: {
    chunkId?: string;
    topic?: string;
    instruction?: string;
    quote?: string;
    page?: number;
  } | null;
  position: number | null;
};

export type QuizOption = {
  id: string;
  question_id: string;
  text: string;
  is_correct: boolean;
  position: number | null;
};

export type AnswerConfidence = "confident" | "unsure" | "guessed";

export type WrittenAnswerGradeVerdict =
  | "correct"
  | "mostly_correct"
  | "partially_correct"
  | "incorrect"
  | "unanswered";

export type WrittenAnswerGrade = {
  score: number;
  maxScore: number;
  verdict: WrittenAnswerGradeVerdict;
  feedback: string;
  matchedPoints: string[];
  missingPoints: string[];
  improvedAnswer: string | null;
  gradedAt: string;
  provider: string | null;
  model: string | null;
};

export type ReviewTab = "all" | "wrong" | "flagged" | "unanswered";
