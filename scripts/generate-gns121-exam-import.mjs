import { createHash, randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const setId = "5a4b65e8-6904-4cf5-87f9-1973824982bb";
const inputPath = resolve("deliverables/GNS121_question_bank_150.jsonl");
const sqlPath = resolve("deliverables/GNS121_import_existing_exam_bank.sql");
const markdownPath = resolve("deliverables/GNS121_question_bank_150.md");

const rows = readFileSync(inputPath, "utf8")
  .trim()
  .split(/\r?\n/)
  .map((line, index) => {
    try {
      return JSON.parse(line);
    } catch (error) {
      throw new Error(`Invalid JSON on line ${index + 1}: ${error.message}`);
    }
  });

const expectedTopics = new Map([
  ["Windows and File Management", 20],
  ["Security and Maintenance", 20],
  ["Cloud, Apps, LMS and CRM", 15],
  ["Microsoft Word", 18],
  ["Microsoft Excel and Databases", 15],
  ["Microsoft PowerPoint", 15],
  ["Internet, Browsers, Search and Intellectual Property", 18],
  ["Email, VoIP, Messaging and Calendars", 16],
  ["Social Media and Digital Identity", 13],
]);
const expectedDifficulties = new Map([
  ["easy", 45],
  ["medium", 75],
  ["hard", 30],
]);

function countBy(field) {
  const result = new Map();
  for (const row of rows) result.set(row[field], (result.get(row[field]) ?? 0) + 1);
  return result;
}

function assertCountMap(actual, expected, label) {
  for (const [key, count] of expected) {
    if (actual.get(key) !== count) {
      throw new Error(`${label} ${key} expected ${count}, received ${actual.get(key) ?? 0}.`);
    }
  }
  if (actual.size !== expected.size) throw new Error(`${label} contains an unexpected value.`);
}

if (rows.length !== 150) throw new Error(`Expected 150 questions, received ${rows.length}.`);
const normalizedPrompts = new Set();
for (const [index, row] of rows.entries()) {
  if (row.id !== index + 1) throw new Error(`Question ID ${row.id} is out of sequence at row ${index + 1}.`);
  if (!["A", "B", "C", "D"].includes(row.answer)) throw new Error(`Question ${row.id} has an invalid answer.`);
  if (!Array.isArray(row.options) || row.options.length !== 4 || new Set(row.options.map((value) => value.trim().toLowerCase())).size !== 4) {
    throw new Error(`Question ${row.id} must have four distinct options.`);
  }
  for (const field of ["question", "explanation", "topic", "difficulty", "source"]) {
    if (!String(row[field] ?? "").trim()) throw new Error(`Question ${row.id} is missing ${field}.`);
  }
  const normalized = row.question.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
  if (normalizedPrompts.has(normalized)) throw new Error(`Question ${row.id} duplicates an earlier prompt.`);
  normalizedPrompts.add(normalized);
}
assertCountMap(countBy("topic"), expectedTopics, "Topic");
assertCountMap(countBy("difficulty"), expectedDifficulties, "Difficulty");

const esc = (value) => String(value).replaceAll("'", "''");
const json = (value) => esc(JSON.stringify(value));
const answerIndex = (answer) => answer.charCodeAt(0) - 65;
const cognitiveLevel = (difficulty) => difficulty === "easy" ? "recall" : difficulty === "medium" ? "application" : "analysis";
const questionKind = (difficulty) => difficulty === "easy" ? "recall" : difficulty === "medium" ? "application" : "scenario_analysis";

const sql = [];
sql.push("-- GNS 121 Exam Sprint: import 150 questions into the existing private bank");
sql.push(`-- Target set: ${setId}`);
sql.push("-- This script refuses to run when the target already contains questions.");
sql.push("BEGIN;");
sql.push("");
sql.push("DO $preflight$");
sql.push("BEGIN");
sql.push(`  IF NOT EXISTS (SELECT 1 FROM public.study_quiz_sets WHERE id = '${setId}'::uuid AND delivery_mode = 'mock_exam') THEN`);
sql.push("    RAISE EXCEPTION 'Target Exam Sprint bank does not exist or is not a mock exam.';");
sql.push("  END IF;");
sql.push(`  IF EXISTS (SELECT 1 FROM public.study_quiz_questions WHERE coalesce(set_id, quiz_set_id) = '${setId}'::uuid) THEN`);
sql.push("    RAISE EXCEPTION 'Target bank already has questions. Import stopped to prevent duplicates.';");
sql.push("  END IF;");
sql.push("END");
sql.push("$preflight$;");
sql.push("");

for (const row of rows) {
  const questionId = randomUUID();
  const fingerprint = createHash("sha256").update(row.question.toLowerCase().replace(/\s+/g, " ").trim()).digest("hex");
  const studyRef = { sourceLabel: row.source, reviewedFromLocalPdf: true };
  const generationMeta = { import: "codex_gns121_150_v1", sourceReference: row.source };
  sql.push(`-- Question ${row.id}`);
  sql.push("INSERT INTO public.study_quiz_questions");
  sql.push("  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)");
  sql.push(`VALUES ('${questionId}'::uuid, '${setId}'::uuid, '${esc(row.question)}', '${esc(row.explanation)}', 'mcq', ${row.id - 1}, '${questionKind(row.difficulty)}', '${row.difficulty}', '${cognitiveLevel(row.difficulty)}', '${esc(row.topic)}', '${fingerprint}', '${json(studyRef)}'::jsonb, '${json(generationMeta)}'::jsonb, true, now());`);
  row.options.forEach((option, index) => {
    sql.push("INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)");
    sql.push(`VALUES ('${randomUUID()}'::uuid, '${questionId}'::uuid, '${esc(option)}', ${index === answerIndex(row.answer)}, ${index}, now());`);
  });
  sql.push("");
}

sql.push("UPDATE public.study_quiz_sets");
sql.push("SET questions_count = 150, time_limit_minutes = 40, published = false, visibility = 'private', updated_at = now()");
sql.push(`WHERE id = '${setId}'::uuid;`);
sql.push("");
sql.push("COMMIT;");
sql.push("");
sql.push("-- Verification summary: should return 150 questions, 600 options, 150 correct options.");
sql.push("SELECT");
sql.push("  count(DISTINCT q.id) AS questions,");
sql.push("  count(o.id) AS options,");
sql.push("  count(o.id) FILTER (WHERE o.is_correct) AS correct_options,");
sql.push("  count(DISTINCT q.id) FILTER (WHERE q.exam_verified_at IS NOT NULL) AS human_verified");
sql.push("FROM public.study_quiz_questions q");
sql.push("LEFT JOIN public.study_quiz_options o ON o.question_id = q.id");
sql.push(`WHERE coalesce(q.set_id, q.quiz_set_id) = '${setId}'::uuid;`);
sql.push("");

const markdown = [
  "# GNS 121 — 150-question bank",
  "",
  "Each answer and explanation is included for administrator review. Do not expose the answer key before exam submission.",
  "",
];
for (const row of rows) {
  markdown.push(`## ${row.id}. ${row.question}`);
  markdown.push("");
  row.options.forEach((option, index) => markdown.push(`${String.fromCharCode(65 + index)}. ${option}`));
  markdown.push("");
  markdown.push(`**Answer:** ${row.answer}`);
  markdown.push("");
  markdown.push(`**Explanation:** ${row.explanation}`);
  markdown.push("");
  markdown.push(`**Metadata:** ${row.topic} · ${row.difficulty} · ${row.source}`);
  markdown.push("");
}

writeFileSync(sqlPath, `${sql.join("\n")}\n`, "utf8");
writeFileSync(markdownPath, `${markdown.join("\n")}\n`, "utf8");
console.log(JSON.stringify({ questions: rows.length, sqlPath, markdownPath, sqlLines: sql.length }, null, 2));
