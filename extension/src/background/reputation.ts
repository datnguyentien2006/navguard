import type { Reputation } from '../shared/types';

const API_URL = 'http://localhost:3000/v1/reputation';
const TIMEOUT_MS = 800;

const cache = new Map<string, Reputation>();

export async function getReputation(url: string): Promise<Reputation> {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return { level: 'unknown', score: 50, reasons: [], source: 'local' };
  }

  const cached = cache.get(host);
  if (cached) return cached;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls: [url] }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!res.ok) throw new Error(`API error: ${res.status}`);

    const data = await res.json();
    const apiResult = data.results?.[0];

    if (!apiResult) throw new Error('Empty API response');

    const rep: Reputation = {
      level: apiResult.level,
      score: apiResult.score,
      reasons: apiResult.reasons || [],
      source: 'api'
    };

    cache.set(host, rep);
    console.log('[NavGuard] Reputation API:', host, rep.level);
    return rep;

  } catch (err) {
    console.warn('[NavGuard] Reputation API failed, fallback to local:', (err as Error).message);
    
    // Fallback local nếu server chết
    const fallback: Reputation = {
      level: 'unknown',
      score: 50,
      reasons: [],
      source: 'local'
    };
    cache.set(host, fallback);
    return fallback;
  }
}
