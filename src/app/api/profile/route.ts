import {randomUUID} from "node:crypto";
import {after} from "next/server";
import {profileSession,encodeProfilePhoto} from "@/lib/profile-photo-server";
import {PROFILE_BUCKET,PROFILE_UPLOAD_BYTES,validProfilePath} from "@/lib/profile-photo";
import {failure,json,readLimitedBody,sameOrigin,WishlistError} from "@/lib/wishlist/server";
function photoUrl(path:string|null, partner = false) { return path ? `/api/profile/photo?${partner ? "owner=partner&" : ""}v=${encodeURIComponent(path.split("/").pop()!)}` : null; }

export async function GET() {
  try {
    const {userId,supabase,profile}=await profileSession();
    const {data:partner,error}=await supabase.from("profiles").select("id,nickname,avatar_path").neq("id",userId).maybeSingle();
    if(error) throw new WishlistError("Partner profile could not sync. Please retry.",503);
    return json({userId,nickname:profile?.nickname ?? "You",photo:photoUrl(profile?.avatar_path ?? null),
      partner:{nickname:partner?.nickname ?? "Partner",photo:partner?.avatar_path && validProfilePath(partner.avatar_path,partner.id) ? photoUrl(partner.avatar_path,true) : null}});
  } catch(error) { return failure(error); }
}
export async function POST(request:Request) {
  try {
    sameOrigin(request);
    const {userId,supabase,profile}=await profileSession();
    const bytes=await readLimitedBody(request,PROFILE_UPLOAD_BYTES+16_384);
    let form:FormData;
    try { form=await new Response(bytes,{headers:{"content-type":request.headers.get("content-type") ?? ""}}).formData(); }
    catch { throw new WishlistError("Choose a valid photo upload."); }
    const file=form.get("file");
    if(!(file instanceof File)||!file.size||file.size>PROFILE_UPLOAD_BYTES) throw new WishlistError("Choose a photo smaller than 5 MB.");
    const photo=await encodeProfilePhoto(new Uint8Array(await file.arrayBuffer()));
    const path=`${userId}/${randomUUID()}.webp`;
    const {error:uploadError}=await supabase.storage.from(PROFILE_BUCKET).upload(path,photo,{contentType:"image/webp",upsert:false});
    if(uploadError) throw new WishlistError(/bucket.*not found/i.test(uploadError.message) ? "Profile sync requires the profile_photos SQL migration." : "Photo upload failed. Please retry.",503);
    const oldPath=profile?.avatar_path ?? null;
    const write=profile
      ? (()=>{const query=supabase.from("profiles").update({avatar_path:path}).eq("id",userId);return oldPath ? query.eq("avatar_path",oldPath) : query.is("avatar_path",null);})()
      : supabase.from("profiles").insert({id:userId,nickname:"You",avatar_path:path});
    const {data,error}=await write.select("nickname,avatar_path").maybeSingle();
    // A lost response can follow a committed write. Keep the new immutable object
    // on ambiguous failure rather than risk deleting the now-current avatar.
    if(error) throw new WishlistError("Could not confirm the profile save. Refresh and retry.",503);
    if(!data) {
      after(async()=>{await supabase.storage.from(PROFILE_BUCKET).remove([path]);});
      throw new WishlistError("Your profile changed on another device. Refresh and retry.",409);
    }
    if(oldPath && validProfilePath(oldPath,userId)) after(async()=>{await supabase.storage.from(PROFILE_BUCKET).remove([oldPath]);});
    return json({userId,nickname:data.nickname ?? profile?.nickname ?? "You",photo:photoUrl(path)});
  } catch(error) { return failure(error); }
}

export async function PATCH(request:Request) {
  try {
    sameOrigin(request);
    const {userId,supabase,profile}=await profileSession();
    let raw:unknown;
    try {raw=JSON.parse(new TextDecoder().decode(await readLimitedBody(request,2048)));}
    catch(error){if(error instanceof WishlistError)throw error;throw new WishlistError("Invalid nickname.");}
    const nickname=raw && typeof raw==="object" && "nickname" in raw && typeof raw.nickname==="string" ? raw.nickname.trim() : "";
    if(!nickname||nickname.length>32)throw new WishlistError("Enter a nickname between 1 and 32 characters.");
    const query=profile ? supabase.from("profiles").update({nickname}).eq("id",userId) : supabase.from("profiles").insert({id:userId,nickname,avatar_path:null});
    const {data,error}=await query.select("nickname,avatar_path").maybeSingle();
    if(error||!data)throw new WishlistError("Could not save your nickname. Please retry.",503);
    return json({userId,nickname:data.nickname,photo:photoUrl(data.avatar_path ?? null)});
  } catch(error){return failure(error);}
}
