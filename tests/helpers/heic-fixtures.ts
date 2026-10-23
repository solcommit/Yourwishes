import { readFileSync } from "node:fs";

const sample = readFileSync("tests/fixtures/images/libheif-example.heic");
type Box = { type: string; bytes: Buffer };
function boxes(buffer: Buffer, start = 0): Box[] {
  const result: Box[] = [];
  for (let p = start; p < buffer.length;) {
    const length = buffer.readUInt32BE(p);
    if (length < 8 || p + length > buffer.length) throw new Error("Bad test fixture box");
    result.push({ type: buffer.toString("ascii", p + 4, p + 8), bytes: buffer.subarray(p, p + length) }); p += length;
  }
  return result;
}
const u16 = (value: number) => { const b = Buffer.alloc(2); b.writeUInt16BE(value); return b; };
const u32 = (value: number) => { const b = Buffer.alloc(4); b.writeUInt32BE(value); return b; };
function box(type: string, ...parts: Buffer[]) { const payload = Buffer.concat(parts); return Buffer.concat([u32(payload.length + 8), Buffer.from(type), payload]); }

// Add real ISO-BMFF orientation/EXIF properties. Keep original media at its
// absolute iloc offsets by replacing the old meta with free and appending meta.
export function heicVariant(kind: "irot" | "exif", orientation = 6) {
  const top = boxes(sample);
  const meta = top.find((item) => item.type === "meta")!.bytes;
  const children = boxes(meta, 12);
  const primary = children.find((item) => item.type === "pitm")!.bytes.readUInt16BE(12);
  let addition = Buffer.alloc(0);
  let replacement: Buffer;
  if (kind === "irot") {
    const properties = boxes(children.find((item) => item.type === "iprp")!.bytes, 8);
    const ipco = properties.find((item) => item.type === "ipco")!.bytes;
    const propertyIndex = boxes(ipco, 8).length + 1;
    const old = properties.find((item) => item.type === "ipma")!.bytes;
    const entries: Buffer[] = [];
    let p = 16;
    for (let i = 0; i < old.readUInt32BE(12); i++) {
      const start = p; const id = old.readUInt16BE(p); const count = old[p + 2]; p += 3 + count;
      entries.push(id === primary ? Buffer.concat([u16(id), Buffer.from([count + 1]), old.subarray(start + 3, p), Buffer.from([propertyIndex])]) : old.subarray(start, p));
    }
    const newIprp = box("iprp", box("ipco", ipco.subarray(8), box("irot", Buffer.from([1]))), box("ipma", old.subarray(8, 16), ...entries));
    replacement = box("meta", meta.subarray(8, 12), ...children.map((item) => item.type === "iprp" ? newIprp : item.bytes));
  } else {
    const tiff = Buffer.alloc(140);
    tiff.write("II"); tiff.writeUInt16LE(42, 2); tiff.writeUInt32LE(8, 4); tiff.writeUInt16LE(2, 8);
    function entry(p: number, tag: number, type: number, count: number, value: number) { tiff.writeUInt16LE(tag, p); tiff.writeUInt16LE(type, p + 2); tiff.writeUInt32LE(count, p + 4); tiff.writeUInt32LE(value, p + 8); }
    entry(10, 0x112, 3, 1, orientation); entry(22, 0x8825, 4, 1, 38);
    tiff.writeUInt16LE(4, 38);
    entry(40, 1, 2, 2, 78); entry(52, 2, 5, 3, 92); entry(64, 3, 2, 2, 69); entry(76, 4, 5, 3, 116);
    for (const [p, value] of [[92, 30], [100, 0], [108, 0], [116, 120], [124, 0], [132, 0]]) { tiff.writeUInt32LE(value, p); tiff.writeUInt32LE(1, p + 4); }
    const payload = Buffer.concat([u32(6), Buffer.from("Exif\0\0"), tiff]);
    addition = box("mdat", payload);
    const exifId = 50000;
    const iloc = children.find((item) => item.type === "iloc")!.bytes;
    const iinf = children.find((item) => item.type === "iinf")!.bytes;
    const iref = children.find((item) => item.type === "iref")!.bytes;
    const itemInfos = boxes(iinf, 16);
    const newIloc = box("iloc", iloc.subarray(8, 14), u16(iloc.readUInt16BE(14) + 1), iloc.subarray(16), u16(exifId), u16(0), u32(0), u16(1), u32(sample.length + 8), u32(payload.length));
    const newIinf = box("iinf", Buffer.alloc(4), u16(itemInfos.length + 1), ...itemInfos.map((item) => item.bytes), box("infe", Buffer.from([2, 0, 0, 0]), u16(exifId), u16(0), Buffer.from("ExifExif\0")));
    const newIref = box("iref", iref.subarray(8), box("cdsc", u16(exifId), u16(1), u16(primary)));
    replacement = box("meta", meta.subarray(8, 12), ...children.map((item) => item.type === "iloc" ? newIloc : item.type === "iinf" ? newIinf : item.type === "iref" ? newIref : item.bytes));
  }
  const original = Buffer.from(sample);
  const metaOffset = top.slice(0, top.findIndex((item) => item.type === "meta")).reduce((sum, item) => sum + item.bytes.length, 0);
  original.write("free", metaOffset + 4);
  return Buffer.concat([original, addition, replacement]);
}

export const heicSample = sample;
