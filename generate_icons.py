#!/usr/bin/env python3
import struct, zlib

def create_png(width, height, r, g, b, a=255):
    def chunk(ctype, data):
        c = ctype + data
        return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)
    header = b'\x89PNG\r\n\x1a\n'
    ihdr = chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0))
    raw = b''.join(b'\x00' + struct.pack('BBBB', r, g, b, a) * width for _ in range(height))
    return header + ihdr + chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b'')
    # Rose-500: #f43f5e

open('icon-192.png', 'wb').write(create_png(192, 192, 244, 63, 94))
open('icon-512.png', 'wb').write(create_png(512, 512, 244, 63, 94))
print('Icons generated: icon-192.png, icon-512.png')
