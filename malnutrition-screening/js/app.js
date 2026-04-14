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

const $ = (id) => document.getElementById(id);

let lmsCache = null;

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

  const setStatus = (id, status) => {
    const el = $(id);
    el.textContent = status?.label || "—";
    el.className = levelClass(status?.level);
  };
  setStatus("status-underweight", result.nutritionStatus?.underweight);
  setStatus("status-stunting", result.nutritionStatus?.stunting);
  setStatus("status-wasting", result.nutritionStatus?.wasting);
  setStatus("status-bmi", result.nutritionStatus?.bmiStatus);

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
  const hasCoreScores = Object.values(result.zScores || {}).some((v) => v != null);
  if (!hasCoreScores) return;
  saveScreeningRecord({ input: result.input, result })
    .then(() => refreshRecordsStatus())
    .catch(() => setRecordsStatus("Could not save this screening record locally.", false));
}

async function refreshRecordsStatus() {
  const rows = await listScreeningRecords();
  const count = rows.length;
  const last = rows[count - 1];
  const lastAt = fmtIso(last?.createdAtUtc);
  const tail = lastAt ? ` Last saved: ${lastAt}.` : "";
  setRecordsStatus(`${count} local record(s) stored.${tail}`, true);
}

async function exportRecordsJson() {
  const rows = await listScreeningRecords();
  const payload = {
    schema: "screening-records-v1",
    exportedAtUtc: new Date().toISOString(),
    records: rows,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `malnutrition-records-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  setRecordsStatus(`Exported ${rows.length} record(s) to JSON.`, true);
}

async function importRecordsJson(file) {
  if (!file) return;
  const text = await file.text();
  const payload = JSON.parse(text);
  if (!payload || !Array.isArray(payload.records)) {
    throw new Error("Invalid records JSON format. Expected { records: [] }.");
  }
  await replaceScreeningRecords(payload.records);
  await refreshRecordsStatus();
}

async function onUploadLms(file) {
  if (!file) return;
  const text = await file.text();
  const data = JSON.parse(text);
  if (!hasLmsData(data)) throw new Error("JSON must contain waz, haz, whz, baz with M and F arrays.");
  await saveLmsJson(data);
  lmsCache = data;
  setLmsStatus(describeLms(data, "uploaded JSON", new Date().toISOString()), true);
  run();
}

function registerSw() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker
    .register("sw.js")
    .then((reg) => {
      const askRefresh = () => {
        const ok = window.confirm("A new app version is available. Refresh now?");
        if (!ok) return;
        if (reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });
      };
      if (reg.waiting) askRefresh();
      reg.addEventListener("updatefound", () => {
        const installing = reg.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          if (installing.state === "installed" && navigator.serviceWorker.controller) askRefresh();
        });
      });
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        window.location.reload();
      });
      window.setTimeout(() => reg.update().catch(() => {}), 3000);
    })
    .catch(() => {});
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
  setLmsStatus("Clearing device-stored LMS data...", true);
  try {
    const beforeClear = await loadLmsRecord().catch(() => null);
    await clearLmsJson();
    const afterClear = await loadLmsRecord().catch(() => null);
    const cleared = afterClear == null;
    const verifiedAt = new Date().toLocaleTimeString();
    const verification = `Verification @ ${verifiedAt} | before-clear: ${
      beforeClear ? "present" : "missing"
    } | after-clear: ${cleared ? "empty" : "still present"}.`;
    lmsCache = null;
    setLmsStatus(
      `LMS cleared from device/runtime. Screening is paused until refresh (to reload bundled data/lms.json) or LMS upload. ${verification}`,
      false
    );
    run();
  } catch (err) {
    setLmsStatus(`Could not clear LMS data: ${err?.message || String(err)}`, false);
  }
});

$("btn-export-records").addEventListener("click", () => {
  exportRecordsJson().catch((err) => setRecordsStatus(err.message || String(err), false));
});

$("btn-import-records").addEventListener("click", () => {
  $("records-file").click();
});

$("records-file").addEventListener("change", (e) => {
  const f = e.target.files && e.target.files[0];
  importRecordsJson(f).catch((err) => setRecordsStatus(err.message || String(err), false));
  e.target.value = "";
});

$("btn-clear-records").addEventListener("click", async () => {
  await clearScreeningRecords();
  await refreshRecordsStatus();
});

registerSw();
initLms()
  .then(() => run())
  .then(() => refreshRecordsStatus())
  .catch(() => setRecordsStatus("Could not read local screening records.", false));
