import { test, expect } from "@playwright/test";
import { imageBrowserServer } from "../helpers/image-browser-server";

let harness: Awaited<ReturnType<typeof imageBrowserServer>>;
test.beforeAll(async () => { harness = await imageBrowserServer(); });
test.afterAll(async () => { await new Promise<void>((resolve, reject) => harness.server.close((error) => error ? reject(error) : resolve())); });
test.beforeEach(async ({ page }, info) => {
  test.skip(!["desktop-baseline-chromium", "desktop-baseline-webkit", "desktop-baseline-firefox", "mobile-390-chromium"].includes(info.project.name), "Decoder coverage on desktop engines and mobile Chromium.");
  await page.goto(harness.url);
});

test("real HEIC, container rotation, EXIF rotation and metadata removal", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { prepareWishImage } = await import(String("/prepare-wish-image.ts"));
    const exifr = await import(String("/vendor/exifr.mjs"));
    const results = [];
    for (const path of ["fixture.heic", "rotated.heic", "exif.heif"]) {
      const input = await (await fetch(`/${path}`)).blob();
      const progress: string[] = [];
      const output = await prepareWishImage(new File([input], path, { type: path === "fixture.heic" ? "" : "application/octet-stream" }), (message: string) => progress.push(message));
      const bitmap = await createImageBitmap(output);
      results.push({ name: output.name, type: output.type, size: output.size, width: bitmap.width, height: bitmap.height, metadata: await exifr.parse(output), sourceMetadata: await exifr.parse(input), sourceOrientation: await exifr.orientation(input), progress });
      bitmap.close();
    }
    return results;
  });
  for (const output of result) {
    expect(output.name).toMatch(/\.jpg$/);
    expect(output.type).toBe("image/jpeg");
    expect(output.size).toBeLessThanOrEqual(5 * 1024 * 1024);
    expect(output.metadata?.GPSLatitude).toBeUndefined();
    expect(output.metadata?.Orientation).toBeUndefined();
    expect(output.progress.join(" ")).toContain("Converting HEIC/HEIF");
  }
  for (const output of result) { expect(output.width).toBe(854); expect(output.height).toBe(854); }
  expect(result[2].sourceOrientation).toBe(6);
  expect(result[2].sourceMetadata.GPSLatitude).toEqual([30, 0, 0]);
});

test("all eight EXIF orientations preserve pixel placement", async ({ page }) => {
  const corners = await page.evaluate(async () => {
    const { encodePhoto } = await import(String("/heic-render.ts"));
    const source = document.createElement("canvas"); source.width = 120; source.height = 80;
    const context = source.getContext("2d")!;
    for (const [i, color] of ["#ff0000", "#00ff00", "#0000ff", "#ffffff"].entries()) {
      context.fillStyle = color; context.fillRect((i % 2) * 60, Math.floor(i / 2) * 40, 60, 40);
    }
    const results = [];
    for (let orientation = 1; orientation <= 8; orientation++) {
      const bitmap = await createImageBitmap(await encodePhoto(source, 120, 80, orientation));
      const canvas = document.createElement("canvas"); canvas.width = bitmap.width; canvas.height = bitmap.height;
      const ctx = canvas.getContext("2d")!; ctx.drawImage(bitmap, 0, 0);
      results.push([[10, 10], [canvas.width - 10, 10], [10, canvas.height - 10], [canvas.width - 10, canvas.height - 10]].map(([x, y]) => {
        const rgb = ctx.getImageData(x, y, 1, 1).data;
        return rgb[0] > 200 && rgb[1] > 200 ? "W" : rgb[0] > 200 ? "R" : rgb[1] > 200 ? "G" : "B";
      }).join(""));
      bitmap.close();
    }
    return results;
  });
  expect(corners).toEqual(["RGBW", "GRWB", "WBGR", "BWRG", "RBGW", "BRWG", "WGBR", "GWRB"]);
});

test("invalid files, size bounds, batch limits, cancellation and retry", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { prepareWishImage, prepareWishImages } = await import(String("/prepare-wish-image.ts"));
    const input = await (await fetch("/fixture.heic")).blob();
    const photo = new File([input], "photo.HEIF", { type: "image/heif" });
    const errors: string[] = [];
    for (const work of [
      () => prepareWishImage(new File(["fake image"], "fake.heic", { type: "image/heic" })),
      () => prepareWishImage(new File([new Uint8Array(32 * 1024 * 1024 + 1)], "huge.heic")),
      () => prepareWishImages([photo, photo], 4, () => {}),
      () => prepareWishImages([photo, new File(["fake"], "bad.heic")], 0, () => {}),
    ]) { try { await work(); errors.push("unexpected success"); } catch (error) { errors.push(String(error)); } }
    const controller = new AbortController();
    try { await prepareWishImage(photo, (message: string) => { if (message.includes("Converting")) controller.abort(); }, controller.signal); } catch (error) { errors.push(String(error)); }
    const batch = await prepareWishImages([photo, new File([input], "second.heic")], 3, () => {});
    return { errors, names: batch.map((file: File) => file.name) };
  });
  expect(result.errors[0]).toContain("contents could not be verified");
  expect(result.errors[1]).toContain("32 MiB");
  expect(result.errors[2]).toContain("up to 5");
  expect(result.errors[3]).toContain("contents could not be verified");
  expect(result.errors[4]).toContain("AbortError");
  expect(result.names).toEqual(["photo.jpg", "second.jpg"]);
});

