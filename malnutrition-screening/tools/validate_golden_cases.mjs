import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { analyzeScreening } from "../js/diagnosis.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function assertNear(actual, expected, tolerance, label) {
  if (actual == null) throw new Error(`${label}: actual value is null`);
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`${label}: expected ${expected} +/- ${tolerance}, got ${actual}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const lmsPath = path.join(__dirname, "..", "data", "lms.json");
  const goldenPath = path.join(__dirname, "..", "data", "golden_cases.json");
  const lms = JSON.parse(await fs.readFile(lmsPath, "utf8"));
  const golden = JSON.parse(await fs.readFile(goldenPath, "utf8"));

  const tolerance = Number(golden.tolerance ?? 0.02);
  let pass = 0;
  for (const c of golden.cases || []) {
    const result = analyzeScreening({ lms, ...c.input });
    const expect = c.expect || {};
    const zScoresNear = expect.zScoresNear || {};
    for (const [k, v] of Object.entries(zScoresNear)) {
      assertNear(result.zScores[k], v, tolerance, `${c.name}.${k}`);
    }
    for (const zNull of expect.zScoresNull || []) {
      assert(result.zScores[zNull] == null, `${c.name}.${zNull} expected null`);
    }
    if (expect.whzModeIncludes) {
      assert(
        String(result.whzMode || "").includes(expect.whzModeIncludes),
        `${c.name}.whzMode expected to include "${expect.whzModeIncludes}"`
      );
    }
    if (expect.acuteCombinedLevel) {
      assert(
        result.acuteCombined.level === expect.acuteCombinedLevel,
        `${c.name}.acuteCombined expected ${expect.acuteCombinedLevel}, got ${result.acuteCombined.level}`
      );
    }
    pass += 1;
  }

  console.log(`Golden validation passed: ${pass} case(s).`);
}

main().catch((err) => {
  console.error(err.message || String(err));
  process.exit(1);
});
