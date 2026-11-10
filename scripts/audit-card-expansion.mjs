// Local synthetic audit only: fixed loopback endpoints, no production credentials.
import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
(async()=>{
 const fixture=await(await fetch('http://127.0.0.1:3119/audit')).json();
 assert.equal(fixture.session?.user?.email,'audit@example.test','Synthetic fixture must be running');
 await mkdir('performance-results/expansion',{recursive:true});
 const browser=await chromium.launch({channel:'chrome'});
 try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{localStorage.setItem('yourwishes-settings',JSON.stringify({ambientAnimation:false,fluidAnimations:true,gradientIntensity:'off'}));});
 await page.goto('http://127.0.0.1:3102/sign-in');await page.getByLabel('Email',{exact:true}).fill('audit@example.test');await page.getByLabel('Password',{exact:true}).fill('local-fixture-only');await page.getByRole('button',{name:'Sign In',exact:true}).click();await page.waitForURL('http://127.0.0.1:3102/');
 const results=[];
 for(const width of [390,1440]){
  await page.setViewportSize({width,height:900});await page.goto('http://127.0.0.1:3102/partner');await expect(page.locator('.wish-tile')).toHaveCount(12);
  for(const list of [false,true]){
   await page.getByRole('button',{name:list?'List layout':'Grid layout',exact:true}).click();await expect(page.locator('.wish-image[src^="blob:"]').first()).toBeVisible();
   const source=page.locator('.wish-tile').first();const opener=source.locator('.wish-open-target');await opener.scrollIntoViewIfNeeded();
   const before=await source.boundingBox();
   await page.evaluate(()=>{window.expansionFrames=[];window.addEventListener('click',()=>{const start=performance.now();const record=()=>{const panel=document.querySelector('[data-shared-wish-card]');if(panel){const r=panel.getBoundingClientRect();window.expansionFrames.push({t:performance.now()-start,width:r.width,height:r.height,x:r.x,y:r.y});}if(performance.now()-start<800)requestAnimationFrame(record);};requestAnimationFrame(record);},{once:true});});
   await opener.click();await expect(page.getByRole('dialog')).toBeVisible();await page.waitForTimeout(850);
   const frames=await page.evaluate(()=>window.expansionFrames);assert(frames.length>5);
   const widths=frames.map(f=>f.width);const animated=Math.max(...widths)-Math.min(...widths)>15;
   assert(animated,`Surface should morph at ${width} list=${list}: ${JSON.stringify(frames.slice(0,3))}`);
   await expect(page.locator('.detail-image-frame img')).toBeVisible();
   const after=await page.getByRole('dialog').boundingBox();assert(after.x>=0&&after.x+after.width<=width);
   await page.screenshot({path:`performance-results/expansion/expanded-${width}-${list?'list':'grid'}.png`});
   await page.keyboard.press('Tab');assert(await page.getByRole('dialog').evaluate(el=>el.contains(document.activeElement)));
   await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);await expect(opener).toBeFocused();
   await expect(source.locator('.wish-image')).toBeVisible();assert(await page.evaluate(()=>document.body.style.overflow!=="hidden"));
   const returned=await source.boundingBox();assert(Math.abs(returned.width-before.width)<1);
   results.push({width,list,frames:frames.length,surfaceMorph:true,focusAndScrollRestored:true});
  }
 }
 await page.emulateMedia({reducedMotion:'reduce'});await page.locator('.wish-open-target').first().click();await expect(page.getByRole('dialog')).toBeVisible();await page.waitForTimeout(80);
 assert.equal(await page.getByRole('dialog').evaluate(el=>getComputedStyle(el).transform),'none');await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
 await page.emulateMedia({reducedMotion:'no-preference'});await page.locator('.wish-open-target').first().click();await expect(page.getByRole('dialog')).toBeVisible();await page.waitForTimeout(600);await page.locator('.shared-item-backdrop').click({position:{x:2,y:2}});await expect(page.getByRole('dialog')).toHaveCount(0);
 assert.equal(errors.length,0,JSON.stringify(errors));console.log(JSON.stringify({syntheticOnly:true,results,reducedMotion:'pass',outsideClose:'pass',runtimeErrors:errors},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
