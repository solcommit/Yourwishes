import sharp from "sharp";
import {fileURLToPath} from "node:url";
const directory=fileURLToPath(new URL("../public/discover-icons/",import.meta.url));
for(const name of ["spin-wheel","instant-pick"]){
  const output=await sharp(directory+name+".png").resize(256,256,{fit:"inside",withoutEnlargement:true}).webp({quality:88,alphaQuality:100}).toFile(directory+name+".webp");
  console.log(`${name}.webp: ${output.size} bytes`);
}
