/**
 * WHO LMS (Lambda-Mu-Sigma): interpolation and z-scores.
 */

export function zScore(x, L, M, S) {
  if (M == null || S == null || S === 0 || x == null || x <= 0) return null;
  if (L === 0) return Math.log(x / M) / S;
  return (Math.pow(x / M, L) - 1) / (L * S);
}

function interpolateRows(rows, value, xKey, options = {}) {
  const { ageBand = null } = options;
  const filtered = ageBand == null ? rows : (rows || []).filter((row) => row.ageBand === ageBand);
  if (!filtered || filtered.length === 0) return null;
  const sorted = [...filtered].sort((a, b) => a[xKey] - b[xKey]);
  const xv = Number(value);
  if (Number.isNaN(xv)) return null;

  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  // Do not extrapolate outside WHO table ranges; returning null lets callers
  // report that input is outside supported LMS coverage.
  if (xv < first[xKey] || xv > last[xKey]) return null;
  if (xv === first[xKey]) return { L: first.L, M: first.M, S: first.S };
  if (xv === last[xKey]) return { L: last.L, M: last.M, S: last.S };

  let lower = first;
  let upper = last;
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (a[xKey] <= xv && xv <= b[xKey]) {
      lower = a;
      upper = b;
      break;
    }
  }

  if (upper[xKey] === lower[xKey]) return { L: lower.L, M: lower.M, S: lower.S };

  const t = (xv - lower[xKey]) / (upper[xKey] - lower[xKey]);
  const interp = (v1, v2) => v1 + t * (v2 - v1);
  return {
    L: interp(lower.L, upper.L),
    M: interp(lower.M, upper.M),
    S: interp(lower.S, upper.S),
  };
}

function getRowsForSex(bundle, sex) {
  if (!bundle) return [];
  const key = sex === "F" ? "F" : "M";
  return bundle[key] || [];
}

/**
 * @param {object} lms - { waz, haz, whz, baz } each { M: rows[], F: rows[] }
 * @param {'waz'|'haz'|'whz'|'baz'} indicator
 * @param {number} value
 * @param {'M'|'F'} sex
 * @param {'age'|'height'} xKey
 */
export function interpolateLMS(lms, indicator, value, sex, xKey, options = {}) {
  const bundle = lms && lms[indicator];
  const rows = getRowsForSex(bundle, sex);
  return interpolateRows(rows, value, xKey, options);
}
