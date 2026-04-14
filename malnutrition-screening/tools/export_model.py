import os
import subprocess
import sys

def convert_h5_to_tfjs(h5_path, output_dir):
    """
    Converts a Keras .h5 model to TensorFlow.js format using the tensorflowjs module.
    """
    try:
        import tensorflowjs as tfjs
        import tensorflow as tf
        
        print(f"Loading Keras model from {h5_path}...")
        model = tf.keras.models.load_model(h5_path)
        
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)
            
        tfjs.converters.save_keras_model(model, output_dir)
        print(f"Success! Model exported to: {os.path.abspath(output_dir)}")
        
    except ImportError:
        print("\n[ERROR] 'tensorflowjs' package not found.")
        print("Please install it using: pip install tensorflowjs")
        print("Then try running this script again.\n")
    except Exception as e:
        print(f"\n[ERROR] An error occurred during conversion: {e}\n")

if __name__ == "__main__":
    # Settings
    MODEL_H5 = "malnutrition_resnet18.h5"  # Matches your current filename
    OUTPUT_FOLDER = "../model"
    
    if os.path.exists(MODEL_H5):
        convert_h5_to_tfjs(MODEL_H5, OUTPUT_FOLDER)
    else:
        print(f"\n[!] Model file '{MODEL_H5}' not found in the current directory.")
        print("Please place your .h5 file here or update the script path.\n")
