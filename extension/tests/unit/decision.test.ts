import { describe, it, expect } from 'vitest';
import { decideLevel, extractFeatures, scoreRisk, type Policy } from '../../src/background/decision';
import type { NavIntent, Reputation } from '../../src/shared/types';

// ===== Helpers =====

function makeIntent(overrides: Partial<NavIntent> = {}): NavIntent {
  return {
    sourceUrl: 'https://facebook.com/feed',
    destinationUrl: 'https://facebook.com/profile',
    isTrusted: true,
    hasUserGesture: true,
    overlaySuspicious: false,
    inIframe: false,
    hookType: 'CLICK',
    timestamp: Date.now(),
    ...overrides
  };
}

function mockReputation(
  level: Reputation['level'],
  score = 50,
  reasons: string[] = []
): Reputation {
  return { level, score, reasons, source: 'local' };
}

const highRep = mockReputation('high', 95);
const unknownRep = mockReputation('unknown', 50);
const lowRep = mockReputation('low', 5, ['in_phishing_feed']);

const emptyPolicy: Policy = {
  allowlist: new Set(),
  blocklist: new Set()
};

function stubRep(rep: Reputation) {
  return async () => rep;
}

// ===== Test groups =====

describe('Decision Engine — Mức 0 (allow im lặng)', () => {
  it('TC-001: same-origin click, no redirect → level 0', async () => {
    const d = await decideLevel({
      intent: makeIntent(),
      policy: emptyPolicy,
      getReputation: stubRep(highRep)
    });
    expect(d.level).toBe(0);
    expect(d.action).toBe('allow');
  });

  it('TC-002: same-origin with query params → level 0', async () => {
    const d = await decideLevel({
      intent: makeIntent({
        sourceUrl: 'https://facebook.com/a?x=1',
        destinationUrl: 'https://facebook.com/b?y=2'
      }),
      policy: emptyPolicy,
      getReputation: stubRep(highRep)
    });
    expect(d.level).toBe(0);
  });

  it('TC-ALLOWLIST: allowlisted cross-origin → level 0', async () => {
    const d = await decideLevel({
      intent: makeIntent({ destinationUrl: 'https://trusted.com/x' }),
      policy: {
        allowlist: new Set(['https://trusted.com']),
        blocklist: new Set()
      },
      getReputation: stubRep(unknownRep)
    });
    expect(d.level).toBe(0);
    expect(d.reason).toContain('allowlisted domain');
  });
});

describe('Decision Engine — Mức 2 (toast cảnh báo)', () => {
  it('TC-201: cross-origin + unknown reputation → level 2', async () => {
    const d = await decideLevel({
      intent: makeIntent({ destinationUrl: 'https://unknown.xyz' }),
      policy: emptyPolicy,
      getReputation: stubRep(unknownRep)
    });
    expect(d.level).toBe(2);
    expect(d.action).toBe('warn-toast');
  });

  it('TC-202: iframe navigation → level 2', async () => {
    const d = await decideLevel({
      intent: makeIntent({
        destinationUrl: 'https://ads.example.com',
        inIframe: true
      }),
      policy: emptyPolicy,
      getReputation: stubRep(highRep)
    });
    expect(d.level).toBe(2);
  });

  it('TC-203: window.open with user gesture → level 2', async () => {
    const d = await decideLevel({
      intent: makeIntent({
        destinationUrl: 'https://other.com',
        hookType: 'WINDOW_OPEN'
      }),
      policy: emptyPolicy,
      getReputation: stubRep(highRep)
    });
    expect(d.level).toBe(2);
  });

  it('TC-204: homoglyph domain → level 2 hoặc 3', async () => {
    const d = await decideLevel({
      intent: makeIntent({ destinationUrl: 'https://faceb00k.com' }),
      policy: emptyPolicy,
      getReputation: stubRep(unknownRep)
    });
    expect([2, 3]).toContain(d.level);
  });

  it('TC-205: href mismatch → level 2', async () => {
    const d = await decideLevel({
      intent: makeIntent({
        sourceUrl: 'https://example.com',
        destinationUrl: 'https://evil.com/x',
        hrefAttr: 'https://google.com'
      }),
      policy: emptyPolicy,
      getReputation: stubRep(highRep)
    });
    expect(d.level).toBe(2);
  });
});

