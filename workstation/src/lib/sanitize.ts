// Security utilities for sanitizing untrusted data from NFT metadata

const ALLOWED_CSS_DOMAINS = [
  "ipfs.io",
  "gateway.pinata.cloud",
  "nftstorage.link",
  "w3s.link",
  "dweb.link",
];

/**
 * Validates that a cssOverrides URL points to a trusted IPFS/storage domain.
 * Returns the URL if safe, or undefined if potentially malicious.
 */
export function sanitizeSkinCssUri(uri: string | undefined): string | undefined {
  if (!uri) return undefined;
  try {
    const url = new URL(uri);
    if (url.protocol !== "https:") return undefined;
    if (!ALLOWED_CSS_DOMAINS.some((d) => url.hostname === d || url.hostname.endsWith(`.${d}`))) {
      return undefined;
    }
    return uri;
  } catch {
    return undefined;
  }
}

/**
 * Strips dangerous CSS properties that could execute JavaScript or exfiltrate data.
 * Removes: expression(), url() with data:/javascript:, behavior:, -moz-binding, @import from non-IPFS
 */
export function sanitizeCssText(css: string): string {
  // Remove expression() — IE CSS expressions
  let sanitized = css.replace(/expression\s*\([^)]*\)/gi, "/* removed */");
  // Remove behavior: — IE HTC bindings
  sanitized = sanitized.replace(/behavior\s*:\s*[^;]*/gi, "/* removed */");
  // Remove -moz-binding — Firefox XBL bindings
  sanitized = sanitized.replace(/-moz-binding\s*:\s*[^;]*/gi, "/* removed */");
  // Remove url() with data: or javascript: schemes
  sanitized = sanitized.replace(/url\s*\(\s*['"]?\s*(data:|javascript:)[^)]*\)/gi, "/* removed */");
  // Remove @import from non-allowed domains
  sanitized = sanitized.replace(/@import\s+(?:url\s*\()?\s*['"]?([^'"\s)]+)['"]?\s*\)?\s*;?/gi, (match, importUrl) => {
    try {
      const url = new URL(importUrl);
      if (ALLOWED_CSS_DOMAINS.some((d) => url.hostname === d || url.hostname.endsWith(`.${d}`))) {
        return match;
      }
    } catch {
      // relative URL or invalid — block it
    }
    return "/* blocked import */";
  });
  return sanitized;
}

/**
 * Validates hex color strings to prevent injection via style props.
 */
export function sanitizeColor(color: string): string {
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(color)) {
    return color;
  }
  return "#ffffff";
}
