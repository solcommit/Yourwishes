import { heifInfo } from "./heif-container";
import { encodePhoto } from "./heic-render";
import { checkDimensions, MAX_OUTPUT_EDGE, MAX_SOURCE_BYTES, rasterDimensions, rasterType } from "./image-format";
import { MAX_WISH_IMAGE_BYTES } from "./wishlist/types";

function aborted() { return new DOMException("Photo processing canceled.", "AbortError"); }

type Decoded = { source: CanvasImageSource; width: number; height: number; close: () => void };

async function nativeDecode(blob: Blob, signal?: AbortSignal): Promise<Decoded> {
  if (signal?.aborted) throw aborted();
  // Safari can decode HEIC through <img> even when createImageBitmap rejects it.
  if (typeof createImageBitmap === "function") {
    let finished = false;
    const work = createImageBitmap(blob, { imageOrientation: "from-image" }).then((bitmap) => {
      if (finished || signal?.aborted) { bitmap.close(); throw aborted(); }
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    });
    try { return await limited(work, 8000, signal); }
    catch { if (signal?.aborted) throw aborted(); }
    finally { finished = true; }
  }
  const url = URL.createObjectURL(blob);
  const image = new Image();
  image.decoding = "async";
  try {
    image.src = url;
    await limited(image.decode(), 8000, signal);
    return { source: image, width: image.naturalWidth, height: image.naturalHeight, close: () => { image.src = ""; URL.revokeObjectURL(url); } };
  } catch (error) { image.src = ""; URL.revokeObjectURL(url); throw error; }
}

function limited<T>(work: Promise<T>, timeout: number, signal?: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => { clear(); reject(new Error("Photo processing timed out. Try selecting it again or choose a smaller copy.")); }, timeout);
    const cancel = () => { clear(); reject(aborted()); };
    const clear = () => { clearTimeout(timer); signal?.removeEventListener("abort", cancel); };
    signal?.addEventListener("abort", cancel, { once: true });
    if (signal?.aborted) { cancel(); return; }
    work.then((value) => { clear(); resolve(value); }, (error) => { clear(); reject(error); });
  });
}

function fallbackDecode(file: File, signal?: AbortSignal, square = true): Promise<Blob> {
  if (signal?.aborted) return Promise.reject(aborted());
  // A dedicated per-photo worker also owns the library's nested decoder worker.
  // Termination bounds hangs, releases decoder memory, and cancels on modal close.
  const worker = new Worker("/generated/heic-worker.js", { type: "module" });
  return new Promise<Blob>((resolve, reject) => {
    const finish = () => { clearTimeout(timer); signal?.removeEventListener("abort", cancel); worker.terminate(); };
    const cancel = () => { finish(); reject(aborted()); };
    const timer = setTimeout(() => { finish(); reject(new Error("HEIC conversion timed out. Try a smaller photo or export a JPEG from Photos.")); }, 60_000);
    worker.onmessage = (event: MessageEvent<{ blob?: Blob; error?: string }>) => {
      finish();
      if (event.data.blob instanceof Blob) resolve(event.data.blob);
      else reject(new Error(event.data.error || "Could not convert this HEIC photo. Try again or export a JPEG from Photos."));
    };
    worker.onerror = (event) => { event.preventDefault(); finish(); reject(new Error("HEIC processing is unavailable on this device. Try again or export a JPEG from Photos.")); };
    signal?.addEventListener("abort", cancel, { once: true });
    if (signal?.aborted) { cancel(); return; }
    worker.postMessage({ file, square });
  });
}

