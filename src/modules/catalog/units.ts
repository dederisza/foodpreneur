/**
 * Recipe quantity/unit model for Phase 2.
 *
 * DELIBERATE SIMPLIFICATION (Phase 2 instructions, Section 10): there is
 * no unit-conversion engine. A recipe quantity is always expressed in the
 * ingredient's own `baseUnit` — the UI enforces this by simply not asking
 * for a unit on the recipe line at all; it displays the ingredient's unit
 * next to the quantity field instead. This trades flexibility (e.g. "0.5
 * kg of an ingredient priced per gram") for correctness: there is no
 * possibility of a silent unit mismatch corrupting HPP.
 */
export const BASE_UNITS = [
  "gram",
  "kilogram",
  "milliliter",
  "liter",
  "piece",
  "portion",
  "other",
] as const;

export type BaseUnit = (typeof BASE_UNITS)[number];

export function isValidBaseUnit(value: string): value is BaseUnit {
  return (BASE_UNITS as readonly string[]).includes(value);
}
