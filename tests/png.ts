import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { expect } from 'vitest';

// Decodes an 8-bit RGB or RGBA PNG into its pixels.
export function pngPixels(file: string): {
  width: number;
  channels: number;
  data: Buffer;
} {
  const png = readFileSync(file);
  let offset = 8;
  const idat: Buffer[] = [];
  let width = 0,
    height = 0,
    channels = 0;
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.toString('ascii', offset + 4, offset + 8);
    const body = png.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      expect(body[8]).toBe(8);
      channels = ({ 2: 3, 6: 4 } as Record<number, number>)[body[9] ?? 0] ?? 0;
      expect(channels).toBeGreaterThan(0);
    }
    if (type === 'IDAT') idat.push(body);
    offset += length + 12;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const data = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const value = raw[y * (stride + 1) + 1 + x] ?? 0;
      const left = x >= channels ? (data[y * stride + x - channels] ?? 0) : 0;
      const up = y > 0 ? (data[(y - 1) * stride + x] ?? 0) : 0;
      const corner =
        x >= channels && y > 0
          ? (data[(y - 1) * stride + x - channels] ?? 0)
          : 0;
      const paeth = () => {
        const p = left + up - corner;
        const [a, b, c] = [
          Math.abs(p - left),
          Math.abs(p - up),
          Math.abs(p - corner),
        ];
        return a <= b && a <= c ? left : b <= c ? up : corner;
      };
      const predictor =
        [0, left, up, (left + up) >> 1, paeth()][filter ?? 0] ?? 0;
      data[y * stride + x] = (value + predictor) & 0xff;
    }
  }
  return { width, channels, data };
}

// The [r, g, b] of the pixel at x, y.
export function pixel(
  image: ReturnType<typeof pngPixels>,
  x: number,
  y: number,
): number[] {
  const offset = (y * image.width + x) * image.channels;
  return [...image.data.subarray(offset, offset + 3)];
}
