# Malnutrition Screening Platform — How It Works

## The Big Picture

This is a **web app** that helps health workers screen children for malnutrition in two completely different ways at the same time — using standard medical measurements AND photos. The two systems check each other, making the result more reliable than either method alone.

---

## The Three Layers

```
[Browser / PWA]  ←→  [server.py :5000]  ←  TensorFlow ResNet50 model
                 ←→  [yolo_server.py :5001]  ←  YOLO + ResNet18 models
```

---

## Layer 1: The Frontend (What the user sees)

**File:** `malnutrition-screening/index.html` + `js/app.js`

The health worker opens the app in a browser and fills in two things:

1. **Clinical measurements** — the child's age (in months), sex, weight, height, and optionally MUAC (mid-upper arm circumference, measured with a tape).
2. **Photos** — up to three photos: a face photo, a front body photo, and a back body photo.

Then they click **"Run Combined Analysis"**. The app sends this data to two separate AI servers simultaneously and shows the results on screen.

---

## Layer 2: Clinical Screening (The Math)

**Files:** `js/diagnosis.js`, `js/lms.js`, `data/lms.json`

This runs **entirely in the browser** — no server needed for this part.

### What it does
Using the child's age, sex, weight, and height, it calculates four **Z-scores** using the WHO's official LMS (Lambda-Mu-Sigma) method:

| Z-score | What it measures |
|---------|-----------------|
| **WAZ** (Weight-for-Age) | Is the child underweight for their age? |
| **HAZ** (Height-for-Age) | Is the child too short for their age? (stunting) |
| **WHZ** (Weight-for-Height) | Is the child too thin for their height? (wasting) |
| **BAZ** (BMI-for-Age) | Is the child's body mass index normal? |

### How to explain Z-scores simply
> "Think of Z-score as a distance from the average healthy child. A score of 0 is perfectly average. A score of -2 means the child is significantly below the healthy range. Below -3 is severe malnutrition. We use the WHO's own growth tables to calculate these."

### Output
Each Z-score gets classified as **Normal / Moderate / Severe**. The system also classifies MUAC (if provided) using WHO thresholds (< 115mm = SAM, 115–125mm = MAM). All of this combines into a final **acute malnutrition assessment**.

---

## Layer 3a: AI Binary Classifier (server.py, port 5000)

**Model:** `malnutrition-screening/model/malnutrition_resnet18.h5`  
**Framework:** TensorFlow / Keras

### What it does
Each uploaded photo (face, front, back) is preprocessed and fed into a **ResNet50** model trained to classify the child as either **healthy** or **malnourished**.

### Preprocessing pipeline
1. For face photos: OpenCV's Haar Cascade detector crops out the face automatically.
2. For body photos: The image is padded into a square to preserve proportions.
3. All images: Converted to grayscale → CLAHE contrast enhancement (removes lighting issues) → resized to 224×224px.

### How to explain this simply
> "We trained a ResNet deep learning model, similar to what Google uses for image recognition, on photos of healthy and malnourished children. It learned to spot visual patterns — things like visible ribcage, hollowed cheeks, or arm wasting. It gives us a probability score between 0 and 1. The threshold is 0.2, meaning if the score exceeds 0.2, the model flags the child as potentially malnourished."

### Output
- A prediction label: `HEALTHY` or `MALNOURISHED`
- A score for each view (Face, Front, Back)
- An overall averaged confidence score

---

## Layer 3b: AI Sign Detector (yolo_server.py, port 5001)

**Models:** `malnutrition_package/yolo_malnutrition.pt` + `malnutrition_package/resnet18_malnutrition.pth`  
**Framework:** PyTorch + Ultralytics YOLO

This is the more advanced part — instead of just saying "malnourished yes/no", it tells you **exactly what clinical signs are visible** and **where on the body**.

### Two-Stage Detection Pipeline

**Stage 1 — YOLO Detector**
YOLO (You Only Look Once) is an object detection model that scans the entire photo and draws bounding boxes around specific visible symptoms:

| Sign | Indicates |
|------|-----------|
| `visible_ribs` | Marasmus — severe energy starvation |
| `flat_belly` | Marasmus — loss of subcutaneous fat |
| `wasted_arms` | Marasmus — muscle wasting |
| `visible_back_bones` | Marasmus — loss of muscle and fat |
| `distended_belly` | Kwashiorkor — protein deficiency causing fluid retention |
| `moon_face` | Kwashiorkor — edema (swelling) from protein deficiency |
| `sunken_eyes` | General severe malnutrition |

**Stage 2 — ResNet18 Verifier**
For every bounding box YOLO draws, it crops that region out of the photo and feeds it through a separate **ResNet18 classifier** to verify if the detected sign is genuine. Each detection gets a ✓ verified or ⚠ unverified tag.

### How to explain this simply
> "YOLO is like a doctor looking at a photo and pointing to the ribcage saying 'that looks wasted'. The ResNet18 then acts as a second opinion, double-checking that specific region. If both agree, we mark it as a confirmed clinical sign."

### Output
- **Annotated photos** with colored bounding boxes showing exactly where each sign was detected
- **Per-sign breakdown** with YOLO confidence, ResNet18 confidence, and clinical description
- **Condition type**: Marasmus (energy deficiency) vs Kwashiorkor (protein deficiency) vs Mixed
- **Severity**: LOW → MODERATE → HIGH → CRITICAL

---

## How the Three Systems Work Together

```
Child's measurements  →  Z-score engine (browser)  →  Clinical Z-scores + MUAC
Child's photos        →  ResNet50/TF   (port 5000)  →  Healthy/Malnourished + confidence
                      →  YOLO+ResNet18 (port 5001)  →  Sign locations + type + severity
```

The key insight is that **these three methods check each other**:
- If the Z-scores show wasting (WHZ < -2) AND the AI also detects `wasted_arms`, clinical correlation is strong.
- If only one system flags the child, the health worker is advised to get a second clinical opinion.
- This mirrors how real doctors work — they use measurements AND visual examination together.

---

## Hackathon Pitch Points

| Feature | Why it matters |
|---------|---------------|
| **No cloud required** | All three systems can run locally on a laptop or clinic computer. No patient data leaves the device. |
| **WHO-compliant criteria** | Z-score logic follows official WHO LMS tables exactly. Our thresholds match CMAM program cutoffs (SAM/MAM/Normal). |
| **Two types of malnutrition** | Most tools detect malnutrition binary. We differentiate Marasmus from Kwashiorkor — which determines the treatment protocol (calories vs protein). |
| **Explainable AI** | The bounding boxes show exactly what the model is "looking at". A health worker can visually verify the AI's reasoning, unlike a black-box binary label. |
| **Three-view fusion** | Face + Front + Back gives broader coverage than a single-angle tool. Each view captures different clinical signs. |
| **PWA** | Installable on any Android phone. Works offline. Designed for low-resource clinic settings. |

---

## How to Start the App

```bash
# Terminal 1 — Clinical AI (TensorFlow)
venv/bin/python server.py         # starts on http://localhost:5000

# Terminal 2 — Sign Detection (YOLO + PyTorch)
venv/bin/python yolo_server.py    # starts on http://localhost:5001

# Terminal 3 — Frontend
cd malnutrition-screening
python3 -m http.server 8000       # open http://localhost:8000
```
