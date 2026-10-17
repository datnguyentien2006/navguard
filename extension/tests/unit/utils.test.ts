import { describe, it, expect } from 'vitest';
import {
  safeUrl,
  getRegistrableDomain,
  urlsEquivalent,
  isSensitivePath,
  detectHomoglyph,
  escapeHtml
} from '../../src/shared/utils';

describe('safeUrl', () => {
  it('returns URL for valid url', () => {
    const u = safeUrl('https://example.com/path');
    expect(u).not.toBeNull();
    expect(u?.hostname).toBe('example.com');
  });

  it('returns null for invalid url', () => {
    expect(safeUrl('not-a-url')).toBeNull();
    expect(safeUrl('')).toBeNull();
  });
});

describe('getRegistrableDomain', () => {
  it('returns last 2 parts for 3-part domain', () => {
    expect(getRegistrableDomain('www.example.com')).toBe('example.com');
  });

  it('returns whole host for 2-part domain', () => {
    expect(getRegistrableDomain('example.com')).toBe('example.com');
  });

  it('returns whole host for single-part', () => {
    expect(getRegistrableDomain('localhost')).toBe('localhost');
  });

  it('handles deep subdomain', () => {
    expect(getRegistrableDomain('a.b.c.example.com')).toBe('example.com');
  });
});

describe('urlsEquivalent', () => {
  it('same origin + same path → true', () => {
    expect(
      urlsEquivalent('https://a.com/x', 'https://a.com/x')
    ).toBe(true);
  });

  it('same origin, different path → false', () => {
    expect(
      urlsEquivalent('https://a.com/x', 'https://a.com/y')
    ).toBe(false);
  });

  it('different origin → false', () => {
    expect(
      urlsEquivalent('https://a.com/x', 'https://b.com/x')
    ).toBe(false);
  });

  it('resolves relative to base', () => {
    expect(
      urlsEquivalent('/x', '/x', 'https://a.com/page')
    ).toBe(true);
  });
});

describe('isSensitivePath', () => {
  it('detects /login', () => {
    expect(isSensitivePath(new URL('https://a.com/login'))).toBe(true);
  });

  it('detects /checkout', () => {
    expect(isSensitivePath(new URL('https://a.com/checkout'))).toBe(true);
  });

  it('detects /oauth/authorize', () => {
    expect(isSensitivePath(new URL('https://a.com/oauth/authorize'))).toBe(true);
  });

  it('returns false for normal path', () => {
    expect(isSensitivePath(new URL('https://a.com/about'))).toBe(false);
  });
});

describe('detectHomoglyph', () => {
  it('detects faceb00k', () => {
    expect(detectHomoglyph('faceb00k.com')).toBe(true);
  });

  it('detects g00gle', () => {
    expect(detectHomoglyph('g00gle.com')).toBe(true);
  });

  it('returns false for real facebook', () => {
    expect(detectHomoglyph('facebook.com')).toBe(false);
  });

  it('returns false for unrelated', () => {
    expect(detectHomoglyph('example.com')).toBe(false);
  });
});

describe('escapeHtml', () => {
  it('escapes < > & " \'', () => {
    expect(escapeHtml('<a href="x">&\'</a>')).toBe(
      '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;'
    );
  });

  it('leaves safe chars alone', () => {
    expect(escapeHtml('hello world')).toBe('hello world');
  });
});
