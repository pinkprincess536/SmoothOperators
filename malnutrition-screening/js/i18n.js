// ─── INTERNATIONALISATION ─────────────────────────────────────────────────────
// Supports: en · hi (Hindi) · mr (Marathi)
// Nothing is left in English when a non-English language is active.

// ─── UI STRINGS ───────────────────────────────────────────────────────────────
const UI = {
  en: {
    appTitle:         'Malnutrition Screening Hub',
    appSubtitle:      'WHO Clinical Growth Standards · AI Sign Detection · Two-Stage Visual Diagnostics',
    sectionMeasure:   '1. Clinical Measurements',
    sectionImages:    '2. Visual Evidence (AI)',
    labelAge:         'Age (months)',
    phAge:            'e.g. 18',
    labelSex:         'Sex',
    optMale:          'Male',
    optFemale:        'Female',
    labelWeight:      'Weight (kg)',
    phWeight:         'e.g. 8.2',
    labelHeight:      'Height (cm)',
    phHeight:         'e.g. 76.0',
    labelMuac:        'MUAC (mm, optional)',
    phMuac:           'e.g. 124',
    labelFace:        'Face',
    labelFront:       'Front',
    labelBack:        'Back',
    btnAnalyze:       'Run Combined Analysis',
    btnReport:        'Generate Report',
    btnExport:        'Export',
    btnClear:         'Clear All',
    btnPrint:         'Print / Save PDF',
    clinicalTitle:    'Clinical Screening Results',
    badgeWHO:         'WHO Growth Standards',
    labelUnderweight: 'Underweight',
    labelStunting:    'Stunting',
    labelWasting:     'Wasting',
    muacDiagnosis:    'MUAC Diagnosis:',
    waitingInput:     'Waiting for input...',
    aiTitle:          'AI Classification',
    badgeResnet:      'ResNet Model',
    aiUploadHint:     'Upload images to see AI prediction',
    aiStrictHint:     'This prediction is based strictly on visual signs detected in the uploaded images.',
    combinedAssess:   'Combined Assessment',
    yoloTitle:        '🔍 Sign Detection Analysis',
    yoloAnalysing:    'Analysing...',
    detectedSigns:    'Detected Clinical Signs',
    noSignsFound:     'No malnutrition signs were detected in the uploaded images.',
    signLabel:        'sign(s)',
    verified:         '✓ verified',
    unverified:       '⚠ unverified',
    storageTitle:     'Device Storage & LMS Settings',
    lmsDataSource:    'LMS Data Source',
    recordMgmt:       'Record Management',
    footer:           'Clinical decisions require trained assessment. This tool is for screening support only.',
    reportModalTitle: 'Risk Assessment Report',
    // Dynamic status
    modelReady:       '✓ AI Model ready',
    modelOffline:     '✗ Server offline — run server.py first',
    lmsReady:         'LMS Data ready ✓',
    lmsMissing:       'Missing LMS Data! Upload LMS .json file.',
    lmsLoaded:        'LMS Loaded successfully!',
    lmsError:         'Error loading LMS JSON.',
    lmsFromDB:        'LMS Data ready from DB.',
    lmsAutoFail:      'Auto-load failed. Upload lms.json manually.',
    lmsLoading:       'Loading...',
    aiAnalysing:      '⏳ Analysing images...',
    aiServerErr:      '❌ Could not reach server. Is server.py running?',
    aiNeedImages:     'Upload at least one image to run AI analysis.',
    avgScore:         (avg, thr) => `Avg score: ${avg} (threshold: ${thr})`,
    confidence:       (pct) => `Confidence: ${pct}%`,
    yoloRunning:      '⏳ Running sign detection...',
    yoloServerErr:    '❌ Detection failed. Is yolo_server.py running?',
    // AI labels
    aiLabelMalnourished: 'MALNOURISHED',
    aiLabelHealthy:      'HEALTHY',
  },

  hi: {
    appTitle:         'कुपोषण जाँच केंद्र',
    appSubtitle:      'WHO नैदानिक विकास मानक · AI संकेत पहचान · द्वि-चरण दृश्य निदान',
    sectionMeasure:   '1. नैदानिक माप',
    sectionImages:    '2. दृश्य साक्ष्य (AI)',
    labelAge:         'आयु (माह)',
    phAge:            'जैसे 18',
    labelSex:         'लिंग',
    optMale:          'पुरुष',
    optFemale:        'महिला',
    labelWeight:      'वजन (किग्रा)',
    phWeight:         'जैसे 8.2',
    labelHeight:      'ऊंचाई (सेमी)',
    phHeight:         'जैसे 76.0',
    labelMuac:        'मुआक (मिमी, वैकल्पिक)',
    phMuac:           'जैसे 124',
    labelFace:        'चेहरा',
    labelFront:       'सामने',
    labelBack:        'पीछे',
    btnAnalyze:       'संयुक्त विश्लेषण चलाएं',
    btnReport:        'रिपोर्ट तैयार करें',
    btnExport:        'निर्यात करें',
    btnClear:         'सब हटाएं',
    btnPrint:         'प्रिंट / PDF सहेजें',
    clinicalTitle:    'नैदानिक जाँच परिणाम',
    badgeWHO:         'WHO विकास मानक',
    labelUnderweight: 'कम वजन',
    labelStunting:    'अवरुद्ध वृद्धि',
    labelWasting:     'क्षय',
    muacDiagnosis:    'मुआक निदान:',
    waitingInput:     'इनपुट की प्रतीक्षा...',
    aiTitle:          'AI वर्गीकरण',
    badgeResnet:      'ResNet मॉडल',
    aiUploadHint:     'AI पूर्वानुमान देखने के लिए छवियाँ अपलोड करें',
    aiStrictHint:     'यह पूर्वानुमान केवल अपलोड की गई छवियों में पाए गए दृश्य संकेतों पर आधारित है।',
    combinedAssess:   'संयुक्त मूल्यांकन',
    yoloTitle:        '🔍 संकेत पहचान विश्लेषण',
    yoloAnalysing:    'विश्लेषण हो रहा है...',
    detectedSigns:    'पहचाने गए नैदानिक संकेत',
    noSignsFound:     'अपलोड की गई छवियों में कुपोषण के संकेत नहीं मिले।',
    signLabel:        'संकेत',
    verified:         '✓ सत्यापित',
    unverified:       '⚠ असत्यापित',
    storageTitle:     'डिवाइस संग्रह और LMS सेटिंग',
    lmsDataSource:    'LMS डेटा स्रोत',
    recordMgmt:       'रिकॉर्ड प्रबंधन',
    footer:           'नैदानिक निर्णयों के लिए प्रशिक्षित मूल्यांकन आवश्यक है। यह उपकरण केवल जाँच सहायता के लिए है।',
    reportModalTitle: 'जोखिम मूल्यांकन रिपोर्ट',
    modelReady:       '✓ AI मॉडल तैयार',
    modelOffline:     '✗ सर्वर बंद — पहले server.py चलाएं',
    lmsReady:         'LMS डेटा तैयार ✓',
    lmsMissing:       'LMS डेटा नहीं! LMS .json फ़ाइल अपलोड करें।',
    lmsLoaded:        'LMS सफलतापूर्वक लोड हुआ!',
    lmsError:         'LMS JSON लोड करने में त्रुटि।',
    lmsFromDB:        'डेटाबेस से LMS डेटा तैयार।',
    lmsAutoFail:      'स्वतः लोड विफल। lms.json मैन्युअल अपलोड करें।',
    lmsLoading:       'लोड हो रहा है...',
    aiAnalysing:      '⏳ छवियों का विश्लेषण हो रहा है...',
    aiServerErr:      '❌ सर्वर से संपर्क नहीं। server.py चल रहा है?',
    aiNeedImages:     'AI विश्लेषण के लिए कम से कम एक छवि अपलोड करें।',
    avgScore:         (avg, thr) => `औसत स्कोर: ${avg} (सीमा: ${thr})`,
    confidence:       (pct) => `विश्वास: ${pct}%`,
    yoloRunning:      '⏳ संकेत पहचान चल रही है...',
    yoloServerErr:    '❌ पहचान विफल। yolo_server.py चल रहा है?',
    aiLabelMalnourished: 'कुपोषित',
    aiLabelHealthy:      'स्वस्थ',
  },

  mr: {
    appTitle:         'कुपोषण तपासणी केंद्र',
    appSubtitle:      'WHO नैदानिक वाढ मानके · AI चिन्ह शोध · द्वि-टप्पा दृश्य निदान',
    sectionMeasure:   '1. नैदानिक मोजमाप',
    sectionImages:    '2. दृश्य पुरावा (AI)',
    labelAge:         'वय (महिने)',
    phAge:            'उदा. 18',
    labelSex:         'लिंग',
    optMale:          'पुरुष',
    optFemale:        'स्त्री',
    labelWeight:      'वजन (किग्रॅ)',
    phWeight:         'उदा. 8.2',
    labelHeight:      'उंची (सेमी)',
    phHeight:         'उदा. 76.0',
    labelMuac:        'मुआक (मिमी, पर्यायी)',
    phMuac:           'उदा. 124',
    labelFace:        'चेहरा',
    labelFront:       'समोर',
    labelBack:        'मागे',
    btnAnalyze:       'एकत्रित विश्लेषण करा',
    btnReport:        'अहवाल तयार करा',
    btnExport:        'निर्यात करा',
    btnClear:         'सर्व काढा',
    btnPrint:         'प्रिंट / PDF जतन करा',
    clinicalTitle:    'नैदानिक तपासणी निकाल',
    badgeWHO:         'WHO वाढ मानके',
    labelUnderweight: 'कमी वजन',
    labelStunting:    'खुंटलेली वाढ',
    labelWasting:     'शोष',
    muacDiagnosis:    'मुआक निदान:',
    waitingInput:     'माहितीची प्रतीक्षा...',
    aiTitle:          'AI वर्गीकरण',
    badgeResnet:      'ResNet मॉडेल',
    aiUploadHint:     'AI अंदाज पाहण्यासाठी प्रतिमा अपलोड करा',
    aiStrictHint:     'हा अंदाज केवळ अपलोड केलेल्या प्रतिमांमधील दृश्य चिन्हांवर आधारित आहे.',
    combinedAssess:   'एकत्रित मूल्यांकन',
    yoloTitle:        '🔍 चिन्ह शोध विश्लेषण',
    yoloAnalysing:    'विश्लेषण होत आहे...',
    detectedSigns:    'आढळलेली नैदानिक चिन्हे',
    noSignsFound:     'अपलोड केलेल्या प्रतिमांमध्ये कुपोषणाची चिन्हे आढळली नाहीत.',
    signLabel:        'चिन्ह(े)',
    verified:         '✓ सत्यापित',
    unverified:       '⚠ असत्यापित',
    storageTitle:     'डिव्हाइस संग्रहण आणि LMS सेटिंग',
    lmsDataSource:    'LMS डेटा स्रोत',
    recordMgmt:       'नोंद व्यवस्थापन',
    footer:           'नैदानिक निर्णयांसाठी प्रशिक्षित मूल्यांकन आवश्यक आहे. हे साधन केवळ तपासणी सहाय्यासाठी आहे.',
    reportModalTitle: 'जोखीम मूल्यांकन अहवाल',
    modelReady:       '✓ AI मॉडेल तयार',
    modelOffline:     '✗ सर्व्हर बंद — आधी server.py चालवा',
    lmsReady:         'LMS डेटा तयार ✓',
    lmsMissing:       'LMS डेटा नाही! LMS .json फाइल अपलोड करा.',
    lmsLoaded:        'LMS यशस्वीरित्या लोड झाले!',
    lmsError:         'LMS JSON लोड करताना त्रुटी.',
    lmsFromDB:        'डेटाबेसमधून LMS डेटा तयार.',
    lmsAutoFail:      'स्वयं-लोड अयशस्वी. lms.json हस्तचलित अपलोड करा.',
    lmsLoading:       'लोड होत आहे...',
    aiAnalysing:      '⏳ प्रतिमांचे विश्लेषण होत आहे...',
    aiServerErr:      '❌ सर्व्हरशी संपर्क नाही. server.py चालू आहे का?',
    aiNeedImages:     'AI विश्लेषणासाठी किमान एक प्रतिमा अपलोड करा.',
    avgScore:         (avg, thr) => `सरासरी गुण: ${avg} (उंबरठा: ${thr})`,
    confidence:       (pct) => `विश्वासार्हता: ${pct}%`,
    yoloRunning:      '⏳ चिन्ह शोध चालू आहे...',
    yoloServerErr:    '❌ शोध अयशस्वी. yolo_server.py चालू आहे का?',
    aiLabelMalnourished: 'कुपोषित',
    aiLabelHealthy:      'निरोगी',
  },
};

