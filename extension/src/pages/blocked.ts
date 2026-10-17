import type { Decision, NavIntent } from '../shared/types';

const params = new URLSearchParams(location.search);
const id = params.get('id');

let intent: NavIntent | null = null;
let decision: Decision | null = null;

async function init() {
  if (!id) {
    (document.getElementById('destination') as HTMLElement).textContent =
      '(không có dữ liệu)';
    return;
  }

  const data = await chrome.storage.session.get([`block_${id}`]);
  const payload = data[`block_${id}`] as
    | { intent: NavIntent; decision: Decision }
    | undefined;

  if (!payload) {
    (document.getElementById('destination') as HTMLElement).textContent =
      '(dữ liệu đã hết hạn)';
    return;
  }

  intent = payload.intent;
  decision = payload.decision;

  // Source line
  try {
    const srcHost = new URL(intent.sourceUrl).hostname;
    (document.getElementById('source-line') as HTMLElement).innerHTML =
      `<strong>${escapeHtml(srcHost)}</strong> đang cố chuyển bạn đến:`;
  } catch {
    /* ignore */
  }

  // Destination
  const destEl = document.getElementById('destination') as HTMLElement;
  if (intent.destinationUrl === intent.sourceUrl) {
    destEl.textContent = '(không rõ đích đến — script ẩn đã cố chuyển hướng)';
  } else {
    destEl.textContent = intent.destinationUrl;
  }

  // Reasons
  const reasonsEl = document.getElementById('reasons') as HTMLElement;
  if (decision.reason.length > 0) {
    for (const r of decision.reason) {
      const li = document.createElement('li');
      li.textContent = r;
      reasonsEl.appendChild(li);
    }
  } else {
    const li = document.createElement('li');
    li.textContent = 'Chuyển hướng có dấu hiệu không an toàn';
    reasonsEl.appendChild(li);
  }
}

// Nút "Quay lại an toàn"
document.getElementById('back')!.addEventListener('click', () => {
  if (history.length > 1) {
    history.back();
  } else {
    location.href = 'about:blank';
  }
});

// Countdown + proceed
const proceedBtn = document.getElementById('proceed') as HTMLButtonElement;
const check = document.getElementById('confirm-check') as HTMLInputElement;

let countdown = 3;
proceedBtn.textContent = `Tôi hiểu rủi ro, vẫn tiếp tục (${countdown}s)`;

const timer = setInterval(() => {
  countdown--;
  if (countdown <= 0) {
    clearInterval(timer);
    proceedBtn.disabled = false;
    proceedBtn.textContent = 'Tôi hiểu rủi ro, vẫn tiếp tục';
  } else {
    proceedBtn.textContent = `Tôi hiểu rủi ro, vẫn tiếp tục (${countdown}s)`;
  }
}, 1000);

proceedBtn.addEventListener('click', async () => {
  if (!check.checked) return;
  if (!intent || !id) return;

  // Xóa khỏi session
  await chrome.storage.session.remove([`block_${id}`]);

  // Yêu cầu background thực thi navigation
  chrome.runtime.sendMessage({
    type: 'ALLOW_FROM_INTERSTITIAL',
    payload: { intent }
  });

  // Feedback tạm
  proceedBtn.textContent = 'Đang chuyển hướng...';
  proceedBtn.disabled = true;
});

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!)
  );
}

init();