export async function prepareWishImage(file: File, onProgress: (message: string) => void = () => {}, signal?: AbortSignal, square = true): Promise<File> {
  if (signal?.aborted) throw aborted();
  if (!file.size || file.size > MAX_SOURCE_BYTES) throw new Error("Choose photos up to 32 MiB each. Larger photos can be exported at a smaller size from Photos.");
  onProgress("Checking photo…");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const raster = rasterType(bytes);
  let heif;
  try { heif = raster ? null : heifInfo(bytes); }
  catch (error) { throw new Error(error instanceof Error && /too large/.test(error.message) ? error.message : "This HEIC/HEIF file is damaged or unsupported. Try another photo or export a JPEG from Photos."); }
  if (!raster && !heif) throw new Error("Choose a valid JPEG, PNG, WebP, HEIC, or HEIF photo. The file's contents could not be verified.");
  if (raster) checkDimensions(rasterDimensions(bytes));
  onProgress(heif ? "Converting HEIC/HEIF photo…" : "Processing photo…");
  let output: Blob;
  let decoded: Decoded | undefined;
  try {
    try { decoded = await nativeDecode(new Blob([file], { type: raster ?? "image/heic" }), signal); }
    catch (error) { if (!heif || signal?.aborted) throw error; }
    if (decoded) {
      checkDimensions(decoded);
      output = await encodePhoto(decoded.source, decoded.width, decoded.height, 1, raster ?? "image/jpeg", square);
    } else output = await fallbackDecode(file, signal, square);
  } catch (error) {
    if (signal?.aborted) throw aborted();
    throw new Error(error instanceof Error && /too large|timed out|HEIC|smaller/.test(error.message) ? error.message : "This photo could not be processed. Try selecting it again or export a JPEG from Photos.");
  } finally { decoded?.close(); }
  if (signal?.aborted) throw aborted();
  onProgress("Validating processed photo…");
  if (!output.size || output.size > MAX_WISH_IMAGE_BYTES) throw new Error("The processed photo must be under 5 MiB. Try a smaller copy.");
  const resultBytes = new Uint8Array(await output.arrayBuffer());
  const type = rasterType(resultBytes);
  if (!type || (heif && type !== "image/jpeg" && type !== "image/webp") || output.type !== type) throw new Error("Photo conversion produced an invalid image. Please try again.");
  const size = rasterDimensions(resultBytes);
  checkDimensions(size);
  if (square && size.width !== size.height) throw new Error("Photo must be cropped to a square. Please try again.");
  if (Math.max(size.width, size.height) > MAX_OUTPUT_EDGE) throw new Error("Photo resizing failed. Please try again.");
  const verified = await nativeDecode(output, signal);
  try { if (verified.width !== size.width || verified.height !== size.height) throw new Error("The processed photo's dimensions are invalid."); }
  finally { verified.close(); }
  const extension = type === "image/jpeg" ? "jpg" : type === "image/png" ? "png" : "webp";
  const basename = file.name.replace(/\.[^.]*$/, "").slice(0, 245) || "Photo";
  return new File([output], `${basename}.${extension}`, { type });
}

export async function prepareWishImages(files: File[], existingCount: number, onProgress: (message: string) => void, signal?: AbortSignal, onCrop?: (file: File, index: number, total: number) => Promise<File>): Promise<File[]> {
  if (existingCount + files.length > 5) throw new Error("A wish can have up to 5 images.");
  const processed: File[] = [];
  for (let i = 0; i < files.length; i++) {
    const file = await prepareWishImage(files[i], (state) => onProgress(`Photo ${i + 1} of ${files.length}: ${state}`), signal, !onCrop);
    if (signal?.aborted) throw aborted();
    processed.push(onCrop ? await onCrop(file, i + 1, files.length) : file);
    if (signal?.aborted) throw aborted();
  }
  return processed;
}


export type SquareCropArea = { x: number; y: number; width: number; height: number };

/** Export the exact chosen area from an already validated/oriented crop source. */
export async function cropWishImage(file: File, area: SquareCropArea, signal?: AbortSignal): Promise<File> {
  if (signal?.aborted) throw aborted();
  const values = [area.x, area.y, area.width, area.height];
  if (values.some((value) => !Number.isFinite(value)) || area.x < 0 || area.y < 0 || area.width < 1 || area.height < 1 || Math.abs(area.width - area.height) > 1) throw new Error("Invalid square crop.");
  const decoded = await nativeDecode(file, signal);
  const canvas = document.createElement("canvas");
  try {
    const edge = Math.min(decoded.width, decoded.height, Math.round(Math.min(area.width, area.height)));
    if (area.x + edge > decoded.width + 1 || area.y + edge > decoded.height + 1) throw new Error("Crop is outside the photo.");
    canvas.width = edge; canvas.height = edge;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Image processing is unavailable.");
    ctx.drawImage(decoded.source, Math.min(area.x, decoded.width - edge), Math.min(area.y, decoded.height - edge), edge, edge, 0, 0, edge, edge);
    const type = file.type === "image/png" ? "image/png" : file.type === "image/webp" ? "image/webp" : "image/jpeg";
    const blob = await encodePhoto(canvas, edge, edge, 1, type);
    if (signal?.aborted) throw aborted();
    return new File([blob], file.name, { type: blob.type });
  } finally { decoded.close(); canvas.width = 1; canvas.height = 1; }
}
