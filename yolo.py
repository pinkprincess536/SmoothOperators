# ╔══════════════════════════════════════════════════════════════════╗
# ║       MALNUTRITION SCREENING — STANDALONE INFERENCE CELL        ║
# ║   Run ONLY this cell. No other cells needed.                    ║
# ║                                                                  ║
# ║   BEFORE RUNNING — upload your two model files to Colab:        ║
# ║     • yolo_malnutrition.pt                                       ║
# ║     • resnet18_malnutrition.pth                                  ║
# ║   (and optionally metadata.json — if absent, defaults are used)  ║
# ╚══════════════════════════════════════════════════════════════════╝

# ── 0. Install dependencies ────────────────────────────────────────
import subprocess, sys
subprocess.run([sys.executable, "-m", "pip", "install", "-q",
                "ultralytics", "torch", "torchvision", "opencv-python-headless",
                "matplotlib", "Pillow"], check=True)

# ── 1. Imports ────────────────────────────────────────────────────
import os, cv2, json, warnings
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.cm as cm
import matplotlib.patches as mpatches
from pathlib import Path
from PIL import Image
warnings.filterwarnings('ignore')

import torch
import torch.nn as nn
import torchvision.transforms as transforms
import torchvision.models as models
from ultralytics import YOLO

DEVICE = 'cuda' if torch.cuda.is_available() else 'cpu'
print(f"Device  : {DEVICE}")
print(f"PyTorch : {torch._version_}")

# ── 2. Configuration — set your model paths here ──────────────────
YOLO_MODEL_PATH    = '/content/yolo_malnutrition.pt'
RESNET_MODEL_PATH  = '/content/resnet18_malnutrition.pth'
METADATA_PATH      = '/content/metadata.json'   # optional
YOLO_CONF          = 0.35
IMG_SIZE           = 224

# ── 3. Known constants (used as fallback if metadata.json missing) ─
DEFAULT_YOLO_CLASSES = [
    'visible_ribs', 'distended_belly', 'flat_belly',
    'wasted_arms', 'visible_back_bones', 'moon_face'
]
DEFAULT_RESNET_CLASSES = [
    'distended_belly', 'flat_belly', 'moon_face',
    'visible_back_bones', 'visible_ribs', 'wasted_arms'
]  # alphabetical — matches ImageFolder default ordering
DEFAULT_MARASMUS_SIGNS    = ['visible_ribs', 'flat_belly', 'wasted_arms', 'visible_back_bones']
DEFAULT_KWASHIORKOR_SIGNS = ['distended_belly', 'moon_face']
SIGN_TO_CONDITION = {
    'visible_ribs'       : 'Marasmus / General wasting',
    'flat_belly'         : 'Marasmus / General wasting',
    'wasted_arms'        : 'Marasmus / General wasting',
    'visible_back_bones' : 'Marasmus / General wasting',
    'distended_belly'    : 'Kwashiorkor (protein deficiency)',
    'moon_face'          : 'Kwashiorkor (protein deficiency)',
}
SIGN_DESCRIPTIONS = {
    'visible_ribs'       : 'Rib cage is clearly visible through skin, indicating severe loss of body fat and muscle.',
    'flat_belly'         : 'Abdomen is sunken/flat due to loss of subcutaneous fat, a sign of energy deprivation.',
    'wasted_arms'        : 'Upper arm is visibly thin with muscle wasting, consistent with severe undernutrition.',
    'visible_back_bones' : 'Spine and/or shoulder blades are prominently visible, indicating muscle and fat loss.',
    'distended_belly'    : 'Abdomen is swollen and protruding due to fluid retention from protein deficiency.',
    'moon_face'          : 'Cheeks appear puffy and rounded due to edema from severe protein deficiency.',
}
SIGN_COLORS = {
    'visible_ribs'       : (220,  60,  60),
    'distended_belly'    : ( 60, 120, 220),
    'flat_belly'         : (220, 140,  50),
    'wasted_arms'        : (140,  60, 220),
    'visible_back_bones' : ( 50, 180, 100),
    'moon_face'          : (220,  60, 150),
}

# ── 4. Load metadata (or fall back to defaults) ────────────────────
if os.path.exists(METADATA_PATH):
    with open(METADATA_PATH) as f:
        meta = json.load(f)
    print("✅ Loaded metadata.json")
else:
    meta = {
        'yolo_classes'     : DEFAULT_YOLO_CLASSES,
        'resnet18_classes' : DEFAULT_RESNET_CLASSES,
        'sign_to_condition': SIGN_TO_CONDITION,
        'sign_descriptions': SIGN_DESCRIPTIONS,
        'marasmus_signs'   : DEFAULT_MARASMUS_SIGNS,
        'kwashiorkor_signs': DEFAULT_KWASHIORKOR_SIGNS,
    }
    print("⚠️  metadata.json not found — using built-in defaults")

