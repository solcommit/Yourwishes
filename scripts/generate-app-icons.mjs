import sharp from "sharp";
import {mkdir,writeFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {resolve} from "node:path";
const directory=fileURLToPath(new URL("../public/app-icons/",import.meta.url));
const input=process.argv[2]?resolve(process.argv[2]):resolve(directory,"source.svg");
await mkdir(directory,{recursive:true});
for(const [name,size] of [["apple-touch-icon.png",180],["icon-192.png",192],["icon-512.png",512]]){
  await sharp(input).resize(size,size,{fit:"contain",background:"#0b0b11"}).flatten({background:"#0b0b11"}).png().toFile(resolve(directory,name));
}
const png=await sharp(input).resize(32,32,{fit:"contain",background:"#0b0b11"}).flatten({background:"#0b0b11"}).ensureAlpha().png().toBuffer();
const header=Buffer.alloc(22);header.writeUInt16LE(1,2);header.writeUInt16LE(1,4);header[6]=32;header[7]=32;header.writeUInt16LE(1,10);header.writeUInt16LE(32,12);header.writeUInt32LE(png.length,14);header.writeUInt32LE(22,18);
await writeFile(new URL("../src/app/favicon.ico",import.meta.url),Buffer.concat([header,png]));
console.log("Generated Yourwishes app icons and favicon.");
