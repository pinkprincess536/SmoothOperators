# Malnutrition Screening AI – Hackathon Improvement Brief

## Executive Summary

This brief synthesizes recent research (2022–2025) and practical tooling to help upgrade a malnutrition-screening PWA that combines anthropometric Z-scores and image-based CNN classification for children, with a focus on what can realistically be improved within a 24–48 hour hackathon sprint. Key opportunities are: leveraging new public multi-view nutritional-status image datasets, adopting more modern lightweight backbones (EfficientNetV2 or MobileNetV3) for better small-data performance and edge deployment, applying stronger augmentation and loss functions for class imbalance, adding explainability via Grad-CAM, and wrapping the pipeline in an offline-first clinical decision support experience aligned with WHO/UNICEF guidance.[1][2][3][4][5][6]

***

## Part 1 – Better Datasets

### 1.1 Public image datasets for child nutritional status

**AnthroVision Dataset (IIT Jodhpur)**

- Public dataset specifically for automated nutritional status assessment in children, with multi-angle images (full-body and facial views) plus anthropometric labels (age, height, weight, BMI, MUAC, head circumference).[6]
- Each subject has about eight multi-pose images; 2,141 subjects yield ~16,938 images, with labels derived from WHO and CDC growth standards (weight-for-age, height-for-age, BMI-for-age Z-scores) and categorical labels such as healthy, underweight/wasting, and overall malnutrition category.[6]
- Highly relevant: you can fine-tune your model to predict these labels from images, then adapt to your own 3-class (SAM/MAM/normal) scheme while keeping WHO-consistent ground truth.

**Child 3D Anthropometry Evaluation Datasets (AutoAnthro, Zenodo)**

- 3D imaging and manual anthropometry (length/height, MUAC, head circumference) from 600 children aged 0–59 months in Guatemala and Kenya and 300 children 0–23 months in China, collected to evaluate an AutoAnthro 3D measurement system.[7]
- Includes paired scan and manual measurements with biases and technical error of measurement, which is valuable if you explore depth-based MUAC or stature estimation for malnutrition risk, or to benchmark your MUAC-from-image pipeline.[7]

**Novel Indonesian facial image database (stunted vs normal)**

- Database of 4,000 frontal facial images from 100 Indonesian children aged 2–5 years, 50 stunted and 50 normal, used with AlexNet and ResNet34 to classify stunted vs normal with near-perfect accuracy under lab conditions.[8]
- The database was built for research and may be available on request; it directly targets stunting classification from face images and is ideal for transfer learning or benchmarking your face-only model.[9]

**Other face-based nutritional datasets and studies**

- A machine-learning model using facial feature recognition predicted nutritional risk (NRS-2002) from facial images of 949 adult patients using U-Net for orbital fat segmentation and HOG features with an SVM classifier; while adult-focused, it shows a full pipeline from clinical score to facial features.[10]
- Multiple 2024–2025 works report datasets of a few hundred to ~1,200 child facial images for malnutrition classification (binary or 3-class), often combining facial analysis with anthropometric measurements; many are described in recent reviews and theses, and may be available from authors on request.[11][12]

**Image resources for MUAC and growth assessment**

- The IYCF (Infant and Young Child Feeding) Image Bank hosts high-resolution demonstration images of MUAC measurement and related practices (maternal and child), which can seed segmentation / pose estimation models or be used as weakly-labeled data for detecting correct arm positioning.[13]
- The "Mid-Upper Arm Circumference Measurement Using Digital Images" work trained Mask R-CNN on annotated images of arms from front and side views to estimate MUAC with a mean absolute error of 2.31 cm versus manual measurements, suggesting their underlying dataset could potentially be requested for research use.[14][15]

**Non-image malnutrition datasets for multi-modal fusion or synthetic labeling**

- Kaggle "Child Malnutrition – UNICEF Dataset" contains UNICEF/WHO/World Bank Joint Child Malnutrition Estimates (JME) at country/regional level for stunting, wasting, severe wasting, underweight, and overweight.[16][17]
- Synthetic tabular stunting and wasting datasets (e.g., "Stunting Wasting Dataset (Synthetic)" on Kaggle) provide structured anthropometric variables; while not for imaging, they are useful for prototyping multi-task models (e.g., predicting Z-score bins from images plus demographics).[18]