YOLO_CLASSES = meta['yolo_classes']
CLASS_NAMES  = meta['resnet18_classes']
NUM_CLASSES  = len(CLASS_NAMES)
IDX_TO_CLASS = {i: c for i, c in enumerate(CLASS_NAMES)}

# ── 5. val_transform (must match training exactly) ─────────────────
val_transform = transforms.Compose([
    transforms.Resize((IMG_SIZE, IMG_SIZE)),
    transforms.Grayscale(num_output_channels=3),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
])

# ── 6. Build ResNet18 (same architecture as during training) ────────
def build_resnet18(num_classes, dropout=0.5):
    model = models.resnet18(weights=None)
    in_features = model.fc.in_features
    model.fc = nn.Sequential(
        nn.Dropout(dropout),
        nn.Linear(in_features, 256),
        nn.ReLU(),
        nn.Dropout(0.3),
        nn.Linear(256, num_classes)
    )
    return model

# ── 7. GradCAM ────────────────────────────────────────────────────
class GradCAM:
    def _init_(self, model):
        self.model       = model
        self.gradients   = None
        self.activations = None
        target = model.layer4[-1].conv2
        target.register_forward_hook(self._fwd_hook)
        target.register_backward_hook(self._bwd_hook)

    def _fwd_hook(self, m, inp, out): self.activations = out.detach()
    def _bwd_hook(self, m, gi, go):  self.gradients    = go[0].detach()

    def generate(self, img_tensor, class_idx=None):
        self.model.eval()
        t = img_tensor.unsqueeze(0).to(DEVICE)
        output = self.model(t)
        if class_idx is None:
            class_idx = output.argmax(dim=1).item()
        self.model.zero_grad()
        output[0, class_idx].backward()
        weights = self.gradients.mean(dim=(2, 3), keepdim=True)
        cam     = (weights * self.activations).sum(dim=1, keepdim=True)
        cam     = torch.relu(cam).squeeze().cpu().numpy()
        cam     = cv2.resize(cam, (IMG_SIZE, IMG_SIZE))
        if cam.max() > 0:
            cam = cam / cam.max()
        return cam, class_idx

# ── 8. Load models ────────────────────────────────────────────────
print("\nLoading YOLO model...")
trained_yolo = YOLO(YOLO_MODEL_PATH)
print("✅ YOLO loaded")

print("Loading ResNet18 model...")
resnet18 = build_resnet18(NUM_CLASSES).to(DEVICE)
state = torch.load(RESNET_MODEL_PATH, map_location=DEVICE)
resnet18.load_state_dict(state)
resnet18.eval()
print("✅ ResNet18 loaded")

gradcam = GradCAM(resnet18)
print("✅ GradCAM ready")

# ── 9. Helper functions ───────────────────────────────────────────
def preprocess_crop(crop_bgr):
    pil = Image.fromarray(cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2RGB))
    return val_transform(pil)

def make_gradcam_overlay(img_rgb, cam, alpha=0.45):
    cam_resized = cv2.resize(cam, (img_rgb.shape[1], img_rgb.shape[0]))
    hm = (cm.jet(cam_resized)[:, :, :3] * 255).astype(np.uint8)
    return cv2.addWeighted(img_rgb, 1 - alpha, hm, alpha, 0)