// ─── DIAGNOSIS LABEL TRANSLATIONS ─────────────────────────────────────────────
// Maps exact English strings from diagnosis.js / muac.js → target language.
const LABELS = {
  hi: {
    'Severe deficit':                   'गंभीर कमी',
    'Moderate deficit':                 'मध्यम कमी',
    'Normal range':                     'सामान्य',
    'Elevated (overnutrition risk)':    'अधिक (अति-पोषण जोखिम)',
    'Not applicable':                   'लागू नहीं',
    'Severe underweight':               'गंभीर कम वजन',
    'Moderate underweight':             'मध्यम कम वजन',
    'No underweight':                   'सामान्य वजन',
    'Underweight not applicable':       'लागू नहीं',
    'Severe stunting':                  'गंभीर अवरुद्ध वृद्धि',
    'Moderate stunting':                'मध्यम अवरुद्ध वृद्धि',
    'No stunting':                      'सामान्य ऊंचाई',
    'Stunting not applicable':          'लागू नहीं',
    'Severe wasting':                   'गंभीर क्षय',
    'Moderate wasting':                 'मध्यम क्षय',
    'No wasting':                       'सामान्य',
    'Wasting not applicable':           'लागू नहीं',
    'Severe thinness':                  'गंभीर कृशता',
    'Moderate thinness':                'मध्यम कृशता',
    'Normal BMI-for-age':               'सामान्य BMI',
    'BMI-for-age not applicable':       'लागू नहीं',
    'Overweight / overnutrition risk':  'अधिक वजन',
    'Severe acute malnutrition (worst of WHZ/MUAC when both apply)':
                                        'गंभीर तीव्र कुपोषण',
    'Moderate acute malnutrition (worst of WHZ/MUAC when both apply)':
                                        'मध्यम तीव्र कुपोषण',
    'No acute malnutrition on available acute indices':
                                        'तीव्र कुपोषण नहीं',
    'Acute classification not applicable':
                                        'तीव्र वर्गीकरण लागू नहीं',
    'Not provided':                     'प्रदान नहीं',
    'Invalid MUAC':                     'अमान्य मुआक',
    'Not applicable for age':           'इस आयु के लिए लागू नहीं',
    'Severe Acute Malnutrition (MUAC)': 'गंभीर तीव्र कुपोषण (मुआक)',
    'Moderate Acute Malnutrition (MUAC)':'मध्यम तीव्र कुपोषण (मुआक)',
    'Normal (MUAC)':                    'सामान्य (मुआक)',
    'Priority: Severe acute malnutrition (combined WHZ/MUAC logic)':
                                        'प्राथमिकता: गंभीर तीव्र कुपोषण',
    'Priority: Moderate acute malnutrition (combined WHZ/MUAC logic)':
                                        'प्राथमिकता: मध्यम तीव्र कुपोषण',
    'Severe stunting (HAZ < -3)':       'गंभीर अवरुद्ध वृद्धि (HAZ < -3)',
    'Moderate stunting (HAZ < -2)':     'मध्यम अवरुद्ध वृद्धि (HAZ < -2)',
    'Severe underweight (WAZ < -3)':    'गंभीर कम वजन (WAZ < -3)',
    'Moderate underweight (WAZ < -2)':  'मध्यम कम वजन (WAZ < -2)',
    'Overnutrition risk (BAZ > +2)':    'अति-पोषण जोखिम (BAZ > +2)',
    'No priority growth deficits detected on available indices (clinical context still required).':
                                        'उपलब्ध संकेतकों पर कोई विकास कमी नहीं मिली।',
    'Unable to calculate one or more growth indices for this input.':
                                        'इस इनपुट के लिए वृद्धि सूचकांक की गणना नहीं हो सकी।',
    '—': '—',
  },
  mr: {
    'Severe deficit':                   'गंभीर कमतरता',
    'Moderate deficit':                 'मध्यम कमतरता',
    'Normal range':                     'सामान्य',
    'Elevated (overnutrition risk)':    'अधिक (अति-पोषण धोका)',
    'Not applicable':                   'लागू नाही',
    'Severe underweight':               'गंभीर कमी वजन',
    'Moderate underweight':             'मध्यम कमी वजन',
    'No underweight':                   'सामान्य वजन',
    'Underweight not applicable':       'लागू नाही',
    'Severe stunting':                  'गंभीर खुंटलेली वाढ',
    'Moderate stunting':                'मध्यम खुंटलेली वाढ',
    'No stunting':                      'सामान्य उंची',
    'Stunting not applicable':          'लागू नाही',
    'Severe wasting':                   'गंभीर शोष',
    'Moderate wasting':                 'मध्यम शोष',
    'No wasting':                       'सामान्य',
    'Wasting not applicable':           'लागू नाही',
    'Severe thinness':                  'गंभीर कृशता',
    'Moderate thinness':                'मध्यम कृशता',
    'Normal BMI-for-age':               'सामान्य BMI',
    'BMI-for-age not applicable':       'लागू नाही',
    'Overweight / overnutrition risk':  'जास्त वजन',
    'Severe acute malnutrition (worst of WHZ/MUAC when both apply)':
                                        'गंभीर तीव्र कुपोषण',
    'Moderate acute malnutrition (worst of WHZ/MUAC when both apply)':
                                        'मध्यम तीव्र कुपोषण',
    'No acute malnutrition on available acute indices':
                                        'तीव्र कुपोषण नाही',
    'Acute classification not applicable':
                                        'तीव्र वर्गीकरण लागू नाही',
    'Not provided':                     'दिलेले नाही',
    'Invalid MUAC':                     'अवैध मुआक',
    'Not applicable for age':           'या वयासाठी लागू नाही',
    'Severe Acute Malnutrition (MUAC)': 'गंभीर तीव्र कुपोषण (मुआक)',
    'Moderate Acute Malnutrition (MUAC)':'मध्यम तीव्र कुपोषण (मुआक)',
    'Normal (MUAC)':                    'सामान्य (मुआक)',
    'Priority: Severe acute malnutrition (combined WHZ/MUAC logic)':
                                        'प्राधान्य: गंभीर तीव्र कुपोषण',
    'Priority: Moderate acute malnutrition (combined WHZ/MUAC logic)':
                                        'प्राधान्य: मध्यम तीव्र कुपोषण',
    'Severe stunting (HAZ < -3)':       'गंभीर खुंटलेली वाढ (HAZ < -3)',
    'Moderate stunting (HAZ < -2)':     'मध्यम खुंटलेली वाढ (HAZ < -2)',
    'Severe underweight (WAZ < -3)':    'गंभीर कमी वजन (WAZ < -3)',
    'Moderate underweight (WAZ < -2)':  'मध्यम कमी वजन (WAZ < -2)',
    'Overnutrition risk (BAZ > +2)':    'अति-पोषण धोका (BAZ > +2)',
    'No priority growth deficits detected on available indices (clinical context still required).':
                                        'उपलब्ध निर्देशांकांवर कोणतीही वाढ कमतरता आढळली नाही.',
    'Unable to calculate one or more growth indices for this input.':
                                        'या माहितीसाठी वाढ निर्देशांक मोजता आले नाहीत.',
    '—': '—',
  },
};

