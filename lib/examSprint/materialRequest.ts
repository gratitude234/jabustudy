const DEFAULT_EXAM_MATERIAL_WHATSAPP = "2347041022336";

type MaterialRequestEnvironment = {
  NEXT_PUBLIC_EXAM_MATERIAL_WHATSAPP_NUMBER?: string;
};

export function normalizeExamMaterialWhatsAppNumber(value: unknown) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (/^0\d{10}$/.test(digits)) return `234${digits.slice(1)}`;
  if (/^234\d{10}$/.test(digits)) return digits;
  if (/^\d{10,15}$/.test(digits)) return digits;
  return "";
}

export function getExamMaterialRequestPhone(
  environment: MaterialRequestEnvironment = {
    NEXT_PUBLIC_EXAM_MATERIAL_WHATSAPP_NUMBER: process.env.NEXT_PUBLIC_EXAM_MATERIAL_WHATSAPP_NUMBER,
  },
) {
  return normalizeExamMaterialWhatsAppNumber(
    environment.NEXT_PUBLIC_EXAM_MATERIAL_WHATSAPP_NUMBER,
  ) || DEFAULT_EXAM_MATERIAL_WHATSAPP;
}

export function buildExamMaterialRequestWhatsAppUrl({
  phone,
  courseCode,
  courseTitle,
  searchQuery,
}: {
  phone: string;
  courseCode?: string;
  courseTitle?: string;
  searchQuery?: string;
}) {
  const normalizedPhone = normalizeExamMaterialWhatsAppNumber(phone);
  if (!normalizedPhone) return "";

  const code = courseCode?.trim();
  const title = courseTitle?.trim();
  const search = searchQuery?.trim();
  const message = code && title
    ? [
        "Hi JabuStudy 👋",
        "",
        `I take ${code} — ${title}. Exam Sprint says this question bank needs course material.`,
        "",
        "I can send the material I have (lecture notes, slides, handouts or past questions).",
        "",
        "Please help prepare this course for Exam Sprint.",
      ].join("\n")
    : [
        "Hi JabuStudy 👋",
        "",
        search
          ? `I couldn't find “${search}” on Exam Sprint and I'd like to request the course.`
          : "I couldn't find my course on Exam Sprint and I'd like to request it.",
        "",
        "Course code:",
        "Course title:",
        "Department / level:",
        "Exam date (if known):",
        "",
        "I have course material to send: Yes / No",
        "Material type: notes / slides / handouts / past questions",
      ].join("\n");

  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
}
