(function () {
  const post = (type, data) =>
    window.postMessage({ __ext: true, type, data }, '*');

  // Hook window.open
  const origOpen = window.open;
  window.open = function (url, target, features) {
    try {
      post('HOOK_WINDOW_OPEN', { url: String(url), target, features });
    } catch (e) {}
    return origOpen.apply(this, arguments);
  };

  // Hook history API
  const origPush = history.pushState;
  const origReplace = history.replaceState;
  history.pushState = function (state, title, url) {
    post('HOOK_PUSH_STATE', { url: url ? String(url) : undefined });
    return origPush.apply(this, arguments);
  };
  history.replaceState = function (state, title, url) {
    post('HOOK_REPLACE_STATE', { url: url ? String(url) : undefined });
    return origReplace.apply(this, arguments);
  };

  // Meta refresh observer
  const observer = new MutationObserver(function (muts) {
    for (const m of muts) {
      for (const node of m.addedNodes) {
        if (
          node.nodeName === 'META' &&
          node.httpEquiv &&
          node.httpEquiv.toLowerCase() === 'refresh'
        ) {
          post('HOOK_META_REFRESH', { content: node.content });
        }
      }
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  // Hook location.assign/replace qua prototype
  try {
    const locProto = Object.getPrototypeOf(location);
    const origAssign = locProto.assign;
    const origReplaceLoc = locProto.replace;
    locProto.assign = function (url) {
      post('HOOK_LOCATION_ASSIGN', { url: String(url) });
      return origAssign.call(this, url);
    };
    locProto.replace = function (url) {
      post('HOOK_LOCATION_REPLACE', { url: String(url) });
      return origReplaceLoc.call(this, url);
    };
  } catch (e) {}
})();
