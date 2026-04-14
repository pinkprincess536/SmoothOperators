import { interpolateLMS, zScore } from "./lms.js";
import { classifyMUAC, whzToAcuteLevel, worstAcute, acuteLevelsAgree, MUAC_AGE_MIN_MO, MUAC_AGE_MAX_MO } from "./muac.js";

function round2(x) {
  if (x == null || Number.isNaN(x)) return null;
  return Math.round(Number(x) * 100) / 100;
}

function classifyZ(z, highThreshold = 2) {
  if (z == null) return { label: "Not applicable", level: "na" };
  if (z < -3) return { label: "Severe deficit", level: "severe" };
  if (z < -2) return { label: "Moderate deficit", level: "moderate" };
  if (z > highThreshold) return { label: "Elevated (overnutrition risk)", level: "over" };
  return { label: "Normal range", level: "normal" };
}

function namedStatus(axis, classification) {
  const c = classification || { label: "Not applicable", level: "na" };
  if (axis === "underweight") {
    if (c.level === "severe") return "Severe underweight";
    if (c.level === "moderate") return "Moderate underweight";
    if (c.level === "normal") return "No underweight";
    return "Underweight not applicable";
  }
  if (axis === "stunting") {
    if (c.level === "severe") return "Severe stunting";
    if (c.level === "moderate") return "Moderate stunting";
    if (c.level === "normal") return "No stunting";
    return "Stunting not applicable";
  }
  if (axis === "wasting") {
    if (c.level === "severe") return "Severe wasting";
    if (c.level === "moderate") return "Moderate wasting";
    if (c.level === "normal") return "No wasting";
    return "Wasting not applicable";
  }
  if (axis === "bmi") {
    if (c.level === "severe") return "Severe thinness";
    if (c.level === "moderate") return "Moderate thinness";
    if (c.level === "over") return "Overweight / overnutrition risk";
    if (c.level === "normal") return "Normal BMI-for-age";
    return "BMI-for-age not applicable";
  }
  return c.label;
}

/**
 * @param {object} params
 * @param {object} params.lms - loaded LMS JSON
 */
