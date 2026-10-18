/** "https://www.reuters.com/a/b" → "reuters.com". Anything unparsable is returned as is. */
export function sourceDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

// A markdown link is matched as a whole first, so the URL inside it is never rewritten twice.
const LINK = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>()[\]]+)/g;

/**
 * Chat messages show each citation as its domain, so long titles and raw URLs don't flood the
 * chat: `[title](url)` and bare URLs both become `[domain](url)`.
 */
export function domainLinks(markdown: string): string {
  return markdown.replace(LINK, (_match, _title, linkUrl?: string, bare?: string) => {
    if (linkUrl) return `[${sourceDomain(linkUrl)}](${linkUrl})`;
    const url = (bare ?? "").replace(/[.,;:!?]+$/, "");
    return `[${sourceDomain(url)}](${url})${(bare ?? "").slice(url.length)}`;
  });
}
