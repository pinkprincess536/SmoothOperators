import { analyzeScreening } from "./diagnosis.js";
import { loadLmsJson, saveLmsJson, clearLmsJson } from "./storage.js";

const $ = (id) => document.getElementById(id);

let lmsCache = null;

function levelClass(level) {
  if (level === "severe") return "pill pill-severe";
  if (level === "moderate") return "pill pill-moderate";
  if (level === "over") return "pill pill-over";
  if (level === "normal") return "pill pill-normal";
  return "pill pill-na";
}

function acuteBannerClass(level) {
  if (level === "severe") return "acute-banner acute-severe";
  if (level === "moderate") return "acute-banner acute-moderate";
  if (level === "normal") return "acute-banner acute-normal";
  return "acute-banner acute-na";
}

function fmtZ(z) {
  if (z == null) return "—";
  return String(z);
}

function setLmsStatus(text, ok) {
  const el = $("lms-status");
  el.textContent = text;
  el.classList.toggle("status-ok", !!ok);
  el.classList.toggle("status-bad", ok === false);
}

async function fetchBundledLms() {
  const res = await fetch("data/lms.json", { cache: "no-cache" });
  if (!res.ok) return null;
  return res.json();
}

function hasLmsData(data) {
  if (!data || typeof data !== "object") return false;
  for (const k of ["waz", "haz", "whz", "baz"]) {
    const b = data[k];
    if (!b) return false;
    const n = (b.M?.length || 0) + (b.F?.length || 0);
    if (n === 0) return false;
  }
  return true;
}

async function initLms() {
  try {
    const fromIdb = await loadLmsJson();
    if (hasLmsData(fromIdb)) {
      lmsCache = fromIdb;
      setLmsStatus("LMS loaded from device storage (IndexedDB).", true);
      return;
    }
  } catch {
    /* no idb */
  }

  try {
    const bundled = await fetchBundledLms();
    if (hasLmsData(bundled)) {
      lmsCache = bundled;
      setLmsStatus("LMS loaded from bundled data/lms.json.", true);
      return;
    }
  } catch {
    /* offline or missing */
  }

  lmsCache = null;
  setLmsStatus("No LMS data. Upload JSON or place data/lms.json (see tools/convert_lms_excel_to_json.py).", false);
}

function render(result) {
  $("out-waz").textContent = fmtZ(result.zScores.waz);
  $("out-haz").textContent = fmtZ(result.zScores.haz);
  $("out-whz").textContent = fmtZ(result.zScores.whz);
  $("out-baz").textContent = fmtZ(result.zScores.baz);

  $("out-whz-mode").textContent = result.whzMode || "—";

  const setPill = (id, c) => {
    const el = $(id);
    el.textContent = c.label;
    el.className = levelClass(c.level);
  };

  if (result.classifications.waz) setPill("pill-waz", result.classifications.waz);
  if (result.classifications.haz) setPill("pill-haz", result.classifications.haz);
  if (result.classifications.whz) setPill("pill-whz", result.classifications.whz);
  if (result.classifications.baz) setPill("pill-baz", result.classifications.baz);

  $("muac-summary").textContent = result.muac.label;
  $("muac-detail").textContent = result.muac.detail;

  const ac = result.acuteCombined;
  const acEl = $("acute-combined");
  acEl.textContent = ac.label;
  acEl.className = acuteBannerClass(ac.level);

  const diag = $("final-diagnosis");
  diag.innerHTML = "";
  result.finalDiagnosis.forEach((line) => {
    const li = document.createElement("li");
    li.textContent = line;
    diag.appendChild(li);
  });

  const conf = result.confidence;
  const confEl = $("confidence");
  confEl.textContent = `${conf.label}: ${conf.detail}`;
  confEl.className = "confidence";
  confEl.classList.add(`confidence-${conf.level}`);

  const vd = $("validation-dynamic");
  vd.innerHTML = "";
  if (result.validationNotes && result.validationNotes.length) {
    result.validationNotes.forEach((note) => {
      const p = document.createElement("p");
      p.style.margin = "0.35rem 0 0";
      p.textContent = note;
      vd.appendChild(p);
    });
  }
}

function readForm() {
  return {
    lms: lmsCache,
    ageMonths: $("age").value,
    weightKg: $("weight").value,
    heightCm: $("height").value,
    sex: $("sex").value,
    muacMm: $("muac").value.trim(),
  };
}

function run() {
  const result = analyzeScreening(readForm());
  render(result);
}

async function onUploadLms(file) {
  if (!file) return;
  const text = await file.text();
  const data = JSON.parse(text);
  if (!hasLmsData(data)) throw new Error("JSON must contain waz, haz, whz, baz with M and F arrays.");
  await saveLmsJson(data);
  lmsCache = data;
  setLmsStatus("LMS saved on device for offline use.", true);
  run();
}

function registerSw() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

$("form-screening").addEventListener("submit", (e) => {
  e.preventDefault();
  run();
});

$("btn-run").addEventListener("click", (e) => {
  e.preventDefault();
  run();
});

$("lms-file").addEventListener("change", (e) => {
  const f = e.target.files && e.target.files[0];
  onUploadLms(f).catch((err) => {
    setLmsStatus(err.message || String(err), false);
  });
  e.target.value = "";
});

$("btn-clear-lms").addEventListener("click", async () => {
  await clearLmsJson();
  await initLms();
  run();
});

registerSw();
initLms().then(() => run());