**Hackathon-friendly recommendation (24–48h)**

- Download AnthroVision and, if possible, a subset focused on frontal and lateral body views plus MUAC/BMI labels; plug it into your existing preprocessing and use it to fine-tune a better backbone (EfficientNetV2 or MobileNetV3) for healthy vs unhealthy and underweight/wasting vs normal classification.[6]
- Augment your tiny in-house dataset by mixing it with AnthroVision images that match similar age ranges and body poses; keep in-house images for validation so you can show generalization beyond the public dataset.

### 1.2 Synthetic data generation in medical imaging (for malnutrition-related tasks)

- A 2023 systematic review of GANs in pediatric radiology shows GANs used successfully for data augmentation, synthesis, and disease diagnosis across MRI, X-ray, CT, ultrasound, and PET, improving performance in many pediatric tasks; the same architectures (DCGAN, cGAN, StyleGAN variants) can be reused for child body/face images.[19]
- Broader reviews of GAN-based medical image synthesis report that GAN-generated images can closely resemble real medical data and significantly enhance performance when combined with classic augmentations, especially for rare classes.[20]
- A pediatric pneumonia study used GANs plus standard augmentations (rotation, zoom, shear, flip) to generate additional chest X-rays, finding that combined original+augmented+GAN data improved CNN performance and helped address class imbalance.[21]

**Practical options for your project**

- For a 24–48h sprint, implementing a custom GAN from scratch is risky; instead, use existing GAN-augmented pipelines as justification that heavy augmentations are clinically acceptable and focus on strong spatial augmentations (MixUp, CutMix, SnapMix) plus color/lighting perturbations.[22][23]
- If you already have a GPU training setup, you can try a simple DCGAN or StyleGAN2 for faces by reusing open-source PyTorch/TensorFlow code and training on your 183 images plus public child-face datasets (e.g., HDA Synthetic Children Face Database) to generate additional realistic faces, then fine-tune the classifier on a mix of real and synthetic data.[24]

### 1.3 Data augmentation strategies for small medical image datasets

A 2023 review of medical image data augmentation highlights that classic flips/rotations are often insufficient for generalization and that mix-based strategies (MixUp, CutMix, AugMix, SnapMix, YOCO) can substantially improve robustness and calibration.[23][22]

- **MixUp & CutMix**: A study on medical CNNs found MixUp and CutMix improved both accuracy and AUROC, with CutMix often giving the best calibration and MixUp giving the biggest accuracy gain (+6.7% absolute on a ResNet-101 baseline).[25][26]
- **MediAug benchmark**: MediAug systematically evaluated MixUp, YOCO, CropMix, CutMix, AugMix, and SnapMix across MRI and fundus datasets. MixUp gave the largest boost for ResNet-50 on brain tumor classification, while SnapMix worked best for ViT-B, showing that mix-based augmentations transfer well to medical images.[22]
- **Advanced synthetic augmentation**: Deep learning–based augmentation (e.g., using style transfer or GAN-based local transformations) has been shown to improve tumor segmentation IoU by 6–13 percentage points over no augmentation, underscoring the benefit of rich perturbations on small datasets.[27]

**Recommended augmentation recipe for your classifier (doable in a hackathon)**

- Baseline spatial/color: random crop/rescale, horizontal flip, small rotations (±10–15°), random brightness/contrast, and slight Gaussian noise.
- Mix-based augmentations:
  - Apply MixUp at a low probability (e.g., 0.3) with \\(\alpha \approx 0.2\\) in early epochs, then anneal to zero in later epochs.
  - Apply CutMix or SnapMix at moderate probability (0.3–0.5) to enforce attention to multiple regions of the body/face.
- Class-conditional augmentation:
  - Use stronger color/contrast distortions and random occlusions (CutOut) on the majority class (healthy) and milder ones on minority (malnourished/SAM) to avoid washing out subtle emaciation cues.
- Ensure deterministic validation set with no augmentation so metrics are interpretable.

