import { decideLevel, type Policy } from './decision';
import { getReputation } from './reputation';
import {
  getAllowlist,
  getBlocklist,
  addToAllowlist,
  addToBlocklist,
  logNavigation,
  updateLastLogChoice,
  originOf
} from './storage';
import type { Message, NavIntent, Decision } from '../shared/types';

console.log('[NavGuard] Background service worker started');

// Policy cache (refresh khi storage thay đổi)
const policy: Policy = {
  allowlist: new Set<string>(),
  blocklist: new Set<string>()
};

async function refreshPolicy() {
  policy.allowlist = await getAllowlist();
  policy.blocklist = await getBlocklist();
  console.log(
    '[NavGuard] Policy refreshed:',
    'allowlist =',
    policy.allowlist.size,
    'blocklist =',
    policy.blocklist.size
  );
}

// Khởi động: load policy
refreshPolicy();

// Nghe storage thay đổi để refresh
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.allowlist || changes.blocklist) {
    refreshPolicy();
  }
});

chrome.runtime.onInstalled.addListener(() => {
  console.log('[NavGuard] Installed');
  refreshPolicy();
});

chrome.runtime.onStartup.addListener(() => {
  console.log('[NavGuard] Startup');
  refreshPolicy();
});

chrome.runtime.onMessage.addListener((msg: Message, sender, sendResponse) => {
  if (msg.type === 'NAV_INTENT') {
    handleNavIntent(msg.payload, sender.tab?.id).then(sendResponse);
    return true;
  }

  if (msg.type === 'ALLOW_ONCE') {
    handleAllowOnce(msg.payload.intent, sender.tab?.id);
    sendResponse({ ok: true });
    return false;
  }

  if (msg.type === 'ALLOW_FROM_INTERSTITIAL') {
    handleAllowFromInterstitial(msg.payload.intent, sender.tab?.id);
    sendResponse({ ok: true });
    return false;
  }

  if (msg.type === 'BLOCK') {
    handleBlock(msg.payload.intent, msg.payload.decision);
    sendResponse({ ok: true });
    return false;
  }

  if (
    msg.type === 'HOOK_WINDOW_OPEN' ||
    msg.type === 'HOOK_PUSH_STATE' ||
    msg.type === 'HOOK_REPLACE_STATE' ||
    msg.type === 'HOOK_META_REFRESH' ||
    msg.type === 'HOOK_LOCATION_ASSIGN' ||
    msg.type === 'HOOK_LOCATION_REPLACE'
  ) {
    console.log('[NavGuard] Hook:', msg.type, msg);
    return false;
  }

  return false;
});

async function handleNavIntent(
  intent: NavIntent,
  tabId?: number
): Promise<{ allow: 'immediate' | 'pending' }> {
  if (tabId) intent.tabId = tabId;

  const decision = await decideLevel({
    intent,
    policy,
    getReputation
  });

  // Ghi log mọi decision (trừ level 0 để tránh spam)
  if (decision.level > 0) {
    await logNavigation(intent, decision);
  }

  console.log('[NavGuard] Decision:', {
    level: decision.level,
    action: decision.action,
    reason: decision.reason,
    dest: intent.destinationUrl
  });

  if (decision.level === 0) {
    return { allow: 'immediate' };
  }

  if (!tabId) {
    return { allow: 'pending' };
  }

  if (decision.level === 1 || decision.level === 2) {
    chrome.tabs.sendMessage(tabId, {
      type: 'SHOW_TOAST',
      decision,
      intent
    });
    return { allow: 'pending' };
  }

  if (decision.level === 3) {
    const id = crypto.randomUUID();
    await chrome.storage.session.set({
      [`block_${id}`]: { intent, decision }
    });

    const url = chrome.runtime.getURL(`blocked.html?id=${id}`);
    chrome.tabs.update(tabId, { url });
    return { allow: 'pending' };
  }

  return { allow: 'pending' };
}

async function handleAllowOnce(intent: NavIntent, tabId?: number) {
  console.log('[NavGuard] ALLOW_ONCE:', intent.destinationUrl);

  const origin = originOf(intent.destinationUrl);
  if (origin) {
    await addToAllowlist(origin, 'user-click-allow');
    await refreshPolicy();
  }
  await updateLastLogChoice(intent.destinationUrl, 'allow');

  if (!tabId) return;
  chrome.tabs.update(tabId, { url: intent.destinationUrl });
}

async function handleAllowFromInterstitial(intent: NavIntent, tabId?: number) {
  console.log('[NavGuard] ALLOW_FROM_INTERSTITIAL:', intent.destinationUrl);

  const origin = originOf(intent.destinationUrl);
  if (origin) {
    await addToAllowlist(origin, 'user-interstitial-allow');
    await refreshPolicy();
  }
  await updateLastLogChoice(intent.destinationUrl, 'allow');

  if (!tabId) return;
  chrome.tabs.update(tabId, { url: intent.destinationUrl });
}

async function handleBlock(intent: NavIntent, decision: Decision) {
  console.log('[NavGuard] BLOCK:', intent.destinationUrl, decision.level);

  const origin = originOf(intent.destinationUrl);
  if (origin) {
    await addToBlocklist(origin, 'user-click-block');
    await refreshPolicy();
  }
  await updateLastLogChoice(intent.destinationUrl, 'block');
}
