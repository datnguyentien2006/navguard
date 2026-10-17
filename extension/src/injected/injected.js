(function () {
  const post = (type, data) =>
    window.postMessage({ __ext: true, type, data }, '*');

  // 1. Chặn window.open
  const origOpen = window.open;
  window.open = function (url, target, features) {
    post('HOOK_WINDOW_OPEN', { url: String(url), target, features });
    return null; // Chặn không cho mở
  };

  // 2. Hook history (chỉ log, không chặn)
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

  // 3. Chặn location.assign và location.replace
  try {
    const locProto = Object.getPrototypeOf(location);
    locProto.assign = function (url) {
      post('HOOK_LOCATION_ASSIGN', { url: String(url) });
      return; // Chặn đứng
    };
    locProto.replace = function (url) {
      post('HOOK_LOCATION_REPLACE', { url: String(url) });
      return; // Chặn đứng
    };
  } catch (e) {}
})();
