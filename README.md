# Integrated Malnutrition Screening Platform

An end-to-end, privacy-preserving web application for the screening and automated visual detection of child malnutrition. The system operates as a Progressive Web App (PWA) equipped with clinical calculation utilities entirely on the edge, coupled with a two-stage local AI backend combining TensorFlow and PyTorch logic.

## 🌟 The 3-Layer Architecture

1. **Clinical Screening (Edge)**
   Calculates standardized Z-scores (WAZ, HAZ, WHZ, BAZ) exclusively inside the browser utilizing the official WHO LMS data parameters.
   
2. **Binary Classification AI (`server.py` | Port 5000)**
   A TensorFlow Keras ResNet50 model that processes image sets (face, front, back) through a Haar Cascade preprocessing step, outputting a base prediction of HEALTHY or MALNOURISHED along with a Grad-CAM heatmap visualization.

3. **Sign-Level Verification AI (`yolo_server.py` | Port 5001)**
   A multi-stage PyTorch pipeline. A YOLOv8 model detects localized signs (e.g., *visible_ribs*, *distended_belly*, *wasted_arms*), crops them, and passes them to a PyTorch ResNet18 model for clinical sign verification. It outputs bounding box overlays, confidence scores, and automatically determines Marasmus vs. Kwashiorkor severity.

---

## 🚀 Setup & Installation

### 1. Requirements

- Python 3.10+
- A modern web browser supporting IndexedDB and ES6 Modules

### 2. Dependency Installation

The backend contains both TensorFlow and PyTorch dependencies. To avoid OS-level CUDA process conflicts and bus errors on local (or CPU-only) devices, **PyTorch must be cleanly installed avoiding standard CUDA drivers**.

1. Create and activate a Virtual Environment (recommended).
   ```bash
   python -m venv venv
   source venv/bin/activate  # MacOS/Linux
   ```

2. Install non-PyTorch dependencies:
   ```bash
   pip install Flask flask-cors tensorflow numpy opencv-python-headless Pillow scipy ultralytics
   ```

3. Install CPU-only PyTorch separately:
   ```bash
   pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
   ```

---

## ⚙️ How to Run

Because TensorFlow and PyTorch are deliberately isolated to avoid conflict, the application utilizes three simultaneous processes.

**Terminal 1 — Binary Classification API (TensorFlow)**
```bash
source venv/bin/activate
python server.py
# Runs on http://127.0.0.1:5000
```

**Terminal 2 — Symptom Locating API (PyTorch)**
```bash
source venv/bin/activate
python yolo_server.py
# Runs on http://127.0.0.1:5001
```

**Terminal 3 — PWA Frontend**
```bash
cd malnutrition-screening
python -m http.server 8000
# Open http://localhost:8000 in your browser
```

---

## 📁 Repository Structure

### The Backends (AI Operations)
- `server.py`
  - Runs on port 5000. Handles `/predict` endpoint.
  - Loads the TensorFlow `.h5` classification model, performs Haar Cascades face-crop logic, generates Grad-CAM overlays using `tf.GradientTape`.
- `yolo_server.py`
  - Runs on port 5001. Handles `/detect` endpoint.
  - Loads YOLOv8 (`yolo_malnutrition.pt`) and ResNet18 (`resnet18_malnutrition.pth`). Handles localized bounding box detection and returns annotated images in real-time.
- `model_metadata.json`
  - Decision threshold parameters and label matrices used by the TensorFlow binary classification model.
- `HOW_IT_WORKS.md`
  - In-depth theoretical writeup answering the "Why" and "How" of using LMS data fused with AI detections. Pitch-ready concepts included.

### The Models & Data
- `malnutrition_package/`
  - Contains `.pt`/`.pth` weights for the PyTorch-based detection and verification pipelines. Includes standard definitions to map classes (`visible_ribs`, `sunken_eyes`) to corresponding disease vectors (Marasmus vs. Kwashiorkor).
- `dataset_v4/`
  - Training dataset structure holding classification-based and symptom-annotated image files.
- `Untitled3.ipynb` & `yolo.py`
  - Colab notebook export and active scripts displaying history for how training epochs, loss functions, and architectural decisions (like creating the original PyTorch GradCAM hooks) were configured.

### The Frontend (`malnutrition-screening/`)
A pure ES6 JavaScript Progressive Web App (PWA) stylized with an independently written dark-themed "shadcn" inspired CSS class-system.

- `index.html` — The primary interface handling inputs representing the "Clinical Z-Scores / Measurements Dashboard", the "Binary AI Result Ring", and the "YOLO Multi-Class Verification Frame".
- `css/app.css` — High-contrast, monochromatic dark-mode aesthetic handling responsive grid adjustments.
- `js/app.js` — The integration logic wiring UI events to both backend Flask APIs and capturing frontend calculations.
- `js/storage.js` — Manages IndexedDB saving/loading state for massive LMS data payloads to reduce parsing memory footprint.
- `js/diagnosis.js` & `js/lms.js` — Offline LMS Z-score engine that iterates linearly to find matching standardized baseline rows.
- `data/lms.json` — Exhaustive JSON payload translated exactly from official WHO metrics datasets for global child malnutrition distributions.

---

### Security & Privacy

All images uploaded for AI diagnosis and anthropometric data input remain localized to the memory space. The backend APIs communicate solely over isolated pre-configured localhost ports (5000 / 5001). No network requests leave the device, ensuring full localized HIPAA/CMAM compliance capabilities.