// ─── YOLO SIGN NAME TRANSLATIONS ──────────────────────────────────────────────
const SIGNS = {
  hi: {
    'visible ribs':        'दिखाई देने वाली पसलियां',
    'visible back bones':  'दिखाई देने वाली पीठ की हड्डियां',
    'wasted arms':         'सूखी भुजाएं',
    'distended belly':     'फूला हुआ पेट',
    'sunken eyes':         'धंसी हुई आंखें',
    'edema':               'सूजन',
    'skin lesions':        'त्वचा के घाव',
    'hair discoloration':  'बालों का रंग परिवर्तन',
    'muscle wasting':      'मांसपेशी क्षय',
    'bilateral pitting edema': 'द्विपक्षीय गड्ढेदार सूजन',
  },
  mr: {
    'visible ribs':        'दिसणाऱ्या फासळ्या',
    'visible back bones':  'दिसणाऱ्या पाठीच्या हाडी',
    'wasted arms':         'वाळलेले हात',
    'distended belly':     'फुगलेले पोट',
    'sunken eyes':         'खोल गेलेले डोळे',
    'edema':               'सूज',
    'skin lesions':        'त्वचेचे व्रण',
    'hair discoloration':  'केसांचा रंग बदल',
    'muscle wasting':      'स्नायू शोष',
    'bilateral pitting edema': 'द्विपक्षीय खड्डे पडणारी सूज',
  },
};

