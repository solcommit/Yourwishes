import {test,expect} from "@playwright/test";
import {build} from "esbuild";
import {createRequire} from "node:module";
import {resolve} from "node:path";
import {wishUiError} from "../../src/lib/wish-copy";
async function routeFor(code:string,message:string){
 const output=await build({entryPoints:['src/app/api/wishlist/route.ts'],bundle:true,write:false,platform:'node',format:'cjs',packages:'external',plugins:[{name:'save-backend',setup(builder){
  builder.onResolve({filter:/^@\/lib\/wishlist\/server$/},()=>({path:'backend',namespace:'fixture'}));
  builder.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:`
   export class WishlistError extends Error {constructor(message,status=400){super(message);this.status=status;}}
   export const json=(body,status=200)=>Response.json(body,{status});export const failure=error=>json({error:error.message},error.status||500);
   export const fetchWishes=async()=>[];export const sameOrigin=()=>{};export const readLimitedBody=async request=>new Uint8Array(await request.arrayBuffer());export const scheduleImageCleanup=()=>true;
   export const wishlistSession=async()=>({userId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',supabase:{rpc:async name=>name==='save_wish'?{error:globalThis.error}:{error:null}}});
  `}));
 }}]});
 const loaded={exports:{}};new Function('require','module','globalThis',output.outputFiles[0].text)(createRequire(resolve('package.json')),loaded,{error:{code,message,details:'private row data'}});
 return loaded.exports as {POST:(request:Request)=>Promise<Response>};
}
const input={id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',name:'Fixture',description:'',price:null,currency:'USD',url:'',priority:'Rare',category:'',photos:[],expectedUpdatedAt:null};
test('priority, currency, missing RPC and permissions get actionable messages on create and edit',async()=>{
 for(const [code,message,expected,status] of [
  ['23514','violates check constraint "wishlist_items_priority_check"','item_grade_priority',503],
  ['23514','violates check constraint "wishlist_items_currency_check"','CNY currency',503],
  ['PGRST202','function save_wish not found','хадгалах функц олдсонгүй',503],
  ['42501','permission denied','хадгалах эрхийг',403],
 ] as const){
  const route=await routeFor(code,message);
  for(const expectedUpdatedAt of [null,'2026-11-10T00:00:00Z']){
   const response=await route.POST(new Request('http://localhost/api/wishlist',{method:'POST',body:JSON.stringify({...input,expectedUpdatedAt})}));
   expect(response.status).toBe(status);const body=await response.json();expect(wishUiError(new Error(body.error))).toContain(expected);expect(JSON.stringify(body)).not.toContain('private row data');
  }
 }
});
