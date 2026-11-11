import {test,expect} from "@playwright/test";
import {build} from "esbuild";
import {createServer} from "node:http";
import {readFileSync} from "node:fs";
let server:ReturnType<typeof createServer>,url:string;
test.beforeAll(async()=>{
 const output=await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import {motion} from 'motion/react';import {AppNavigation} from './src/components/navigation/app-navigation';import {PartnerAvatar} from './src/components/partner-avatar';createRoot(document.getElementById('root')).render(<><motion.header layoutRoot className="app-topbar"><PartnerAvatar/></motion.header><AppNavigation/></>);`,loader:'tsx',resolveDir:process.cwd()},bundle:true,write:false,platform:'browser',format:'esm',loader:{'.css':'empty'},define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'nav-fixture',setup(builder){
  builder.onResolve({filter:/settings-provider$/},()=>({path:'settings',namespace:'fixture'}));builder.onResolve({filter:/profile-photo-provider$/},()=>({path:'profile',namespace:'fixture'}));builder.onResolve({filter:/^next-themes$/},()=>({path:'theme',namespace:'fixture'}));builder.onResolve({filter:/^next\/(navigation|image|link)$/},args=>({path:args.path,namespace:'fixture'}));
  builder.onLoad({filter:/.*/,namespace:'fixture'},args=>({loader:'jsx',resolveDir:process.cwd(),contents:args.path==='settings'?`export const useAppSettings=()=>({settings:{fluidAnimations:true}});`:args.path==='profile'?`export const useProfilePhoto=()=>({partner:{nickname:'Partner synced',photo:null}});`:args.path==='theme'?`export const useTheme=()=>({resolvedTheme:'dark'});`:args.path==='next/navigation'?`import {useSyncExternalStore} from 'react';export const usePathname=()=>useSyncExternalStore(callback=>{window.addEventListener('popstate',callback);return()=>window.removeEventListener('popstate',callback);},()=>location.pathname,()=>'/');`:args.path==='next/image'?`import React from 'react';export default function Image(props){return <img {...props}/>} `:`import React from 'react';export default function Link({href,onClick,children,...props}){return <a href={href} {...props} onClick={event=>{onClick?.(event);if(!event.defaultPrevented){event.preventDefault();history.pushState({},'',href);window.dispatchEvent(new Event('popstate'));}}}>{children}</a>}` }));
 }}]});
 const css=readFileSync('src/app/globals.css','utf8').replace(/^@import.*$/gm,'')+readFileSync('src/components/navigation/GooeyNav.css','utf8')+readFileSync('src/components/navigation/app-navigation.css','utf8')+'.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}';
 server=createServer((req,res)=>{if(req.url==='/app.js'){res.setHeader('Content-Type','text/javascript');res.end(output.outputFiles[0].contents);}else{res.setHeader('Content-Type','text/html');res.end('<meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style><div id="root"></div><script type="module" src="/app.js"></script>');}});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();if(!address||typeof address==='string')throw Error('No fixture');url=`http://127.0.0.1:${address.port}`;
});
test.afterAll(async()=>{await new Promise<void>(resolve=>server.close(()=>resolve()));});
test('official Gooey Nav provides four icon routes, active state and browser-back synchronization',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await page.goto(url);
 const nav=page.getByRole('navigation',{name:'Main navigation'});await expect(nav.getByRole('link')).toHaveCount(4);
 await expect(nav.getByRole('link',{name:'Home',exact:true})).toHaveAttribute('aria-current','page');
 for(const [name,path] of [['Partner','/partner'],['Mine','/wishlist'],['Discover','/discover'],['Home','/']] as const){await nav.getByRole('link',{name,exact:true}).click();await expect(page).toHaveURL(url+path);await expect(nav.getByRole('link',{name,exact:true})).toHaveAttribute('aria-current','page');}
 await page.goBack();await expect(nav.getByRole('link',{name:'Discover',exact:true})).toHaveAttribute('aria-current','page');
 for(const width of [320,375,430,768,1440]){await page.setViewportSize({width,height:850});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
 await expect(page.locator('.app-dock')).toHaveCount(0);expect(errors).toEqual([]);
});
test('Gooey Nav remains functional without WebGL and with reduced motion',async({page})=>{
 await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(this:HTMLCanvasElement,type:string,...args:unknown[]){return type==='webgl2'?null:original.apply(this,[type,...args] as never);} as typeof original;});
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto(url);await expect(page.locator('.gooey-nav__fallback')).toHaveCSS('display','block');
 await page.getByRole('link',{name:'Partner',exact:true}).click();await expect(page.getByRole('link',{name:'Partner',exact:true})).toHaveAttribute('aria-current','page');
});
test('partner avatar expands on desktop hover and mobile tap without opening an editor',async({page,browser})=>{
 await page.setViewportSize({width:1440,height:850});await page.goto(url);const avatar=page.getByRole('button',{name:/Partner synced/});
 const before=await avatar.boundingBox();await avatar.hover();await expect(avatar).toHaveAttribute('aria-expanded','true');await page.waitForTimeout(500);const expanded=await avatar.boundingBox();expect(expanded!.width).toBeGreaterThan(before!.width);expect(Math.abs(expanded!.y-before!.y)).toBeLessThan(1);
 await page.mouse.move(800,600);await expect(avatar).toHaveAttribute('aria-expanded','false');
 const context=await browser.newContext({viewport:{width:375,height:812},isMobile:true,hasTouch:true});try{const mobile=await context.newPage();await mobile.goto(url);const target=mobile.getByRole('button',{name:/Partner synced/});await target.tap();await expect(target).toHaveAttribute('aria-expanded','true');await target.tap();await expect(target).toHaveAttribute('aria-expanded','false');await expect(mobile.getByRole('dialog')).toHaveCount(0);}finally{await context.close();}
});

test('icon navigation has one SVG per route and selected contrast without a clipped duplicate',async({page})=>{
 await page.goto(url);const nav=page.getByRole('navigation',{name:'Main navigation'});
 await expect(nav.locator('.gooey-nav__icon svg')).toHaveCount(4);
 await expect(nav.locator('.gooey-nav__list--active .gooey-nav__icon')).toHaveCount(0);
 await expect(nav.locator('.gooey-nav__list--active')).toHaveCSS('display','none');
 for(const name of ['Home','Partner','Mine','Discover']){
   const link=nav.getByRole('link',{name,exact:true});await link.click();await expect(link).toHaveAttribute('aria-current','page');
   await expect.poll(()=>link.evaluate(e=>getComputedStyle(e).color)).toBe(await nav.evaluate(e=>{const probe=document.createElement('span');probe.style.color='var(--gn-active-ink)';e.append(probe);const color=getComputedStyle(probe).color;probe.remove();return color;}));
 }
 await page.screenshot({path:'performance-results/navigation-single-icon.png'});
});
