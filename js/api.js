/**
 * api.js: every call to the Apps Script backend goes through Api.call().
 *
 * Requests are POSTed as text/plain JSON (no CORS preflight) to APP_CONFIG.apiUrl.
 * Errors come back as ApiError with a code, shown to the user as "message (CODE)".
 * Codes made here in the app (not by the server):
 *   E-CFG-01  apiUrl in config.js is not set
 *   E-NET-01  no connection to the server
 *   E-NET-02  the server took too long
 *   E-NET-03  the server answered with something that is not the app's JSON (wrong URL or deployment access)
 */
const Api = (() => {
  const TOKEN_KEY = 'doctrack.token';

  class ApiError extends Error {
    constructor(code, message, ref) { super(message); this.code = code; this.ref = ref || ''; }
    toString() { return this.message + ' (' + this.code + ')'; }
  }

  // localStorage can be blocked (private mode); the app still works, the login just isn't remembered.
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) { /* ignore */ } }
  };

  let token = store.get(TOKEN_KEY);
  const listeners = [];

  function device() {
    const ua = navigator.userAgent;
    const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac/.test(ua) ? 'Mac' : 'Other';
    const br = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : /Firefox\//.test(ua) ? 'Firefox' : 'Browser';
    const installed = window.matchMedia && matchMedia('(display-mode: standalone)').matches ? ' app' : '';
    return os + ' ' + br + installed + (navigator.maxTouchPoints > 0 ? ' touch' : '');
  }

  async function call(action, body) {
    const url = (window.APP_CONFIG || {}).apiUrl || '';
    if (!/^https?:\/\/.+\/exec$/.test(url)) {
      throw new ApiError('E-CFG-01', 'The app is not connected to the database yet. ICTU must set apiUrl in config.js.');
    }
    const payload = Object.assign({}, body || {}, { action: action, token: token || '', device: device() });
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ((window.APP_CONFIG.requestTimeoutSeconds) || 30) * 1000);
    let res;
    try {
      res = await fetch(url, { method: 'POST', body: JSON.stringify(payload), redirect: 'follow', signal: ctrl.signal,
        headers: { 'Content-Type': 'text/plain;charset=utf-8' } });
    } catch (e) {
      if (e.name === 'AbortError') throw new ApiError('E-NET-02', 'The server took too long to answer. Please try again.');
      throw new ApiError('E-NET-01', navigator.onLine === false
        ? 'You are offline. Check the Wi-Fi or mobile data, then try again.'
        : 'Cannot reach the server. Check your internet connection, then try again. If the internet works, please tell ICTU.');
    } finally { clearTimeout(timer); }

    let data;
    try { data = await res.json(); }
    catch (e) { throw new ApiError('E-NET-03', 'The server gave an unexpected answer. ICTU: check the apiUrl and that the deployment access is "Anyone".'); }

    if (!data.ok) {
      if (data.code === 'E-AUTH-04') { setToken(null); listeners.forEach(fn => fn('session-ended')); }
      if (data.code === 'E-AUTH-07') listeners.forEach(fn => fn('must-change'));
      throw new ApiError(data.code || 'E-SYS-00', data.error || 'Unknown error.', data.ref);
    }
    return data;
  }

  function setToken(t) { token = t; store.set(TOKEN_KEY, t); }

  return {
    call, ApiError, device, store,
    setToken, hasToken: () => !!token,
    onEvent: fn => listeners.push(fn)
  };
})();
