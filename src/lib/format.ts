/**
 * SHARED FORMATTING UTILITIES (Phase 6 UX polish)
 * ---------------------------------------------------------------------------
 * Every component previously redefined its own local `formatCurrency`/
 * `formatDate` function - identical implementations, copy-pasted across
 * ~10 files. Centralizing them here removes that duplication and
 * guarantees money and date formatting is actually consistent
 * everywhere in the app, per the Phase 6 UX polish requirement.
 *
 * Behavior is unchanged from the original per-component versions - this
 * is a pure refactor, not a formatting change.
 */

/** Currency-formatted money string (e.g. "Rp10.800"). Null/undefined renders as "—" (no value yet) rather than a misleading Rp0; invalid currency codes fall back to plain-text formatting. */
export function formatCurrency(value: number | null | undefined, currency: string): string {
  if (value === null || value === undefined) return "—";
  try {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

/** Medium-length date only (e.g. "23 Agu 2026"). */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", { dateStyle: "medium" });
}

/** Medium-length date + short time (e.g. "23 Agu 2026, 10.15"). */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

/** Today's date as a yyyy-mm-dd string, for pre-filling `<input type="date">` fields. */
export function todayDateInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}
