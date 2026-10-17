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

  if (anchor.hasAttribute('download')) return;
  if (anchor.target && anchor.target !== '_self') return;

  const hrefProp = anchor.href;
  if (!hrefProp) return;
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

  e.preventDefault();
  e.stopImmediatePropagation();

  chrome.runtime.sendMessage(
    { type: 'NAV_INTENT', payload: intent } as Message,
    (response: any) => {
      if (response?.allow === 'immediate') {
        window.location.href = intent.destinationUrl;
      }
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
      console.log(`[NavGuard] Bạn đã chọn: ${choice.toUpperCase()}`);
      
      chrome.runtime.sendMessage({
        type: choice === 'allow' ? 'ALLOW_ONCE' : 'BLOCK',
        payload: { intent, decision }
      } as Message, (response) => {
        if (choice === 'allow' && response?.ok) {
          // Background đã lo việc mở tab mới cho WINDOW_OPEN
          // Content Script chỉ chuyển trang đối với click link thông thường
          if (intent.hookType !== 'WINDOW_OPEN') {
            window.location.href = intent.destinationUrl;
          }
        }
      });
    });
    return;
  }

  if (msg.type === 'EXECUTE_NAVIGATION') {
    // Background yêu cầu chuyển trang (Dự phòng)
    const intent = msg.intent as NavIntent;
    if (intent.hookType === 'WINDOW_OPEN') {
      window.open(intent.destinationUrl, '_blank');
    } else {
      window.location.href = intent.destinationUrl;
    }
    return;
  }
});

// ===== Nhận message từ injected script =====
window.addEventListener('message', (e) => {
  if (e.source !== window || !e.data?.__ext) return;

  if (e.data.type === 'HOOK_WINDOW_OPEN') {
    const intent: NavIntent = {
      sourceUrl: location.href,
      destinationUrl: e.data.data.url,
      isTrusted: false,
      hasUserGesture: navigator.userActivation?.isActive ?? false,
      overlaySuspicious: false,
      inIframe: window.top !== window.self,
      iframeSrc: window.top !== window.self ? getFrameAncestorOrigin() : undefined,
      hookType: 'WINDOW_OPEN',
      timestamp: Date.now()
    };
    chrome.runtime.sendMessage({ type: 'NAV_INTENT', payload: intent } as Message);
    return;
  }

  const msg = {
    type: e.data.type,
    payload: e.data.data,
    sourceUrl: location.href
  } as Message;
  chrome.runtime.sendMessage(msg);
});