This mix-based strategy is easy to add to a Keras or PyTorch pipeline and is well-supported by empirical evidence in medical imaging.[25][23][22]

***

## Part 2 – Model Architecture Improvements

### 2.1 Architectures beyond ResNet50 for small medical datasets & edge deployment

Several comparative studies in medical imaging indicate that EfficientNet-family models and lightweight CNNs can outperform or match ResNet50 while being more parameter-efficient and better suited to small datasets.[28][2]

- An 11-architecture comparison on small COVID-19 lung-image datasets found EfficientNet models performed better than ResNet, DenseNet, and Inception networks in accuracy and efficiency, while MobileNet achieved performance comparable to heavier architectures.[2]
- A 2025 brain tumor study comparing ResNet50, EfficientNet, and EfficientNetV2 reported that EfficientNetV2 delivered the best accuracy using transfer learning but with higher training time due to added complexity; still, it was more sample-efficient than ResNet50.[28]
- Reviews of ViTs vs CNNs in medical imaging show that ViTs and hybrid Transformers can outperform CNNs when heavily pre-trained on large datasets, but they are more data-hungry and computationally intensive; for small datasets, well-regularized CNNs or hybrid CNN-Transformer architectures often provide a better trade-off.[29][30][31]

**Edge/deployment-friendly baselines**

- **MobileNetV3**: Designed for mobile and embedded vision with good accuracy–latency trade-off; widely used with TensorFlow.js and TFLite for on-device inference.[32][33]
- **EfficientNet-B0 / EfficientNetV2-S**: Strong general-purpose backbones that fine-tune well on small medical datasets and remain relatively small; good for server-side backends or moderately powerful devices.[34][28]
- **ConvNeXt-T**: A modern CNN with better training behavior and ResNet-like architecture, competitive with Swin Transformers at similar compute; more suitable for server or powerful edge devices.[34]
- **ViT-B/16 (or DeiT-Small)**: High performance but typically requires larger datasets or strong pretraining; better for a future iteration rather than a weekend hack, unless used as fixed feature extractor with minimal fine-tuning.[35][29]

**Actionable architecture recommendations (hackathon scope)**

- Replace ResNet50 with **EfficientNet-B0 or EfficientNetV2-S** as the main Keras/TensorFlow backbone; initialize with ImageNet weights and fine-tune only the top layers plus the last few blocks.[2][28]
- For edge and TF.js deployment, export a **MobileNetV3-Small or -Large** classifier head trained on your malnutrition dataset, then convert to TF.js via the `tensorflowjs_converter`, piggybacking on existing MobileNet TF.js examples.[33][32]
- Keep model size under ~10–20 MB and use post-training quantization (int8) for offline PWA use.

### 2.2 Multi-view image fusion (face + front + back)

General multi-view CNN research proposes several fusion strategies that can be re-used for your three-view pipeline.[36]

- A 2021 multi-view CNN framework investigated three fusion strategies: (1) fusing convolutional feature maps (early fusion), (2) fusing fully connected representations (late fusion), and (3) fused view-pooling using "view voting"; late fusion and view-pooling often gave better robustness than early concatenation.[36]
- Multimodal medical image fusion work (e.g., combining CT and MRI) uses CNNs plus an auxiliary classifier (e.g., extreme learning machine) to combine modality-specific features, showing that learned fusion weights outperform simple averaging.[37][38]

**Practical fusion architectures for your case**

- **Shared backbone + attention pooling (recommended)**:
  - Pass face, front, and back images through the same backbone (e.g., EfficientNet-B0) with shared weights.
  - Obtain a feature vector per view via global average pooling.
  - Concatenate the three vectors and apply a small self-attention or gated mechanism to learn per-view importance, then feed into a final MLP classifier.
- **Score-level late fusion**:
  - Train separate classifiers for face, front, and back views, then average or weighted-average their softmax scores; weights can be learned via a small meta-network trained on validation data.
- **Hierarchical fusion**:
  - First fuse front+back views to capture body wasting cues, then combine the resulting feature with face-based cues, reflecting clinical workflow (body then face).

All of these architectures can be implemented with Keras functional API in a few dozen lines and do not require changes to your Flask API beyond handling multiple images per request.[36]

