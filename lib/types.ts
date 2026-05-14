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

export type ReviewTab = "all" | "wrong" | "flagged" | "unanswered";
