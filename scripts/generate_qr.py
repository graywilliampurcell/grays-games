import qrcode
import sys

if len(sys.argv) < 3:
    print("Usage: python generate_qr.py <string_to_encode> <output_file_path>")
    sys.exit(1)

qr_string = sys.argv[1]
output_path = sys.argv[2]
img = qrcode.make(qr_string)
img.save(output_path)
