import os
os.environ['CUDA_VISIBLE_DEVICES'] = ''

from flask import Flask, request, jsonify
from flask_cors import CORS
import json, cv2, base64
import numpy as np
import torch
import torch.nn as nn
import torchvision.transforms as transforms
import torchvision.models as tv_models
from ultralytics import YOLO
from PIL import Image

app  = Flask(__name__)
CORS(app)

DEVICE = 'cpu'
YOLO_META     = json.load(open('malnutrition_package/metadata.json'))
YOLO_CLASSES  = YOLO_META['yolo_classes']
RESNET_CLASSES= YOLO_META['resnet18_classes']
IDX_TO_CLASS  = {i: c for i, c in enumerate(RESNET_CLASSES)}
MARASMUS_SIGNS    = set(YOLO_META['marasmus_signs'])
KWASHIORKOR_SIGNS = set(YOLO_META['kwashiorkor_signs'])
SIGN_DESCRIPTIONS = YOLO_META['sign_descriptions']
SIGN_TO_CONDITION = YOLO_META['sign_to_condition']
YOLO_CONF     = YOLO_META.get('yolo_conf_threshold', 0.35)
NUM_CLASSES   = len(RESNET_CLASSES)

SIGN_COLORS_BGR = {
    'visible_ribs'       : (60,  60, 220),
    'distended_belly'    : (220,120,  60),
    'flat_belly'         : (50, 140, 220),
    'wasted_arms'        : (220, 60, 140),
    'visible_back_bones' : (100,180,  50),
    'moon_face'          : (150, 60, 220),
    'sunken_eyes'        : (200,200,  50),
}

val_transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.Grayscale(num_output_channels=3),
    transforms.ToTensor(),
    transforms.Normalize([0.485,0.456,0.406],[0.229,0.224,0.225])
])

def build_resnet18(num_classes):
    m = tv_models.resnet18(weights=None)
    in_f = m.fc.in_features
    m.fc = nn.Sequential(
        nn.Dropout(0.5), nn.Linear(in_f, 256), nn.ReLU(),
        nn.Dropout(0.3), nn.Linear(256, num_classes))
    return m

print("Loading YOLO model...")
yolo_model = YOLO('malnutrition_package/yolo_malnutrition.pt')
print("Loading PyTorch ResNet18 model...")
pt_resnet = build_resnet18(NUM_CLASSES).to(DEVICE)
state_dict = torch.load('malnutrition_package/resnet18_malnutrition.pth', map_location=DEVICE)
pt_resnet.load_state_dict(state_dict)
pt_resnet.eval()
print(f"YOLO server ready on device: {DEVICE}")

def bytes_to_bgr(file_bytes):
    arr = np.frombuffer(file_bytes, np.uint8)
    return cv2.imdecode(arr, cv2.IMREAD_COLOR)

def verify_crop(crop_bgr, expected_sign):
    if crop_bgr is None or crop_bgr.size == 0:
        return expected_sign, 0.0
    pil = Image.fromarray(cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2RGB))
    t   = val_transform(pil).unsqueeze(0).to(DEVICE)
    with torch.no_grad():
        probs = torch.softmax(pt_resnet(t), dim=1).cpu().numpy()[0]
    idx = int(probs.argmax())
    return IDX_TO_CLASS[idx], float(probs[idx])

def generate_severity(all_signs):
    marasmus    = [s for s in all_signs if s['sign'] in MARASMUS_SIGNS]
    kwashiorkor = [s for s in all_signs if s['sign'] in KWASHIORKOR_SIGNS]
    if not all_signs:
        return 'No malnutrition signs detected', 'LOW', '#16a34a'
    if kwashiorkor and marasmus:
        return 'Mixed — Kwashiorkor + Marasmus signs', 'CRITICAL', '#7f1d1d'
    if kwashiorkor:
        sev = 'HIGH' if len(kwashiorkor) >= 2 else 'MODERATE'
        return 'Kwashiorkor indicators present', sev, '#b91c1c'
    if len(marasmus) >= 2:
        return 'Marasmus indicators present', 'HIGH', '#b91c1c'
    if len(marasmus) == 1:
        return 'Signs of wasting / general malnutrition', 'MODERATE', '#d97706'
    return 'Mild signs — monitor closely', 'LOW-MODERATE', '#ca8a04'

def img_to_b64(img_bgr):
    _, buf = cv2.imencode('.jpg', img_bgr, [cv2.IMWRITE_JPEG_QUALITY, 88])
    return base64.b64encode(buf).decode()

@app.route('/detect', methods=['POST'])
def detect():
    view_results = {}
    all_signs    = []
    for view in ['face', 'front', 'back']:
        if view not in request.files:
            continue
        raw     = request.files[view].read()
        img_bgr = bytes_to_bgr(raw)
        if img_bgr is None:
            continue
        oh, ow = img_bgr.shape[:2]
        annotated = img_bgr.copy()
        yolo_results = yolo_model(img_bgr, verbose=False, conf=YOLO_CONF)[0]
        signs_this_view = []
        for box in yolo_results.boxes:
            conf      = float(box.conf[0])
            cls_id    = int(box.cls[0])
            sign_name = YOLO_CLASSES[cls_id]
            x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
            x1, y1 = max(0, x1), max(0, y1)
            x2, y2 = min(ow, x2), min(oh, y2)
            crop = img_bgr[y1:y2, x1:x2] if (x2>x1 and y2>y1) else None
            rnet_class, rnet_conf = verify_crop(crop, sign_name)
            verified = (rnet_class == sign_name)
            color = SIGN_COLORS_BGR.get(sign_name, (180,180,180))
            cv2.rectangle(annotated, (x1,y1), (x2,y2), color, 2)
            lbl = f'{sign_name.replace("_"," ")} {conf:.0%}'
            (tw,th),_ = cv2.getTextSize(lbl, cv2.FONT_HERSHEY_SIMPLEX, 0.48, 1)
            cv2.rectangle(annotated, (x1, y1-th-6), (x1+tw+4, y1), color, -1)
            cv2.putText(annotated, lbl, (x1+2, y1-3),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.48, (255,255,255), 1)
            sign_entry = {
                'sign': sign_name, 'yolo_conf': round(conf,3),
                'resnet_class': rnet_class, 'resnet_conf': round(rnet_conf,3),
                'verified': verified,
                'condition': SIGN_TO_CONDITION.get(sign_name, ''),
                'description': SIGN_DESCRIPTIONS.get(sign_name, ''),
                'bbox': [round(x1/ow,4), round(y1/oh,4), round(x2/ow,4), round(y2/oh,4)]
            }
            signs_this_view.append(sign_entry)
            all_signs.append(sign_entry)
        view_results[view] = {
            'signs': signs_this_view,
            'annotated_image': img_to_b64(annotated)
        }
    condition, severity, sev_color = generate_severity(all_signs)
    return jsonify({
        'condition': condition, 'severity': severity, 'severity_color': sev_color,
        'total_signs': len(all_signs),
        'verified_count': sum(1 for s in all_signs if s['verified']),
        'marasmus_signs': [s['sign'] for s in all_signs if s['sign'] in MARASMUS_SIGNS],
        'kwashiorkor_signs': [s['sign'] for s in all_signs if s['sign'] in KWASHIORKOR_SIGNS],
        'views': view_results
    })

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'model': 'yolo+resnet18'})

if __name__ == '__main__':
    app.run(port=5001, debug=False)