export function analyzeScreening({
  lms,
  ageMonths,
  weightKg,
  heightCm,
  sex,
  muacMm,
}) {
  const S = sex === "F" ? "F" : "M";
  const age = Number(ageMonths);
  const w = Number(weightKg);
  const h = Number(heightCm);

  const missing = [];
  if (Number.isNaN(age)) missing.push("age");
  if (Number.isNaN(w) || w <= 0) missing.push("weight");
  if (Number.isNaN(h) || h <= 0) missing.push("height");

  const errors = [];
  if (!lms || typeof lms !== "object") errors.push("LMS database not loaded.");

  const result = {
    input: { ageMonths: age, weightKg: w, heightCm: h, sex: S, muacMm: muacMm === "" ? null : muacMm },
    zScores: { waz: null, haz: null, whz: null, baz: null },
    whzMode: null,
    classifications: {},
    nutritionStatus: {
      underweight: { label: "—", level: "na" },
      stunting: { label: "—", level: "na" },
      wasting: { label: "—", level: "na" },
      bmiStatus: { label: "—", level: "na" },
    },
    muac: classifyMUAC(muacMm, age),
    acuteCombined: { level: "na", label: "", sources: [] },
    finalDiagnosis: [],
    confidence: { level: "low", label: "Low", detail: "" },
    validationNotes: [],
  };

  if (missing.length) {
    result.finalDiagnosis = [`Missing required input: ${missing.join(", ")}`];
    result.confidence = { level: "low", label: "Low", detail: "Complete age, weight, and height." };
    result.classifications = {
      waz: { label: "—", level: "na" },
      haz: { label: "—", level: "na" },
      whz: { label: "—", level: "na" },
      baz: { label: "—", level: "na" },
    };
    result.nutritionStatus = {
      underweight: { label: "Underweight not applicable", level: "na" },
      stunting: { label: "Stunting not applicable", level: "na" },
      wasting: { label: "Wasting not applicable", level: "na" },
      bmiStatus: { label: "BMI-for-age not applicable", level: "na" },
    };
    result.acuteCombined = { level: "na", label: "—", sources: [] };
    return result;
  }
  if (errors.length) {
    result.finalDiagnosis = ["Unable to calculate one or more growth indices for this input."];
    result.confidence = { level: "low", label: "Low", detail: "Load valid LMS JSON to compute z-scores." };
    result.classifications = {
      waz: { label: "—", level: "na" },
      haz: { label: "—", level: "na" },
      whz: { label: "—", level: "na" },
      baz: { label: "—", level: "na" },
    };
    result.nutritionStatus = {
      underweight: { label: "Underweight not applicable", level: "na" },
      stunting: { label: "Stunting not applicable", level: "na" },
      wasting: { label: "Wasting not applicable", level: "na" },
      bmiStatus: { label: "BMI-for-age not applicable", level: "na" },
    };
    result.acuteCombined = { level: "na", label: "—", sources: [] };
    return result;
  }

  const bmi = w / (h / 100) ** 2;

  let waz = null;
  if (age <= 120) {
    const row = interpolateLMS(lms, "waz", age, S, "age");
    if (!row) errors.push("WAZ: no LMS rows for this sex/age.");
    else waz = zScore(w, row.L, row.M, row.S);
  }

  const hazRow = interpolateLMS(lms, "haz", age, S, "age");
  if (!hazRow) errors.push("HAZ: no LMS rows for this sex/age.");
  const haz = hazRow ? zScore(h, hazRow.L, hazRow.M, hazRow.S) : null;

  let whz = null;
  let whzMode = "Not applicable (>5 yrs)";
  if (age <= 60) {
    const measurement = age < 24 ? h + 0.7 : h;
    const ageBand = age < 24 ? "0-2" : "2-5";
    whzMode = age < 24 ? "Weight-for-length (0–23 mo, length +0.7 cm correction)" : "Weight-for-height (24–60 mo)";
    const whzRow = interpolateLMS(lms, "whz", measurement, S, "height", { ageBand });
    if (!whzRow) errors.push("WHZ: no LMS rows for this sex/height.");
    else whz = zScore(w, whzRow.L, whzRow.M, whzRow.S);
  }

  const bazRow = interpolateLMS(lms, "baz", age, S, "age");
  if (!bazRow) errors.push("BAZ: no LMS rows for this sex/age.");
  const baz = bazRow ? zScore(bmi, bazRow.L, bazRow.M, bazRow.S) : null;

  if (errors.length) {
    result.finalDiagnosis = ["Unable to calculate one or more growth indices for this input."];
    result.confidence = { level: "low", label: "Low", detail: "Fix LMS data coverage or regenerate JSON." };
    result.classifications = {
      waz: { label: "—", level: "na" },
      haz: { label: "—", level: "na" },
      whz: { label: "—", level: "na" },
      baz: { label: "—", level: "na" },
    };
    result.nutritionStatus = {
      underweight: { label: "Underweight not applicable", level: "na" },
      stunting: { label: "Stunting not applicable", level: "na" },
      wasting: { label: "Wasting not applicable", level: "na" },
      bmiStatus: { label: "BMI-for-age not applicable", level: "na" },
    };
    result.acuteCombined = { level: "na", label: "—", sources: [] };
    return result;
  }

  result.zScores = {
    waz: round2(waz),
    haz: round2(haz),
    whz: round2(whz),
    baz: round2(baz),
  };
  result.whzMode = whzMode;

  const wazC = classifyZ(waz);
  const hazC = classifyZ(haz);
  const whzC = classifyZ(whz);
  const bazC = classifyZ(baz, 2);

  result.classifications = {
    waz: wazC,
    haz: hazC,
    whz: whzC,
    baz: bazC,
  };
  result.nutritionStatus = {
    underweight: { label: namedStatus("underweight", wazC), level: wazC.level },
    stunting: { label: namedStatus("stunting", hazC), level: hazC.level },
    wasting: { label: namedStatus("wasting", whzC), level: whzC.level },
    bmiStatus: { label: namedStatus("bmi", bazC), level: bazC.level },
  };

  const whzAcute = whzToAcuteLevel(whz);
  let muacAcute = "na";
  if (
    muacMm != null &&
    muacMm !== "" &&
    age >= MUAC_AGE_MIN_MO &&
    age <= MUAC_AGE_MAX_MO
  ) {
    muacAcute = result.muac.level === "na" ? "na" : result.muac.level;
  }

  let combined = whzAcute;
  const sources = [];
  if (age <= 60 && whz != null) sources.push("WHZ");
  if (muacAcute !== "na") sources.push("MUAC");

  if (muacAcute !== "na" && age <= 60 && whz != null) {
    combined = worstAcute(whzAcute, muacAcute);
  } else if (muacAcute !== "na") {
    combined = muacAcute;
    if (age > 60) {
      sources.length = 0;
      sources.push("MUAC");
    }
  } else if (age <= 60 && whz != null) {
    combined = whzAcute;
  } else {
    combined = "na";
  }

  result.acuteCombined = {
    level: combined,
    label: acuteLabel(combined),
    sources,
  };

  if (sources.includes("WHZ") && sources.includes("MUAC")) {
    if (acuteLevelsAgree(whzAcute, muacAcute)) {
      result.confidence = {
        level: "high",
        label: "High",
        detail: "WHZ and MUAC both available and agree on acute malnutrition category.",
      };
    } else {
      result.confidence = {
        level: "medium",
        label: "Medium",
        detail: "WHZ and MUAC disagree; worst category selected. Clinical correlation advised.",
      };
    }
  } else if (sources.includes("WHZ")) {
    result.confidence = {
      level: "medium",
      label: "Medium",
      detail: "Acute malnutrition assessment from WHZ only (MUAC missing or not applicable).",
    };
  } else if (sources.includes("MUAC")) {
    result.confidence = {
      level: "medium",
      label: "Medium",
      detail: "Acute malnutrition from MUAC only (WHZ not used: age >60 months or WHZ unavailable).",
    };
  } else {
    result.confidence = {
      level: "low",
      label: "Low",
      detail: "No acute axis (WHZ/MUAC) available for this age/input.",
    };
  }

  const lines = [];
  if (combined === "severe") {
    lines.push("Priority: Severe acute malnutrition (combined WHZ/MUAC logic)");
  } else if (combined === "moderate") {
    lines.push("Priority: Moderate acute malnutrition (combined WHZ/MUAC logic)");
  }

  if (haz != null && haz < -2) {
    lines.push(haz < -3 ? "Severe stunting (HAZ < -3)" : "Moderate stunting (HAZ < -2)");
  }

  if (waz != null && waz < -2) {
    lines.push(waz < -3 ? "Severe underweight (WAZ < -3)" : "Moderate underweight (WAZ < -2)");
  }

  if (baz != null && baz > 2) {
    lines.push("Overnutrition risk (BAZ > +2)");
  }

  if (
    lines.length === 0 &&
    (combined === "normal" || combined === "na") &&
    (haz == null || haz >= -2) &&
    (waz == null || waz >= -2) &&
    (baz == null || baz <= 2)
  ) {
    lines.push("No priority growth deficits detected on available indices (clinical context still required).");
  }

  result.finalDiagnosis = lines;

  result.validationNotes = [
    "NFHS/DHS-style validation requires matching reference tables, survey weights, and age heaping corrections; this tool implements standard WHO LMS mathematics for z-scores only.",
    "MUAC thresholds are fixed public-health cut-offs for 6–59 months; they are not interchangeable with WHZ across all contexts.",
  ];

  return result;
}

function acuteLabel(level) {
  if (level === "severe") return "Severe acute malnutrition (worst of WHZ/MUAC when both apply)";
  if (level === "moderate") return "Moderate acute malnutrition (worst of WHZ/MUAC when both apply)";
  if (level === "normal") return "No acute malnutrition on available acute indices";
  return "Acute classification not applicable";
}
