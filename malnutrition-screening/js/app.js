const API_URL = 'http://127.0.0.1:5000';
const YOLO_API_URL = 'http://127.0.0.1:5001';

import { loadLmsJson, saveLmsJson, saveScreeningRecord, getRecordsByAadhar, listScreeningRecords } from './storage.js';
import { analyzeScreening } from './diagnosis.js';
import { generateReport } from './report.js';
import { applyLang, t, tLabel, tSign, tCondition, tAILabel, currentLang } from './i18n.js';

// ─── ANALYSIS STATE ───────────────────────────────────────────────────────────
const _state = {
  zScoreResult: null,
  resnetData: null,
  yoloData: null,
};

// Track current key for re-translatable dynamic status fields
const _status = {
  model: 'lmsLoading',
  lms: 'lmsLoading',
};

// ─── LANGUAGE SELECTOR ────────────────────────────────────────────────────────
document.getElementById('global-lang').addEventListener('change', e => {
  applyLang(e.target.value);
  rerenderDynamic();
  if (document.getElementById('report-modal').style.display !== 'none') {
    renderReport();
  }
});

function rerenderDynamic() {
  // Status bars (tracked keys)
  document.getElementById('model-status').textContent = t(_status.model);
  document.getElementById('lms-status').textContent = t(_status.lms);

  // Re-render clinical results with translated labels
  if (_state.zScoreResult) {
    renderClinicalResults(_state.zScoreResult);
  } else {
    document.getElementById('acute-combined').textContent = t('waitingInput');
  }

  // AI waiting state
  const aiWaiting = document.getElementById('ai-waiting');
  if (aiWaiting.style.display !== 'none' && !_state.resnetData) {
    aiWaiting.querySelector('p').textContent = t('aiUploadHint');
  }

  // Re-render AI result labels
  if (_state.resnetData) {
    rerenderAIResult(_state.resnetData);
  }

  // Re-render YOLO results
  if (_state.yoloData) {
    rerenderYOLO(_state.yoloData);
  }
}

// ─── FILE INPUTS → PREVIEW ───────────────────────────────────────────────────
const uploadedFiles = { face: null, front: null, back: null };

['face', 'front', 'back'].forEach(view => {
  const input = document.getElementById(`input-${view}`);
  const preview = document.getElementById(`preview-${view}`);
  input.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    uploadedFiles[view] = file;
    preview.src = URL.createObjectURL(file);
    preview.style.display = 'block';
  });
});

// ─── SERVER HEALTH CHECK ──────────────────────────────────────────────────────
async function checkServer() {
  const bar = document.getElementById('model-status');
  try {
    const res = await fetch(`${API_URL}/health`);
    if (res.ok) {
      _status.model = 'modelReady';
      bar.textContent = t('modelReady');
      document.getElementById('model-status-bar').classList.add('status-ready');
    }
  } catch {
    _status.model = 'modelOffline';
    bar.textContent = t('modelOffline');
    document.getElementById('model-status-bar').classList.remove('status-ready');
  }
}

// ─── LMS ─────────────────────────────────────────────────────────────────────
document.getElementById('lms-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const json = JSON.parse(await file.text());
    await saveLmsJson(json);
    _status.lms = 'lmsLoaded';
    document.getElementById('lms-status').textContent = t('lmsLoaded');
  } catch {
    _status.lms = 'lmsError';
    document.getElementById('lms-status').textContent = t('lmsError');
  }
});

async function initLMS() {
  const lms = await loadLmsJson();
  _status.lms = lms ? 'lmsFromDB' : 'lmsMissing';
  document.getElementById('lms-status').textContent = t(_status.lms);
}

async function autoFetchLms() {
  try {
    const res = await fetch('./data/lms.json');
    if (!res.ok) throw new Error();
    const json = await res.json();
    await saveLmsJson(json);
    _status.lms = 'lmsReady';
    document.getElementById('lms-status').textContent = t('lmsReady');
  } catch {
    _status.lms = 'lmsAutoFail';
    document.getElementById('lms-status').textContent = t('lmsAutoFail');
  }
}

