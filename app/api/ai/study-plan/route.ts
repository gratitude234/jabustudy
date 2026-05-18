// app/api/ai/study-plan/route.ts
// POST /api/ai/study-plan
// Generates a personalised study plan based on courses, GPA goals, and exam timeline.
// Not cached - fully personalised per request.

export const maxDuration = 60;

import { NextRequest } from "next/server";
import { streamText, userMessage } from "@/lib/ai";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function jsonErr(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return jsonErr("Unauthorised", 401);

  let body: {
    courses?: string[];
    currentCgpa?: number | null;
    targetCgpa?: number | null;
    weeksUntilExam?: number;
    weakCourses?: string[];
    dailyHours?: number;
  };
  try {
    body = await req.json();
  } catch {
    return jsonErr("Invalid JSON body", 400);
  }

  const {
    courses = [],
    currentCgpa,
    targetCgpa,
    weeksUntilExam = 4,
    weakCourses = [],
    dailyHours = 4,
  } = body;

  if (!courses.length) return jsonErr("At least one course is required", 400);

  const weeks = Math.max(1, Math.min(weeksUntilExam, 12));

  const gpaLine =
    currentCgpa != null && targetCgpa != null
      ? `Current CGPA: ${currentCgpa.toFixed(2)} -> Target: ${targetCgpa.toFixed(2)}`
      : currentCgpa != null
      ? `Current CGPA: ${currentCgpa.toFixed(2)}`
      : "";

  const weakLine =
    weakCourses.length > 0
      ? `Weak courses needing extra attention: ${weakCourses.join(", ")}`
      : "";

  const includedDays =
    weeks <= 2
      ? ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
      : ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

  const prompt = `You are a study coach for Nigerian university students preparing for exams.

Student Profile:
- Courses: ${courses.join(", ")}
- Available study time: ${dailyHours} hours/day
- Weeks until exams: ${weeks}
${gpaLine ? `- ${gpaLine}` : ""}
${weakLine ? `- ${weakLine}` : ""}

Create a ${weeks}-week study plan. Prioritise weak courses.
IMPORTANT: Respond ONLY with a single raw JSON object. No markdown, no backticks, no explanation before or after.

Schema (follow exactly):
{
  "summary": "1-2 sentences personalised to this student",
  "totalWeeks": ${weeks},
  "weeks": [
    {
      "week": 1,
      "theme": "short theme",
      "weeklyGoal": "one sentence goal",
      "days": [
        {
          "day": "Monday",
          "focus": "COURSE - Topic",
          "tasks": ["task 1", "task 2"],
          "hours": ${dailyHours}
        }
      ]
    }
  ],
  "generalTips": ["tip 1", "tip 2", "tip 3"]
}

Include these days per week: ${includedDays.join(", ")}.
Keep tasks short (under 10 words each). Keep theme and weeklyGoal under 12 words each.`;

  const tokenBudget = Math.min(6000, weeks * includedDays.length * 150 + 500);
  const result = await streamText({
    messages: [userMessage(prompt)],
    temperature: 0.5,
    maxTokens: tokenBudget,
    timeoutMs: 55_000,
    modelRole: "fast",
  });

  if (!result.ok) return jsonErr(result.error, 502);

  return new Response(result.stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