test("oversized raster output is center-cropped to square, bounded and validated", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { prepareWishImage } = await import(String("/prepare-wish-image.ts"));
    const canvas = document.createElement("canvas"); canvas.width = 4000; canvas.height = 3000;
    const context = canvas.getContext("2d")!;
    const pixels = context.createImageData(canvas.width, canvas.height);
    let seed = 123;
    for (let i = 0; i < pixels.data.length; i += 4) {
      for (let j = 0; j < 3; j++) { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; pixels.data[i + j] = seed >>> 24; }
      pixels.data[i + 3] = 255;
    }
    context.putImageData(pixels, 0, 0);
    const input = await new Promise<Blob>((resolve) => canvas.toBlob((blob) => resolve(blob!), "image/jpeg", 0.95));
    const output = await prepareWishImage(new File([input], "large.jpg", { type: "application/octet-stream" }));
    const bitmap = await createImageBitmap(output);
    const result = { input: input.size, output: output.size, width: bitmap.width, height: bitmap.height };
    bitmap.close(); return result;
  });
  expect(result.input).toBeGreaterThan(5 * 1024 * 1024);
  expect(result.output).toBeLessThanOrEqual(5 * 1024 * 1024);
  expect(result.width).toBeLessThanOrEqual(3072);
  expect(result.width).toBe(result.height);
});

test("five HEIC conversions leave main-thread button interactions available", async ({ page }, info) => {
  await page.evaluate(async () => {
    const { prepareWishImages } = await import(String("/prepare-wish-image.ts"));
    const blob = await (await fetch("/fixture.heic")).blob();
    const button = document.createElement("button"); button.textContent = "Processing interaction";
    button.onclick = () => { button.dataset.clicks = String(Number(button.dataset.clicks || 0) + 1); }; document.body.append(button);
    const state = { done: false, longTasksSupported: PerformanceObserver.supportedEntryTypes.includes("longtask"), longTasks: [] as number[] };
    Object.assign(window, { processingAudit: state });
    const observer = new PerformanceObserver((list) => { state.longTasks.push(...list.getEntries().map((entry) => entry.duration)); });
    if (state.longTasksSupported) observer.observe({ type: "longtask" });
    void prepareWishImages(Array.from({ length: 5 }, (_, i) => new File([blob], `photo-${i}.heic`)), 0, () => {}).then(() => { state.done = true; observer.disconnect(); });
  });
  const start = Date.now();
  await page.getByRole("button", { name: "Processing interaction" }).click({ clickCount: 3 });
  const clickMs = Date.now() - start;
  await expect(page.getByRole("button", { name: "Processing interaction" })).toHaveAttribute("data-clicks", "3");
  await page.waitForFunction(() => (window as Window & { processingAudit?: { done: boolean } }).processingAudit?.done);
  const result = await page.evaluate(() => (window as Window & { processingAudit?: { longTasks: number[] } }).processingAudit);
  await info.attach("heic-responsiveness", { body: JSON.stringify({ clickMs, ...result }), contentType: "application/json" });
  console.log(JSON.stringify({ measurement: "five-photo-heic", project: info.project.name, clickMs, ...result }));
});


test("manual crop sources preserve HEIC framing and selected pixels export as square", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { prepareWishImage, cropWishImage } = await import(String("/prepare-wish-image.ts"));
    const heic = await (await fetch("/fixture.heic")).blob();
    const prepared = await prepareWishImage(new File([heic], "fixture.heic"), () => {}, undefined, false);
    const source = await createImageBitmap(prepared);
    const original = {width:source.width,height:source.height};source.close();
    const canvas = document.createElement("canvas");canvas.width=900;canvas.height=300;
    const ctx=canvas.getContext("2d")!;
    for (const [index,color] of ["red","lime","blue"].entries()) {ctx.fillStyle=color;ctx.fillRect(index*300,0,300,300);}
    const blob=await new Promise<Blob>(resolve=>canvas.toBlob(value=>resolve(value!),"image/png"));
    const uncropped=await prepareWishImage(new File([blob],"wide.png"),()=>{},undefined,false);
    const cropped=await cropWishImage(uncropped,{x:600,y:0,width:300,height:300});
    const bitmap=await createImageBitmap(cropped);canvas.width=bitmap.width;canvas.height=bitmap.height;ctx.drawImage(bitmap,0,0);
    const output={width:bitmap.width,height:bitmap.height,rgb:[...ctx.getImageData(150,150,1,1).data]};bitmap.close();
    let invalid=false;try{await cropWishImage(uncropped,{x:800,y:0,width:300,height:300});}catch{invalid=true;}
    return {original,output,invalid};
  });
  expect(result.original).toEqual({width:1280,height:854});
  expect(result.output.width).toBe(300);expect(result.output.height).toBe(300);
  expect(result.output.rgb).toEqual([0,0,255,255]);expect(result.invalid).toBe(true);
});

test("manual batch waits for confirmation and abort rejects later adoption", async ({ page }) => {
  const result=await page.evaluate(async()=>{
    const {prepareWishImages}=await import(String("/prepare-wish-image.ts"));
    const canvas=document.createElement("canvas");canvas.width=600;canvas.height=300;
    const blob=await new Promise<Blob>(resolve=>canvas.toBlob(value=>resolve(value!),"image/png"));
    const files=[new File([blob],"one.png"),new File([blob],"two.png")];
    let calls=0;let aborted=false;const controller=new AbortController();
    try{await prepareWishImages(files,0,()=>{},controller.signal,async(file: File,index: number,total: number)=>{
      calls++;if(index!==1||total!==2)throw Error("Incorrect batch order");
      controller.abort();return file;
    });}catch(error){aborted=error instanceof DOMException&&error.name==="AbortError";}
    return {calls,aborted};
  });
  expect(result).toEqual({calls:1,aborted:true});
});
