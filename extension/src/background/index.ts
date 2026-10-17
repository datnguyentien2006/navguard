import { decideLevel, type Policy } from './decision';
import { getReputation } from './reputation';
import { getAllowlist, getBlocklist, addToBlocklist } from './storage';
import type { Message, NavIntent } from '../shared/types';

console.log('[NavGuard] Background service worker started');

const policy: Policy = {
  allowlist: new Set<string>(),
  blocklist: new Set<string>(),
  sessionAllowlist: new Set<string>()
};

async function refreshPolicy() {
  policy.allowlist = await getAllowlist();
  policy.blocklist = await getBlocklist();
}
refreshPolicy();

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (changes.allowlist || changes.blocklist)) refreshPolicy();
});

// Xóa session khi đóng tab
chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.session.remove(`allow_tab_${tabId}`);
});

// Xóa session khi reload trang
chrome.webNavigation.onCommitted.addListener((details) => {
  if (details.frameId === 0 && details.transitionType === 'reload') {
    chrome.storage.session.remove(`allow_tab_${details.tabId}`);
  }
});

chrome.runtime.onMessage.addListener((msg: Message, sender, sendResponse) => {
  if (msg.type === 'NAV_INTENT') {
    handleNavIntent(msg.payload, sender.tab?.id).then(sendResponse);
    return true;
  }
  if (msg.type === 'ALLOW_ONCE') {
    handleAllowOnce(msg.payload.intent, sender.tab?.id).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg.type === 'BLOCK') {
    handleBlock(msg.payload.intent).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg.type === 'RESET_ALL') {
    chrome.storage.local.clear();
    chrome.storage.session.clear();
    refreshPolicy().then(() => sendResponse({ ok: true }));
    return true;
  }
  return false;
});

async function handleNavIntent(intent: NavIntent, tabId?: number): Promise<{ allow: 'immediate' | 'pending' | 'blocked_silent' }> {
  if (tabId) intent.tabId = tabId;

  // CHẶN IM LẶNG: Kiểm tra blocklist ngay lập tức trên RAM (tránh race condition)
  try {
    const dst = new URL(intent.destinationUrl);
    const noWww = dst.origin.replace('://www.', '://');
    const withWww = dst.origin.replace('://', '://www.');
    if (policy.blocklist.has(dst.origin) || policy.blocklist.has(noWww) || policy.blocklist.has(withWww)) {
      return { allow: 'blocked_silent' };
    }
  } catch (e) {}

  // Lấy danh sách cho phép tạm thời của riêng tab này
  let tabAllow = new Set<string>();
  if (tabId) {
    const data = await chrome.storage.session.get(`allow_tab_${tabId}`);
    if (data[`allow_tab_${tabId}`]) tabAllow = new Set(data[`allow_tab_${tabId}`]);
  }

  const currentPolicy = { ...policy, sessionAllowlist: tabAllow };
  const decision = await decideLevel({ intent, policy: currentPolicy, getReputation });

  console.log('[NavGuard] Decision:', { level: decision.level, reason: decision.reason, dest: intent.destinationUrl });

  // TH1: Chặn im lặng
  if (decision.level === 0 && decision.reason.includes('blocklisted')) {
     return { allow: 'blocked_silent' };
  }
  if (decision.level === 0) return { allow: 'immediate' };
  if (!tabId) return { allow: 'pending' };

  if (decision.level === 1 || decision.level === 2) {
    chrome.tabs.sendMessage(tabId, { type: 'SHOW_TOAST', decision, intent });
    return { allow: 'pending' };
  }

  if (decision.level === 3) {
    const id = crypto.randomUUID();
    await chrome.storage.session.set({ [`block_${id}`]: { intent, decision } });
    chrome.tabs.update(tabId, { url: chrome.runtime.getURL(`blocked.html?id=${id}`) });
    return { allow: 'pending' };
  }
  return { allow: 'pending' };
}

async function handleAllowOnce(intent: NavIntent, tabId?: number) {
  const origin = new URL(intent.destinationUrl).origin;
  if (tabId) {
    const key = `allow_tab_${tabId}`;
    const data = await chrome.storage.session.get(key);
    const list = new Set(data[key] || []);
    list.add(origin);
    await chrome.storage.session.set({ [key]: Array.from(list) });
    
    // Mở tab mới nếu là quảng cáo popup
    if (intent.hookType === 'WINDOW_OPEN') {
      chrome.tabs.create({ url: intent.destinationUrl, openerTabId: tabId });
    }
  }
  console.log('[NavGuard] ALLOW_ONCE:', intent.destinationUrl);
}

async function handleBlock(intent: NavIntent) {
  const origin = new URL(intent.destinationUrl).origin;
  
  // Cập nhật ngay vào bộ nhớ RAM để chặn tức thì
  policy.blocklist.add(origin); 
  console.log('[NavGuard] Đã chặn tức thì (RAM):', origin);

  // Lưu vào ổ cứng
  await addToBlocklist(origin, 'user-click-block');
  await refreshPolicy();
}
