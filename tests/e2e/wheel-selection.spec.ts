import {test,expect} from "@playwright/test";
import {build} from "esbuild";
import {createServer} from "node:http";
import {readFileSync} from "node:fs";
let server:ReturnType<typeof createServer>;let url:string;
test.beforeAll(async()=>{
 const output=await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import {DiscoverPage} from './src/components/workspace-pages';createRoot(document.getElementById('root')).render(<DiscoverPage/>);`,loader:'tsx',resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'browser',loader:{'.css':'empty'},define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'fixture',setup(b){
  b.onResolve({filter:/app-shell$/},()=>({path:'workspace',namespace:'fixture'}));b.onResolve({filter:/settings-provider$/},()=>({path:'settings',namespace:'fixture'}));b.onResolve({filter:/profile-photo-provider$/},()=>({path:'profile',namespace:'fixture'}));b.onResolve({filter:/^next\/(image|link)$/},args=>({path:args.path,namespace:'fixture'}));
  b.onLoad({filter:/.*/,namespace:'fixture'},args=>({resolveDir:process.cwd(),loader:'jsx',contents:args.path==='workspace'?`
    import {useSyncExternalStore} from 'react';let items=[{id:'a',name:'Affordable gift',price:10},{id:'b',name:'Another gift',price:20},{id:'c',name:'Expensive gift',price:1000}].map(item=>({...item,owner:'partner',currency:'USD',priority:'Rare',images:[]}));items.push({...items[0],id:'own',name:'Own wish',owner:'you'});
    window.changeWishes=()=>{items=items.filter(item=>item.id!=='a');window.dispatchEvent(new Event('wishlistchange'))};
    window.addWish=()=>{items=[...items,{...items[0],id:'new',name:'New remote gift'}];window.dispatchEvent(new Event('wishlistchange'))};
    const subscribe=f=>{window.addEventListener('wishlistchange',f);return()=>window.removeEventListener('wishlistchange',f)};export const useWorkspace=()=>({items:useSyncExternalStore(subscribe,()=>items)});export const useWorkspaceActions=()=>({});
  `:args.path==='settings'?`export const useAppSettings=()=>({settings:{fluidAnimations:true}});`:args.path==='profile'?`export const useProfilePhoto=()=>({partner:{nickname:'Partner'}});`:args.path==='next/image'?`import React from 'react';export default function Image({unoptimized,...props}){return <img {...props}/>} `:`import React from 'react';export default function Link(props){return <a {...props}/>} `}));
 }}]});
 const css=['src/app/globals.css','src/components/discover.css','src/components/ui/gooey-controls.css','src/components/wheel-wish-selector.css'].map(f=>readFileSync(f,'utf8').replace(/^@import.*$/gm,'')).join('\n');
 server=createServer((req,res)=>{if(req.url==='/app.js'){res.setHeader('Content-Type','text/javascript');res.end(output.outputFiles[0].contents);}else{res.setHeader('Content-Type','text/html');res.end('<meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style><div id="root"></div><script type="module" src="/app.js"></script>');}});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();if(!address||typeof address==='string')throw Error('No fixture');url=`http://127.0.0.1:${address.port}`;
});
test.afterAll(async()=>{await new Promise<void>(resolve=>server.close(()=>resolve()));});
async function openWheel(page:import('@playwright/test').Page){await page.goto(url);await page.getByRole('button',{name:'Spin the Wheel',exact:true}).click();await page.locator('.wheel-selection summary').click();}
test('only checked partner wishes can win; clear disables spin and select all restores it',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await openWheel(page);await expect(page.getByRole('checkbox')).toHaveCount(3);await expect(page.getByRole('checkbox',{name:/Own wish/})).toHaveCount(0);
 await page.getByRole('button',{name:'Clear',exact:true}).click();await expect(page.getByRole('button',{name:'Spin',exact:true})).toBeDisabled();await expect(page.locator('.prize-wheel-wrap')).toHaveCount(0);
 await page.getByRole('checkbox',{name:/Affordable gift/}).check();await expect(page.locator('.prize-wheel-label')).toHaveCount(1);
 for(let i=0;i<5;i++){await page.getByRole('button',{name:'Spin',exact:true}).click();await expect(page.locator('.prize-wheel-winner')).toHaveText('Affordable gift');}
 await page.getByRole('button',{name:'Select all',exact:true}).click();await expect(page.getByRole('checkbox',{checked:true})).toHaveCount(3);await expect(page.locator('.prize-wheel-winner')).toHaveCount(0);
});
test('choices persist when returning from a method; new or removed wishes cannot invalidate a custom pool',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await openWheel(page);await page.getByRole('button',{name:'Clear',exact:true}).click();await page.getByRole('checkbox',{name:/Affordable gift/}).check();
 await page.getByRole('button',{name:'Choose a method',exact:true}).click();await page.getByRole('button',{name:'Spin the Wheel',exact:true}).click();await page.locator('.wheel-selection summary').click();await expect(page.getByRole('checkbox',{checked:true})).toHaveCount(1);
 await page.evaluate('window.addWish()');await expect(page.getByRole('checkbox',{name:/New remote gift/})).not.toBeChecked();await expect(page.getByRole('checkbox',{checked:true})).toHaveCount(1);
 await page.getByRole('button',{name:'Spin',exact:true}).click();await expect(page.locator('.prize-wheel-winner')).toHaveText('Affordable gift');await page.evaluate('window.changeWishes()');await expect(page.locator('.prize-wheel-winner')).toHaveCount(0);await expect(page.getByRole('button',{name:'Spin',exact:true})).toBeDisabled();
});
test('selection is locked during motion and usable at SE width with keyboard',async({page})=>{
 await page.setViewportSize({width:375,height:667});await openWheel(page);await page.getByRole('checkbox',{name:/Expensive gift/}).focus();await page.keyboard.press('Space');await expect(page.getByRole('checkbox',{name:/Expensive gift/})).not.toBeChecked();
 await page.getByRole('button',{name:'Spin',exact:true}).click();await expect(page.getByRole('checkbox').first()).toBeDisabled();await expect(page.getByRole('button',{name:'Clear',exact:true})).toBeDisabled();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('button',{name:'Choose a method',exact:true}).click();await page.getByRole('button',{name:'Spin the Wheel',exact:true}).click();await page.locator('.wheel-selection summary').click();await expect(page.getByRole('checkbox').first()).toBeEnabled();
});

