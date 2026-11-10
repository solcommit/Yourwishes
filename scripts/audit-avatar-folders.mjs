// Synthetic local audit only: start the fixture on 3119 and isolated Next on localhost:3102.
import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
const fixture=await(await fetch('http://127.0.0.1:3119/audit')).json();
assert.equal(fixture.session?.user?.email,'audit@example.test');
const browser=await chromium.launch({channel:'chrome'});
try {
  const page=await browser.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>localStorage.setItem('yourwishes-settings',JSON.stringify({ambientAnimation:false,fluidAnimations:true,gradientIntensity:'off'})));
  await page.goto('http://localhost:3102/sign-in');
  await page.getByLabel('Email',{exact:true}).fill('audit@example.test');await page.getByLabel('Password',{exact:true}).fill('local-fixture-only');await page.getByRole('button',{name:'Sign In',exact:true}).click();await page.waitForURL('http://localhost:3102/');
  const results=[];
  for(const width of [375,768,1440]) {
    await page.setViewportSize({width,height:800});await page.goto('http://localhost:3102/partner');await expect(page.locator('.wish-tile')).toHaveCount(12,{timeout:30000}).catch(async e=>{console.log(JSON.stringify({errors,body:await page.locator('body').innerText()}));throw e;});
    await page.getByRole('button',{name:'Sort',exact:true}).click();await expect(page.locator('.folder-root')).toHaveCount(5);
    const lower=page.locator('.priority-folder-group[data-priority="Legendary"] .folder-stage');await lower.scrollIntoViewIfNeeded();
    await page.mouse.move(2,700);await page.waitForTimeout(400);
    const avatar=page.locator('.profile-avatar');const before=await avatar.boundingBox();assert(before);assert.equal(Math.round(before.width),44);
    await lower.click();const samples=[];
    for(let i=0;i<8;i++) {await page.waitForTimeout(40);const box=await avatar.boundingBox();assert(box);samples.push(box.y);assert(Math.abs(box.y-before.y)<1,`${width}: avatar jumped ${box.y-before.y}`);assert(Math.abs(box.x-before.x)<1,`${width}: avatar shifted horizontally`);}
    await expect(page.locator('.folder-item')).toHaveCount(0);await expect(page.locator('.folder-stage')).toHaveAttribute('aria-expanded','true');
    await page.getByRole('button',{name:'← Бүх ангилал'}).click();await expect(page.locator('.folder-root')).toHaveCount(5);
    await avatar.hover();await page.waitForTimeout(650);const expanded=await avatar.boundingBox();assert(expanded.width>44);assert(Math.abs(expanded.y-before.y)<1);
    await page.mouse.move(2,700);await page.waitForTimeout(650);await expect(avatar).toHaveAttribute('aria-expanded','false');
    results.push({width,avatarY:before.y,samples,emptyFolder:true,profileExpansion:true});
  }
  assert.deepEqual(errors,[]);console.log(JSON.stringify({syntheticOnly:true,results,runtimeErrors:errors}));
} finally {await browser.close();}
