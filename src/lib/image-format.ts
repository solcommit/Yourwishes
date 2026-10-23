// Shared byte-level checks. Picker filenames and declared MIME types are hints only.
export type RasterType = "image/jpeg" | "image/png" | "image/webp";
export type ImageSize = { width: number; height: number };
export const MAX_SOURCE_BYTES = 32 * 1024 * 1024;
export const MAX_SOURCE_PIXELS = 52_000_000;
export const MAX_OUTPUT_EDGE = 3072;

export function checkDimensions({ width, height }: ImageSize) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 16_384 || height > 16_384 || width * height > MAX_SOURCE_PIXELS) {
    throw new Error("This photo is too large to process safely. Choose a photo up to 52 megapixels and 16,384 pixels per side.");
  }
}

export function rasterType(bytes: Uint8Array): RasterType | null {
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "image/jpeg";
  if ([137,80,78,71,13,10,26,10].every((byte, i) => bytes[i] === byte)) return "image/png";
  if (String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}

export function rasterDimensions(bytes: Uint8Array): ImageSize {
  const type = rasterType(bytes);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (type === "image/png" && bytes.length >= 24 && String.fromCharCode(...bytes.slice(12, 16)) === "IHDR") {
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  if (type === "image/jpeg") {
    let offset = 2;
    while (offset + 4 < bytes.length) {
      if (bytes[offset++] !== 255) break;
      while (bytes[offset] === 255) offset++;
      const marker = bytes[offset++];
      if (marker === 0xda || marker === 0xd9) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (offset + 2 > bytes.length) break;
      const size = view.getUint16(offset);
      if (size < 2 || offset + size > bytes.length) break;
      if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker) && size >= 8) {
        return { width: view.getUint16(offset + 5), height: view.getUint16(offset + 3) };
      }
      offset += size;
    }
  }
  if (type === "image/webp") {
    for (let offset = 12; offset + 8 <= bytes.length;) {
      const chunk = String.fromCharCode(...bytes.slice(offset, offset + 4));
      const size = view.getUint32(offset + 4, true);
      const start = offset + 8;
      if (start + size > bytes.length) break;
      const le24 = (p: number) => bytes[p] | (bytes[p + 1] << 8) | (bytes[p + 2] << 16);
      if (chunk === "VP8X" && size >= 10) return { width: le24(start + 4) + 1, height: le24(start + 7) + 1 };
      if (chunk === "VP8 " && size >= 10 && bytes[start + 3] === 0x9d && bytes[start + 4] === 0x01 && bytes[start + 5] === 0x2a) return { width: view.getUint16(start + 6, true) & 0x3fff, height: view.getUint16(start + 8, true) & 0x3fff };
      if (chunk === "VP8L" && size >= 5 && bytes[start] === 0x2f) {
        const bits = view.getUint32(start + 1, true);
        return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
      }
      offset = start + size + (size % 2);
    }
  }
  throw new Error("This file does not contain a valid JPEG, PNG, or WebP image header.");
}
