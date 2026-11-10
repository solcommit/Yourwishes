"use client";
const PROFILE_DATABASE = "yourwishes-profile";
const PROFILE_STORE = "photos";
function openProfileDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("This browser does not support local profile photo storage."));
      return;
    }
    const request = indexedDB.open(PROFILE_DATABASE, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(PROFILE_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open profile photo storage."));
  });
}

export async function readLegacyProfilePhoto() {
  const database = await openProfileDatabase();
  return new Promise<Blob | null>((resolve, reject) => {
    const request = database.transaction(PROFILE_STORE, "readonly").objectStore(PROFILE_STORE).get("avatar");
    request.onsuccess = () => {
      const value = request.result;
      // Keep reading older Blob avatars. Byte records also work in WebKit
      // environments whose IndexedDB cannot persist File/Blob values.
      if (value instanceof Blob) resolve(value);
      else if (value?.bytes instanceof ArrayBuffer && typeof value.type === "string" && value.type.startsWith("image/") && value.bytes.byteLength <= 5 * 1024 * 1024) {
        resolve(new Blob([value.bytes], { type: value.type }));
      } else resolve(null);
    };
    request.onerror = () => reject(request.error ?? new Error("Could not load the saved profile photo."));
    request.transaction?.addEventListener("complete", () => database.close(), { once: true });
  });
}

