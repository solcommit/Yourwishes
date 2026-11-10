import {profileSession} from "@/lib/profile-photo-server";
import {PROFILE_BUCKET,validProfilePath} from "@/lib/profile-photo";
import {failure,WishlistError} from "@/lib/wishlist/server";
export async function GET(request: Request) {
  try {
    const {userId,supabase,profile}=await profileSession(new URL(request.url).searchParams.get("owner") === "partner" ? "partner" : "self");
    const path=profile?.avatar_path;
    if(!path||!validProfilePath(path,profile?.id ?? userId)) throw new WishlistError("Profile photo not found.",404);
    const {data,error}=await supabase.storage.from(PROFILE_BUCKET).download(path);
    if(error||!data) throw new WishlistError("Profile photo could not load. Please retry.",503);
    return new Response(data,{headers:{"Content-Type":"image/webp","Cache-Control":"private, no-store","Vary":"Cookie","X-Content-Type-Options":"nosniff"}});
  } catch(error) { return failure(error); }
}
