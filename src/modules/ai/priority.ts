import type { Finding, FindingSeverity } from "@/modules/intelligence/types";
import type { FindingRef } from "./types";

/**
 * PRIORITY LOGIC (Phase 5, Section 3)
 * ---------------------------------------------------------------------------
 * Primary order: severity, in the order given in the Phase 5 spec -
 * critical > warning > opportunity > positive > neutral.
 *
 * Secondary order (ties within the same severity): category, using a
 * fixed business-impact ordering - profitability and expense problems
 * are treated as generally more consequential than a single sales
 * metric or activity note when severities are otherwise equal.
 *
 * Tertiary order: the finding's own stable id, alphabetically - this
 * guarantees a fully deterministic result regardless of the order
 * findings happened to be pushed onto the array in rules.ts, and is
 * what makes the same set of findings always produce the same
 * synthesis (verified by the Phase 5 determinism test).
 * ------------------------------------------------------------------------ */
const SEVERITY_RANK: Record<FindingSeverity, number> = {
  critical: 0,
  warning: 1,
  opportunity: 2,
  positive: 3,
  neutral: 4,
};

const CATEGORY_RANK: Record<Finding["category"], number> = {
  profitability: 0,
  expenses: 1,
  sales: 2,
  activity: 3,
};

export function prioritizeFindings(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => {
    const bySeverity = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (bySeverity !== 0) return bySeverity;
    const byCategory = CATEGORY_RANK[a.category] - CATEGORY_RANK[b.category];
    if (byCategory !== 0) return byCategory;
    return a.id.localeCompare(b.id);
  });
}

export function toFindingRef(finding: Finding): FindingRef {
  return {
    id: finding.id,
    category: finding.category,
    severity: finding.severity,
    title: finding.title,
  };
}
