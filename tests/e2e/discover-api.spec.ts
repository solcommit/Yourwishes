import {test,expect} from "@playwright/test";
import {build} from "esbuild";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import {resolve} from "node:path";
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222',id='aaaaaaaa-0000-4000-8000-000000000001';
type Call={table:string;op:string;values?:Record<string,unknown>;filters:Record<string,unknown>};
type DbResult={data:Record<string,unknown>|null;error:{code:string}|null};
interface Query extends PromiseLike<DbResult>{select:(columns:string)=>Query;insert:(v:Record<string,unknown>)=>Query;upsert:(v:Record<string,unknown>)=>Query;update:(v:Record<string,unknown>)=>Query;delete:()=>Query;eq:(key:string,v:unknown)=>Query;neq:(key:string,v:unknown)=>Query;maybeSingle:()=>Promise<DbResult>}
function fixture(){
 const state={member:true,userId:A,calls:[] as Call[],exists:true,error:null as {code:string}|null,duplicate:false,existing:{} as Record<string,unknown>};
 const client={rpc:async(name:string,args?:Record<string,unknown>)=>{state.calls.push({table:name,op:'rpc',values:args,filters:{}});return {data:{shortlist:[],preferences:[],occasions:[],shared:[]},error:state.error};},from:(table:string)=>{
  const call:Call={table,op:'select',filters:{}};
  const finish=async()=>{state.calls.push({...call,filters:{...call.filters}});return {data:state.exists?{id,created_by:A,...state.existing}:null,error:state.duplicate&&call.op==='insert'?{code:'23505'}:state.error};};
  const query:Query={select:()=>query,insert:v=>{call.op='insert';call.values=v;return query;},upsert:v=>{call.op='upsert';call.values=v;return query;},update:v=>{call.op='update';call.values=v;return query;},delete:()=>{call.op='delete';return query;},eq:(key,v)=>{call.filters[key]=v;return query;},neq:(key,v)=>{call.filters['not:'+key]=v;return query;},maybeSingle:finish,then:(yes,no)=>finish().then(yes,no)};return query;
 }};return {...state,get member(){return state.member;},set member(v:boolean){state.member=v;},get exists(){return state.exists;},set exists(v:boolean){state.exists=v;},get error(){return state.error;},set error(v:{code:string}|null){state.error=v;},get duplicate(){return state.duplicate;},set duplicate(v:boolean){state.duplicate=v;},get existing(){return state.existing;},set existing(v:Record<string,unknown>){state.existing=v;},client};
}
type Fixture=ReturnType<typeof fixture>;
let bundle:string;
test.beforeAll(async()=>{
 const server=readFileSync('src/lib/wishlist/server.ts','utf8');const helpers=server.slice(server.indexOf('export class WishlistError'),server.indexOf('export async function fetchWishes'));
 const output=await build({entryPoints:['src/app/api/discover/route.ts'],bundle:true,write:false,format:'cjs',platform:'node',plugins:[{name:'server-fixture',setup(b){b.onResolve({filter:/^@\/lib\/wishlist\/server$/},()=>({path:'server',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({loader:'ts',contents:`const f=globalThis.discoverFixture;const getMember=async()=>f.member?{userId:f.userId}:null;const createClient=async()=>f.client;`+helpers}));}}]});bundle=output.outputFiles[0].text;
});
function route(state:Fixture){const loaded={exports:{}};new Function('require','module','globalThis',bundle)(createRequire(resolve('package.json')),loaded,{discoverFixture:state});return loaded.exports as Record<'GET'|'POST'|'PATCH'|'DELETE',(request?:Request)=>Promise<Response>>;}
function request(method:string,value:unknown,origin='http://localhost'){return new Request('http://localhost/api/discover',{method,headers:{origin,'content-type':'application/json'},body:JSON.stringify(value)});}
const occasion={resource:'occasions',id,title:'Our day',date:'2025-11-11',kind:'anniversary',annual:true};
test('anonymous reads and cross-origin writes fail before any database work',async()=>{
 const state=fixture();state.member=false;expect((await route(state).GET()).status).toBe(401);expect(state.calls).toHaveLength(0);state.member=true;expect((await route(state).POST(request('POST',occasion,'https://evil.invalid'))).status).toBe(403);expect(state.calls).toHaveLength(0);
});
test('snapshot is private/no-store and missing setup returns actionable 503',async()=>{
 const state=fixture();const response=await route(state).GET();expect(response.headers.get('cache-control')).toBe('private, no-store');expect((await response.json()).userId).toBe(A);expect(state.calls[0].table).toBe('discover_snapshot');state.error={code:'PGRST202'};const failed=await route(state).GET();expect(failed.status).toBe(503);expect((await failed.json()).error).toContain('discover_tools');
});
test('shortlist owner is derived from session and delete cannot target partner notes',async()=>{
 const state=fixture();expect((await route(state).POST(request('POST',{resource:'shortlist',wishId:id,note:'Private',owner_id:B}))).status).toBe(200);expect(state.calls.find(c=>c.op==='upsert')?.values?.owner_id).toBe(A);state.calls.length=0;await route(state).DELETE(request('DELETE',{resource:'shortlist',wishId:id,owner_id:B}));expect(state.calls[0].filters).toEqual({owner_id:A,wish_id:id});
});
test('invalid dates, prices, links, same-wish votes and oversized requests are rejected',async()=>{
 const state=fixture(),api=route(state);expect((await api.POST(request('POST',{...occasion,date:'2025-02-29'}))).status).toBe(400);
 const shared={resource:'shared',id,title:'Trip',description:'',price:null,currency:'MNT',url:'javascript:alert(1)',done:false};expect((await api.POST(request('POST',shared))).status).toBe(400);expect((await api.POST(request('POST',{...shared,url:'',price:-2}))).status).toBe(400);expect((await api.POST(request('POST',{action:'compare',winner:id,loser:id}))).status).toBe(400);expect((await api.POST(request('POST',{...occasion,title:'x'.repeat(20000)}))).status).toBe(413);expect(state.calls).toHaveLength(0);
});
test('shared edits require an expected version and return conflict instead of overwriting',async()=>{
 const state=fixture(),api=route(state);expect((await api.PATCH(request('PATCH',occasion))).status).toBe(400);state.exists=false;const version='2026-11-11T00:00:00Z';expect((await api.PATCH(request('PATCH',{...occasion,expectedUpdatedAt:version}))).status).toBe(409);expect(state.calls[0].filters).toEqual({id,updated_at:version});
});
test('retrying the same committed create is idempotent only for matching owner and content',async()=>{
 const state=fixture();state.duplicate=true;state.existing={title:'Our day',date:'2025-11-11',kind:'anniversary',annual:true};expect((await route(state).POST(request('POST',occasion))).status).toBe(200);state.existing={...state.existing,created_by:B};expect((await route(state).POST(request('POST',occasion))).status).toBe(409);
});
