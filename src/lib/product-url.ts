const TAOBAO_HOSTS = ["taobao.com", "tb.cn", "tmall.com"];

function isTaobaoHost(host: string) {
  return TAOBAO_HOSTS.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

/** Accept ordinary product URLs and extract real URLs from Taobao share text.
 * No redirect expansion, scraping, or fetching arbitrary pasted URLs.
 */
export function normalizeProductUrl(input: string): string {
  const value = input.trim();
  if (!value) return "";
  if (value.length > 8192) throw new Error("Product link is too long.");
  let candidate = value;
  if (/^(?:[a-z0-9-]+\.)*(?:taobao\.com|tb\.cn|tmall\.com)(?:[/:?#]|$)/i.test(candidate)) {
    candidate = `https://${candidate}`;
  }
  let parsed: URL;
  try {
    if (/\s/.test(candidate)) throw new Error("Share text");
    parsed = new URL(candidate);
  }
  catch {
    const links = value.match(/https?:\/\/[^\s<>"“”]+/gi) ?? [];
    const found = links.map((link) => link.replace(/[，。；、！）】》〉」』)\]}>]+$/u, ""))
      .find((link) => { try { return isTaobaoHost(new URL(link).hostname.toLowerCase()); } catch { return false; } });
    if (!found) throw new Error("Paste a product URL or a Taobao share link containing https://.");
    candidate = found;
    parsed = new URL(candidate);
  }
  if (!["https:", "http:"].includes(parsed.protocol) || !parsed.hostname || parsed.username || parsed.password || /\s/.test(candidate) || candidate.length > 2048) {
    throw new Error("Enter a valid HTTP or HTTPS product URL.");
  }
  return parsed.href;
}