describe('Decision Engine — Mức 3 (interstitial)', () => {
  it('TC-301: meta refresh without user gesture → level 3', async () => {
    const d = await decideLevel({
      intent: makeIntent({
        destinationUrl: 'https://evil.com',
        hookType: 'META_REFRESH',
        hasUserGesture: false,
        isTrusted: false
      }),
      policy: emptyPolicy,
      getReputation: stubRep(unknownRep)
    });
    expect(d.level).toBe(3);
    expect(d.action).toBe('interstitial');
  });

  it('TC-302: overlay + user gesture → level 3', async () => {
    const d = await decideLevel({
      intent: makeIntent({
        destinationUrl: 'https://evil.com',
        overlaySuspicious: true
      }),
      policy: emptyPolicy,
      getReputation: stubRep(unknownRep)
    });
    expect(d.level).toBe(3);
  });

  it('TC-303: blocklisted domain → level 3', async () => {
    const d = await decideLevel({
      intent: makeIntent({ destinationUrl: 'https://malware.com/x' }),
      policy: {
        allowlist: new Set(),
        blocklist: new Set(['https://malware.com'])
      },
      getReputation: stubRep(highRep)
    });
    expect(d.level).toBe(3);
  });

  it('TC-304: low reputation → level 3', async () => {
    const d = await decideLevel({
      intent: makeIntent({ destinationUrl: 'https://phishing.xyz' }),
      policy: emptyPolicy,
      getReputation: stubRep(lowRep)
    });
    expect(d.level).toBe(3);
    expect(d.reason.join(' ')).toContain('phishing');
  });

  it('TC-305: redirect depth 5 + no gesture → level 3', async () => {
    const d = await decideLevel({
      intent: makeIntent({
        destinationUrl: 'https://chain.com',
        hasUserGesture: false,
        isTrusted: false,
        redirectChain: ['a.com', 'b.com', 'c.com', 'd.com', 'e.com']
      }),
      policy: emptyPolicy,
      getReputation: stubRep(unknownRep)
    });
    expect(d.level).toBe(3);
  });
});

describe('Decision Engine — Edge cases', () => {
  it('TC-501: invalid URL → level 3 hoặc 2', async () => {
    const d = await decideLevel({
      intent: makeIntent({ destinationUrl: 'not-a-url' }),
      policy: emptyPolicy,
      getReputation: stubRep(unknownRep)
    });
    expect([2, 3]).toContain(d.level);
  });

  it('TC-502: javascript: URL → không crash', async () => {
    const d = await decideLevel({
      intent: makeIntent({ destinationUrl: 'javascript:alert(1)' }),
      policy: emptyPolicy,
      getReputation: stubRep(unknownRep)
    });
    expect([0, 1, 2, 3]).toContain(d.level);
  });

  it('never throws on random inputs', async () => {
    const inputs = [
      'https://a.com',
      'http://b.com',
      'ftp://c.com',
      'data:text/html,<h1>x</h1>',
      '',
      'x'
    ];
    for (const url of inputs) {
      const d = await decideLevel({
        intent: makeIntent({ destinationUrl: url }),
        policy: emptyPolicy,
        getReputation: stubRep(unknownRep)
      });
      expect([0, 1, 2, 3]).toContain(d.level);
    }
  });
});

describe('extractFeatures', () => {
  it('detects same-origin', () => {
    const f = extractFeatures(
      makeIntent({
        sourceUrl: 'https://a.com/x',
        destinationUrl: 'https://a.com/y'
      }),
      emptyPolicy
    );
    expect(f.sameOrigin).toBe(true);
  });

  it('detects http downgrade', () => {
    const f = extractFeatures(
      makeIntent({
        sourceUrl: 'https://a.com',
        destinationUrl: 'http://a.com'
      }),
      emptyPolicy
    );
    expect(f.isHttpDowngrade).toBe(true);
  });

  it('detects punycode', () => {
    const f = extractFeatures(
      makeIntent({ destinationUrl: 'https://xn--faceb-9qa.com' }),
      emptyPolicy
    );
    expect(f.isPunycode).toBe(true);
  });
});

describe('scoreRisk', () => {
  it('blocklist → 100', () => {
    const f = extractFeatures(
      makeIntent({ destinationUrl: 'https://x.com' }),
      { allowlist: new Set(), blocklist: new Set(['https://x.com']) }
    );
    expect(scoreRisk(f)).toBe(100);
  });

  it('safe same-origin → low score', () => {
    const f = extractFeatures(
      makeIntent({
        sourceUrl: 'https://a.com/x',
        destinationUrl: 'https://a.com/y'
      }),
      emptyPolicy
    );
    expect(scoreRisk(f)).toBeLessThan(20);
  });
});
