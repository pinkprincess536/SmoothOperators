// ─── RULE-BASED REPORT GENERATOR ─────────────────────────────────────────────
// No LLM. Pure deterministic signal fusion using WHO/CMAM thresholds.

// ─── TRANSLATIONS ─────────────────────────────────────────────────────────────
// Condition/severity strings shared with i18n.js (duplicated to keep report.js self-contained)
const CONDITIONS_T = {
  hi: {
    'Marasmus': 'मरास्मस', 'Kwashiorkor': 'क्वाशिओरकोर',
    'Marasmic-Kwashiorkor': 'मरास्मिक-क्वाशिओरकोर',
    'Marasmus / General wasting': 'मरास्मस / सामान्य क्षय',
    'Kwashiorkor / Protein deficiency': 'क्वाशिओरकोर / प्रोटीन कमी',
    'Marasmus indicators present': 'मरास्मस के संकेत मिले',
    'Kwashiorkor indicators present': 'क्वाशिओरकोर के संकेत मिले',
    'Healthy': 'स्वस्थ', 'No condition detected': 'कोई स्थिति नहीं मिली',
    'HIGH': 'उच्च', 'MODERATE': 'मध्यम', 'LOW': 'कम',
    'CRITICAL': 'अत्यंत गंभीर', 'LOW-MODERATE': 'कम-मध्यम',
  },
  mr: {
    'Marasmus': 'मरास्मस', 'Kwashiorkor': 'क्वाशिओरकोर',
    'Marasmic-Kwashiorkor': 'मरास्मिक-क्वाशिओरकोर',
    'Marasmus / General wasting': 'मरास्मस / सामान्य शोष',
    'Kwashiorkor / Protein deficiency': 'क्वाशिओरकोर / प्रथिने कमतरता',
    'Marasmus indicators present': 'मरास्मसची चिन्हे आढळली',
    'Kwashiorkor indicators present': 'क्वाशिओरकोरची चिन्हे आढळली',
    'Healthy': 'निरोगी', 'No condition detected': 'कोणती स्थिती आढळली नाही',
    'HIGH': 'उच्च', 'MODERATE': 'मध्यम', 'LOW': 'कमी',
    'CRITICAL': 'अत्यंत गंभीर', 'LOW-MODERATE': 'कमी-मध्यम',
  },
};

const T = {
  en: {
    title:                  'Patient Risk Assessment',
    riskLabelMalnourished:  'MALNOURISHED',
    riskLabelHealthy:       'HEALTHY',
    generated:       'Generated',
    measurements:    'Patient Measurements',
    age:             'Age',
    months:          'months',
    sex:             'Sex',
    male:            'Male',
    female:          'Female',
    weight:          'Weight',
    height:          'Height',
    muac:            'MUAC',
    zscores:         'Clinical Z-Scores',
    acuteCombined:   'Acute Combined',
    aiClass:         'AI Classification',
    prediction:      'Prediction',
    score:           'Score',
    signDetection:   'Sign Detection',
    condition:       'Condition',
    severity:        'Severity',
    overallRisk:     'Overall Risk Level',
    disclaimer:      'This screening tool supports — but does not replace — clinical assessment by a qualified health professional. All findings require clinical correlation.',
    riskHigh:        'HIGH',
    riskModerate:    'MODERATE',
    riskLow:         'LOW',
  },
  hi: {
    title:           'रोगी जोखिम मूल्यांकन',
    generated:       'तैयार किया गया',
    measurements:    'रोगी माप',
    age:             'आयु',
    months:          'माह',
    sex:             'लिंग',
    male:            'पुरुष',
    female:          'महिला',
    weight:          'वजन',
    height:          'ऊंचाई',
    muac:            'मुआक',
    zscores:         'नैदानिक Z-स्कोर',
    acuteCombined:   'तीव्र संयुक्त',
    aiClass:         'AI वर्गीकरण',
    prediction:      'पूर्वानुमान',
    score:           'स्कोर',
    signDetection:   'संकेत पहचान',
    condition:       'स्थिति',
    severity:        'गंभीरता',
    overallRisk:     'समग्र जोखिम स्तर',
    disclaimer:      'यह स्क्रीनिंग उपकरण एक योग्य स्वास्थ्य पेशेवर द्वारा नैदानिक मूल्यांकन का समर्थन करता है — लेकिन उसकी जगह नहीं लेता। सभी निष्कर्षों के लिए नैदानिक सहसंबंध आवश्यक है।',
    riskHigh:               'उच्च जोखिम',
    riskModerate:           'मध्यम जोखिम',
    riskLow:                'कम जोखिम',
    riskLabelMalnourished:  'कुपोषित',
    riskLabelHealthy:       'स्वस्थ',
  },
  mr: {
    title:           'रुग्ण जोखीम मूल्यांकन',
    generated:       'तयार केले',
    measurements:    'रुग्णाचे मोजमाप',
    age:             'वय',
    months:          'महिने',
    sex:             'लिंग',
    male:            'पुरुष',
    female:          'स्त्री',
    weight:          'वजन',
    height:          'उंची',
    muac:            'मुआक',
    zscores:         'नैदानिक Z-गुण',
    acuteCombined:   'एकत्रित तीव्र',
    aiClass:         'AI वर्गीकरण',
    prediction:      'अंदाज',
    score:           'गुण',
    signDetection:   'चिन्ह शोध',
    condition:       'स्थिती',
    severity:        'तीव्रता',
    overallRisk:     'एकूण जोखीम पातळी',
    disclaimer:      'हे तपासणी साधन पात्र आरोग्य व्यावसायिकाद्वारे नैदानिक मूल्यांकनास सहाय्य करते — परंतु त्याची जागा घेत नाही. सर्व निष्कर्षांसाठी नैदानिक सहसंबंध आवश्यक आहे.',
    riskHigh:               'उच्च धोका',
    riskModerate:           'मध्यम धोका',
    riskLow:                'कमी धोका',
    riskLabelMalnourished:  'कुपोषित',
    riskLabelHealthy:       'निरोगी',
  },
};