### 2.3 MUAC measurement from photos

- The 2025 "Mid-Upper Arm Circumference Measurement Using Digital Images" paper uses Mask R-CNN with a top-down panoptic segmentation pipeline to identify the upper arm from front and side-view images, then uses geometric features (bounding-box diagonals and ellipse approximations) plus a pixel-to-centimeter calibration (wall power plug as reference) to estimate MUAC, achieving a mean absolute error of 2.31 cm compared to manual measurements on 72 images.[15][14]
- Depth-based anthropometry work has also demonstrated child height estimation from depth images alongside manual MUAC measurements, indicating that commodity depth cameras or simple stereo setups can provide adequate accuracy for malnutrition screening.[39]
- Large 3D anthropometry datasets like AutoAnthro provide real-world MUAC measurements and scan-based estimates, offering ground truth for validating computer vision MUAC tools.[7]

**Hackathon-feasible MUAC-from-photo prototype**

- For a weekend sprint, full Mask R-CNN training is heavy; instead, prototype a **heuristic MUAC-assist feature**:
  - Use MediaPipe or a pose-estimation model to detect shoulder and elbow joints from an arm photo and draw a guideline where MUAC should be measured.
  - Let the app display a visual overlay and instruct the CHW (community health worker) to place the tape at that position, thus improving MUAC measurement quality without replacing the tape.
- If you have time and a few labeled arm masks, fine-tune a lightweight segmentation network (e.g., DeepLabV3+ with MobileNet backbone) on cropped arm images to detect a circular cross-section region and estimate circumference using a reference object (e.g., a printed fiducial or phone width).

### 2.4 Loss functions and training tricks for imbalanced, small medical image datasets

**Specialized loss functions**

- Batch-balanced focal loss (BBFL) combines batch balancing with focal loss, improving CNN performance on imbalanced fundus image datasets in both binary and multiclass disease classification tasks.[3]
- Large Margin aware Focal (LMF) loss and other hybrid focal/class-balanced losses have been proposed specifically for imbalanced medical imaging classification, showing better sensitivity on minority pathology classes.[40][41]
- Unified Focal Loss generalizes Dice and cross-entropy-based losses for segmentation to handle class imbalance, and achieves consistent improvements across multiple imbalanced medical segmentation tasks; its ideas (focal weighting on harder examples) also apply conceptually to classification.[42][43]

**Calibration and training strategies**

- A PLOS One study on class-imbalanced medical image classification showed that model calibration (e.g., temperature scaling, isotonic regression) significantly improves performance at the default threshold of 0.5, particularly in imbalanced settings, although gains diminish when using an optimal threshold from precision–recall curves.[44][45]
- Reviews of imbalanced medical imaging suggest combining loss engineering with re-sampling, stratified mini-batches, and curriculum learning (starting with easier or more typical examples and progressively increasing difficulty or occlusion).[46][47][48]

**Recommended training recipe for your setting**

- Use **class-balanced focal loss or batch-balanced focal loss** in place of plain binary cross-entropy.
- Employ **stratified mini-batching** so each batch contains a fixed ratio of malnourished vs healthy images; oversample minority class images with strong augmentation.
- Apply a light **curriculum**: train first with easy augmentations and full-resolution images, then introduce stronger mix-based augmentations or occlusions (e.g., YOCO, CutOut) after the model has stabilized.[46][22]
- After training, run a **temperature scaling calibration** step on a small validation set to ensure probabilities correspond to observed risk, which is important for clinical decision support.[44]

***

## Part 3 – Clinical and Scientific Rigour

### 3.1 Extending from binary to SAM/MAM/Normal (3-class)

Recent studies have moved beyond binary classification to multi-class severity categorization that aligns more closely with SAM, MAM, and normal.

