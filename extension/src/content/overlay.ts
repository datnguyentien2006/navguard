
export function isSuspiciousOverlay(el: Element | null): boolean {
  if (!el) return false;

  const tag = el.tagName.toLowerCase();
  if (tag === 'html' || tag === 'body' || tag === 'main') return false;

  const style = getComputedStyle(el);
  const opacity = parseFloat(style.opacity);

  const bg = style.backgroundColor || '';
  const bgTransparent =
    bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent' || bg === '';
  const hasBgImage = style.backgroundImage && style.backgroundImage !== 'none';

  const isTransparent = opacity < 0.15 || bgTransparent;

  const hasNoContent =
    (el.textContent?.trim() ?? '') === '' &&
    !el.querySelector('img, svg, video, button, input, a');

  const rect = el.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const coversViewport = rect.width >= vw * 0.8 && rect.height >= vh * 0.8;

  const position = style.position;
  const zIndex = parseInt(style.zIndex, 10) || 0;
  const isPositioned = position === 'fixed' || position === 'absolute';
  const hasHighZ = zIndex >= 100;

  const pointerEvents = style.pointerEvents;
  const capturesPointer = pointerEvents !== 'none';

  return (
    isTransparent &&
    hasNoContent &&
    !hasBgImage &&
    coversViewport &&
    isPositioned &&
    hasHighZ &&
    capturesPointer
  );
}

export function detectOverlay(
  topEl: Element | null,
  clickedEl: Element
): boolean {
  if (!topEl) return false;

  // Trường hợp 1: element trên cùng khác element được click (có gì chắn)
  if (
    topEl !== clickedEl &&
    !topEl.contains(clickedEl) &&
    !clickedEl.contains(topEl)
  ) {
    if (isSuspiciousOverlay(topEl)) return true;
  }

  // Trường hợp 2: chính element được click là overlay
  if (isSuspiciousOverlay(clickedEl)) return true;

  return false;
}

export function getFrameAncestorOrigin(): string | undefined {
  try {
    return window.top?.location.origin;
  } catch {
    return undefined;
  }
}
