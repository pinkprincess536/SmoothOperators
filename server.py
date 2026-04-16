import os
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'

from flask import Flask, request, jsonify
from flask_cors import CORS
import tensorflow as tf
import numpy as np
import cv2, json, os, base64, io

# ─── Keras 2/3 compatibility patch ────────────────────────────────────────────
from tensorflow.keras.layers import Layer, Dense, InputLayer
def patch_layer_init(original_init):
    def new_init(self, *args, **kwargs):
        kwargs.pop('quantization_config', None)
        if 'batch_shape' in kwargs and not hasattr(self, '_batch_input_shape'):
            kwargs['batch_input_shape'] = kwargs.pop('batch_shape')
        return original_init(self, *args, **kwargs)
    return new_init
Layer.__init__   = patch_layer_init(Layer.__init__)
Dense.__init__   = patch_layer_init(Dense.__init__)
InputLayer.__init__ = patch_layer_init(InputLayer.__init__)

import torch
import torch.nn as nn
import torchvision.transforms as transforms
import torchvision.models as tv_models
from ultralytics import YOLO
from PIL import Image

app  = Flask(__name__)
CORS(app)

# ─── 1. TF ResNet (existing /predict endpoint) ────────────────────────────────
MODEL_PATH = 'malnutrition-screening/model/malnutrition_resnet18.h5'
tf_model   = tf.keras.models.load_model(MODEL_PATH)
tf_meta    = json.load(open('model_metadata.json'))
THRESHOLD  = tf_meta['optimal_threshold']
CLASSES    = tf_meta['classes']
cascade    = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')