def run_inference_on_image(img_path, view_name):
    img_bgr = cv2.imread(str(img_path))
    if img_bgr is None:
        pil = Image.open(str(img_path)).convert('RGB')
        img_bgr = cv2.cvtColor(np.array(pil), cv2.COLOR_RGB2BGR)

    img_disp  = cv2.resize(img_bgr, (400, 400))
    img_rgb_d = cv2.cvtColor(img_disp, cv2.COLOR_BGR2RGB)

    yolo_res = trained_yolo(str(img_path), verbose=False, conf=YOLO_CONF)[0]
    boxed    = img_rgb_d.copy()
    detected_signs = []

    for box in yolo_res.boxes:
        conf      = float(box.conf[0])
        cls_id    = int(box.cls[0])
        sign_name = YOLO_CLASSES[cls_id]
        x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())

        # ResNet18 verification on the crop
        crop_orig  = img_bgr[y1:y2, x1:x2]
        rnet_class = sign_name
        rnet_conf  = conf
        if crop_orig.size > 0:
            crop_r = cv2.resize(crop_orig, (224, 224))
            tensor = preprocess_crop(crop_r).to(DEVICE)
            with torch.no_grad():
                out  = resnet18(tensor.unsqueeze(0))
                prob = torch.softmax(out, dim=1).cpu().numpy()[0]
            pred_idx   = prob.argmax()
            rnet_class = IDX_TO_CLASS[pred_idx]
            rnet_conf  = prob[pred_idx]

        verified = (rnet_class == sign_name)
        detected_signs.append({
            'sign'        : sign_name,
            'yolo_conf'   : conf,
            'resnet_class': rnet_class,
            'resnet_conf' : rnet_conf,
            'verified'    : verified,
            'box'         : (x1, y1, x2, y2),
            'condition'   : meta['sign_to_condition'].get(sign_name, '')
        })

        # Draw bounding box (scaled to 400×400 display)
        oh, ow = img_bgr.shape[:2]
        sx = 400 / ow; sy = 400 / oh
        bx1, by1 = int(x1 * sx), int(y1 * sy)
        bx2, by2 = int(x2 * sx), int(y2 * sy)
        color = SIGN_COLORS.get(sign_name, (180, 180, 180))
        cv2.rectangle(boxed, (bx1, by1), (bx2, by2), color, 2)
        label = f'{sign_name} {conf:.0%}'
        (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.42, 1)
        cv2.rectangle(boxed, (bx1, by1 - th - 5), (bx1 + tw + 3, by1), color, -1)
        cv2.putText(boxed, label, (bx1 + 2, by1 - 3),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.42, (255, 255, 255), 1)

    # GradCAM on full image
    img_for_cam = cv2.resize(img_bgr, (224, 224))
    cam_tensor  = preprocess_crop(img_for_cam)
    cam_map, _  = gradcam.generate(cam_tensor)
    gradcam_ov  = make_gradcam_overlay(img_rgb_d, cam_map)

    return img_rgb_d, boxed, gradcam_ov, detected_signs

def generate_report(all_signs_by_view):
    all_signs = [s for signs in all_signs_by_view.values() for s in signs]
    verified  = [s for s in all_signs if s['verified']]
    marasmus_signs    = [s for s in all_signs if s['sign'] in meta['marasmus_signs']]
    kwashiorkor_signs = [s for s in all_signs if s['sign'] in meta['kwashiorkor_signs']]

    total_detected = len(all_signs)
    if total_detected == 0:
        condition, severity, sev_color = 'No malnutrition signs detected', 'LOW', 'green'
    elif kwashiorkor_signs and marasmus_signs:
        condition, severity, sev_color = 'Mixed — Kwashiorkor + Marasmus signs present', 'CRITICAL', 'darkred'
    elif kwashiorkor_signs:
        if len(kwashiorkor_signs) >= 2:
            condition, severity, sev_color = 'Kwashiorkor indicators present', 'HIGH', 'red'
        else:
            condition, severity, sev_color = 'Kwashiorkor indicators present', 'MODERATE', 'orange'
    elif len(marasmus_signs) >= 2:
        condition, severity, sev_color = 'Marasmus indicators present', 'HIGH', 'red'
    elif len(marasmus_signs) == 1:
        condition, severity, sev_color = 'Signs of wasting / general malnutrition', 'MODERATE', 'orange'
    else:
        condition, severity, sev_color = 'Mild signs — monitor closely', 'LOW-MODERATE', 'goldenrod'

    return {
        'condition'        : condition,
        'severity'         : severity,
        'sev_color'        : sev_color,
        'all_signs'        : all_signs,
        'marasmus_signs'   : marasmus_signs,
        'kwashiorkor_signs': kwashiorkor_signs,
        'verified_count'   : len(verified),
        'total_detected'   : total_detected
    }

def render_full_report(view_results, report):
    n_views = len(view_results)
    fig = plt.figure(figsize=(6 * n_views, 14))

    for col, (vname, (orig, boxed, gradcam_ov, signs)) in enumerate(view_results.items()):
        ax1 = fig.add_subplot(3, n_views, col + 1)
        ax1.imshow(orig)
        ax1.set_title(f'{vname}\n(original)', fontweight='bold', fontsize=9)
        ax1.axis('off')

        ax2 = fig.add_subplot(3, n_views, n_views + col + 1)
        ax2.imshow(boxed)
        sign_names = [s['sign'] for s in signs]
        ax2.set_title(f'YOLO: {len(signs)} sign(s)\n{", ".join(sign_names) if sign_names else "none"}',
                      fontsize=8, fontweight='bold')
        ax2.axis('off')

        ax3 = fig.add_subplot(3, n_views, 2 * n_views + col + 1)
        ax3.imshow(gradcam_ov)
        ax3.set_title('GradCAM\n(model attention)', fontsize=8)
        ax3.axis('off')

    handles = [mpatches.Patch(color=np.array(c) / 255, label=s)
               for s, c in SIGN_COLORS.items()]
    fig.legend(handles=handles, loc='upper right', fontsize=7,
               title='Sign colors', title_fontsize=8, framealpha=0.8)

    plt.tight_layout(rect=[0, 0.01, 1, 0.88])
    fig.text(0.5, 0.97, f'CONDITION: {report["condition"].upper()}',
             ha='center', fontsize=15, fontweight='bold', color=report['sev_color'])
    fig.text(0.5, 0.93,
             f'Severity: {report["severity"]}   |   '
             f'{report["total_detected"]} sign(s) detected   |   '
             f'{report["verified_count"]} ResNet18-verified',
             ha='center', fontsize=11, color='#444')

    plt.savefig('/content/report_visual.png', dpi=150, bbox_inches='tight')
    plt.show()

