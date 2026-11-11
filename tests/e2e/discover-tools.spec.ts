import {test,expect,type Page} from "@playwright/test";
import {build} from "esbuild";
import {createServer} from "node:http";
import {readFileSync} from "node:fs";
import {budgetWishes,occasionCountdown,validCalendarDate,type DiscoverSnapshot,type SharedWish,type Occasion,type ShortlistEntry,type Preference} from "../../src/lib/discover/types";
import type {WishlistItem} from "../../src/lib/wishlist/types";
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
const a1='aaaaaaaa-0000-4000-8000-000000000001',a2='aaaaaaaa-0000-4000-8000-000000000002',b1='bbbbbbbb-0000-4000-8000-000000000001',b2='bbbbbbbb-0000-4000-8000-000000000002';
let server:ReturnType<typeof createServer>,url:string;let shortlist:ShortlistEntry[]=[],preferences:Preference[]=[],occasions:Occasion[]=[],shared:SharedWish[]=[],version=0,failSave=false;
const stamp=()=>new Date(Date.UTC(2026,10,11,0,0,++version)).toISOString();
test.beforeAll(async()=>{
 const output=await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import {DiscoverPage} from './src/components/workspace-pages';createRoot(document.getElementById('root')).render(<DiscoverPage/>);`,loader:'tsx',resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'browser',loader:{'.css':'empty'},define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'discover-fixture',setup(b){
 b.onResolve({filter:/app-shell$/},()=>({path:'workspace',namespace:'fixture'}));b.onResolve({filter:/settings-provider$/},()=>({path:'settings',namespace:'fixture'}));b.onResolve({filter:/profile-photo-provider$/},()=>({path:'profile',namespace:'fixture'}));b.onResolve({filter:/^next\/(dynamic|image|link)$/},args=>({path:args.path,namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},args=>({resolveDir:process.cwd(),loader:'jsx',contents:args.path==='workspace'?`
 const userId=location.search.includes('user=b')?'${B}':'${A}';const items=[{id:'${a1}',name:'My USD wish',ownerId:'${A}',price:20,currency:'USD'},{id:'${a2}',name:'My MNT wish',ownerId:'${A}',price:10000,currency:'MNT'},{id:'${b1}',name:'Partner USD wish',ownerId:'${B}',price:40,currency:'USD'},{id:'${b2}',name:'Partner MNT wish',ownerId:'${B}',price:30000,currency:'MNT'}].map(item=>({...item,owner:item.ownerId===userId?'you':'partner',images:[],image:'',description:'',priority:'Rare',url:'',category:'',updatedAt:'2026-11-11T00:00:00Z'}));export const useWorkspace=()=>({userId,items});export const useWorkspaceActions=()=>({});
 `:args.path==='settings'?`export const useAppSettings=()=>({settings:{fluidAnimations:false}});`:args.path==='profile'?`export const useProfilePhoto=()=>({partner:{nickname:'Partner'}});`:args.path==='next/dynamic'?`import React from 'react';export default function dynamic(load){const C=React.lazy(()=>load().then(result=>typeof result==='function'?{default:result}:result));return props=><React.Suspense fallback={null}><C {...props}/></React.Suspense>}`:args.path==='next/image'?`import React from 'react';export default function Image({unoptimized,...props}){return <img {...props}/>} `:`import React from 'react';export default function Link(props){return <a {...props}/>} `}));
 }}]});
 const css=['src/app/globals.css','src/components/discover.css','src/components/discover/tools.css','src/components/wheel-wish-selector.css','src/components/ui/gooey-controls.css'].map(f=>readFileSync(f,'utf8').replace(/^@import.*$/gm,'')).join('\n')+'.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}';
 server=createServer(async(req,res)=>{
 const path=new URL(req.url!,'http://fixture');
 if(['/discover-icons/spin-wheel.webp','/discover-icons/instant-pick.webp'].includes(path.pathname)){res.setHeader('Content-Type','image/webp');res.end(readFileSync('public'+path.pathname));return;}
 if(path.pathname==='/app.js'){res.setHeader('Content-Type','text/javascript');res.end(output.outputFiles[0].contents);return;}
 if(path.pathname==='/api/discover'){
  const owner=req.headers.cookie?.includes('fixture-user=b')?B:A;res.setHeader('Content-Type','application/json');
  if(req.headers.cookie?.includes('fixture-missing=1')){res.statusCode=503;res.end(JSON.stringify({error:'Discover setup requires the discover_tools SQL migration.'}));return;}
  if(req.method==='GET'){res.end(JSON.stringify({userId:owner,shortlist:shortlist.filter(s=>s.owner_id===owner),preferences,occasions,shared} satisfies DiscoverSnapshot));return;}
  if(failSave){res.statusCode=503;res.end(JSON.stringify({error:'Temporary save failure. Please retry.'}));return;}
  let body='';for await(const chunk of req)body+=chunk;const v=JSON.parse(body);
  if(v.action==='compare'){for(const [id,wins] of [[v.winner,1],[v.loser,0]] as const){let entry=preferences.find(p=>p.owner_id===owner&&p.wish_id===id);if(!entry){entry={owner_id:owner,wish_id:id,wins:0,compared:0};preferences.push(entry);}entry.wins+=wins;entry.compared++;}}
  else if(v.action==='resetPreferences')preferences=preferences.filter(p=>p.owner_id!==owner);
  else if(v.resource==='shortlist'){shortlist=shortlist.filter(s=>!(s.owner_id===owner&&s.wish_id===v.wishId));if(req.method!=='DELETE')shortlist.push({owner_id:owner,wish_id:v.wishId,note:v.note,occasion_id:v.occasionId??null,updated_at:stamp()});}
  else{const rows=v.resource==='shared'?shared:occasions;const existing=rows.findIndex(r=>r.id===v.id);if(req.method!=='POST'&&(existing<0||rows[existing].updated_at!==v.expectedUpdatedAt)){res.statusCode=409;res.end(JSON.stringify({error:'This item changed on another device.'}));return;}if(req.method==='DELETE')rows.splice(existing,1);else{const row={...v,created_by:existing>=0?rows[existing].created_by:owner,updated_at:stamp()};if(existing>=0)rows[existing]=row;else rows.push(row);}}
  res.end(JSON.stringify({ok:true}));return;
 }
 if(path.pathname!=='/'){res.statusCode=204;res.end();return;}
 res.setHeader('Content-Type','text/html');res.setHeader('Set-Cookie',[`fixture-user=${path.searchParams.get('user')==='b'?'b':'a'}; Path=/; SameSite=Lax`,`fixture-missing=${path.searchParams.has('missing')?'1':'0'}; Path=/; SameSite=Lax`]);res.end('<meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style><div id="root"></div><script type="module" src="/app.js"></script>');
 });
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();if(!address||typeof address==='string')throw Error('No fixture');url=`http://127.0.0.1:${address.port}`;
});
test.afterAll(async()=>{await new Promise<void>(resolve=>server.close(()=>resolve()));});
test.beforeEach(async({page})=>{shortlist=[];preferences=[];occasions=[];shared=[];version=0;failSave=false;await page.emulateMedia({reducedMotion:'reduce'});});
async function launch(page:Page,name:string,query=''){await page.goto(url+query);await page.getByRole('button',{name,exact:true}).click();}

