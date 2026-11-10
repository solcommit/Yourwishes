import { test, expect } from "@playwright/test";
import { build } from "esbuild";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

let server: ReturnType<typeof createServer>;
let url: string;
test.beforeAll(async () => {
  const output = await build({ stdin: {contents: `
    import React,{useState} from 'react';
    import {createRoot} from 'react-dom/client';
    import {FormSelect} from './src/components/ui/select';
    import {PRIORITY_OPTIONS,CURRENCY_OPTIONS} from './src/components/wish-form-options';
    function Harness(){const [result,setResult]=useState('');return <form onSubmit={e=>{e.preventDefault();setResult(JSON.stringify(Object.fromEntries(new FormData(e.currentTarget))))}}>
      <FormSelect name="priority" label="Ач холбогдол" options={PRIORITY_OPTIONS} defaultValue="Rare"/>
      <FormSelect name="currency" label="Валют" options={CURRENCY_OPTIONS} defaultValue="USD"/>
      <FormSelect name="disabled" label="Unavailable" options={CURRENCY_OPTIONS} disabled/>
      <button type="submit">Capture</button><output>{result}</output></form>}
    createRoot(document.getElementById('root')).render(<Harness/>);
  `,loader:"tsx",resolveDir:process.cwd()},bundle:true,write:false,platform:"browser",format:"esm",define:{"process.env.NODE_ENV":'"production"'} });
  const styles=(await readFile("src/app/globals.css", "utf8")).replace('@import "tailwindcss";', "");
  server=createServer((request,response)=>{
    if(request.url==="/styles.css"){response.setHeader("Content-Type","text/css");response.end(styles);return;}
    if(request.url==="/app.js"){response.setHeader("Content-Type","text/javascript");response.end(output.outputFiles[0].contents);}
    else {response.setHeader("Content-Type","text/html");response.end('<meta charset="utf-8"><link rel="stylesheet" href="/styles.css"><div id="root"></div><script type="module" src="/app.js"></script>');}
  });
  await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));
  const address=server.address();if(!address||typeof address==="string")throw Error("Harness unavailable");url=`http://127.0.0.1:${address.port}`;
});
test.afterAll(async()=>{if(server)await new Promise<void>(resolve=>server.close(()=>resolve()));});

test("priority keyboard choice and currency click serialize through native FormData",async({page})=>{
  await page.goto(url);
  const priority=page.getByRole("combobox",{name:"Ач холбогдол",exact:true});
  await expect(priority).toContainText("Хэрэгтэй");
  await priority.click();await expect(page.getByRole("listbox")).toBeVisible();
  await page.keyboard.press("End");await expect(page.getByRole("option",{name:/Нэн шаардлагатай/})).toBeFocused();await page.keyboard.press("Enter");
  await expect(priority).toContainText("Нэн шаардлагатай");
  await page.getByRole("combobox",{name:"Валют",exact:true}).click();await page.getByRole("option",{name:/CNY/}).click();
  await page.getByRole("button",{name:"Capture"}).click();
  await expect(page.locator("output")).toContainText('"priority":"Legendary"');
  await expect(page.locator("output")).toContainText('"currency":"CNY"');
  await expect(page.getByRole("combobox",{name:"Unavailable"})).toBeDisabled();
});
test("Escape dismisses only the menu and restores trigger focus",async({page})=>{
  await page.goto(url);
  const trigger=page.getByRole("combobox",{name:"Ач холбогдол",exact:true});
  await trigger.click();await expect(page.getByRole("listbox")).toBeVisible();
  await page.keyboard.press("Escape");await expect(page.getByRole("listbox")).toHaveCount(0);await expect(trigger).toBeFocused();
  await expect(trigger).toContainText("Хэрэгтэй");
});


test("five grades have distinct light/dark colors and remain selectable",async({page},info)=>{
  await page.goto(url);
  const trigger=page.getByRole("combobox",{name:"Ач холбогдол",exact:true});
  const grades=["Common","Uncommon","Rare","Epic","Legendary"];
  const labels=["Байвал гоё","Авмаар байна","Хэрэгтэй","Маш хэрэгтэй","Нэн шаардлагатай"];
  for(const dark of [false,true]){
    await page.evaluate(dark=>document.documentElement.classList.toggle("dark",dark),dark);
    const colors=[];
    for(const grade of grades){
      await trigger.click();await expect(page.getByRole("option")).toHaveCount(5);
      await page.getByRole("option",{name:new RegExp("^"+labels[grades.indexOf(grade)])}).click();
      await expect(trigger).toHaveAttribute("data-tone",grade.toLowerCase());
      colors.push(await trigger.locator(".priority-dot").evaluate(el=>getComputedStyle(el).backgroundColor));
    }
    expect(new Set(colors).size).toBe(5);
    await trigger.click();await page.waitForTimeout(180);
    await page.screenshot({path:info.outputPath(dark?"priority-dark.png":"priority-light.png")});
    await page.keyboard.press("Escape");
  }
});
