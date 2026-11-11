import {test,expect} from "@playwright/test";
import {build} from "esbuild";
import {createServer} from "node:http";
import sharp from "sharp";
let server:ReturnType<typeof createServer>;let url:string;let photos:string[]=[];
const imagePath='/api/wishlist/images/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
test.beforeAll(async()=>{
  const image=await sharp({create:{width:20,height:20,channels:3,background:'#8844cc'}}).webp().toBuffer();
  const output=await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import {WishGallery} from './src/components/wish-gallery';createRoot(document.getElementById('root')).render(<WishGallery name="Fixture" images={['${imagePath}']}/>);`,loader:'tsx',resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'browser',loader:{'.css':'empty'},define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'fixture',setup(b){
    b.onResolve({filter:/settings-provider$/},()=>({path:'settings',namespace:'stub'}));b.onResolve({filter:/^next\/image$/},()=>({path:'image',namespace:'stub'}));
    b.onLoad({filter:/.*/,namespace:'stub'},args=>({resolveDir:process.cwd(),loader:'jsx',contents:args.path==='settings'?`export const useAppSettings=()=>({settings:{fluidAnimations:true}});`:`import React from 'react';export default function Image({unoptimized,...props}){return <img {...props}/>}`}));
  }}]});
  server=createServer((req,res)=>{if(req.url==='/app.js'){res.setHeader('Content-Type','text/javascript');res.end(output.outputFiles[0].contents);}else if(req.url?.startsWith('/api/wishlist/images/')){photos.push(req.url);res.setHeader('Content-Type','image/webp');res.end(image);}else{res.setHeader('Content-Type','text/html');res.end('<div id="root"></div><script type="module" src="/app.js"></script>');}});
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();if(!address||typeof address==='string')throw Error('No fixture');url=`http://127.0.0.1:${address.port}`;
});
test.afterAll(async()=>{await new Promise<void>(resolve=>server.close(()=>resolve()));});
test('gallery uses a bounded detail variant and fetches original only for Download',async({page})=>{
  photos=[];await page.setViewportSize({width:390,height:844});await page.goto(url);
  await expect(page.getByRole('group')).toHaveAttribute('aria-busy','false');expect(photos).toEqual([imagePath+'?width=640']);
  const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'Download image'}).click();const file=await downloaded;
  expect(await file.failure()).toBeNull();expect(photos).toEqual([imagePath+'?width=640',imagePath]);
});
