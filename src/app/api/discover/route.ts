import {wishlistSession,sameOrigin,readLimitedBody,json,failure,WishlistError} from "@/lib/wishlist/server";
import {UUID_PATTERN} from "@/lib/wishlist/types";
import {validCalendarDate} from "@/lib/discover/types";
type DbError={code?:string;message?:string};
function check(error:DbError|null){if(error?.code==="22023")throw new WishlistError("Choose two distinct wishes you own.");if(error?.code==="42501")throw new WishlistError("This action is not allowed.",403);if(error)throw new WishlistError(["42P01","PGRST202","PGRST205"].includes(error.code??"") ? "Discover setup requires the discover_tools SQL migration." : "Discover could not save or sync. Please retry.",503);}
function text(value:unknown,max:number,required=false){if(typeof value!=="string"||value.length>max||(required&&!value.trim()))throw new WishlistError("Check the text fields.");return value.trim();}
function uuid(value:unknown){if(typeof value!=="string"||!UUID_PATTERN.test(value))throw new WishlistError("Invalid item identifier.");return value;}
function sharedFields(value:Record<string,unknown>){
 const title=text(value.title,100,true),description=text(value.description??"",500),url=text(value.url??"",2048);
 if(url){let parsed:URL;try{parsed=new URL(url);}catch{throw new WishlistError("Enter a valid product link.");}if(!["https:","http:"].includes(parsed.protocol)||parsed.username||parsed.password)throw new WishlistError("Use an HTTP or HTTPS link.");}
 const price=value.price;if(price!==null&&(typeof price!=="number"||!Number.isFinite(price)||price<0||price>=1e12||Number(price.toFixed(2))!==price))throw new WishlistError("Enter a valid price.");
 if(!["MNT","USD","CNY"].includes(String(value.currency))||typeof value.done!=="boolean")throw new WishlistError("Check currency and status.");
 return {title,description,url,price,currency:value.currency as string,done:value.done};
}
function occasionFields(value:Record<string,unknown>){
 if(!validCalendarDate(value.date)||typeof value.annual!=="boolean"||!["anniversary","birthday","other"].includes(String(value.kind)))throw new WishlistError("Choose a valid date and occasion type.");
 return {title:text(value.title,100,true),date:value.date,annual:value.annual,kind:value.kind as string};
}
export async function GET(){try{const {userId,supabase}=await wishlistSession();const {data,error}=await supabase.rpc("discover_snapshot");check(error);return json({userId,...data});}catch(error){return failure(error);}}
async function mutate(request:Request){
 try{
  sameOrigin(request);const {userId,supabase}=await wishlistSession();let raw:unknown;
  try{raw=JSON.parse(new TextDecoder().decode(await readLimitedBody(request,16_384)));}catch(error){if(error instanceof WishlistError)throw error;throw new WishlistError("Invalid request.");}
  if(!raw||typeof raw!=="object"||Array.isArray(raw))throw new WishlistError("Invalid request.");const value=raw as Record<string,unknown>;
  if(request.method==="POST"&&value.action==="compare"){
   const winner=uuid(value.winner),loser=uuid(value.loser);if(winner===loser)throw new WishlistError("Choose two different wishes.");
   const {error}=await supabase.rpc("record_wish_preference",{p_winner:winner,p_loser:loser});check(error);return json({ok:true});
  }
  if(request.method==="DELETE"&&value.action==="resetPreferences"){const {error}=await supabase.from("discover_preferences").delete().eq("owner_id",userId);check(error);return json({ok:true});}
  if(value.resource==="shortlist"){
   const wishId=uuid(value.wishId);
   if(request.method==="POST"){
    const {data:wish,error:accessError}=await supabase.from("wishlist_items").select("id").eq("id",wishId).neq("owner_id",userId).maybeSingle();check(accessError);if(!wish)throw new WishlistError("Choose a current partner wish.",404);
    const {error}=await supabase.from("discover_shortlist").upsert({owner_id:userId,wish_id:wishId,note:text(value.note??"",500),occasion_id:value.occasionId==null?null:uuid(value.occasionId)},{onConflict:"owner_id,wish_id"});check(error);
   }else if(request.method==="DELETE"){const {error}=await supabase.from("discover_shortlist").delete().eq("owner_id",userId).eq("wish_id",wishId);check(error);}else throw new WishlistError("Unsupported operation.");
   return json({ok:true});
  }
  if(value.resource!=="occasions"&&value.resource!=="shared")throw new WishlistError("Unknown Discover resource.");
  const table=value.resource==="occasions"?"discover_occasions":"discover_shared_wishes";const id=uuid(value.id);
  if(request.method==="POST"){
   const fields=value.resource==="occasions"?occasionFields(value):sharedFields(value);const {error}=await supabase.from(table).insert({id,created_by:userId,...fields});
   if(error?.code==="23505"){
    const {data:existing,error:readError}=await supabase.from(table).select("*").eq("id",id).maybeSingle();check(readError);
    if(!existing||existing.created_by!==userId||!Object.entries(fields).every(([key,value])=>key==="price"&&value!==null?Number(existing[key])===value:existing[key]===value))throw new WishlistError("This item already exists. Reload it before changing it.",409);
   }else check(error);
  }else{
   if(typeof value.expectedUpdatedAt!=="string"||!Number.isFinite(Date.parse(value.expectedUpdatedAt)))throw new WishlistError("Refresh this item before changing it.");
   const query=request.method==="DELETE"?supabase.from(table).delete():supabase.from(table).update(value.resource==="occasions"?occasionFields(value):sharedFields(value));
   const {data,error}=await query.eq("id",id).eq("updated_at",value.expectedUpdatedAt).select("id").maybeSingle();check(error);if(!data)throw new WishlistError("This item changed on another device. Refresh and retry.",409);
  }
  return json({ok:true});
 }catch(error){return failure(error);}
}
export const POST=mutate;export const PATCH=mutate;export const DELETE=mutate;
