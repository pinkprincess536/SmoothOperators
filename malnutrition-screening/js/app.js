import { analyzeScreening } from "./diagnosis.js";
import {
  loadLmsRecord,
  saveLmsJson,
  clearLmsJson,
  saveScreeningRecord,
  listScreeningRecords,
  replaceScreeningRecords,
  clearScreeningRecords,
} from "./storage.js";
import * as ai from "./ai.js";

const $ = (id) => document.getElementById(id);

let lmsCache = null;
const aiImages = { face: null, front: null, back: null };

function setRecordsStatus(text, ok) {
  const el = $("records-status");
  if (!el) return;
  el.textContent = text;
  el.classList.toggle("status-ok", !!ok);
  el.classList.toggle("status-bad", ok === false);
}

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

function fmtIso(ts) {
  if (!ts) return null;
  const d = new Date(ts);
  if (Number.isNaN(d.valueOf())) return null;
  return d.toLocaleString();
}

function describeLms(data, source, savedAtUtc) {
  const version = data?.meta?.schema_version || "unknown-version";
  const generatedAt = fmtIso(data?.meta?.generated_at_utc);
  const savedAt = fmtIso(savedAtUtc);
  const parts = [`LMS loaded (${source})`, `schema: ${version}`];
  if (generatedAt) parts.push(`generated: ${generatedAt}`);
  if (savedAt) parts.push(`stored: ${savedAt}`);
  return `${parts.join(" | ")}.`;
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
    const bundled = await fetchBundledLms();
    if (hasLmsData(bundled)) {
      lmsCache = bundled;
      setLmsStatus(describeLms(bundled, "bundled data/lms.json", null), true);
      await saveLmsJson(bundled);
      return;
    }
  } catch {
    /* offline or missing bundle */
  }

  try {
    const fromIdb = await loadLmsRecord();
    if (fromIdb && hasLmsData(fromIdb.data)) {
      lmsCache = fromIdb.data;
      setLmsStatus(describeLms(fromIdb.data, "device storage (IndexedDB)", fromIdb.savedAtUtc), true);
      return;
    }
  } catch {
    /* no idb */
  }

  lmsCache = null;
  setLmsStatus("No LMS data. Upload JSON or place data/lms.json (see tools/convert_lms_excel_to_json.py).", false);
}

// AI Integration
async function initAI() {
  const ok = await ai.loadModel();
  const statusEl = $("model-status");
  if (ok) {
    statusEl.textContent = "Ready";
    statusEl.style.color = "#81c784";
  } else {
    statusEl.textContent = "Model missing. Please export and place in /model directory.";
    statusEl.style.color = "#ef9a9a";
  }
}

function handleImageInput(inputId, imgId) {
  const input = $(inputId);
  const preview = $(imgId);
  input.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      preview.src = url;
      preview.style.display = "block";
      const key = inputId.split("-")[1];
      aiImages[key] = preview;
      checkAiReady();
    }
  });
}

async function runCombinedAnalysis() {
  const dashboard = $("results-dashboard");
  dashboard.style.display = "grid";
  dashboard.scrollIntoView({ behavior: "smooth" });

  // 1. Run Clinical Screening
  run();

  // 2. Run AI Prediction (if images are present)
  const hasImages = aiImages.face && aiImages.front && aiImages.back;
  if (hasImages) {
    await runAiPrediction();
  } else {
    $("ai-waiting").style.display = "block";
    $("ai-result").style.display = "none";
  }
}

async function runAiPrediction() {
  const resultEl = $("ai-result");
  const waitingEl = $("ai-waiting");
  const labelEl = $("ai-prediction-label");
  const confEl = $("ai-prediction-conf");

  try {
    waitingEl.style.display = "none";
    resultEl.style.display = "block";
    labelEl.textContent = "Analyzing images...";
    confEl.textContent = "Please wait";

    const result = await ai.predict(aiImages);

    labelEl.textContent = result.label;
    confEl.textContent = `Confidence: ${result.confidence}`;
    
    // Add success class to the ring if needed
    resultEl.className = `ai-content ai-${result.label.toLowerCase()}`;
  } catch (err) {
    console.error(err);
    labelEl.textContent = "Error";
    confEl.textContent = "Check model files";
    alert("AI Prediction failed. Ensure the model is loaded in the browser.");
  }
}

function render(result) {
  // Clinical Panel
  $("out-waz").textContent = fmtZ(result.zScores.waz);
  $("out-haz").textContent = fmtZ(result.zScores.haz);
  $("out-whz").textContent = fmtZ(result.zScores.whz);
  $("out-baz").textContent = fmtZ(result.zScores.baz);

  const setPill = (id, c) => {
    const el = $(id);
    if (!el) return;
    el.textContent = c.label;
    el.className = levelClass(c.level);
  };

  if (result.classifications.waz) setPill("pill-waz", result.classifications.waz);
  if (result.classifications.haz) setPill("pill-haz", result.classifications.haz);
  if (result.classifications.whz) setPill("pill-whz", result.classifications.whz);
  if (result.classifications.baz) setPill("pill-baz", result.classifications.baz);

  $("status-underweight").textContent = result.nutritionStatus?.underweight?.label || "—";
  $("status-underweight").className = levelClass(result.nutritionStatus?.underweight?.level);
  
  $("status-stunting").textContent = result.nutritionStatus?.stunting?.label || "—";
  $("status-stunting").className = levelClass(result.nutritionStatus?.stunting?.level);
  
  $("status-wasting").textContent = result.nutritionStatus?.wasting?.label || "—";
  $("status-wasting").className = levelClass(result.nutritionStatus?.wasting?.level);

  $("muac-summary").textContent = result.muac.label;

  const ac = result.acuteCombined;
  const acEl = $("acute-combined");
  acEl.textContent = ac.label || "Acute: " + ac.level;
  acEl.className = acuteBannerClass(ac.level);

  // Diagnosis Panel (Combined Assessment)
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
  confEl.className = `confidence confidence-${conf.level}`;
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
  const data = readForm();
  if (!data.ageMonths || !data.weightKg || !data.heightCm) return;
  
  const result = analyzeScreening(data);
  render(result);
  
  saveScreeningRecord({ input: result.input, result })
    .then(() => refreshRecordsStatus())
    .catch(() => console.warn("Local save failed"));
}

async function refreshRecordsStatus() {
  const rows = await listScreeningRecords();
  const count = rows.length;
  // silent update
}

async function exportRecordsJson() {
  const rows = await listScreeningRecords();
  const payload = { schema: "screening-records-v1", records: rows };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "malnutrition-records.json";
  a.click();
}

async function onUploadLms(file) {
  if (!file) return;
  const text = await file.text();
  const data = JSON.parse(text);
  await saveLmsJson(data);
  lmsCache = data;
  setLmsStatus("LMS Updated", true);
  run();
}

function registerSw() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

// Event Listeners
$("btn-analyze-all").addEventListener("click", () => runCombinedAnalysis());

$("lms-file").addEventListener("change", (e) => {
  onUploadLms(e.target.files[0]).catch(err => alert(err.message));
});

$("btn-export-records").addEventListener("click", () => exportRecordsJson());
$("btn-clear-records").addEventListener("click", async () => {
  if(confirm("Clear all records?")) {
    await clearScreeningRecords();
    alert("Records cleared");
  }
});

// Setup image inputs
handleImageInput("input-face", "preview-face");
handleImageInput("input-front", "preview-front");
handleImageInput("input-back", "preview-back");

registerSw();
initLms().then(() => run());
initAI();

