import "server-only";
import sharp from "sharp";
import { PROFILE_STORED_BYTES } from "./profile-photo";
import { rasterType } from "./image-format";
import { WishlistError, wishlistSession } from "./wishlist/server";

export async function profileSession(scope: "self" | "partner" = "self") {
  const session = await wishlistSession();
  const query = session.supabase.from("profiles").select("id,nickname,avatar_path");
  const {data,error} = await (scope === "partner" ? query.neq("id",session.userId) : query.eq("id",session.userId)).maybeSingle();
  if(error) throw new WishlistError("Profile could not load. Please retry.",503);
  return {...session, profile:data};
}
export async function encodeProfilePhoto(bytes: Uint8Array) {
  const gif = new TextDecoder().decode(bytes.slice(0,6));
  if(!rasterType(bytes) && gif !== "GIF87a" && gif !== "GIF89a") throw new WishlistError("Choose a JPEG, PNG, WebP or GIF photo.");
  let output: Buffer;
  try {
    output = await sharp(bytes,{animated:true,limitInputPixels:16_000_000}).rotate()
      .resize(512,512,{fit:"cover",withoutEnlargement:true}).webp({quality:85,effort:4}).toBuffer();
  } catch { throw new WishlistError("This photo cannot be processed. Choose a smaller JPEG, PNG, WebP or GIF."); }
  if(output.length > PROFILE_STORED_BYTES) throw new WishlistError("This photo is too large after processing. Choose a smaller photo.");
  return output;
}