def preprocess(file_bytes, view):
    arr = np.frombuffer(file_bytes, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if view == 'face':
        gray  = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        faces = cascade.detectMultiScale(gray, 1.1, 4, minSize=(30,30))
        if len(faces) > 0:
            x,y,w,h = sorted(faces, key=lambda f:f[2]*f[3], reverse=True)[0]
            pad = int(max(w,h)*0.3)
            img = img[max(0,y-pad):y+h+pad, max(0,x-pad):x+w+pad]
    h,w  = img.shape[:2]
    side = max(h,w)
    c    = np.zeros((side,side,3), np.uint8)
    c[(side-h)//2:(side-h)//2+h, (side-w)//2:(side-w)//2+w] = img
    
    img_for_overlay = cv2.resize(c, (224, 224))
    
    g    = cv2.cvtColor(c, cv2.COLOR_BGR2GRAY)
    eq   = cv2.createCLAHE(2.0,(8,8)).apply(g)
    img3 = cv2.merge([eq,eq,eq])
    imgr = cv2.resize(img3,(224,224)).astype(np.float32)
    from tensorflow.keras.applications.resnet50 import preprocess_input
    tensor = np.expand_dims(preprocess_input(imgr), 0)
    return tensor, img_for_overlay

import matplotlib.cm as cm
def make_gradcam_heatmap(img_array, model, pred_index=None):
    last_conv_layer_name = None
    for layer in reversed(model.layers):
        try:
            if len(layer.output.shape) == 4:
                last_conv_layer_name = layer.name
                break
        except Exception:
            pass
    if last_conv_layer_name is None:
        return np.zeros((224, 224))
        
    grad_model = tf.keras.models.Model(
        inputs=[model.inputs], outputs=[model.get_layer(last_conv_layer_name).output, model.output]
    )
    with tf.GradientTape() as tape:
        last_conv_layer_output, preds = grad_model(img_array)
        if pred_index is None:
            pred_index = tf.argmax(preds[0])
        class_channel = preds[:, pred_index]
    grads = tape.gradient(class_channel, last_conv_layer_output)
    pooled_grads = tf.reduce_mean(grads, axis=(0, 1, 2))
    last_conv_layer_output = last_conv_layer_output[0]
    heatmap = last_conv_layer_output @ pooled_grads[..., tf.newaxis]
    heatmap = tf.squeeze(heatmap)
    heatmap = tf.maximum(heatmap, 0) / tf.math.reduce_max(heatmap)
    return heatmap.numpy()

def get_gradcam_base64(img_bgr, heatmap, alpha=0.4):
    heatmap = np.uint8(255 * heatmap)
    jet = cm.get_cmap("jet")
    jet_colors = jet(np.arange(256))[:, :3]
    jet_heatmap = (jet_colors[heatmap] * 255).astype(np.uint8)
    jet_heatmap = cv2.resize(jet_heatmap, (img_bgr.shape[1], img_bgr.shape[0]))
    superimposed_img = cv2.addWeighted(img_bgr, 1 - alpha, jet_heatmap, alpha, 0)
    _, buf = cv2.imencode('.jpg', superimposed_img, [cv2.IMWRITE_JPEG_QUALITY, 85])
    return base64.b64encode(buf).decode()

@app.route('/predict', methods=['POST'])
def predict():
    probs, details = [], []
    for view in ['face','front','back']:
        if view not in request.files: continue
        tensor, img_for_overlay = preprocess(request.files[view].read(), view)
        prob   = float(tf_model.predict(tensor, verbose=0)[0][0])
        
        heatmap = make_gradcam_heatmap(tensor, tf_model, pred_index=None)
        heatmap_b64 = get_gradcam_base64(img_for_overlay, heatmap)
        
        probs.append(prob)
        details.append({
            'view': view, 
            'probability': round(prob,4),
            'label': CLASSES[int(prob >= THRESHOLD)],
            'gradcam_image': heatmap_b64
        })
    avg   = float(np.mean(probs)) if probs else 0.0
    label = CLASSES[int(avg >= THRESHOLD)] if probs else 'UNKNOWN'
    return jsonify({'final_label': label, 'average_probability': round(avg,4),
                    'threshold': THRESHOLD, 'views': details})

# ─── 2. YOLO + PyTorch ResNet18 (new /detect endpoint) ───────────────────────
DEVICE      = 'cuda' if torch.cuda.is_available() else 'cpu'
YOLO_META   = json.load(open('malnutrition_package/metadata.json'))
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
print(f"YOLO + ResNet18 ready on {DEVICE}")

def bytes_to_bgr(file_bytes):
    arr = np.frombuffer(file_bytes, np.uint8)
    return cv2.imdecode(arr, cv2.IMREAD_COLOR)

def verify_crop(crop_bgr, expected_sign):
    if crop_bgr is None or crop_bgr.size == 0:
        return expected_sign, 0.0
    pil = Image.fromarray(cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2RGB))
    t   = val_transform(pil).unsqueeze(0).to(DEVICE)
    with torch.no_grad():
        logits = pt_resnet(t)
        probs  = torch.softmax(logits, dim=1).cpu().numpy()[0]
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

        # Run YOLO
        yolo_results = yolo_model(img_bgr, verbose=False, conf=YOLO_CONF)[0]
        signs_this_view = []

        for box in yolo_results.boxes:
            conf     = float(box.conf[0])
            cls_id   = int(box.cls[0])
            sign_name = YOLO_CLASSES[cls_id]
            x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
            x1, y1 = max(0, x1), max(0, y1)
            x2, y2 = min(ow, x2), min(oh, y2)

            # ResNet18 verification on crop
            crop = img_bgr[y1:y2, x1:x2] if (x2>x1 and y2>y1) else None
            rnet_class, rnet_conf = verify_crop(crop, sign_name)
            verified = (rnet_class == sign_name)

            # Draw on annotated image
            color = SIGN_COLORS_BGR.get(sign_name, (180,180,180))
            cv2.rectangle(annotated, (x1,y1), (x2,y2), color, 2)
            lbl = f'{sign_name.replace("_"," ")} {conf:.0%}'
            (tw,th),_ = cv2.getTextSize(lbl, cv2.FONT_HERSHEY_SIMPLEX, 0.48, 1)
            cv2.rectangle(annotated, (x1, y1-th-6), (x1+tw+4, y1), color, -1)
            cv2.putText(annotated, lbl, (x1+2, y1-3),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.48, (255,255,255), 1)

            sign_entry = {
                'sign': sign_name,
                'yolo_conf': round(conf, 3),
                'resnet_class': rnet_class,
                'resnet_conf': round(rnet_conf, 3),
                'verified': verified,
                'condition': SIGN_TO_CONDITION.get(sign_name, ''),
                'description': SIGN_DESCRIPTIONS.get(sign_name, ''),
                # Normalized bbox [0-1] for JS canvas
                'bbox': [round(x1/ow,4), round(y1/oh,4), round(x2/ow,4), round(y2/oh,4)]
            }
            signs_this_view.append(sign_entry)
            all_signs.append(sign_entry)

        view_results[view] = {
            'signs': signs_this_view,
            'annotated_image': img_to_b64(annotated)
        }

    condition, severity, sev_color = generate_severity(all_signs)
    marasmus_signs    = [s for s in all_signs if s['sign'] in MARASMUS_SIGNS]
    kwashiorkor_signs = [s for s in all_signs if s['sign'] in KWASHIORKOR_SIGNS]

    return jsonify({
        'condition': condition,
        'severity': severity,
        'severity_color': sev_color,
        'total_signs': len(all_signs),
        'verified_count': sum(1 for s in all_signs if s['verified']),
        'marasmus_signs': [s['sign'] for s in marasmus_signs],
        'kwashiorkor_signs': [s['sign'] for s in kwashiorkor_signs],
        'views': view_results
    })

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'})

if __name__ == '__main__':
    app.run(port=5000, debug=False)