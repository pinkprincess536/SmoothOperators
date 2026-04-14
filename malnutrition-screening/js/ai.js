/**
 * AI Module for Visual Malnutrition Screening
 * Uses TensorFlow.js to run the ResNet50-based model in the browser.
 */

const MODEL_PATH = './model/model.json';
const IMG_SIZE = 224;

let model = null;

/**
 * Load the model from the specified path.
 */
export async function loadModel() {
  try {
    model = await tf.loadLayersModel(MODEL_PATH);
    console.log("AI Model loaded successfully");
    return true;
  } catch (err) {
    console.error("Failed to load AI model:", err);
    return false;
  }
}

/**
 * Preprocess an image element for the model.
 */
async function preprocessImage(imageSource) {
  return tf.tidy(() => {
    let tensor = tf.browser.fromPixels(imageSource)
      .resizeNearestNeighbor([IMG_SIZE, IMG_SIZE])
      .toFloat();

    const gray = tensor.mean(2).expandDims(2);
    const rgbGray = tf.concat([gray, gray, gray], 2);

    // ResNet50 Preprocessing (Caffe style)
    const mean = tf.tensor1d([103.939, 116.779, 123.68]);
    const normalized = rgbGray.sub(mean);
    
    return normalized.expandDims(0); 
  });
}

/**
 * Run prediction ONLY on image data.
 * @param {object} images - { face: img, front: img, back: img } 
 */
export async function predict(images) {
  if (!model) throw new Error("Model not loaded");

  const faceTensor = await preprocessImage(images.face);
  const frontTensor = await preprocessImage(images.front);
  const backTensor = await preprocessImage(images.back);

  // The model in the notebook takes exactly 3 image inputs
  const prediction = model.predict([faceTensor, frontTensor, backTensor]);
  const score = await prediction.data();

  // Cleanup
  faceTensor.dispose();
  frontTensor.dispose();
  backTensor.dispose();
  prediction.dispose();

  const isMalnourished = score[0] > 0.5; 
  const confidence = isMalnourished ? score[0] : 1 - score[0];

  return {
    label: isMalnourished ? "Malnourished" : "Healthy",
    probability: score[0],
    confidence: (confidence * 100).toFixed(1) + "%"
  };
}


