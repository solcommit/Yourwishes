import {test,expect} from "@playwright/test";
import {build} from "esbuild";
import {createRequire} from "node:module";
import {resolve} from "node:path";
import sharp from "sharp";
const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
type State={nickname:string;partnerName:string;partnerPath:string|null;writtenId?:string;auth:boolean;path:string|null;missing:boolean;conflict:boolean;calls:string[];objects:Map<string,Uint8Array>;jobs:(()=>Promise<void>)[]};
async function setup(overrides:Partial<State>={}){
 const state:State={nickname:"Owner",partnerName:"Partner name",partnerPath:null,auth:true,path:null,missing:false,conflict:false,calls:[],objects:new Map(),jobs:[],...overrides};
 const output=await build({stdin:{contents:'export {GET,POST,PATCH} from "./src/app/api/profile/route";export {GET as PHOTO} from "./src/app/api/profile/photo/route";export {encodeProfilePhoto} from "./src/lib/profile-photo-server";',resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'cjs',packages:'external',plugins:[{name:'isolated-profile-backend',setup(builder){
  builder.onResolve({filter:/^server-only$/},()=>({path:'empty',namespace:'fixture'}));builder.onResolve({filter:/^next\/server$/},()=>({path:'after',namespace:'fixture'}));
  builder.onResolve({filter:/^@\/lib\/auth$/},()=>({path:'auth',namespace:'fixture'}));builder.onResolve({filter:/^@\/lib\/supabase\/server$/},()=>({path:'client',namespace:'fixture'}));
  builder.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:args.path==='empty'?'':args.path==='after'?'export const after=job=>globalThis.state.jobs.push(job)':args.path==='auth'?`export const getMember=async()=>globalThis.state.auth?{userId:'${owner}'}:null;`:'export const createClient=async()=>globalThis.client;'}));
 }}]});
 const client={from:()=>{let mode='read',next:string|undefined,newNickname:string|undefined,isPartner=false,expected:string|null|undefined;const query={select:()=>query,neq:()=>{isPartner=true;return query;},eq:(key:string,value:string)=>{if(key==='avatar_path')expected=value;if(key==='id'&&mode==='write')state.writtenId=value;return query;},is:()=>{expected=null;return query;},update:(input:{avatar_path?:string;nickname?:string})=>{mode='write';next=input.avatar_path;newNickname=input.nickname;return query;},insert:(input:{avatar_path?:string;nickname?:string})=>{mode='write';next=input.avatar_path;newNickname=input.nickname;return query;},maybeSingle:async()=>{if(mode==='read')return {data:isPartner?(state.partnerPath?{id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',nickname:state.partnerName,avatar_path:state.partnerPath}:null):{id:owner,nickname:state.nickname,avatar_path:state.path},error:null};if(state.conflict||expected!==undefined&&expected!==state.path)return {data:null,error:null};if(next!==undefined)state.path=next;if(newNickname!==undefined)state.nickname=newNickname;return {data:{nickname:state.nickname,avatar_path:state.path},error:null};}};return query;},storage:{from:()=>({upload:async(path:string,bytes:Uint8Array)=>{state.calls.push('upload');if(state.missing)return {error:{message:'Bucket not found'}};state.objects.set(path,bytes);return {error:null};},download:async(path:string)=>{state.calls.push('download');return {data:state.objects.has(path)?new Blob([new Uint8Array(state.objects.get(path)!)],{type:'image/webp'}):null,error:null};},remove:async(paths:string[])=>{for(const path of paths)state.objects.delete(path);return {error:null};}})}};
 const loaded={exports:{}};new Function('require','module','globalThis',output.outputFiles[0].text)(createRequire(resolve('package.json')),loaded,{state,client});
 return {state,...loaded.exports as {GET:()=>Promise<Response>;PHOTO:(request:Request)=>Promise<Response>;POST:(request:Request)=>Promise<Response>;PATCH:(request:Request)=>Promise<Response>;encodeProfilePhoto:(bytes:Uint8Array)=>Promise<Buffer>}};
}
async function upload(bytes:Uint8Array,origin='http://localhost'){
 const form=new FormData();form.set('file',new File([new Uint8Array(bytes)],'avatar.png',{type:'image/png'}));return new Request('http://localhost/api/profile',{method:'POST',headers:{origin},body:form});
}
test('profile upload commits private immutable path, metadata syncs and authenticated photo reads are no-store',async()=>{
 const route=await setup();const png=await sharp({create:{width:800,height:600,channels:3,background:'#8844cc'}}).png().toBuffer();
 const response=await route.POST(await upload(png));expect(response.status).toBe(200);const body=await response.json();expect(body.userId).toBe(owner);expect(body.photo).toMatch(/^\/api\/profile\/photo\?v=/);expect(route.state.path).toMatch(new RegExp('^'+owner+'/[0-9a-f-]{36}\\.webp$'));
 expect((await (await route.GET()).json()).photo).toBe(body.photo);
 const photo=await route.PHOTO(new Request("http://localhost/api/profile/photo"));expect(photo.status).toBe(200);expect(photo.headers.get('cache-control')).toContain('no-store');expect(photo.headers.get('vary')).toBe('Cookie');
 const meta=await sharp(Buffer.from(await photo.arrayBuffer())).metadata();expect(meta.width).toBe(512);expect(meta.height).toBe(512);expect(meta.exif).toBeUndefined();
 const old=route.state.path!;await route.POST(await upload(png));expect(route.state.path).not.toBe(old);for(const job of route.state.jobs)await job();expect(route.state.objects.has(old)).toBe(false);
});
test('anonymous, cross-origin, invalid bytes and foreign avatar pointers fail closed',async()=>{
 const route=await setup({auth:false});expect((await route.GET()).status).toBe(401);expect((await route.PHOTO(new Request("http://localhost/api/profile/photo"))).status).toBe(401);
 route.state.auth=true;expect((await route.POST(await upload(new Uint8Array([1,2]),'http://evil.example'))).status).toBe(403);
 expect((await route.POST(await upload(new TextEncoder().encode('<svg/>')))).status).toBe(400);expect(route.state.calls).toEqual([]);
 route.state.path='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/cccccccc-cccc-4ccc-8ccc-cccccccccccc.webp';expect((await route.PHOTO(new Request("http://localhost/api/profile/photo"))).status).toBe(404);expect(route.state.calls).toEqual([]);
});
test('missing migration and concurrent pointer change report failure without claiming sync',async()=>{
 const png=await sharp({create:{width:16,height:16,channels:3,background:'#8844cc'}}).png().toBuffer();
 const route=await setup({missing:true});const response=await route.POST(await upload(png));expect(response.status).toBe(503);expect((await response.json()).error).toContain('profile_photos SQL migration');expect(route.state.path).toBeNull();
 route.state.missing=false;route.state.conflict=true;expect((await route.POST(await upload(png))).status).toBe(409);expect(route.state.path).toBeNull();
 for(const job of route.state.jobs)await job();expect(route.state.objects.size).toBe(0);
});

test('nickname writes are owner-scoped and partner photo reads resolve only the paired profile',async()=>{
 const other='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';const path=other+'/cccccccc-cccc-4ccc-8ccc-cccccccccccc.webp';
 const route=await setup({partnerPath:path,partnerName:'Partner nickname'});const png=await sharp({create:{width:16,height:16,channels:3,background:'#8844cc'}}).webp().toBuffer();route.state.objects.set(path,png);
 const info=await(await route.GET()).json();expect(info.partner.nickname).toBe('Partner nickname');expect(info.partner.photo).toContain('owner=partner');
 expect((await route.PHOTO(new Request('http://localhost/api/profile/photo?owner=partner'))).status).toBe(200);
 const response=await route.PATCH(new Request('http://localhost/api/profile',{method:'PATCH',headers:{origin:'http://localhost'},body:JSON.stringify({id:other,nickname:'  New nickname  '})}));
 expect(response.status).toBe(200);expect(route.state.nickname).toBe('New nickname');expect(route.state.writtenId).toBe(owner);expect((await(await route.GET()).json()).nickname).toBe('New nickname');
 for(const nickname of ['', 'x'.repeat(33)])expect((await route.PATCH(new Request('http://localhost/api/profile',{method:'PATCH',headers:{origin:'http://localhost'},body:JSON.stringify({nickname})}))).status).toBe(400);
 route.state.auth=false;expect((await route.PHOTO(new Request('http://localhost/api/profile/photo?owner=partner'))).status).toBe(401);
});