test('calendar countdown handles today, year rollover, leap day, future start and invalid dates',()=>{
 expect(validCalendarDate('2025-02-29')).toBe(false);expect(validCalendarDate('2024-02-29')).toBe(true);
 expect(occasionCountdown('2020-11-11',true,'2026-11-11')).toMatchObject({days:0,years:6});
 expect(occasionCountdown('2020-01-01',true,'2026-12-31')).toMatchObject({days:1,date:'2027-01-01',years:7});
 expect(occasionCountdown('2024-02-29',true,'2025-02-27')).toMatchObject({days:1,date:'2025-02-28'});
 expect(occasionCountdown('2027-11-16',true,'2026-11-11')).toMatchObject({days:370,years:0});
 expect(occasionCountdown('2020-01-01',false,'2026-11-11')!.days).toBeLessThan(0);
});
test('budget filtering never mixes currencies, own wishes or missing prices',()=>{
 const items=[{owner:'partner',currency:'USD',price:30},{owner:'partner',currency:'MNT',price:10},{owner:'you',currency:'USD',price:10},{owner:'partner',currency:'USD',price:null}] as WishlistItem[];
 expect(budgetWishes(items,'USD',40)).toHaveLength(1);expect(budgetWishes(items,'USD',NaN)).toHaveLength(0);
});
test('budget candidates flow into Spin with only matching partner wishes',async({page})=>{
 await launch(page,'Within budget');await page.getByLabel('Maximum budget').fill('50');await page.getByRole('combobox',{name:'Budget currency'}).click();await page.getByRole('option',{name:'USD · $',exact:true}).click();
 await expect(page.getByRole('status')).toHaveText('1 matching wishes');await page.getByRole('button',{name:'Spin these'}).click();await page.locator('.wheel-selection summary').click();await expect(page.getByRole('checkbox',{checked:true})).toHaveCount(1);await page.getByRole('button',{name:'Spin',exact:true}).click();await expect(page.locator('.prize-wheel-winner')).toHaveText('Partner USD wish');
});
test('private shortlist persists and partner browser does not receive the note',async({browser})=>{
 const one=await browser.newContext(),two=await browser.newContext();try{const a=await one.newPage(),b=await two.newPage();await a.emulateMedia({reducedMotion:'reduce'});await b.emulateMedia({reducedMotion:'reduce'});await launch(a,'Surprise shortlist');await a.getByRole('combobox',{name:'Partner wish'}).click();await a.getByRole('option',{name:'Partner USD wish',exact:true}).click();await a.getByLabel('Private note',{exact:true}).fill('Birthday surprise');await a.getByRole('button',{name:'Save to shortlist'}).click();await expect(a.getByRole('heading',{name:'Partner USD wish',exact:true})).toBeVisible();await a.reload();await a.getByRole('button',{name:'Surprise shortlist',exact:true}).click();await expect(a.getByLabel('Private note').last()).toHaveValue('Birthday surprise');await launch(b,'Surprise shortlist','?user=b');await expect(b.getByText('Your surprise ideas will appear here.')).toBeVisible();await expect(b.getByText('Birthday surprise')).toHaveCount(0);}finally{await one.close();await two.close();}
});
test('anniversary saves, countdown appears on launcher and partner can edit the shared date',async({browser})=>{
 const one=await browser.newContext(),two=await browser.newContext();try{const a=await one.newPage(),b=await two.newPage();for(const page of [a,b]){await page.emulateMedia({reducedMotion:'reduce'});await page.clock.setFixedTime(new Date(2026,10,11,12));}await launch(a,'Special days');await a.getByLabel('Title',{exact:true}).fill('Our anniversary');await a.getByLabel('Date you started').fill('2025-11-16');await a.getByRole('button',{name:'Save day',exact:true}).click();await expect(a.getByText('5 days to go')).toBeVisible();await a.getByRole('button',{name:'Discover',exact:true}).click();await expect(a.locator('.discover-countdown')).toContainText('5 days to go');await launch(b,'Special days','?user=b');await b.getByRole('button',{name:'Edit',exact:true}).click();await b.getByLabel('Date you started').fill('2025-11-17');await b.getByRole('button',{name:'Save day',exact:true}).click();await expect(b.getByText('6 days to go')).toBeVisible();await a.reload();await expect(a.locator('.discover-countdown')).toContainText('6 days to go');}finally{await one.close();await two.close();}
});
test('shared wishes save, edit and complete across two browsers',async({browser})=>{
 const one=await browser.newContext(),two=await browser.newContext();try{const a=await one.newPage(),b=await two.newPage();await a.emulateMedia({reducedMotion:'reduce'});await b.emulateMedia({reducedMotion:'reduce'});await launch(a,'Our wishlist');await a.getByLabel('Name',{exact:true}).fill('Trip together');await a.getByLabel('Notes',{exact:true}).fill('Next summer');await a.getByRole('button',{name:'Save shared wish'}).click();await expect(a.getByRole('checkbox',{name:'Complete Trip together'})).toBeVisible();await launch(b,'Our wishlist','?user=b');await b.getByRole('button',{name:'Edit',exact:true}).click();await b.getByLabel('Name',{exact:true}).fill('Summer trip');await b.getByRole('button',{name:'Save shared wish'}).click();await b.getByRole('checkbox',{name:'Complete Summer trip'}).check();await expect(b.getByRole('checkbox',{name:'Complete Summer trip'})).toBeChecked();await expect(b.getByRole('checkbox',{name:'Complete Summer trip'})).toBeEnabled();await a.reload();await a.getByRole('button',{name:'Our wishlist',exact:true}).click();await expect(a.getByRole('checkbox',{name:'Complete Summer trip'})).toBeChecked();}finally{await one.close();await two.close();}
});
test('This or That votes only on own wishes and preferences become visible to partner',async({browser})=>{
 const one=await browser.newContext(),two=await browser.newContext();try{const a=await one.newPage(),b=await two.newPage();await a.emulateMedia({reducedMotion:'reduce'});await b.emulateMedia({reducedMotion:'reduce'});await launch(a,'This or That');await a.getByRole('button',{name:/My USD wish/}).click();await expect(a.locator('.tool-list').first()).toContainText('My USD wish');await launch(b,'This or That','?user=b');await expect(b.getByRole('heading',{name:'Partner favorites'}).locator('..')).toContainText('My USD wish');}finally{await one.close();await two.close();}
});
test('save failure retains input, and missing setup does not break Spin or budget',async({page})=>{
 await launch(page,'Our wishlist');await page.getByLabel('Name',{exact:true}).fill('Keep my input');failSave=true;await page.getByRole('button',{name:'Save shared wish'}).click();await expect(page.getByRole('alert')).toContainText('Temporary save failure');await expect(page.getByLabel('Name',{exact:true})).toHaveValue('Keep my input');
 await launch(page,'Within budget','?missing=1');await expect(page.getByLabel('Maximum budget')).toBeEnabled();await page.getByRole('button',{name:'Discover',exact:true}).click();await page.getByRole('button',{name:'Spin the Wheel',exact:true}).click();await expect(page.getByRole('button',{name:'Spin',exact:true})).toBeEnabled();
});
test('seven launcher icons remain three columns and all tool forms fit SE width',async({page})=>{
 await page.setViewportSize({width:375,height:667});await page.goto(url);await expect(page.locator('.discovery-method-list button')).toHaveCount(7);expect(await page.locator('.discovery-method-list').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length)).toBe(3);
 for(const name of ['Within budget','This or That','Surprise shortlist','Special days','Our wishlist']){await page.getByRole('button',{name,exact:true}).click();await expect(page.getByRole('heading',{name,exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.getByRole('button',{name:'Discover',exact:true}).click();}
 await page.screenshot({path:'performance-results/discover-suite-mobile.png',fullPage:true});
});

test('a private gift plan can be linked to a shared special day',async({page})=>{
 occasions=[{id:'cccccccc-0000-4000-8000-000000000001',created_by:A,title:'Birthday',date:'2025-12-01',annual:true,kind:'birthday',updated_at:stamp()}];
 await launch(page,'Surprise shortlist');await page.getByRole('combobox',{name:'Partner wish'}).click();await page.getByRole('option',{name:'Partner USD wish',exact:true}).click();await page.getByRole('combobox',{name:'Gift occasion',exact:true}).click();await page.getByRole('option',{name:'Birthday',exact:true}).click();await page.getByRole('button',{name:'Save to shortlist'}).click();
 await expect(page.getByRole('combobox',{name:'Gift occasion for Partner USD wish'})).toContainText('Birthday');expect(shortlist[0].occasion_id).toBe(occasions[0].id);
});
