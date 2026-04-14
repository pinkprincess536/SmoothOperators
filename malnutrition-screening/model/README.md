# AI Model Directory

Place your exported TensorFlow.js model files here.

Needed files:
- `model.json`: The model architecture and weight specifications.
- `group1-shard1of1.bin` (and any other `.bin` files): The trained weight shards.

## How to export?
Use the provided script in `tools/export_model.py` to convert your Keras `.h5` model.
Alternatively, use the more reliable command:
```bash
python -m tensorflowjs.converters.converter --input_format=keras your_model.h5 ./model
```
Note: Ensure `tensorflowjs` is installed (`pip install tensorflowjs`).