// ─── MAIN BUTTON ─────────────────────────────────────────────────────────────
document.getElementById('btn-analyze-all').addEventListener('click', async () => {
  const form = document.getElementById('form-screening');
  if (!form.reportValidity()) return;

  await runClinicalScreening();
  
  const hasImages = uploadedFiles.face || uploadedFiles.front || uploadedFiles.back;
  if (hasImages) {
    await Promise.all([runAIAnalysis(), runYOLODetection()]);
  } else {
    showAIWaiting(t('aiNeedImages'));
  }
  
  document.getElementById('btn-generate-report').style.display = '';

  try {
    const record = {
      input: getPatientInputs(),
      result: {
        clinical: _state.zScoreResult ? JSON.parse(JSON.stringify(_state.zScoreResult)) : null,
        resnet: _state.resnetData ? JSON.parse(JSON.stringify(_state.resnetData)) : null,
        yolo: _state.yoloData ? JSON.parse(JSON.stringify(_state.yoloData)) : null
      }
    };
    await saveScreeningRecord(record);
    console.log("Successfully saved record to DB", record);
  } catch (err) {
    alert("Database Save Error: " + err.message);
  }
});

// ─── REPORT ───────────────────────────────────────────────────────────────────
function getPatientInputs() {
  return {
    aadhar: document.getElementById('aadhar').value,
    age: document.getElementById('age').value,
    sex: document.getElementById('sex').value,
    weight: document.getElementById('weight').value,
    height: document.getElementById('height').value,
    muac: document.getElementById('muac').value,
  };
}

function renderReport() {
  const { html, risk } = generateReport(
    _state.zScoreResult, _state.resnetData, _state.yoloData,
    getPatientInputs(), currentLang()
  );
  document.getElementById('report-content').innerHTML = html;
  document.getElementById('report-modal').dataset.risk = risk;
}

document.getElementById('btn-generate-report').addEventListener('click', () => {
  renderReport();
  document.getElementById('report-modal').style.display = 'flex';
});

document.getElementById('btn-close-report').addEventListener('click', () => {
  document.getElementById('report-modal').style.display = 'none';
});

document.getElementById('report-modal').addEventListener('click', e => {
  if (e.target === e.currentTarget) e.currentTarget.style.display = 'none';
});

document.getElementById('btn-print-report').addEventListener('click', () => {
  window.print();
});

// ─── CLINICAL SCREENING ───────────────────────────────────────────────────────
async function runClinicalScreening() {
  document.getElementById('results-dashboard').style.display = 'grid';
  const lms = await loadLmsJson();
  const ageMonths = document.getElementById('age').value || null;
  const sex = document.getElementById('sex').value;
  const weightKg = document.getElementById('weight').value || null;
  const heightCm = document.getElementById('height').value || null;
  const muacMm = document.getElementById('muac').value || null;

  const result = analyzeScreening({ lms, ageMonths, weightKg, heightCm, sex, muacMm });
  _state.zScoreResult = result;
  renderClinicalResults(result);
}

function renderClinicalResults(result) {
  const updateZ = (id, val, cls) => {
    document.getElementById(`out-${id}`).textContent = val !== null ? val : '—';
    const pill = document.getElementById(`pill-${id}`);
    pill.textContent = tLabel(cls.label) || '—';
    pill.className = `pill pill-${cls.level}`;
  };
  updateZ('waz', result.zScores.waz, result.classifications.waz);
  updateZ('haz', result.zScores.haz, result.classifications.haz);
  updateZ('whz', result.zScores.whz, result.classifications.whz);
  updateZ('baz', result.zScores.baz, result.classifications.baz);

  const updateStatus = (id, statusData) => {
    const el = document.getElementById(`status-${id}`);
    el.textContent = tLabel(statusData.label) || '—';
    el.className = `pill pill-${statusData.level}`;
  };
  updateStatus('underweight', result.nutritionStatus.underweight);
  updateStatus('stunting', result.nutritionStatus.stunting);
  updateStatus('wasting', result.nutritionStatus.wasting);

  document.getElementById('muac-summary').textContent =
    tLabel(result.muac.label) || '—';

  const acuteEl = document.getElementById('acute-combined');
  acuteEl.textContent = tLabel(result.acuteCombined.label) || '—';
  acuteEl.className = `acute-banner acute-${result.acuteCombined.level}`;
}

// ─── BINARY AI ANALYSIS ───────────────────────────────────────────────────────
async function runAIAnalysis() {
  document.getElementById('results-dashboard').style.display = 'grid';
  document.getElementById('ai-waiting').innerHTML = `<p>${t('aiAnalysing')}</p>`;
  document.getElementById('ai-waiting').style.display = 'flex';
  document.getElementById('ai-result').style.display = 'none';

  const formData = new FormData();
  for (const view of ['face', 'front', 'back']) {
    if (uploadedFiles[view]) formData.append(view, uploadedFiles[view]);
  }

  let data;
  try {
    const res = await fetch(`${API_URL}/predict`, { method: 'POST', body: formData });
    data = await res.json();
  } catch {
    showAIWaiting(t('aiServerErr')); return;
  }

  document.getElementById('ai-waiting').style.display = 'none';
  document.getElementById('ai-result').style.display = 'block';
  _state.resnetData = data;
  rerenderAIResult(data);
}