test('Instant Pick shares the selection and picks only checked wishes; clear and remote removal clear the result',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await openWheel(page);
 await page.getByRole('button',{name:'Clear',exact:true}).click();await page.getByRole('checkbox',{name:/Affordable gift/}).check();
 await page.getByRole('button',{name:'Choose a method',exact:true}).click();await page.getByRole('button',{name:'Instant Pick',exact:true}).click();await page.locator('.wheel-selection summary').click();
 await expect(page.getByRole('checkbox',{checked:true})).toHaveCount(1);
 for(let i=0;i<5;i++){await page.getByRole('button',{name:'Pick',exact:true}).click();await expect(page.locator('.instant-result strong')).toHaveText('Affordable gift');}
 await page.getByRole('button',{name:'Clear',exact:true}).click();await expect(page.getByRole('button',{name:'Pick',exact:true})).toBeDisabled();await expect(page.locator('.instant-result')).toHaveCount(0);
 await page.getByRole('button',{name:'Select all',exact:true}).click();await expect(page.getByRole('button',{name:'Pick',exact:true})).toBeEnabled();
 await page.getByRole('button',{name:'Clear',exact:true}).click();await page.getByRole('checkbox',{name:/Affordable gift/}).check();await page.getByRole('button',{name:'Pick',exact:true}).click();await expect(page.locator('.instant-result strong')).toHaveText('Affordable gift');await page.evaluate('window.changeWishes()');await expect(page.locator('.instant-result')).toHaveCount(0);await expect(page.getByRole('button',{name:'Pick',exact:true})).toBeDisabled();
});
