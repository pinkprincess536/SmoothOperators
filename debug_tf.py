import tensorflow as tf
print(f"TF Version: {tf.__version__}")
try:
    print(f"TF Keras: {tf.keras}")
except Exception as e:
    print(f"Error accessing tf.keras: {e}")

import keras
print(f"Standalone Keras Version: {keras.__version__}")
