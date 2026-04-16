import tensorflow
try:
    print(f"Tensorflow path: {tensorflow.__path__}")
except AttributeError:
    print("Tensorflow has no __path__")

import sys
print(f"Sys path: {sys.path}")
