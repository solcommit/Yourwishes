import {test,expect} from "@playwright/test";
import {build} from "esbuild";
import {createServer} from "node:http";
import sharp from "sharp";
let server:ReturnType<typeof createServer>,url:string;
const userId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
let version=0,fail=false,saves=0,nickname="Owner",partnerNickname="Partner";
test.beforeAll(async()=>{
 const output=await build({stdin:{contents:`
  import React from 'react';import {createRoot} from 'react-dom/client';import {ProfilePhotoProvider,useProfilePhoto} from './src/components/profile-photo-provider';
  function Harness(){const {profilePhoto,profileError,saveProfilePhoto,importLegacyPhoto,nickname,partner,saveNickname}=useProfilePhoto();return <><output>{profilePhoto||'none'}</output><span data-nickname>{nickname}</span><span data-partner-nickname>{partner.nickname}</span><input aria-label="Nickname" id="nickname"/><button onClick={()=>saveNickname(document.getElementById("nickname").value).catch(()=>{})}>Save nickname</button><p role="alert">{profileError}</p><input aria-label="Photo" type="file" onChange={e=>saveProfilePhoto(e.target.files[0]).catch(()=>{})}/><button onClick={()=>window.dispatchEvent(new Event('yourwishes-session-ending'))}>Logout</button><button onClick={()=>importLegacyPhoto().catch(()=>{})}>Import legacy</button></>}
  createRoot(document.getElementById('root')).render(<ProfilePhotoProvider userId={location.search.includes("asPartner")?"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb":"${userId}"}><Harness/></ProfilePhotoProvider>);
 `,loader:'tsx',resolveDir:process.cwd()},bundle:true,write:false,platform:'browser',format:'esm',define:{'process.env.NODE_ENV':'"production"'}});
 server=createServer(async(req,res)=>{
  if(req.url==='/app.js'){res.setHeader('Content-Type','text/javascript');res.end(output.outputFiles[0].contents);return;}
  if(req.url==='/api/profile'){
   const other=req.headers.cookie?.includes('fixture-user=b');
   if(req.method==='PATCH'){let raw='';for await(const chunk of req)raw+=chunk;const value=JSON.parse(raw).nickname;if(other)partnerNickname=value;else nickname=value;} 
   if(req.method==='POST'){for await(const chunk of req)void chunk;saves++;if(fail){res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Profile sync requires the profile_photos SQL migration.'}));return;}version++;}
   res.setHeader('Content-Type','application/json');res.end(JSON.stringify({userId:other?'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb':userId,nickname:other?partnerNickname:nickname,photo:!other&&version?`/api/profile/photo?v=${version}`:null,partner:{nickname:other?nickname:partnerNickname,photo:other&&version?`/api/profile/photo?owner=partner&v=${version}`:null}}));return;
  }
  if(req.url==='/favicon.ico'){res.statusCode=204;res.end();return;}
  res.setHeader('Set-Cookie',`fixture-user=${req.url?.includes('asPartner')?'b':'a'}; Path=/; SameSite=Lax`);res.setHeader('Content-Type','text/html');res.end('<div id="root"></div><script type="module" src="/app.js"></script>');
 });
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();if(!address||typeof address==='string')throw Error('No harness');url=`http://127.0.0.1:${address.port}`;
});
test.afterAll(async()=>{await new Promise<void>(resolve=>server.close(()=>resolve()));});
test.beforeEach(()=>{version=0;fail=false;saves=0;nickname="Owner";partnerNickname="Partner";});
test('avatar upload is read in a separate mobile browser, refreshes on focus and clears on logout',async({browser})=>{
 const pc=await browser.newContext(),mobile=await browser.newContext({viewport:{width:375,height:812}});
 try{
  const desktop=await pc.newPage(),phone=await mobile.newPage();await desktop.goto(url);await phone.goto(url);
  await expect(desktop.locator('output')).toHaveText('none');await expect(phone.locator('output')).toHaveText('none');
  const bytes=await sharp({create:{width:16,height:16,channels:3,background:'#8844cc'}}).png().toBuffer();
  await desktop.getByLabel('Photo').setInputFiles({name:'avatar.png',mimeType:'image/png',buffer:bytes});await expect(desktop.locator('output')).toHaveText('/api/profile/photo?v=1');
  await phone.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(phone.locator('output')).toHaveText('/api/profile/photo?v=1');
  await phone.reload();await expect(phone.locator('output')).toHaveText('/api/profile/photo?v=1');
  await desktop.getByLabel('Photo').setInputFiles({name:'new-avatar.png',mimeType:'image/png',buffer:bytes});await expect(desktop.locator('output')).toHaveText('/api/profile/photo?v=2');
  await phone.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(phone.locator('output')).toHaveText('/api/profile/photo?v=2');
  await phone.getByRole('button',{name:'Logout'}).click();await expect(phone.locator('output')).toHaveText('none');
  await phone.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(phone.locator('output')).toHaveText('none');
 }finally{await pc.close();await mobile.close();}
});
test('failed upload retains confirmed photo; old IndexedDB avatar is imported only on explicit action',async({page})=>{
 await page.goto(url);await expect(page.locator('output')).toHaveText('none');
 await page.evaluate(async()=>{
  await new Promise<void>((resolve,reject)=>{const request=indexedDB.open('yourwishes-profile',1);request.onupgradeneeded=()=>request.result.createObjectStore('photos');request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result;const tx=db.transaction('photos','readwrite');tx.objectStore('photos').put({bytes:new Uint8Array([137,80,78,71]).buffer,type:'image/png'},'avatar');tx.oncomplete=()=>{db.close();resolve();};};});
 });
 await expect(page.locator('output')).toHaveText('none');expect(saves).toBe(0);
 await page.getByRole('button',{name:'Import legacy'}).click();await expect(page.locator('output')).toHaveText('/api/profile/photo?v=1');expect(saves).toBe(1);
 fail=true;await page.getByLabel('Photo').setInputFiles({name:'avatar.png',mimeType:'image/png',buffer:Buffer.from([137,80,78,71])});
 await expect(page.getByRole('alert')).toContainText('profile_photos SQL migration');await expect(page.locator('output')).toHaveText('/api/profile/photo?v=1');
});
test('a late pre-save refresh cannot replace the newly saved avatar',async({page})=>{
 await page.goto(url);await expect(page.locator('output')).toHaveText('none');
 let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});let started=false;
 await page.route('**/api/profile',async route=>{if(route.request().method()==='GET'){started=true;await gate;await route.fulfill({json:{userId,photo:null}}).catch(()=>{});}else await route.continue();});
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect.poll(()=>started).toBe(true);
 await page.getByLabel('Photo').setInputFiles({name:'avatar.png',mimeType:'image/png',buffer:Buffer.from([137,80,78,71])});await expect(page.locator('output')).toHaveText('/api/profile/photo?v=1');
 release();await expect(page.locator('output')).toHaveText('/api/profile/photo?v=1');
});

test('server nickname propagates into the other member profile in a separate browser',async({browser})=>{
 const one=await browser.newContext(),two=await browser.newContext();try{
  const first=await one.newPage(),second=await two.newPage();await first.goto(url);await second.goto(url+'?asPartner');
  await expect(second.locator('[data-partner-nickname]')).toHaveText('Owner');
  await first.getByLabel('Nickname',{exact:true}).fill('Zengel synced');await first.getByRole('button',{name:'Save nickname',exact:true}).click();
  await expect(first.locator('[data-nickname]')).toHaveText('Zengel synced');await second.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await expect(second.locator('[data-partner-nickname]')).toHaveText('Zengel synced');await second.reload();await expect(second.locator('[data-partner-nickname]')).toHaveText('Zengel synced');
 }finally{await one.close();await two.close();}
});