// ─── CONDITION / SEVERITY TRANSLATIONS ────────────────────────────────────────
const CONDITIONS = {
  hi: {
    'Marasmus':                        'मरास्मस',
    'Kwashiorkor':                     'क्वाशिओरकोर',
    'Marasmic-Kwashiorkor':            'मरास्मिक-क्वाशिओरकोर',
    'Marasmus / General wasting':      'मरास्मस / सामान्य क्षय',
    'Kwashiorkor / Protein deficiency':'क्वाशिओरकोर / प्रोटीन कमी',
    'Healthy':                         'स्वस्थ',
    'No condition detected':           'कोई स्थिति नहीं मिली',
    'Marasmus indicators present':     'मरास्मस के संकेत मिले',
    'Kwashiorkor indicators present':  'क्वाशिओरकोर के संकेत मिले',
    'HIGH':       'उच्च',
    'MODERATE':   'मध्यम',
    'LOW':        'कम',
    'CRITICAL':   'अत्यंत गंभीर',
    'LOW-MODERATE':'कम-मध्यम',
  },
  mr: {
    'Marasmus':                        'मरास्मस',
    'Kwashiorkor':                     'क्वाशिओरकोर',
    'Marasmic-Kwashiorkor':            'मरास्मिक-क्वाशिओरकोर',
    'Marasmus / General wasting':      'मरास्मस / सामान्य शोष',
    'Kwashiorkor / Protein deficiency':'क्वाशिओरकोर / प्रथिने कमतरता',
    'Healthy':                         'निरोगी',
    'No condition detected':           'कोणती स्थिती आढळली नाही',
    'Marasmus indicators present':     'मरास्मसची चिन्हे आढळली',
    'Kwashiorkor indicators present':  'क्वाशिओरकोरची चिन्हे आढळली',
    'HIGH':       'उच्च',
    'MODERATE':   'मध्यम',
    'LOW':        'कमी',
    'CRITICAL':   'अत्यंत गंभीर',
    'LOW-MODERATE':'कमी-मध्यम',
  },
};

