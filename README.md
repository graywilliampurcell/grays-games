# Generating a QR Code

To generate a QR code image for any string or URL, use the provided script:

1. (First time only) Create a Python virtual environment and install dependencies:
   ```bash
   python3 -m venv venv
   ./venv/bin/pip install qrcode[pil]
   ```

2. Run the script with the string or URL you want to encode, and the output file path:
   ```bash
   ./venv/bin/python3 scripts/generate_qr.py "https://example.com" docs/assets/example-qr.png
   ```

This will generate a PNG file at the path you specify (e.g., `docs/assets/example-qr.png`).
# Gray's Games

These are games Gray made.

