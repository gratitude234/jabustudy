export const MEAL_DRAFT_PREFIX = "meal-draft-";

export function getMealDraftKey(userId: string, vendorId: string) {
  return `${MEAL_DRAFT_PREFIX}${userId}:${vendorId}`;
}

export function removeMealDraft(key: string) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(key);
}

export function clearMealDrafts() {
  if (typeof window === "undefined") return;
  Object.keys(window.localStorage)
    .filter((key) => key.startsWith(MEAL_DRAFT_PREFIX))
    .forEach((key) => window.localStorage.removeItem(key));
}