// ─── STATE ────────────────────────────────────────────────────────────────────
let _lang = 'en';
export function currentLang() { return _lang; }

// ─── PUBLIC API ───────────────────────────────────────────────────────────────

/** Translate a UI key. Falls back to English. */
export function t(key, ...args) {
  const val = (UI[_lang] || UI.en)[key] ?? UI.en[key] ?? key;
  return typeof val === 'function' ? val(...args) : val;
}

/** Translate a diagnosis.js / muac.js label string. */
export function tLabel(label) {
  if (_lang === 'en' || !label) return label;
  return (LABELS[_lang] || {})[label] ?? label;
}

/** Translate a YOLO sign name (underscore_separated → translated readable). */
export function tSign(signName) {
  const readable = signName.replace(/_/g, ' ').toLowerCase();
  if (_lang === 'en') return readable;
  return (SIGNS[_lang] || {})[readable] ?? readable;
}

/** Translate a condition / severity string from YOLO. */
export function tCondition(str) {
  if (_lang === 'en' || !str) return str;
  return (CONDITIONS[_lang] || {})[str] ?? str;
}

/** Translate the AI binary label (malnourished / healthy). */
export function tAILabel(label) {
  if (!label) return label;
  const lower = label.toLowerCase();
  if (lower === 'malnourished') return t('aiLabelMalnourished');
  if (lower === 'healthy')      return t('aiLabelHealthy');
  return label;
}

/**
 * Apply a language to the entire page.
 * Rewrites all [data-i18n] text, placeholders, and aria-labels.
 */
export function applyLang(lang) {
  if (!UI[lang]) return;
  _lang = lang;
  document.documentElement.lang = lang;

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const val = t(el.dataset.i18n);
    if (typeof val === 'string') el.textContent = val;
  });

  document.querySelectorAll('[data-i18n-ph]').forEach(el => {
    const val = t(el.dataset.i18nPh);
    if (typeof val === 'string') el.placeholder = val;
  });

  document.querySelectorAll('[data-i18n-aria]').forEach(el => {
    const val = t(el.dataset.i18nAria);
    if (typeof val === 'string') el.setAttribute('aria-label', val);
  });
}