function rerenderAIResult(data) {
  const label = data.final_label;
  const avg = data.average_probability;

  document.getElementById('ai-prediction-label').textContent = tAILabel(label).toUpperCase();
  document.getElementById('ai-prediction-conf').textContent =
    t('avgScore', avg.toFixed(3), data.threshold);

  const ring = document.querySelector('.ai-score-ring');
  ring.classList.remove('ring-healthy', 'ring-malnourished');
  ring.classList.add(label === 'healthy' ? 'ring-healthy' : 'ring-malnourished');

  const diagList = document.getElementById('final-diagnosis');
  diagList.innerHTML = '';
  data.views.forEach(({ view, probability, label: vlabel }) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="view-name">${view}</span>
      <span class="view-prob">score: ${probability.toFixed(3)}</span>
      <span class="pill ${vlabel === 'healthy' ? 'pill-normal' : 'pill-sam'}">${tAILabel(vlabel)}</span>`;
    diagList.appendChild(li);
  });

  // Re-render Grad-CAM thumbnails only when we have new image data
  const thumbList = document.getElementById('gradcam-thumbnails');
  if (thumbList.children.length === 0) {
    data.views.forEach(({ view, gradcam_image }) => {
      if (gradcam_image) {
        const thumb = document.createElement('div');
        thumb.style.textAlign = 'center';
        thumb.innerHTML = `
          <img src="data:image/jpeg;base64,${gradcam_image}"
            style="width:120px;height:120px;border-radius:4px;border:1px solid hsl(var(--border));object-fit:cover;"
            title="Grad-CAM ${view}" />
          <div class="k" style="font-size:0.75rem;margin-top:4px;text-transform:capitalize;">${view}</div>`;
        thumbList.appendChild(thumb);
      }
    });
  }

  const confidence = Math.round(label === 'healthy' ? (1 - avg) * 100 : avg * 100);
  const confEl = document.getElementById('confidence');
  confEl.textContent = t('confidence', confidence);
  confEl.className = `confidence confidence-${label === 'healthy' ? 'normal' : 'high'}`;
}

// ─── YOLO SIGN DETECTION ──────────────────────────────────────────────────────
async function runYOLODetection() {
  const dash = document.getElementById('yolo-dashboard');
  const banner = document.getElementById('yolo-severity-banner');
  dash.style.display = 'block';
  banner.textContent = t('yoloRunning');
  banner.className = 'acute-banner acute-na';
  document.getElementById('yolo-images').innerHTML = '';
  document.getElementById('yolo-signs-list').innerHTML = '';

  const formData = new FormData();
  for (const view of ['face', 'front', 'back']) {
    if (uploadedFiles[view]) formData.append(view, uploadedFiles[view]);
  }

  let data;
  try {
    const res = await fetch(`${YOLO_API_URL}/detect`, { method: 'POST', body: formData });
    data = await res.json();
  } catch {
    banner.textContent = t('yoloServerErr'); return;
  }

  _state.yoloData = data;
  rerenderYOLO(data);
}

function rerenderYOLO(data) {
  const banner = document.getElementById('yolo-severity-banner');
  const sevLevelMap = {
    LOW: 'normal', MODERATE: 'moderate', 'LOW-MODERATE': 'moderate',
    HIGH: 'severe', CRITICAL: 'severe',
  };
  const condT = tCondition(data.condition);
  const sevT = tCondition(data.severity);
  banner.textContent = `${condT} — ${sevT}`;
  banner.className = `acute-banner acute-${sevLevelMap[data.severity] || 'na'}`;

  // Annotated image row — rebuild only if empty (images don't change with lang)
  const imgRow = document.getElementById('yolo-images');
  if (imgRow.children.length === 0) {
    for (const [view, result] of Object.entries(data.views)) {
      const col = document.createElement('div');
      col.className = 'yolo-view-col';
      col.innerHTML = `
        <p class="k" style="margin-bottom:0.5rem;text-transform:capitalize;font-weight:600;">
          ${view} <span class="badge badge-ai">${result.signs.length} ${t('signLabel')}</span>
        </p>
        <img src="data:image/jpeg;base64,${result.annotated_image}"
          class="yolo-annotated-img" alt="${view}" />`;
      imgRow.appendChild(col);
    }
  } else {
    // Just update sign count badges when re-rendering for language change
    imgRow.querySelectorAll('.badge.badge-ai').forEach((badge, i) => {
      const signs = Object.values(data.views)[i]?.signs || [];
      badge.textContent = `${signs.length} ${t('signLabel')}`;
    });
  }

  // Signs grid — fully rebuild (text changes with language)
  const allSigns = Object.values(data.views).flatMap(v => v.signs);
  const signsList = document.getElementById('yolo-signs-list');
  const noSigns = document.getElementById('yolo-no-signs');
  signsList.innerHTML = '';

  if (allSigns.length === 0) {
    noSigns.textContent = t('noSignsFound');
    noSigns.style.display = 'block';
  } else {
    noSigns.style.display = 'none';
    allSigns.forEach(s => {
      const card = document.createElement('div');
      card.className = 'sign-card';
      const verifiedBadge = s.verified
        ? `<span class="pill pill-normal">${t('verified')}</span>`
        : `<span class="pill pill-moderate">${t('unverified')}</span>`;
      const conditionT = tCondition(s.condition);
      card.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;">
          <strong style="font-size:0.9rem;text-transform:capitalize;">${tSign(s.sign)}</strong>
          ${verifiedBadge}
        </div>
        <p style="font-size:0.8rem;color:var(--muted-foreground);margin:0 0 0.75rem;">${s.description}</p>
        <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
          <span class="pill pill-na">YOLO ${(s.yolo_conf * 100).toFixed(0)}%</span>
          <span class="pill pill-na">ResNet18 ${(s.resnet_conf * 100).toFixed(0)}%</span>
          <span class="pill ${s.condition.includes('Kwashiorkor') ? 'pill-severe' : 'pill-moderate'}">${conditionT}</span>
        </div>`;
      signsList.appendChild(card);
    });
  }
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function showAIWaiting(msg) {
  document.getElementById('results-dashboard').style.display = 'grid';
  document.getElementById('ai-waiting').innerHTML = `<p>${msg}</p>`;
  document.getElementById('ai-waiting').style.display = 'flex';
  document.getElementById('ai-result').style.display = 'none';
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
checkServer();
initLMS();
autoFetchLms();

// ─── HISTORY UI ─────────────────────────────────────────────────────────────
document.getElementById('btn-view-history').addEventListener('click', async () => {
  const aadhar = document.getElementById('aadhar').value.trim();
  if (!aadhar) {
    alert("Please enter an Aadhar number to view its history.");
    return;
  }
  const records = await getRecordsByAadhar(aadhar);
  
  const list = document.getElementById('history-list');
  list.innerHTML = '';

  if (records.length === 0) {
    list.innerHTML = `<li>No history found for Aadhar ${aadhar}.</li>`;
  } else {
    records.sort((a,b) => new Date(b.createdAtUtc) - new Date(a.createdAtUtc)); // newest first
    records.forEach(r => {
      const dateStr = new Date(r.createdAtUtc).toLocaleString();
      const severities = [];
      if (r.result?.clinical?.acuteCombined?.label) severities.push(`Clinical: ${r.result.clinical.acuteCombined.label}`);
      if (r.result?.yolo?.severity) severities.push(`AI: ${r.result.yolo.severity}`);
      
      const recordAadhar = r.input?.aadhar || 'Unknown';
      
      const li = document.createElement('li');
      li.style.border = "1px solid hsl(var(--border))";
      li.style.padding = "0.75rem";
      li.style.borderRadius = "8px";
      li.style.background = "hsl(var(--card))";
      li.innerHTML = `
        <div style="display:flex; justify-content:space-between;">
          <strong style="font-size:0.9rem; margin-bottom:4px; color:hsl(var(--foreground));">Aadhar: ${recordAadhar}</strong>
          <span style="font-size:0.8rem; color:hsl(var(--muted-foreground));">Date: ${dateStr}</span>
        </div>
        <div style="font-weight:bold; color:hsl(var(--foreground)); margin-bottom:0.75rem;">${severities.join(' | ')}</div>
        <button class="btn-ghost" style="padding:0.35rem 0.75rem; font-size:0.75rem;">View Full Report</button>
      `;
      
      li.querySelector('button').addEventListener('click', () => {
        const { html, risk } = generateReport(
          r.result?.clinical, r.result?.resnet, r.result?.yolo,
          r.input, currentLang()
        );
        document.getElementById('report-content').innerHTML = html;
        document.getElementById('report-modal').dataset.risk = risk;
        document.getElementById('report-modal').style.display = 'flex';
      });

      list.appendChild(li);
    });
  }
  document.getElementById('history-modal').style.display = 'flex';
});

document.getElementById('btn-close-history').addEventListener('click', () => {
  document.getElementById('history-modal').style.display = 'none';
});

document.getElementById('history-modal').addEventListener('click', e => {
  if (e.target === e.currentTarget) e.currentTarget.style.display = 'none';
});
