"""Generate extension icons as PNG files."""
import os, struct, zlib, base64

def make_png(size, bg=(99, 102, 241), text_color=(255, 255, 255)):
    """Create a simple solid-color PNG with a 'C' letter."""
    # We'll create a minimal valid PNG
    import io

    try:
        from PIL import Image, ImageDraw, ImageFont
        img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        # Rounded background
        draw.ellipse([0, 0, size-1, size-1], fill=(*bg, 255))
        # Simple brain emoji approximation - just use "C" for ContextOS
        font_size = int(size * 0.55)
        try:
            font = ImageFont.truetype("arial.ttf", font_size)
        except:
            font = ImageFont.load_default()

        text = "C"
        bbox = draw.textbbox((0, 0), text, font=font)
        tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
        x = (size - tw) / 2 - bbox[0]
        y = (size - th) / 2 - bbox[1]
        draw.text((x, y), text, fill=(*text_color, 255), font=font)

        buf = io.BytesIO()
        img.save(buf, "PNG")
        return buf.getvalue()
    except ImportError:
        # Fallback: create minimal PNG without Pillow
        return make_minimal_png(size, bg)

def make_minimal_png(size, bg):
    """Create a minimal solid color PNG."""
    import struct, zlib

    def png_chunk(name, data):
        c = struct.pack('>I', len(data)) + name + data
        return c + struct.pack('>I', zlib.crc32(name + data) & 0xffffffff)

    # IHDR
    ihdr = struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0)

    # Raw image data
    r, g, b = bg
    scanline = bytes([0]) + bytes([r, g, b] * size)
    raw = scanline * size
    compressed = zlib.compress(raw, 9)

    data = (
        b'\x89PNG\r\n\x1a\n' +
        png_chunk(b'IHDR', ihdr) +
        png_chunk(b'IDAT', compressed) +
        png_chunk(b'IEND', b'')
    )
    return data

os.makedirs("icons", exist_ok=True)

for size in [16, 48, 128]:
    data = make_png(size)
    with open(f"icons/icon{size}.png", "wb") as f:
        f.write(data)
    print(f"Created icons/icon{size}.png ({len(data)} bytes)")

print("Done!")
