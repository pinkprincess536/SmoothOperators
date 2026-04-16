/** MUAC thresholds (mm), valid ages 6–59 months per requirement. */

export const MUAC_AGE_MIN_MO = 6;
export const MUAC_AGE_MAX_MO = 59;

export const MUAC_SEVERE_MM = 115;
export const MUAC_MODERATE_MM = 125;

/**
 * @returns {{ label: string, level: 'severe'|'moderate'|'normal'|'na', detail: string }}
 */
export function classifyMUAC(muacMm, ageMonths) {
  if (muacMm == null || muacMm === "") {
    return {
      label: "Not provided",
      level: "na",
      detail: "MUAC optional; acute assessment can use WHZ only.",
    };
  }
  const mm = Number(muacMm);
  if (Number.isNaN(mm) || mm <= 0) {
    return { label: "Invalid MUAC", level: "na", detail: "Enter MUAC in millimetres." };
  }

  if (ageMonths < MUAC_AGE_MIN_MO || ageMonths > MUAC_AGE_MAX_MO) {
    return {
      label: "Not applicable for age",
      level: "na",
      detail: `MUAC cut-offs apply only from ${MUAC_AGE_MIN_MO}–${MUAC_AGE_MAX_MO} months.`,
    };
  }

  if (mm < MUAC_SEVERE_MM) {
    return {
      label: "Severe Acute Malnutrition (MUAC)",
      level: "severe",
      detail: `MUAC < ${MUAC_SEVERE_MM} mm`,
    };
  }
  if (mm < MUAC_MODERATE_MM) {
    return {
      label: "Moderate Acute Malnutrition (MUAC)",
      level: "moderate",
      detail: `${MUAC_SEVERE_MM}–${MUAC_MODERATE_MM - 1} mm`,
    };
  }
  return {
    label: "Normal (MUAC)",
    level: "normal",
    detail: `≥ ${MUAC_MODERATE_MM} mm`,
  };
}

/** Map WHZ z to acute level for combination (aligned with -3 / -2 clinical bands). */
export function whzToAcuteLevel(z) {
  if (z == null) return "na";
  if (z < -3) return "severe";
  if (z < -2) return "moderate";
  return "normal";
}

const rank = { na: 0, normal: 1, moderate: 2, severe: 3 };

/** Worst of two acute levels. */
export function worstAcute(a, b) {
  return rank[a] >= rank[b] ? a : b;
}

/** True if both are valid acute levels and identical. */
export function acuteLevelsAgree(a, b) {
  if (a === "na" || b === "na") return false;
  return a === b;
}