const RANK = { LOW: 0, MODERATE: 1, HIGH: 2 };

function worstRisk(...levels) {
  return levels
    .filter(Boolean)
    .reduce((best, cur) => (RANK[cur] > RANK[best] ? cur : best), 'LOW');
}

// Clinical z-score / MUAC → risk
function clinicalRisk(acuteLevel) {
  if (acuteLevel === 'severe')   return 'HIGH';
  if (acuteLevel === 'moderate') return 'MODERATE';
  if (acuteLevel === 'normal')   return 'LOW';
  return null; // 'na' → no data, don't vote
}

// ResNet50 binary probability → risk
function resnetRisk(finalLabel, avgProb) {
  const label = (finalLabel || '').toLowerCase();
  if (label !== 'malnourished') return 'LOW';
  if (avgProb >= 0.75) return 'HIGH';
  if (avgProb >= 0.50) return 'MODERATE';
  return 'LOW';
}

// YOLO verified-sign count → risk
function yoloRisk(allSigns) {
  const verified = allSigns.filter(s => s.verified).length;
  if (verified >= 3)           return 'HIGH';
  if (verified >= 1)           return 'MODERATE';
  if (allSigns.length >= 3)    return 'MODERATE';
  return 'LOW';
}

/**
 * Fuse three independent signal sources.
 * Rule: escalate to HIGH when ≥2 sources agree on HIGH or MODERATE+HIGH combo;
 *       escalate to MODERATE when ≥2 sources report ≥ MODERATE.
 */
export function fuseSignals(zScoreResult, resnetData, yoloData) {
  const allSigns = yoloData
    ? Object.values(yoloData.views || {}).flatMap(v => v.signs || [])
    : [];

  const r1 = clinicalRisk(zScoreResult?.acuteCombined?.level);
  const r2 = resnetData
    ? resnetRisk(resnetData.final_label, resnetData.average_probability)
    : null;
  const r3 = yoloRisk(allSigns);

  const votes = [r1, r2, r3].filter(Boolean);
  const highVotes     = votes.filter(v => v === 'HIGH').length;
  const elevatedVotes = votes.filter(v => v === 'HIGH' || v === 'MODERATE').length;

  if (highVotes >= 1 && elevatedVotes >= 2) return 'HIGH';
  if (highVotes >= 2)                        return 'HIGH';
  if (elevatedVotes >= 2)                    return 'MODERATE';
  return worstRisk(...votes) || 'LOW';
}

function getWHOAction(risk) {
  if (risk === 'HIGH') {
    return [
      'Immediate admission to Therapeutic Feeding Center (TFC).',
      'Initiate CMAM inpatient (F-75 / F-100) protocol.',
      'Rule out medical complications (infection, hypoglycaemia).',
    ];
  }
  if (risk === 'MODERATE') {
    return [
      'Enrol in Outpatient Therapeutic Program (OTP) or SFP.',
      'Provide Ready-to-Use Supplementary Food (RUSF).',
      'Schedule follow-up in 4 weeks; escalate if deteriorating.',
    ];
  }
  return [
    'Continue routine growth monitoring.',
    'Counsel caregiver on Infant & Young Child Feeding (IYCF).',
    'Review anthropometrics in 3 months.',
  ];
}

const RISK_ICON = { HIGH: '🔴', MODERATE: '🟡', LOW: '🟢' };

/**
 * Generate a printable report from fully rule-based logic.
 *
 * @param {object}      zScoreResult  - output of analyzeScreening()
 * @param {object|null} resnetData    - JSON from /predict endpoint
 * @param {object|null} yoloData      - JSON from /detect endpoint
 * @param {object}      patientInputs - raw form values { age, sex, weight, height, muac }
 * @param {string}      [lang='en']   - 'en' | 'hi' | 'mr'
 * @returns {{ risk: string, html: string }}
 */
