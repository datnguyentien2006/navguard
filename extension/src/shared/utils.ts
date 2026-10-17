export function safeUrl(u: string): URL | null {
  try {
    return new URL(u);
  } catch {
    return null;
  }
}

export function getRegistrableDomain(host: string): string {
  const parts = host.split('.');
  if (parts.length <= 2) return host;
  return parts.slice(-2).join('.');
}

export function urlsEquivalent(a: string, b: string, base?: string): boolean {
  try {
    const ua = new URL(a, base);
    const ub = new URL(b, base);
    return ua.origin === ub.origin && ua.pathname === ub.pathname;
  } catch {
    return false;
  }
}

export function isSensitivePath(u: URL): boolean {
  const p = u.pathname.toLowerCase();
  return /\/(login|signin|signup|register|checkout|payment|oauth|authorize|verify)/.test(p);
}

export function detectHomoglyph(host: string): boolean {
  const map: Record<string, string> = { '0': 'o', '1': 'l', '3': 'e', '5': 's' };
  const normalized = host.replace(/[0135]/g, (c) => map[c] || c);
  const brands = ['facebook', 'google', 'apple', 'microsoft', 'amazon', 'paypal'];
  return brands.some((b) => normalized.includes(b) && !host.includes(b));
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!)
  );
}
