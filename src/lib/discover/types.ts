import type {WishCurrency,WishlistItem} from "@/lib/wishlist/types";
export type ShortlistEntry={owner_id:string;wish_id:string;note:string;occasion_id?:string|null;updated_at:string};
export type Preference={owner_id:string;wish_id:string;wins:number;compared:number};
export type Occasion={id:string;created_by:string;title:string;date:string;annual:boolean;kind:"anniversary"|"birthday"|"other";updated_at:string};
export type SharedWish={id:string;created_by:string;title:string;description:string;price:number|null;currency:WishCurrency;url:string;done:boolean;updated_at:string};
export type DiscoverSnapshot={userId:string;shortlist:ShortlistEntry[];preferences:Preference[];occasions:Occasion[];shared:SharedWish[]};
export function budgetWishes(items:WishlistItem[],currency:WishCurrency,maximum:number){
  return Number.isFinite(maximum)&&maximum>=0 ? items.filter(item=>item.owner==="partner"&&item.currency===currency&&typeof item.price==="number"&&item.price<=maximum) : [];
}
export function validCalendarDate(value:unknown):value is string {
  if(typeof value!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const [year,month,day]=value.split("-").map(Number);const date=new Date(Date.UTC(year,month-1,day));
  return year>=1900&&year<=2199&&date.getUTCFullYear()===year&&date.getUTCMonth()===month-1&&date.getUTCDate()===day;
}
/** Calendar-day arithmetic avoids timezone parsing and daylight-saving off-by-one errors. */
export function occasionCountdown(date:string,annual:boolean,today:string){
  if(!validCalendarDate(date)||!validCalendarDate(today))return null;
  const [year,month,day]=date.split("-").map(Number);const [ty,tm,td]=today.split("-").map(Number);
  const now=Date.UTC(ty,tm-1,td);
  const occurrence=(y:number)=>Date.UTC(y,month-1,Math.min(day,new Date(Date.UTC(y,month,0)).getUTCDate()));
  let target=Date.UTC(year,month-1,day);let targetYear=year;
  if(annual){targetYear=Math.max(year,ty);target=occurrence(targetYear);if(target<now){targetYear++;target=occurrence(targetYear);}}
  return {days:Math.round((target-now)/86_400_000),date:new Date(target).toISOString().slice(0,10),years:targetYear-year};
}
