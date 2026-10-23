import { checkDimensions, type ImageSize } from "./image-format";

type Box = { type: string; data: number; end: number };
export type HeifInfo = ImageSize & { containerOrientation: boolean };

// Parse bounded ISO-BMFF boxes; never scan arbitrary payload bytes for 'heic'.
function boxes(view: DataView, start: number, end: number): Box[] {
  const result: Box[] = [];
  for (let offset = start; offset < end;) {
    if (offset + 8 > end || result.length > 4096) throw new Error("Invalid HEIC container.");
    let size = view.getUint32(offset);
    let header = 8;
    if (size === 1) {
      if (offset + 16 > end) throw new Error("Invalid HEIC container.");
      const large = view.getBigUint64(offset + 8);
      if (large > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Invalid HEIC container.");
      size = Number(large); header = 16;
    } else if (size === 0) size = end - offset;
    if (size < header || offset + size > end) throw new Error("Invalid HEIC container.");
    const type = String.fromCharCode(...new Uint8Array(view.buffer, view.byteOffset + offset + 4, 4));
    result.push({ type, data: offset + header, end: offset + size });
    offset += size;
  }
  return result;
}

export function heifInfo(bytes: Uint8Array): HeifInfo | null {
  if (bytes.length < 16 || String.fromCharCode(...bytes.slice(4, 8)) !== "ftyp") return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const top = boxes(view, 0, bytes.length);
  const ftyp = top.find((box) => box.type === "ftyp");
  if (!ftyp || ftyp.end - ftyp.data < 8) return null;
  const brands = [String.fromCharCode(...bytes.slice(ftyp.data, ftyp.data + 4))];
  for (let p = ftyp.data + 8; p + 4 <= ftyp.end; p += 4) brands.push(String.fromCharCode(...bytes.slice(p, p + 4)));
  if (brands.some((brand) => brand === "avif" || brand === "avis")) return null;
  if (!brands.some((brand) => ["heic","heix","hevc","hevx","heim","heis","hevm","hevs","mif1","msf1"].includes(brand))) return null;
  const meta = top.find((box) => box.type === "meta");
  if (!meta || meta.data + 4 > meta.end) throw new Error("The HEIC photo has no readable metadata.");
  const children = boxes(view, meta.data + 4, meta.end);
  const pitm = children.find((box) => box.type === "pitm");
  const iprp = children.find((box) => box.type === "iprp");
  if (!pitm || !iprp || pitm.data + 6 > pitm.end) throw new Error("The HEIC photo has no primary image.");
  const primary = view.getUint8(pitm.data) === 0 ? view.getUint16(pitm.data + 4) : view.getUint32(pitm.data + 4);
  const properties = boxes(view, iprp.data, iprp.end);
  const ipco = properties.find((box) => box.type === "ipco");
  const ipma = properties.find((box) => box.type === "ipma");
  if (!ipco || !ipma || ipma.data + 8 > ipma.end) throw new Error("The HEIC image properties are missing.");
  const entries = boxes(view, ipco.data, ipco.end);
  // Bound all declared image extents, not just a thumbnail or MIME declaration.
  for (const box of entries) if (box.type === "ispe") {
    if (box.data + 12 > box.end) throw new Error("Invalid HEIC dimensions.");
    checkDimensions({ width: view.getUint32(box.data + 4), height: view.getUint32(box.data + 8) });
  }
  const version = view.getUint8(ipma.data);
  const wide = (view.getUint32(ipma.data) & 1) !== 0;
  const count = view.getUint32(ipma.data + 4);
  if (count > 4096) throw new Error("Too many HEIC image properties.");
  let offset = ipma.data + 8;
  const selected: Box[] = [];
  for (let i = 0; i < count; i++) {
    const idSize = version === 0 ? 2 : 4;
    if (offset + idSize + 1 > ipma.end) throw new Error("Invalid HEIC image properties.");
    const id = idSize === 2 ? view.getUint16(offset) : view.getUint32(offset);
    offset += idSize;
    const associations = view.getUint8(offset++);
    for (let j = 0; j < associations; j++) {
      if (offset + (wide ? 2 : 1) > ipma.end) throw new Error("Invalid HEIC image properties.");
      const index = wide ? view.getUint16(offset) & 0x7fff : view.getUint8(offset) & 0x7f;
      offset += wide ? 2 : 1;
      if (id === primary && index) { if (!entries[index - 1]) throw new Error("Invalid HEIC property reference."); selected.push(entries[index - 1]); }
    }
  }
  const size = selected.find((box) => box.type === "ispe");
  if (!size) throw new Error("The HEIC photo has no valid dimensions.");
  return { width: view.getUint32(size.data + 4), height: view.getUint32(size.data + 8), containerOrientation: selected.some((box) => box.type === "irot" || box.type === "imir") };
}
