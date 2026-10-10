/**
 * app.js: start-up, login screen, the app frame (top bar + menu) and the router.
 * Screens live in views.js; server calls in api.js.
 *
 * Routes (the part after # in the address):
 *   #/inbox  #/track  #/new  #/mine  #/reports  #/account  #/admin  #/doc/DT-2026-10-001
 */
const Icons = {
  inbox: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>',
  scan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><rect x="7" y="7" width="4" height="4"/><rect x="13" y="13" width="4" height="4"/><path d="M13 7h4v2M7 17v-4"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg>',
  folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 3v18h18"/><path d="M7 15v3M12 10v8M17 6v12"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  sign: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 17c3-3 5-9 7-9s-1 9 2 9 3-4 5-4 2 3 4 3"/><path d="M3 21h18"/></svg>',
  send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z"/></svg>',
  print: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>',
  qr: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3zM20 14v1M14 20h1M17 17h4v4h-4"/></svg>'
};

const App = (() => {
  const VERSION = '1.0.0';
  const cfgFile = window.APP_CONFIG;
  const root = () => document.getElementById('app');
  let installPrompt = null;

  const state = { VERSION, cfg: null, user: null };

  // ---------- start ----------
  async function start() {
    document.title = cfgFile.appName + ' | TRC Dulag';
    window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installPrompt = e; const b = document.querySelector('[data-install]'); if (b) b.classList.remove('hidden'); });
    if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
    Api.onEvent(ev => {
      if (ev === 'session-ended') { UI.toast('Your session ended. Please log in again.', true); showLogin(); }
      if (ev === 'must-change') showChangePassword();
    });
    window.addEventListener('hashchange', route);
    if (!Api.hasToken()) return showLogin();
    try { await refreshConfig(); startShell(); }
    catch (e) { if (e.code === 'E-AUTH-07') return; if (e.code !== 'E-AUTH-04') UI.error(e); showLogin(); }
  }

  async function refreshConfig() {
    const c = await Api.call('config');
    state.cfg = c; state.user = c.user;
    return c;
  }

  // ---------- login ----------
  function showLogin() {
    const r = root();
    r.innerHTML = '<div class="login" style="background-image:url(\'' + UI.esc(cfgFile.wallpaper) + '\')">' + loginHeader() +
      '<form class="login-card" data-login autocomplete="on">' +
      '<div class="login-brand"><h1>' + UI.esc(cfgFile.appName) + '</h1><p>Log in with the account ICTU gave you.</p></div>' +
      '<label class="f"><span>Username</span><input type="text" name="username" autocomplete="username" autocapitalize="off" spellcheck="false" required></label>' +
      '<label class="f"><span>Password</span><div class="pw-wrap"><input type="password" name="password" autocomplete="current-password" required>' +
      '<button type="button" data-show>Show</button></div></label>' +
      '<button class="btn big block" type="submit">Log in</button>' +
      '<button class="btn ghost block hidden" type="button" data-install>Install this app on this device</button>' +
      '<div class="login-foot"><span>Forgot your password? Ask ICTU.</span><a href="#" data-check>Connection check</a></div>' +
      '</form></div>';
    const f = r.querySelector('[data-login]');
    if (installPrompt) r.querySelector('[data-install]').classList.remove('hidden');
    r.querySelector('[data-install]').onclick = async () => { if (installPrompt) { installPrompt.prompt(); installPrompt = null; } };
    r.querySelector('[data-show]').onclick = e => { const i = f.password; i.type = i.type === 'password' ? 'text' : 'password'; e.target.textContent = i.type === 'password' ? 'Show' : 'Hide'; };
    r.querySelector('[data-check]').onclick = async e => {
      e.preventDefault();
      try { const p = await Api.call('ping'); UI.toast('Connected to ' + p.app + ' v' + p.version + '. Server time ' + p.time + '.'); }
      catch (err) { UI.error(err); }
    };
    f.onsubmit = e => {
      e.preventDefault();
      UI.busy(f.querySelector('[type=submit]'), async () => {
        const res = await Api.call('login', { username: f.username.value.trim(), password: f.password.value });
        Api.setToken(res.token);
        state.user = res.user;
        if (res.user.mustChange) return showChangePassword(f.password.value);
        await refreshConfig();
        if (!location.hash || location.hash === '#/' ) location.hash = '#/inbox';
        startShell();
      }).catch(UI.error);
    };
  }

  /** The office header over the dark login wallpaper, so the white version (see config.js). Phones only: CSS hides it on wide screens. */
  function loginHeader() {
    return '<img class="login-header" src="' + UI.esc(cfgFile.logos.headerWhite) + '" alt="' + UI.esc(cfgFile.orgName) + '">';
  }

  /** First login (temporary password) or after an ICTU reset: the user must pick their own password. */
  function showChangePassword(currentPw) {
    const r = root();
    r.innerHTML = '<div class="login" style="background-image:url(\'' + UI.esc(cfgFile.wallpaper) + '\')">' + loginHeader() + '<form class="login-card" data-f autocomplete="off">' +
      '<div class="login-brand"><h1>Set your password</h1>' +
      '<p>Welcome' + (state.user ? ', ' + UI.esc(state.user.name) : '') + '. Choose your own password to continue.</p></div>' +
      (currentPw ? '' : '<label class="f"><span>Temporary password</span><input type="password" name="oldPassword" autocomplete="current-password"></label>') +
      '<label class="f"><span>New password</span><input type="password" name="newPassword" autocomplete="new-password"><small>At least 8 characters, with letters and numbers. Do not use your username.</small></label>' +
      '<label class="f"><span>Repeat new password</span><input type="password" name="again" autocomplete="new-password"></label>' +
      '<button class="btn big block" type="submit">Save and continue</button>' +
      '<button class="btn ghost block" type="button" data-out>Cancel and log out</button></form></div>';
    const f = r.querySelector('[data-f]');
    r.querySelector('[data-out]').onclick = logout;
    f.onsubmit = e => {
      e.preventDefault();
      if (f.newPassword.value !== f.again.value) return UI.toast('The two new passwords do not match.', true);
      UI.busy(f.querySelector('[type=submit]'), async () => {
        await Api.call('changePassword', { oldPassword: currentPw || f.oldPassword.value, newPassword: f.newPassword.value });
        await refreshConfig();
        UI.toast('Password saved.');
        location.hash = '#/inbox';
        startShell();
      }).catch(UI.error);
    };
  }

  async function logout() {
    try { await Api.call('logout'); } catch (e) { /* signing out anyway */ }
    Api.setToken(null); state.user = null; state.cfg = null; clearInterval(badgeTimer);
    location.hash = '';
    showLogin();
  }

  // ---------- app frame ----------
  function menu() {
    const roles = state.cfg.roles, role = state.user.role;
    const items = [['#/inbox', 'My office', Icons.inbox], ['#/track', 'Track', Icons.scan]];
    if (role !== roles.VIEWER) items.push(['#/new', 'New', Icons.plus], ['#/mine', 'Sent', Icons.folder]);
    if (role === roles.ADMIN || role === roles.VIEWER) items.push(['#/reports', 'Reports', Icons.chart]);
    if (role === roles.ADMIN) items.push(['#/admin', 'Admin', Icons.gear]);
    items.push(['#/account', 'Account', Icons.user]);
    return items;
  }

  function startShell() {
    const u = state.user;
    root().innerHTML = '<div class="shell"><header class="topbar"><img class="seal" src="' + UI.esc(cfgFile.logos.main) + '" alt="">' +
      '<img class="hdr" src="' + UI.esc(cfgFile.logos.headerWhite) + '" alt="' + UI.esc(cfgFile.orgName) + '">' +
      '<div><div class="t1">' + UI.esc(cfgFile.appName) + '</div><div class="t2">TRC Dulag</div></div><div class="spacer"></div>' +
      '<div class="who"><div>' + UI.esc(u.name) + '</div><div>' + UI.esc(u.office) + '</div></div></header>' +
      '<nav class="nav">' + menu().map(m => '<a href="' + m[0] + '">' + m[2] + '<span>' + m[1] + '</span>' + (m[0] === '#/inbox' ? '<span class="dot hidden" data-badge></span>' : '') + '</a>').join('') + '</nav>' +
      '<main class="main" id="view"></main></div>';
    if (!location.hash || location.hash === '#/') location.hash = '#/inbox'; else route();
    // Keep the "to receive" count on the menu fresh (every 2 minutes while the app is open and visible).
    clearInterval(badgeTimer);
    badgeTimer = setInterval(() => { if (document.visibilityState === 'visible') refreshBadge(); }, 120000);
    refreshBadge();
    if (u.role !== state.cfg.roles.VIEWER && !u.hasSignature && navigator.maxTouchPoints === 0 && !Api.store.get('doctrack.sigPrompted.' + u.username)) {
      Api.store.set('doctrack.sigPrompted.' + u.username, '1');
      UI.toast('Tip: set up a stored signature and PIN in Account, to sign on this desktop.');
    }
  }

  let badgeTimer = 0;
  function refreshBadge() {
    if (!state.cfg) return;
    Api.call('inbox').then(r => setBadge(r.docs.filter(d => d.status === 'In Transit').length)).catch(() => {});
  }

  function setBadge(n) {
    const b = document.querySelector('[data-badge]');
    if (b) { b.textContent = n; b.classList.toggle('hidden', !n); }
  }

  async function route() {
    const view = document.getElementById('view');
    if (!view || !state.cfg) return;
    const parts = location.hash.replace(/^#\/?/, '').split('/');
    const name = parts[0] || 'inbox';
    document.querySelectorAll('.nav a').forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#/' + (name === 'doc' ? 'track' : name)));
    const map = { inbox: Views.inbox, track: Views.track, new: Views.newdoc, mine: Views.mine, reports: Views.reports, account: Views.account, admin: Views.admin };
    window.scrollTo(0, 0);
    try {
      if (name === 'doc') await Views.doc(view, decodeURIComponent(parts[1] || ''));
      else await (map[name] || Views.inbox)(view);
    } catch (e) {
      if (e.code === 'E-AUTH-04' || e.code === 'E-AUTH-07') return;
      view.innerHTML = '<div class="notice err">' + UI.esc(e.code ? e.toString() : e.message || e) + '</div>' +
        '<button class="btn secondary" data-retry>Try again</button>';
      view.querySelector('[data-retry]').onclick = route;
      console.error(e);
    }
  }

  return Object.assign(state, { start, refreshConfig, logout, setBadge, get VERSION() { return VERSION; } });
})();

document.addEventListener('DOMContentLoaded', App.start);
