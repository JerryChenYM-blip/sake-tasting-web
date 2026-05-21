"""
Process all 7 sake bottle photos:
1. Remove background (rembg)
2. Crop tight to bottle
3. Normalize to consistent canvas (640x1600 transparent PNG)
4. Add subtle reflection ground for stage effect (separate file)
"""
from rembg import remove, new_session
from PIL import Image
import io
import os

# Mapping: source filename → output name (matches Excel order R2-R8)
JOBS = [
    # (source, output_name, need_crop)
    ("LINE_ALBUM_2026.5.21_260521_7.jpg", "01_casareccio.png",     None),  # already white bg, pro shot
    ("LINE_ALBUM_2026.5.21_260521_1.jpg", "02_hizirizm.png",       None),  # cafe bg
    ("LINE_ALBUM_2026.5.21_260521_6.jpg", "03_juicy_cherry.png",   None),  # white bg, hi-res
    ("LINE_ALBUM_2026.5.21_260521_5.jpg", "04_yoakemae.png",       None),  # white bg, small
    ("LINE_ALBUM_2026.5.21_260521_4.jpg", "05_shirakiku.png",      (0, 0, 213, 480)),  # crop left bottle
    ("LINE_ALBUM_2026.5.21_260521_3.jpg", "06_yofukashi.png",      None),  # cafe bg
    ("LINE_ALBUM_2026.5.21_260521_2.jpg", "07_yamana_k.png",       None),  # cafe bg (newspaper wrapped)
]

SRC_DIR = "/Users/jerrychen/project/instant_translation_web/pho"
OUT_DIR = "/Users/jerrychen/project/instant_translation_web/build/bottles_processed"
os.makedirs(OUT_DIR, exist_ok=True)

# Output canvas: tall portrait, mobile-friendly
CANVAS_W, CANVAS_H = 640, 1600

session = new_session("u2net")

def trim_alpha(img):
    """Crop image to non-transparent bounding box."""
    bbox = img.getbbox()
    if bbox:
        return img.crop(bbox)
    return img

def fit_to_canvas(img, canvas_w, canvas_h, margin_y=40):
    """Scale image to fit canvas, centered horizontally, bottom-anchored with margin."""
    iw, ih = img.size
    # Scale to fit height first, then check width
    scale = (canvas_h - margin_y * 2) / ih
    new_w = int(iw * scale)
    new_h = int(ih * scale)
    if new_w > canvas_w - 40:  # if too wide, scale to width
        scale = (canvas_w - 40) / iw
        new_w = int(iw * scale)
        new_h = int(ih * scale)
    img_resized = img.resize((new_w, new_h), Image.LANCZOS)

    canvas = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
    x = (canvas_w - new_w) // 2
    y = canvas_h - new_h - margin_y  # bottom-anchored
    canvas.paste(img_resized, (x, y), img_resized)
    return canvas

for src, out_name, crop in JOBS:
    src_path = os.path.join(SRC_DIR, src)
    out_path = os.path.join(OUT_DIR, out_name)
    print(f"Processing {src} → {out_name} ...")

    img = Image.open(src_path).convert("RGB")
    if crop:
        img = img.crop(crop)

    # Remove background
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    out_bytes = remove(buf.getvalue(), session=session)
    img_rgba = Image.open(io.BytesIO(out_bytes)).convert("RGBA")

    # Trim to content bbox
    img_trimmed = trim_alpha(img_rgba)

    # Fit to canvas
    final = fit_to_canvas(img_trimmed, CANVAS_W, CANVAS_H)
    final.save(out_path, "PNG", optimize=True)
    print(f"  → {out_path} ({final.size})")

print("\nDone. All bottles processed.")
