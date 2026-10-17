import type { Decision, NavIntent } from '../shared/types';
import { escapeHtml } from '../shared/utils';

const TOAST_CSS = `
  :host { all: initial; }
  .toast {
    position: fixed;
    top: 16px;
    right: 16px;
    z-index: 2147483647;
    max-width: 420px;
    padding: 14px 16px;
    border-radius: 10px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.18);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 14px;
    display: flex;
    gap: 12px;
    align-items: flex-start;
    animation: navguard-slideIn 0.2s ease-out;
  }
  @keyframes navguard-slideIn {
    from { transform: translateX(20px); opacity: 0; }
    to   { transform: translateX(0);    opacity: 1; }
  }
  .toast.info { background: #ffffff; color: #1a1a1a; border-left: 4px solid #3b82f6; }
  .toast.warn { background: #fef2f2; color: #7f1d1d; border-left: 4px solid #dc2626; }
  .icon { font-size: 20px; line-height: 1; flex-shrink: 0; }
  .content { flex: 1; min-width: 0; }
  .title { font-weight: 600; margin-bottom: 4px; word-break: break-word; }
  .reasons { margin: 6px 0 0; padding-left: 18px; font-size: 12px; }
  .reasons li { margin-bottom: 2px; }
  .actions { display: flex; gap: 8px; margin-top: 10px; }
  button {
    padding: 6px 12px; border-radius: 6px; border: none; cursor: pointer;
    font-size: 13px; font-weight: 500; font-family: inherit;
  }
  .primary   { background: #2563eb; color: white; }
  .secondary { background: transparent; color: inherit; border: 1px solid currentColor; }
  .primary:hover   { background: #1d4ed8; }
  .secondary:hover { background: rgba(0,0,0,0.05); }
`;

export function renderToast(
  decision: Decision,
  intent: NavIntent,
  onChoice: (choice: 'allow' | 'block') => void
): void {
  const existing = document.getElementById('navguard-toast-host');
  if (existing) existing.remove();

  const host = document.createElement('div');
  host.id = 'navguard-toast-host';
  document.documentElement.appendChild(host);
  const shadow = host.attachShadow({ mode: 'closed' });

  const isWarn = decision.level === 2;
  const levelClass = isWarn ? 'warn' : 'info';
  const icon = isWarn ? '⚠️' : 'ℹ️';
  const hostname = safeHostname(intent.destinationUrl);

  const allowBtnClass = isWarn ? 'secondary' : 'primary';
  const blockBtnClass = isWarn ? 'primary' : 'secondary';

  const reasonsHtml =
    isWarn && decision.reason.length > 0
      ? `<ul class="reasons">${decision.reason
          .map((r) => `<li>${escapeHtml(r)}</li>`)
          .join('')}</ul>`
      : '';

  shadow.innerHTML = `
    <style>${TOAST_CSS}</style>
    <div class="toast ${levelClass}">
      <div class="icon">${icon}</div>
      <div class="content">
        <div class="title">Trang này muốn mở <strong>${escapeHtml(hostname)}</strong></div>
        ${reasonsHtml}
        <div class="actions">
          <button class="allow ${allowBtnClass}">Cho phép</button>
          <button class="block ${blockBtnClass}">Chặn</button>
        </div>
      </div>
    </div>
  `;

  shadow.querySelector('.allow')!.addEventListener('click', () => {
    onChoice('allow');
    host.remove();
  });
  shadow.querySelector('.block')!.addEventListener('click', () => {
    onChoice('block');
    host.remove();
  });

  if (!isWarn) {
    setTimeout(() => host.remove(), 5000);
  }
}

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