- An EfficientNet-E7–based framework for "Identification of Nutritional Deficiency in Children Through Deep Learning" reports a dataset of child facial images categorized into three classes: Normal, Moderate Malnutrition, and Severe Malnutrition, and finds that EfficientNet-E7 achieved the highest accuracy, with a lightweight custom CNN performing similarly with far fewer parameters.[49][50]
- Several deep-learning frameworks combine anthropometric measurements and facial images to classify malnutrition status (e.g., normal vs mild vs severe) and report accuracies in the 86–92% range on datasets of a few hundred to a thousand children.[12][11]
- The MERON system, trained on 3,167 Kenyan children, uses facial photographs to predict BMI and weight-for-height Z-score categories; it successfully classified 60% of child malnutrition cases, demonstrating feasibility of severity categorization from images but also highlighting the need for larger and more diverse training sets.[51]

**How to structure a 3-class model**

- Define labels using WHO criteria: SAM (WHZ < −3 or MUAC < 115 mm or oedema), MAM (−3 ≤ WHZ < −2 or MUAC 115–125 mm, without oedema), and Normal (WHZ ≥ −2 and MUAC ≥ 125 mm, no oedema).[5][52]
- Train a **3-way classifier** (SAM / MAM / normal) instead of binary, and optionally collapse SAM+MAM into "malnourished" for a high-sensitivity binary decision in deployment while still using the 3-way output internally for decision support.
- If data are too imbalanced, start with a 2-class model (normal vs any malnourished) and add a second-stage classifier that refines malnourished into SAM vs MAM, which can be trained with stronger regularization and prior-based thresholds.

### 3.2 Clinical validation benchmarks and gold-standard test sets

There is not yet a single universally adopted gold-standard **image** benchmark for AI-based childhood malnutrition classification analogous to ChestX-ray14 or ISIC in other domains; most groups train and evaluate on their own datasets (e.g., MERON, Indonesian stunting dataset, AnthroVision).[8][51][6]

However, there are well-established anthropometric **ground truths** and large-scale measurement datasets that can be used as reference for validating your combined Z-score + image model:

- WHO/UNICEF/World Bank Joint Child Malnutrition Estimates (JME) define prevalence and thresholds for stunting, wasting, and overweight and maintain global and regional estimates; these data themselves are not image-based but provide prevalence baselines and cut-offs to which your system should conform.[53][54]
- Large anthropometry evaluation datasets like AutoAnthro offer high-quality manual and scan-based length/height and MUAC measurements that can serve as ground truth for validating image-derived anthropometry and classification thresholds.[7]
- Studies like "Optimal Screening of Children with Acute Malnutrition Requires a Change in Current WHO Guidelines" examine how MUAC and WHZ identify different patient groups, underscoring that any AI tool should respect both indicators and not rely on image features alone.[55]

For hackathon purposes, you can present your own small held-out test set (ideally with clinician-reviewed labels) as a "local benchmark" and situate it relative to reported performance in MERON, AnthroVision-based models, and the ResNet-50 Sci Rep 2025 study.[4][51][6]

### 3.3 WHO, UNICEF, Save the Children guidance for digital malnutrition tools

**WHO nutritional guidance**

- The 2023 WHO guideline on the prevention and management of wasting and nutritional oedema provides normative, evidence-informed recommendations on admission, referral, and treatment criteria for acute malnutrition, based on MUAC, WHZ, and oedema, and supersedes older 2013 guidance.[56][5]
- WHO guidelines emphasize that severe acute malnutrition (SAM) is defined by MUAC < 115 mm, WHZ < −3, or bilateral pitting oedema and that community-based management (CMAM) with ready-to-use therapeutic food is the main treatment pathway.[52][5]

**Digital health and SMART guidelines**

- WHO "Recommendations on digital interventions for health system strengthening" list key digital functions relevant to your app: client-to-provider telemedicine, patient tracking, mobile health worker decision support, and mobile learning.[57]
- WHO SMART Guidelines initiative and its Digital Adaptation Kits (DAKs) for child health in humanitarian emergencies define how to translate WHO clinical recommendations into interoperable digital decision-support algorithms, stressing standardization, offline capability, and fidelity to guideline logic.[58][59]

**UNICEF and CMAM/Save the Children perspectives**