def print_text_report(report):
    SEV_ICONS = {'LOW': '🟢', 'LOW-MODERATE': '🟡', 'MODERATE': '🟡',
                 'HIGH': '🔴', 'CRITICAL': '🆘'}
    icon = SEV_ICONS.get(report['severity'], '⚠️')
    print('═' * 65)
    print('  MALNUTRITION VISUAL SCREENING REPORT')
    print('═' * 65)
    print(f'  {icon}  CONDITION : {report["condition"].upper()}')
    print(f'      SEVERITY  : {report["severity"]}')
    print()

    if report['all_signs']:
        print('  DETECTED SIGNS:')
        for s in report['all_signs']:
            v_mark = '✅ verified' if s['verified'] else '⚠️ unverified'
            print(f'    • {s["sign"].replace("_", " "):25s} '
                  f'YOLO:{s["yolo_conf"]:.0%}  '
                  f'ResNet18:{s["resnet_conf"]:.0%}  [{v_mark}]')
            print(f'      → {meta["sign_descriptions"].get(s["sign"], "")}')
    else:
        print('  No signs detected.')

    print()
    print('  CONDITION ANALYSIS:')
    if report['marasmus_signs']:
        m_names = ', '.join(s['sign'].replace('_', ' ') for s in report['marasmus_signs'])
        print(f'    Marasmus indicators   : {m_names}')
        print(f'    Cause                 : Severe energy/calorie deficiency')
        print(f'    Action                : Increase calorie-dense foods, protein,')
        print(f'                           meal frequency (5x/day minimum)')
    if report['kwashiorkor_signs']:
        k_names = ', '.join(s['sign'].replace('_', ' ') for s in report['kwashiorkor_signs'])
        print(f'    Kwashiorkor indicators: {k_names}')
        print(f'    Cause                 : Severe protein deficiency')
        print(f'    Action                : Add protein at EVERY meal — eggs, dal, milk.')
        print(f'                           If edema (swelling) present → REFER IMMEDIATELY')
    if not report['marasmus_signs'] and not report['kwashiorkor_signs'] and report['all_signs']:
        print('    General malnutrition signs present.')
        print('    Improve dietary diversity and increase meal frequency.')
    print()
    if report['severity'] in ('HIGH', 'CRITICAL'):
        print('  🚨 REFER TO HEALTH FACILITY IMMEDIATELY')
    elif report['severity'] == 'MODERATE':
        print('  ⚠️  Follow dietary recommendations. Reassess in 4 weeks.')
    else:
        print('  ✅ Continue monitoring. Reassess in 3 months.')
    print()
    print('  ⚠️  This is a screening tool only. Always confirm with a health worker.')
    print('═' * 65)

# ── 10. Upload test images and run inference ──────────────────────
from google.colab import files

print('\nUpload 3 images in order:')
print('  1. Face image')
print('  2. Front body image')
print('  3. Back body image')
print('(You can select all 3 at once)\n')

uploaded_test  = files.upload()
uploaded_paths = []
for fname, fbytes in uploaded_test.items():
    p = f'/content/test_{fname}'
    with open(p, 'wb') as fh:
        fh.write(fbytes)
    uploaded_paths.append(p)
    print(f'  Saved: {fname}')

view_names = ['Face', 'Front body', 'Back body']
n_views    = min(len(uploaded_paths), 3)
assigned   = {view_names[i]: uploaded_paths[i] for i in range(n_views)}

print(f'\n🔍 Running inference on {n_views} view(s)...')

view_results      = {}
all_signs_by_view = {}

for vname, vpath in assigned.items():
    print(f'  Processing: {vname}...')
    orig, boxed, gradcam_ov, signs = run_inference_on_image(vpath, vname)
    view_results[vname]      = (orig, boxed, gradcam_ov, signs)
    all_signs_by_view[vname] = signs
    print(f'    Signs found: {[s["sign"] for s in signs] or "none"}')

report = generate_report(all_signs_by_view)

print('\nGenerating visual report...')
render_full_report(view_results, report)

print('\nText report:')
print_text_report(report)