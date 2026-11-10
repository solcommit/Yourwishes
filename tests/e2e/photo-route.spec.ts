import { test, expect } from "@playwright/test";
import { build } from "esbuild";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import sharp from "sharp";

type Fixture = { auth: boolean; fallback: boolean; member: boolean; photo: boolean; calls: string[]; bytes: Buffer };
async function routeFor(fixture: Fixture) {
  const output = await build({ entryPoints: ["src/app/api/wishlist/images/[id]/route.ts"], bundle: true, write: false,
    platform: "node", format: "cjs", packages: "external", plugins: [{ name: "isolated-backend", setup(builder) {
      builder.onResolve({filter:/^server-only$/},()=>({path:"empty",namespace:"fixture"}));
      builder.onResolve({filter:/^next\/server$/},()=>({path:"after",namespace:"fixture"}));
      builder.onResolve({filter:/^@\/lib\/supabase\/server$/},()=>({path:"client",namespace:"fixture"}));
      builder.onResolve({filter:/^@\/lib\/wishlist\/server$/},()=>({path:"errors",namespace:"fixture"}));
      builder.onLoad({filter:/.*/,namespace:"fixture"},args=>({contents: args.path==="empty"?"":args.path==="after"?'export const after=()=>{};':args.path==="client"?'export const createClient=()=>globalThis.fixtureClient;':
        'export class WishlistError extends Error {constructor(message,status=400){super(message);this.status=status}};export const failure=e=>Response.json({error:e.message},{status:e.status||500,headers:{"Cache-Control":"private, no-store"}});' }));
    }}] });
  const client = {
    auth:{getUser:async()=>{fixture.calls.push("identity");return {data:{user:fixture.auth?{id:"owner"}:null},error:null};}},
    rpc:async()=>{fixture.calls.push("access");return fixture.fallback?{error:{code:"PGRST202"}}:{data:fixture.photo?[{storage_path:"owner/immutable/photo.jpg"}]:[],error:null};},
    from:(table:string)=>({select:()=>({eq:()=>({maybeSingle:async()=>{fixture.calls.push(table);return {data:table==="app_members"?(fixture.member?{slot:"A"}:null):(fixture.photo?{storage_path:"owner/immutable/photo.jpg"}:null),error:null};}})})}),
    storage:{from:(bucket:string)=>({download:async()=>{fixture.calls.push(bucket);return {data:new Blob([new Uint8Array(fixture.bytes)],{type:"image/webp"}),error:null};}})},
  };
  const loaded={exports:{}};
  // Pass the fixture through a lexical global facade, not application auth bypass code.
  new Function("require","module","globalThis",output.outputFiles[0].text)(createRequire(resolve("package.json")),loaded,{fixtureClient:client});
  return loaded.exports as {GET:(request:Request,context:{params:Promise<{id:string}>})=>Promise<Response>};
}
const id="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const request=(query="?width=320")=>new Request(`http://localhost/api/wishlist/images/${id}${query}`);
const params={params:Promise.resolve({id})};
async function fixture(overrides:Partial<Fixture>={}) {
  return {auth:true,fallback:false,member:true,photo:true,calls:[],bytes:await sharp({create:{width:320,height:180,channels:3,background:"#8844cc"}}).webp().toBuffer(),...overrides} as Fixture;
}

test("durable image uses one live identity and one access call, no original; memory still checks access",async()=>{
  const state=await fixture();const route=await routeFor(state);
  const first=await route.GET(request(),params);
  expect(first.status).toBe(200);expect(first.headers.get("X-Thumbnail-Source")).toBe("durable");
  expect(first.headers.get("Cache-Control")).toBe("private, no-store");
  expect(first.headers.get("Server-Timing")).toContain("identity;dur=");
  expect(state.calls).toEqual(["identity","access","wishlist-thumbnails"]);
  const second=await route.GET(request(),params);
  expect(second.headers.get("X-Thumbnail-Source")).toBe("memory");
  expect(state.calls).toEqual(["identity","access","wishlist-thumbnails","identity","access"]);
  state.photo=false;
  expect((await route.GET(request(),params)).status).toBe(404);
});
test("anonymous and revoked photo access never reach storage",async()=>{
  for(const overrides of [{auth:false},{photo:false}]){
    const state=await fixture(overrides);const route=await routeFor(state);
    expect((await route.GET(request(),params)).status).toBe(overrides.auth===false?401:404);
    expect(state.calls.some(call=>call.startsWith("wishlist-"))).toBe(false);
  }
});
test("missing migration falls back to membership and RLS, denial remains fail closed",async()=>{
  const state=await fixture({fallback:true,member:false});const route=await routeFor(state);
  expect((await route.GET(request(),params)).status).toBe(404);
  expect(state.calls).toEqual(["identity","access","app_members"]);
  state.member=true;
  expect((await route.GET(request(),params)).status).toBe(200);
  expect(state.calls).toContain("wishlist_images");
});
test("invalid sizes do not start backend work",async()=>{
  const state=await fixture();const route=await routeFor(state);
  expect((await route.GET(request("?width=99999"),params)).status).toBe(400);
  expect(state.calls).toEqual([]);
});