- UNICEF’s "Management of Severe Acute Malnutrition in Children: Working Towards Results at Scale" program guidance stresses accurate identification, decentralized community-based treatment, robust monitoring and evaluation, and integration with CMAM programs; it refers to the use of digital tracking tools and MIS to monitor SAM/MAM children.[60]
- A NITI Aayog–UNICEF report on community-based management of acute malnutrition in India documents Android-based applications for real-time data entry and tracking of children with SAM and MAM, emphasizing standardized protocols, data quality, and follow-up.[61]
- Save the Children and IASC Nutrition Cluster CMAM resource signposting documents highlight key requirements for tools: support for regular community screening (often by lay workers or caregivers), simple user interfaces, offline operation, and integration with existing reporting systems rather than standalone pilots.[62][63]

**Minimum requirements to claim clinical deployability in low-resource settings**

For a digital malnutrition screening tool to be considered clinically credible by WHO/UNICEF-aligned programs, it should:

- Use **standard anthropometric definitions** (WHZ, HAZ, WAZ, MUAC, oedema) and clearly show thresholds for SAM and MAM based on official growth standards.[64][5]
- Act as **decision support**, not a stand-alone diagnostic, and avoid overriding anthropometric indications with image-based predictions.
- Provide **clear referral and treatment guidance** consistent with CMAM/IMAM protocols (e.g., when to refer to outpatient therapeutic programs vs inpatient stabilization).[5][60]
- Work **offline**, synchronize when connectivity is available, and support low-literate users via icons, colors, and local languages.[62][57]
- Implement **data protection and privacy safeguards**, especially for facial images of children, and preferably avoid storing raw images, as MERON does by storing only facial key points.[65][51]

***

## Part 4 – New Features to Add

### 4.1 Impactful product features for a malnutrition-screening PWA

Based on digital health guidance, CMAM implementation reports, and recent smartphone-MUAC pilots, the following features would strongly differentiate your PWA in a hackathon.[57][61][62]

- **Offline-first, low-bandwidth design**:
  - Use a service worker with cache-first strategies for static assets and your TF.js model so the app loads and runs entirely offline; synchronize results when the network is available.[66][67]
  - Persist screening records in IndexedDB with a small queue for background sync on reconnection.
- **Referral and follow-up workflow**:
  - Turn the classifier output plus anthropometric Z-scores into a structured care recommendation: "Treat as SAM – refer to OTP/ITP today", "Treat as MAM – enroll in SFP and schedule follow-up in 14 days", or "Normal – counsel caregiver, follow-up in 3 months".[60][5]
  - Provide a simple referral summary screen that can be shown to caregivers and a printable or SMS summary where possible.
- **Growth charting & history**:
  - Plot weight-for-age, height-for-age, and MUAC over time vs WHO growth curves, flagging crossing of Z-score lines; these curves are standard outputs in anthropometry tools and resonate with clinicians and program managers.[68][5]
- **Localization and regional customization**:
  - Pre-configure target WHZ/MUAC thresholds, language, and treatment protocols for specific regions (e.g., India’s CMAM pilot guidelines, Kenya’s CMAM guidance), where documentation exists.[55][61]
  - Use icons and color-coding (green, yellow, red) to support low-literacy community workers.
- **Integration with community-led MUAC apps**:
  - Take inspiration from tools like D2A, which supports Family MUAC reporting via smartphone; allow caregivers to record MUAC in-app (with video instructions) and optionally capture a photo of the measurement for later auditing.[62]

### 4.2 Integrating open APIs for regional malnutrition context

You can augment individual screening results with regional prevalence data using open APIs or easily consumable CSV endpoints.

- **WHO Global Health Observatory (GHO) / JME APIs**:
  - The GHO hosts the Joint Child Malnutrition Estimates with country-level stunting, wasting, severe wasting, and overweight prevalence for children under 5; data are accessible via indicator endpoints (e.g., stunting prevalence, severe wasting counts).[53][64]
  - Present local prevalence as "In your country, X% of under-5 children are wasted and Y% are stunted" to contextualize an individual child’s risk.[69]
- **UNICEF Data Warehouse**:
  - UNICEF maintains databases of hundreds of child-related indicators, including malnutrition, accessible via its data warehouse and often mirrored by World Bank/Open Data platforms.[70]
