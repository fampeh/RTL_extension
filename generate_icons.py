import zlib, struct
from pathlib import Path

icon_dir = Path(r'c:\Users\BulBul\Desktop\RTL_extension\icons')
icon_dir.mkdir(parents=True, exist_ok=True)

letters = {
    'default': {'color': (150, 150, 150), 'bitmap': [
        ' ##### ',
        '#     #',
        '#     #',
        '#     #',
        '#     #',
        '#     #',
        ' ##### '
    ]},
    'rtl': {'color': (0, 170, 0), 'bitmap': [
        '#    # ',
        '#   #  ',
        '#   #  ',
        '#####  ',
        '#   #  ',
        '#    # ',
        '#     #'
    ]},
    'ltr': {'color': (0, 170, 0), 'bitmap': [
        ' #     ',
        ' #     ',
        ' #     ',
        ' #     ',
        ' #     ',
        ' #     ',
        ' ##### '
    ]}
}

sizes = [16, 32, 48, 128]

for style, info in letters.items():
    for size in sizes:
        fname = icon_dir / f'{style}-{size}.png'
        pixels = []
        bg = info['color']
        for y in range(size):
            row = []
            for x in range(size):
                row.append(bg + (255,))
            pixels.append(row)
        bm = info['bitmap']
        h = len(bm)
        w = len(bm[0])
        for y in range(h):
            for x in range(w):
                if bm[y][x] == '#':
                    for yy in range(int(y * size / h), int((y + 1) * size / h)):
                        for xx in range(int(x * size / w), int((x + 1) * size / w)):
                            if 0 <= xx < size and 0 <= yy < size:
                                pixels[yy][xx] = (0, 0, 0, 255)
        def png_chunk(chunk_type, data):
            chunk = chunk_type.encode('ascii') + data
            return struct.pack('>I', len(data)) + chunk + struct.pack('>I', zlib.crc32(chunk) & 0xffffffff)
        width = size
        height = size
        raw_data = b''.join(b'\x00' + b''.join(bytes(pixel) for pixel in row) for row in pixels)
        compressed = zlib.compress(raw_data)
        png = b'\x89PNG\r\n\x1a\n'
        png += png_chunk('IHDR', struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0))
        png += png_chunk('IDAT', compressed)
        png += png_chunk('IEND', b'')
        with open(fname, 'wb') as f:
            f.write(png)

for svg in icon_dir.glob('*.svg'):
    try:
        svg.unlink()
    except Exception:
        pass

print('Created PNG icon files and removed SVGs.')
