export const PROFILE_BUCKET = "profile-photos";
export const PROFILE_UPLOAD_BYTES = 5 * 1024 * 1024;
export const PROFILE_STORED_BYTES = 1024 * 1024;
export function validProfilePath(path: string, userId: string) {
  return path.startsWith(`${userId}/`) && /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.webp$/.test(path);
}
