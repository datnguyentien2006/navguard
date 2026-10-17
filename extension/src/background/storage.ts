import type { Decision, NavIntent } from '../shared/types';

const LOG_KEY = 'logs';
const ALLOW_KEY = 'allowlist';
const BLOCK_KEY = 'blocklist';
const SETTINGS_KEY = 'settings';

export type LogEntry = {
  id: string;
  timestamp: number;
  level: 0 | 1 | 2 | 3;
  action: string;
  sourceUrl: string;
  destinationUrl: string;
  reason: string[];
  userChoice: 'allow' | 'block' | 'pending';
};

export type AllowEntry = {
  addedAt: number;
  reason: string;
};

export type BlockEntry = {
  addedAt: number;
  reason: string;
};

const MAX_LOGS = 500;

// ===== Allowlist =====

export async function getAllowlist(): Promise<Set<string>> {
  const data = await chrome.storage.local.get(ALLOW_KEY);
  const list = (data[ALLOW_KEY] || {}) as Record<string, AllowEntry>;
  return new Set(Object.keys(list));
}

export async function addToAllowlist(origin: string, reason = 'user') {
  const data = await chrome.storage.local.get(ALLOW_KEY);
  const list = (data[ALLOW_KEY] || {}) as Record<string, AllowEntry>;
  list[origin] = { addedAt: Date.now(), reason };
  await chrome.storage.local.set({ [ALLOW_KEY]: list });
}

export async function removeFromAllowlist(origin: string) {
  const data = await chrome.storage.local.get(ALLOW_KEY);
  const list = (data[ALLOW_KEY] || {}) as Record<string, AllowEntry>;
  delete list[origin];
  await chrome.storage.local.set({ [ALLOW_KEY]: list });
}

export async function getAllowlistRaw(): Promise<Record<string, AllowEntry>> {
  const data = await chrome.storage.local.get(ALLOW_KEY);
  return (data[ALLOW_KEY] || {}) as Record<string, AllowEntry>;
}

// ===== Blocklist =====

export async function getBlocklist(): Promise<Set<string>> {
  const data = await chrome.storage.local.get(BLOCK_KEY);
  const list = (data[BLOCK_KEY] || {}) as Record<string, BlockEntry>;
  return new Set(Object.keys(list));
}

export async function addToBlocklist(origin: string, reason = 'user') {
  const data = await chrome.storage.local.get(BLOCK_KEY);
  const list = (data[BLOCK_KEY] || {}) as Record<string, BlockEntry>;
  list[origin] = { addedAt: Date.now(), reason };
  await chrome.storage.local.set({ [BLOCK_KEY]: list });
}

export async function removeFromBlocklist(origin: string) {
  const data = await chrome.storage.local.get(BLOCK_KEY);
  const list = (data[BLOCK_KEY] || {}) as Record<string, BlockEntry>;
  delete list[origin];
  await chrome.storage.local.set({ [BLOCK_KEY]: list });
}

export async function getBlocklistRaw(): Promise<Record<string, BlockEntry>> {
  const data = await chrome.storage.local.get(BLOCK_KEY);
  return (data[BLOCK_KEY] || {}) as Record<string, BlockEntry>;
}

// ===== Logs =====

export async function logNavigation(
  intent: NavIntent,
  decision: Decision,
  userChoice: LogEntry['userChoice'] = 'pending'
) {
  const data = await chrome.storage.local.get(LOG_KEY);
  const logs = (data[LOG_KEY] || []) as LogEntry[];

  logs.unshift({
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    level: decision.level,
    action: decision.action,
    sourceUrl: intent.sourceUrl,
    destinationUrl: intent.destinationUrl,
    reason: decision.reason,
    userChoice
  });

  await chrome.storage.local.set({ [LOG_KEY]: logs.slice(0, MAX_LOGS) });
}

export async function updateLastLogChoice(
  destinationUrl: string,
  userChoice: LogEntry['userChoice']
) {
  const data = await chrome.storage.local.get(LOG_KEY);
  const logs = (data[LOG_KEY] || []) as LogEntry[];

  // Cập nhật log mới nhất có cùng destinationUrl và userChoice='pending'
  for (const l of logs) {
    if (l.destinationUrl === destinationUrl && l.userChoice === 'pending') {
      l.userChoice = userChoice;
      break;
    }
  }

  await chrome.storage.local.set({ [LOG_KEY]: logs });
}

export async function getLogs(): Promise<LogEntry[]> {
  const data = await chrome.storage.local.get(LOG_KEY);
  return (data[LOG_KEY] || []) as LogEntry[];
}

export async function clearLogs() {
  await chrome.storage.local.set({ [LOG_KEY]: [] });
}

export async function pruneLogs(retentionDays = 30) {
  const data = await chrome.storage.local.get(LOG_KEY);
  const logs = (data[LOG_KEY] || []) as LogEntry[];
  const cutoff = Date.now() - retentionDays * 86400_000;
  await chrome.storage.local.set({
    [LOG_KEY]: logs.filter((l) => l.timestamp > cutoff)
  });
}

// ===== Settings =====

export type Settings = {
  enabled: boolean;
};

const DEFAULT_SETTINGS: Settings = {
  enabled: true
};

export async function getSettings(): Promise<Settings> {
  const data = await chrome.storage.local.get(SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS, ...(data[SETTINGS_KEY] || {}) };
}

export async function updateSettings(patch: Partial<Settings>) {
  const current = await getSettings();
  await chrome.storage.local.set({
    [SETTINGS_KEY]: { ...current, ...patch }
  });
}

// ===== Util =====

export function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}
