export function isIndexableMaterialPath(filePath: string | null | undefined): boolean {
  const clean = (filePath ?? "").split("?")[0].toLowerCase();
  return clean.endsWith(".pdf") || clean.endsWith(".docx") || clean.endsWith(".pptx");
}