- **Our World in Data (OWID) CSV API**:
  - OWID exposes many nutrition-related indicators (number of children wasted, stunted, undernourished, deaths from malnutrition) via CSV URLs that can be fetched directly from the browser or your backend.[71][72][73][74]

In a hackathon, you can hard-code a small subset (e.g., for India, Kenya, Ethiopia) and fetch from OWID or GHO with simple GET requests, caching responses in the service worker for offline reuse.[72][53]

### 4.3 Clinical decision support outputs beyond a label

A robust CDSS for malnutrition should output more than "healthy" or "malnourished"; it should support frontline decisions and program metrics.[5][57][60]

Suggested outputs per screening:

- **Risk classification**: SAM / MAM / normal, plus a calibrated risk score (e.g., high, medium, low) combining MUAC, WHZ, and image-based confidence.[44][5]
- **Action recommendations**: concise, protocol-aligned suggestions like "Immediate referral to stabilization center" or "Enroll in outpatient therapeutic program and provide RUTF".[75][5]
- **Red flags & contraindications**: checklists for signs requiring urgent care (severe oedema, lethargy, severe dehydration, pneumonia, hypoglycemia) based on WHO ten-step treatment guidance.[5]
- **Follow-up scheduling**: auto-computed review dates (e.g., weekly for SAM, biweekly for MAM, quarterly for normal) and reminders (even if just local notifications in the PWA) for the caregiver or health worker.[61][60]
- **Program indicators**: aggregated counts of screened children, SAM/MAM cases, referrals, and defaulters, aligned with standard CMAM monitoring indicators; this demonstrates impact and helps program managers.[63][61]

### 4.4 Explainability (XAI) with Grad-CAM

Grad-CAM and its variants are widely used in medical imaging to highlight image regions that drive CNN predictions and to build clinician trust.[76][77][78]

- The Keras Grad-CAM tutorial shows how to construct a model that outputs the activations of the last convolutional layer and the final predictions, then use `tf.GradientTape` to compute gradients and back-project them onto the feature maps to produce a heatmap normalized between 0 and 1.[79][80]
- The `tf-keras-vis` library provides a high-level GradCAM API and supports GradCAM++, ScoreCAM, and LayerCAM for Keras models with minimal boilerplate.[81][82][83]
- Medical case studies demonstrate that Grad-CAM overlays often align with clinically relevant areas (e.g., lung opacities, lesions) and help identify spurious correlations and biases.[77][84][76]

**Hackathon implementation plan**

- Wrap your trained Keras model in a small Grad-CAM utility (either reusing the Keras example or `tf-keras-vis`) to generate a heatmap for each photo; overlay it on the original image using OpenCV or PIL and return as a PNG from your Flask API.[81][79]
- Display the heatmap transparently over the child’s image in the PWA when a clinician toggles "Explain prediction"; restrict this view to authenticated health workers and avoid storing the underlying original image on disk.[76]

### 4.5 Offline TF.js / ONNX.js deployment in a PWA

- TensorFlow.js offers pretrained MobileNet models for in-browser image classification, optimized for small size and low latency; the models can be loaded via script tags or npm and run directly on `<video>`/`anvas>` elements.[85][32][33]
- Service workers can cache large TF.js model files and shards so they are downloaded only once, then served from cache even offline; examples show how to intercept model requests and store them in CacheStorage.[86][66]
- PWA best practices advocate cache-first strategies for static assets and models, and network-first or stale-while-revalidate for dynamic API calls, plus background sync for POST requests (e.g., queued screening uploads).[87][67]
- IBM’s TF.js web app example demonstrates a full offline-capable PWA with an embedded TF.js model, which you can adapt as a template.[88]

**Simplified deployment path (24–48h)**

- Train your model in TensorFlow/Keras using a MobileNetV3 or EfficientNetB0 backbone, then convert it to TF.js format using `tensorflowjs_converter`.
- Integrate the TF.js model into the existing JS frontend and add a service worker that caches `model.json` and shard files; confirm that predictions run with airplane mode on.[32][66]
- Optionally, provide a fallback to the Flask API when online (for heavier models) and use the TF.js model only offline for a "fast screening" mode.

