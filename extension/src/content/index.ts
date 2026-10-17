import { detectOverlay, getFrameAncestorOrigin } from './overlay';
import { renderToast } from './toast';
import type { Message, NavIntent, Decision } from '../shared/types';

console.log('[NavGuard] Content script loaded on', location.href);

// ===== Inject script vào main world =====
function injectMainWorldScript() {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('injected.js');
  script.onload = () => script.remove();
  (document.head || document.documentElement).appendChild(script);
}
injectMainWorldScript();

// ===== Bắt click =====
function onCaptureClick(e: MouseEvent) {
  const target = e.target as Element | null;
  if (!target) return;

  const topEl = document.elementFromPoint(e.clientX, e.clientY);
  const overlaySuspicious = topEl ? detectOverlay(topEl, target) : false;

  const anchor = target.closest?.('a[href]') as HTMLAnchorElement | null;

  // Không phải anchor: chỉ chặn nếu overlay suspicious
  if (!anchor) {
    if (overlaySuspicious && e.isTrusted) {
      e.preventDefault();
      e.stopImmediatePropagation();

      const intent: NavIntent = {
        sourceUrl: location.href,
        destinationUrl: location.href,
        isTrusted: e.isTrusted,
        hasUserGesture: navigator.userActivation?.isActive ?? true,
        overlaySuspicious: true,
        inIframe: window.top !== window.self,
        iframeSrc: window.top !== window.self ? getFrameAncestorOrigin() : undefined,
        hookType: 'CLICK',
        timestamp: Date.now()
      };
      chrome.runtime.sendMessage({ type: 'NAV_INTENT', payload: intent } as Message);
    }
    return;
  }

  // Bỏ qua anchor có download, hoặc target=_blank (để browser xử lý)
  if (anchor.hasAttribute('download')) return;
  if (anchor.target && anchor.target !== '_self') return;

  const hrefProp = anchor.href;
  if (!hrefProp) return;

  // Chỉ bỏ qua URL javascript:, mailto:, tel: — không phải navigation web
  if (/^(javascript|mailto|tel):/i.test(hrefProp)) return;

  const isTrusted = e.isTrusted;
  const hasUserGesture = navigator.userActivation?.isActive ?? true;

  const hrefAttr = anchor.getAttribute('href') ?? undefined;
  const inIframe = window.top !== window.self;
  const iframeSrc = inIframe ? getFrameAncestorOrigin() : undefined;

  const intent: NavIntent = {
    sourceUrl: location.href,
    destinationUrl: hrefProp,
    hrefAttr,
    target: anchor.target,
    isTrusted,
    hasUserGesture,
    overlaySuspicious,
    inIframe,
    iframeSrc,
    hookType: 'CLICK',
    timestamp: Date.now()
  };

  // Chặn navigation ngay để chờ decision
  e.preventDefault();
  e.stopImmediatePropagation();

  chrome.runtime.sendMessage(
    { type: 'NAV_INTENT', payload: intent } as Message,
    (response: any) => {
      // Background trả về "immediate" nghĩa là level 0 → tự navigate
      if (response?.allow === 'immediate') {
        window.location.href = intent.destinationUrl;
      }
      // Các trường hợp khác: background sẽ gửi SHOW_TOAST hoặc redirect interstitial
    }
  );
}

document.addEventListener('click', onCaptureClick, true);

// ===== Nhận message từ background =====
chrome.runtime.onMessage.addListener((msg: any) => {
  if (msg.type === 'SHOW_TOAST') {
    const decision = msg.decision as Decision;
    const intent = msg.intent as NavIntent;

    renderToast(decision, intent, (choice) => {
      chrome.runtime.sendMessage({
        type: choice === 'allow' ? 'ALLOW_ONCE' : 'BLOCK',
        payload: { intent, decision }
      } as Message);
    });
    return;
  }

  if (msg.type === 'BLOCKED_ACK') {
    // Không cần xử lý gì — toast đã hiện
    return;
  }
});

// ===== Nhận message từ injected script =====
window.addEventListener('message', (e) => {
  if (e.source !== window || !e.data?.__ext) return;
  const msg = {
    type: e.data.type,
    payload: e.data.data,
    sourceUrl: location.href
  } as Message;
  chrome.runtime.sendMessage(msg);
});
