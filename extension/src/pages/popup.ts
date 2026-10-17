import type { LogEntry } from '../background/storage';

const LOG_KEY = 'logs';
const ALLOW_KEY = 'allowlist';
const BLOCK_KEY = 'blocklist';

document.querySelectorAll<HTMLButtonElement>('nav button').forEach((btn) => {
  btn.addEventListener('click', () => {
    document
      .querySelectorAll('nav button')
      .forEach((b) => b.classList.remove('active'));
    document
      .querySelectorAll('.tab')
      .forEach((t) => t.classList.remove('active'));
    btn.classList.add('active');
    const tabId = `tab-${btn.dataset.tab}`;
    document.getElementById(tabId)?.classList.add('active');
  });
});

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!)
  );
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = Date.now();
  const diff = now - ts;
  if (diff < 60_000) return 'vừa xong';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)} phút trước`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)} giờ trước`;
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

async function loadStatus() {
  const data = await chrome.storage.local.get([ALLOW_KEY, BLOCK_KEY, LOG_KEY]);
  const allowCount = Object.keys(data[ALLOW_KEY] || {}).length;
  const blockCount = Object.keys(data[BLOCK_KEY] || {}).length;
  const logCount = (data[LOG_KEY] || []).length;
  document.getElementById('status')!.textContent =
    `${logCount} log · ${allowCount} allow · ${blockCount} block`;
}

async function loadLogs() {
  const data = await chrome.storage.local.get(LOG_KEY);
  const logs = (data[LOG_KEY] || []) as LogEntry[];
  const el = document.getElementById('tab-log')!;

  if (logs.length === 0) {
    el.innerHTML = '<div class="empty">Chưa có log nào</div>';
    return;
  }

  el.innerHTML = logs
    .slice(0, 100)
    .map((l) => {
      const choiceClass =
        l.userChoice === 'allow'
          ? 'allow'
          : l.userChoice === 'block'
          ? 'block'
          : 'pending';
      const choiceLabel =
        l.userChoice === 'allow'
          ? 'Đã cho phép'
          : l.userChoice === 'block'
          ? 'Đã chặn'
          : 'Chờ xử lý';
      const reason = l.reason.join(' • ') || '(không có lý do)';
      return `
        <div class="log-item level-${l.level}">
          <div class="meta">
            <span class="level-badge lv-${l.level}">Mức ${l.level}</span>
            <span class="time">${formatTime(l.timestamp)}</span>
          </div>
          <div class="url">${escapeHtml(l.destinationUrl)}</div>
          <div class="meta">
            <span>${escapeHtml(reason)}</span>
            <span class="choice ${choiceClass}">${choiceLabel}</span>
          </div>
        </div>
      `;
    })
    .join('');
}

async function loadAllowlist() {
  const data = await chrome.storage.local.get(ALLOW_KEY);
  const list = (data[ALLOW_KEY] || {}) as Record<
    string,
    { addedAt: number; reason: string }
  >;
  const el = document.getElementById('tab-allow')!;
  const entries = Object.entries(list);

  if (entries.length === 0) {
    el.innerHTML = '<div class="empty">Chưa có domain nào được cho phép</div>';
    return;
  }

  el.innerHTML = entries
    .sort((a, b) => b[1].addedAt - a[1].addedAt)
    .map(
      ([origin, info]) => `
      <div class="list-item">
        <div style="flex:1; min-width:0">
          <div class="domain">${escapeHtml(origin)}</div>
          <div class="meta">${formatTime(info.addedAt)} · ${escapeHtml(info.reason)}</div>
        </div>
        <button data-remove="${escapeHtml(origin)}" data-key="${ALLOW_KEY}">Xóa</button>
      </div>
    `
    )
    .join('');

  bindRemoveButtons(el);
}

async function loadBlocklist() {
  const data = await chrome.storage.local.get(BLOCK_KEY);
  const list = (data[BLOCK_KEY] || {}) as Record<
    string,
    { addedAt: number; reason: string }
  >;
  const el = document.getElementById('tab-block')!;
  const entries = Object.entries(list);

  if (entries.length === 0) {
    el.innerHTML = '<div class="empty">Chưa có domain nào bị chặn</div>';
    return;
  }

  el.innerHTML = entries
    .sort((a, b) => b[1].addedAt - a[1].addedAt)
    .map(
      ([origin, info]) => `
      <div class="list-item">
        <div style="flex:1; min-width:0">
          <div class="domain">${escapeHtml(origin)}</div>
          <div class="meta">${formatTime(info.addedAt)} · ${escapeHtml(info.reason)}</div>
        </div>
        <button data-remove="${escapeHtml(origin)}" data-key="${BLOCK_KEY}">Xóa</button>
      </div>
    `
    )
    .join('');

  bindRemoveButtons(el);
}

function bindRemoveButtons(container: HTMLElement) {
  container.querySelectorAll<HTMLButtonElement>('button[data-remove]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const domain = btn.dataset.remove!;
      const key = btn.dataset.key!;
      const data = await chrome.storage.local.get(key);
      const list = data[key] || {};
      delete list[domain];
      await chrome.storage.local.set({ [key]: list });

      if (key === ALLOW_KEY) await loadAllowlist();
      if (key === BLOCK_KEY) await loadBlocklist();
      await loadStatus();
    });
  });
}

document.getElementById('clear-logs')!.addEventListener('click', async () => {
  if (!confirm('Xóa toàn bộ log?')) return;
  await chrome.storage.local.set({ [LOG_KEY]: [] });
  await loadLogs();
  await loadStatus();
});

document.getElementById('clear-all')!.addEventListener('click', async () => {
  if (!confirm('Reset tất cả log, allowlist, blocklist và phiên làm việc?')) return;
  await chrome.runtime.sendMessage({ type: 'RESET_ALL' });
  await loadLogs();
  await loadAllowlist();
  await loadBlocklist();
  await loadStatus();
});

async function init() {
  await loadStatus();
  await loadLogs();
  await loadAllowlist();
  await loadBlocklist();
}

init();