***

## Part 5 – Hackathon Winning Strategy

### 5.1 Typical judging criteria and how to frame the project

Global health and AI-for-good competitions such as MIT Solve and AI-for-Good hackathons tend to use a common set of criteria.[89][90][91][92]

- **Alignment with the challenge**: Does the solution directly address the specified health equity or malnutrition challenge and target underserved populations?[93][89]
- **Potential for impact**: What is the scale of the problem and how many children could realistically be reached if the solution is deployed? Judges look for clear impact pathways and evidence that the intervention addresses root barriers (e.g., lack of trained staff, equipment, timely screening).[89][51]
- **Technical feasibility & execution quality**: Is the AI implementation appropriate and working? Is the pipeline robust, with real validation metrics and failure handling?[90][91]
- **Innovation & differentiation**: Is there something novel compared with existing MUAC apps or tools like MERON and AutoAnthro (e.g., multi-view fusion, combined anthropometry + imaging, offline XAI in a PWA)?[51][6]
- **Human-centered design**: Was the solution co-designed with community health workers and caregivers? Is the UI simple, localized, and respectful of privacy and cultural norms?[89][62]
- **Scalability & partnerships**: Can the solution integrate into CMAM programs, government HMIS, or NGOs like UNICEF and Save the Children, and what partnerships would enable scale?[61][89]

In your pitch, explicitly map your features to these criteria (e.g., a slide titled "Alignment & Impact" referencing WHO/UNICEF burden data and how your tool lowers barriers for CHWs).[94][53]

### 5.2 Recent academic and programmatic work closest to your project (2022–2025)

Below are key works you can cite to position your novelty; most are open access or accessible via institutional logins.

| Year | Title & Link | Authors / Org | Relevance |
|------|--------------|---------------|-----------|
| 2024 | **Artificial intelligence for the practical assessment of nutritional status in emergencies** (MERON) – *Expert Systems with Applications*.[51] | Watkins B. et al. | Describes MERON, an AI system that predicts adult BMI and child WHZ from facial photographs; variant trained on 3,167 Kenyan children correctly classified 60% of malnutrition cases and is piloted with UNICEF; emphasizes non-storage of raw images and offers an open API vision. |
| 2025 | **Prediction of malnutrition in kids by integrating ResNet-50-based deep learning technique using facial images** – *Scientific Reports*.[4][95] | Aanjankumar S. et al. | Uses ResNet-50 with segmentation on facial images to detect malnutrition in Indian children, reporting 98.49% accuracy and outperforming XGBoost, VGG16, Xception, and MobileNet; close to your current ResNet50 pipeline but without multi-view fusion or PWA deployment. |
| 2024 | **Development and evaluation of a deep learning framework for the diagnosis of malnutrition using a 3D facial points cloud** – *JPEN*.[96] | Wang X. et al. | Trains a PointNet++ model on 3D facial point clouds from 482 patients to classify malnutrition states, demonstrating feasibility of 3D face-based malnutrition diagnosis and offering a bridge to your multi-view work. |
| 2024 | **Classification of stunted and normal children using novel facial image database and convolutional neural network**.[8][9] | Indonesian research group | Introduces a 4,000-image child facial database (100 children, 50 stunted, 50 normal) and evaluates AlexNet vs ResNet34, achieving up to 100% test accuracy under controlled conditions; serves as a key facial stunting dataset. |
| 2024 | **Deep Learning-Based Pediatric Malnutrition Detection: A Systematic Review**.[1] | Ahire H.S. et al. | Systematic review of deep-learning approaches for pediatric malnutrition detection using facial and body images; summarizes architectures, datasets, and gaps, and is ideal to cite in your background section. |
| 2023 | **Establishing a machine learning model for predicting nutritional risk through facial feature recognition** – *Frontiers in Nutrition*.[10] | Wang J. et al. | Uses U-Net segmentation of orbital fat pads and HOG+SVM to predict NRS-2002 scores from facial images of 949 adults; illustrates a pipeline that isolates specific face regions correlated with nutrition. |
| 2023 | **Identification of malnutrition and prediction of BMI from facial images using real-time image processing and machine learning**.