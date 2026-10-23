// Use our authenticated endpoint, never Next's shared/public image optimizer.
export function wishThumbnailLoader({ src, width }: { src: string; width: number }) {
  if (!src.startsWith("/api/wishlist/images/")) return src;
  const size = width <= 320 ? 320 : width <= 640 ? 640 : 960;
  return `${src}?width=${size}`;
}
