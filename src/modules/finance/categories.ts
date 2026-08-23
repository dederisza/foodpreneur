/**
 * Controlled expense category model for Phase 3 (Section 11): a fixed
 * list keeps the MVP simple and consistent, while "other" prevents users
 * from being blocked by a category that isn't on the list yet. A future
 * phase can expand this list without a schema change (category is a
 * plain text column).
 */
export const EXPENSE_CATEGORIES = [
  "rent",
  "utilities",
  "transportation",
  "packaging",
  "marketing",
  "salary",
  "maintenance",
  "equipment",
  "other",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export function isValidExpenseCategory(value: string): value is ExpenseCategory {
  return (EXPENSE_CATEGORIES as readonly string[]).includes(value);
}