export function generateReport(zScoreResult, resnetData, yoloData, patientInputs, lang = 'en') {
  const t = T[lang] || T.en;
  const risk = fuseSignals(zScoreResult, resnetData, yoloData);

  // ── Patient ──────────────────────────────────────────────────────────────
  const age    = patientInputs?.age    || '—';
  const sexRaw = patientInputs?.sex;
  const sex    = sexRaw === 'M' ? t.male : sexRaw === 'F' ? t.female : '—';
  const weight = patientInputs?.weight || '—';
  const height = patientInputs?.height || '—';
  const muac   = patientInputs?.muac   || '—';

  // ── Z-scores ─────────────────────────────────────────────────────────────
  const zs = zScoreResult?.zScores || {};
  const ns = zScoreResult?.nutritionStatus || {};
  const acuteLabel = zScoreResult?.acuteCombined?.label || '—';

  // ── AI ───────────────────────────────────────────────────────────────────
  const rawLabel = resnetData?.final_label?.toLowerCase() || '';
  const resLabel = rawLabel === 'malnourished' ? t.riskLabelMalnourished
                 : rawLabel === 'healthy'      ? t.riskLabelHealthy
                 : (resnetData?.final_label?.toUpperCase() || '—');
  const resProb  = resnetData
    ? `${(resnetData.average_probability * 100).toFixed(1)}%`
    : '—';
  const yoloCond = (() => {
    const c = yoloData?.condition || '—';
    return (CONDITIONS_T[lang] || {})[c] ?? c;
  })();
  const yoloSev  = (() => {
    const s = yoloData?.severity || '—';
    return (CONDITIONS_T[lang] || {})[s] ?? s;
  })();

  // ── Date/time ────────────────────────────────────────────────────────────
  const now  = new Date();
  const date = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const time = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  // ── HTML ─────────────────────────────────────────────────────────────────
  const riskClass = { HIGH: 'risk-high', MODERATE: 'risk-moderate', LOW: 'risk-low' }[risk] || '';
  const riskLabel = { HIGH: t.riskHigh, MODERATE: t.riskModerate, LOW: t.riskLow }[risk] || risk;
  const escHtml = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const html = `
<div class="report-doc">
  <div class="report-header">
    <h2>${t.title}</h2>
    <p class="report-meta">${t.generated}: ${date} &nbsp;·&nbsp; ${time}</p>
  </div>

  <div class="report-section">
    <h4>${t.measurements}</h4>
    <table class="report-table">
      <tr><td>${t.age}</td><td>${age} ${t.months}</td></tr>
      <tr><td>${t.sex}</td><td>${sex}</td></tr>
      <tr><td>${t.weight}</td><td>${weight} kg</td></tr>
      <tr><td>${t.height}</td><td>${height} cm</td></tr>
      <tr><td>${t.muac}</td><td>${muac} mm</td></tr>
    </table>
  </div>

  <div class="report-section">
    <h4>${t.zscores} &nbsp;<span class="report-badge">WHO LMS</span></h4>
    <table class="report-table">
      <tr><td>WAZ</td><td>${zs.waz ?? '—'}</td><td>${escHtml(ns.underweight?.label || '—')}</td></tr>
      <tr><td>HAZ</td><td>${zs.haz ?? '—'}</td><td>${escHtml(ns.stunting?.label    || '—')}</td></tr>
      <tr><td>WHZ</td><td>${zs.whz ?? '—'}</td><td>${escHtml(ns.wasting?.label     || '—')}</td></tr>
      <tr><td>BAZ</td><td>${zs.baz ?? '—'}</td><td></td></tr>
    </table>
    <p class="report-note"><strong>${t.acuteCombined}:</strong> ${escHtml(acuteLabel)}</p>
  </div>

  <div class="report-section">
    <h4>${t.aiClass} &nbsp;<span class="report-badge">ResNet50</span></h4>
    <table class="report-table">
      <tr><td>${t.prediction}</td><td><strong>${resLabel}</strong></td></tr>
      <tr><td>${t.score}</td><td>${resProb}</td></tr>
    </table>
  </div>

  <div class="report-section">
    <h4>${t.signDetection} &nbsp;<span class="report-badge">YOLO + ResNet18</span></h4>
    <table class="report-table">
      <tr><td>${t.condition}</td><td>${escHtml(yoloCond)}</td></tr>
      <tr><td>${t.severity}</td><td>${escHtml(yoloSev)}</td></tr>
    </table>
  </div>

  <div class="report-risk-banner ${riskClass}">
    <span class="risk-icon">${RISK_ICON[risk] || ''}</span>
    <span>${t.overallRisk}: <strong>${riskLabel}</strong></span>
  </div>

  <p class="report-disclaimer">${t.disclaimer}</p>
</div>`.trim();

  return { risk, html };
}
