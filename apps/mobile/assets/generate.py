"""Render the small Harbor-style bank mark without third-party image tools."""

from pathlib import Path
import struct
import zlib


def render(size, background, foreground, output):
    pixels = bytearray(background * (size * size))

    def rectangle(x0, y0, x1, y1):
        for y in range(round(y0 * size), round(y1 * size)):
            start = (y * size + round(x0 * size)) * 3
            end = (y * size + round(x1 * size)) * 3
            pixels[start:end] = foreground * ((end - start) // 3)

    # A simple portico matches the fictional banking demo without new branding.
    for y in range(round(0.24 * size), round(0.42 * size)):
        fraction = (y / size - 0.24) / 0.18
        rectangle(0.5 - 0.29 * fraction, y / size,
                  0.5 + 0.29 * fraction, (y + 1) / size)
    rectangle(0.21, 0.43, 0.79, 0.48)
    for x in [0.28, 0.46, 0.64]:
        rectangle(x, 0.51, x + 0.08, 0.72)
    rectangle(0.21, 0.75, 0.79, 0.81)

    def chunk(kind, data):
        return (struct.pack('!I', len(data)) + kind + data
                + struct.pack('!I', zlib.crc32(kind + data)))

    scanlines = b''.join(b'\0' + pixels[y * size * 3:(y + 1) * size * 3]
                         for y in range(size))
    output.write_bytes(b'\x89PNG\r\n\x1a\n'
                       + chunk(b'IHDR', struct.pack('!2I5B', size, size, 8, 2, 0, 0, 0))
                       + chunk(b'IDAT', zlib.compress(scanlines)) + chunk(b'IEND', b''))


if __name__ == '__main__':
    root = Path(__file__).parent
    render(1024, bytes.fromhex('205747'), bytes.fromhex('f5f6f1'), root / 'icon.png')
    render(512, bytes.fromhex('f5f6f1'), bytes.fromhex('205747'), root / 'splash.png')
