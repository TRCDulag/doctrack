/**
 * ui.js: small display helpers shared by every screen (escaping, toasts, dialogs, badges, durations).
 */
const UI = (() => {
  /** Escapes text before it goes into HTML. Use it for EVERY value that came from a user or the server. */
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /** A short message at the bottom of the screen. `detail` is a second, smaller line (the error code for ICTU). */
  function toast(msg, isError, detail) {
    document.querySelectorAll('.toast').forEach(t => t.remove());
    const t = document.createElement('div');
    t.className = 'toast' + (isError ? ' err' : '');
    t.setAttribute('role', isError ? 'alert' : 'status');
    t.textContent = msg;
    if (detail) { const sm = document.createElement('small'); sm.textContent = detail; t.appendChild(sm); }
    document.body.appendChild(t);
    setTimeout(() => t.remove(), isError ? 7000 : 3500);
  }

  /** Shows an error from Api.call (or any error) as a red toast. */
  function error(e) {
    console.error(e);
    toast(e && e.code ? e.message : (e && e.message) || String(e), true, e && e.code ? 'Code for ICTU: ' + e.code + (e.ref ? ' / ' + e.ref : '') : '');
  }

  /** The same error drawn inside the part of the screen that failed, with a Try again button when `retry` is given. */
  function errorBox(e, retry) {
    const msg = e && e.message ? e.message : String(e);
    return '<div class="err-box" role="alert"><span class="ic" aria-hidden="true">!</span><div><b>This could not be loaded.</b><p>' + esc(msg) + '</p>' +
      (retry ? '<button class="btn secondary" data-retry>Try again</button>' : '') +
      (e && e.code ? '<span class="code">Code for ICTU: ' + esc(e.code) + (e.ref ? ' / ' + esc(e.ref) : '') + '</span>' : '') + '</div></div>';
  }

  /**
   * Marks a field that needs fixing: red edge and a one-line message right under it, plus the usual toast.
   * `detail` is the small second line of the toast. The mark clears as soon as the field is changed. Returns undefined so callers can `return need(...)`.
   */
  function need(field, msg, detail) {
    toast(msg, true, detail);
    const wrap = field && (field.closest('.f') || field.parentElement);
    if (!wrap) return;
    wrap.classList.add('invalid');
    let m = wrap.querySelector(':scope > .f-err');
    if (!m) { m = document.createElement('span'); m.className = 'f-err'; wrap.appendChild(m); }
    m.textContent = msg;
    if (field.setAttribute) field.setAttribute('aria-invalid', 'true');
    const clear = () => { wrap.classList.remove('invalid'); m.remove(); if (field.removeAttribute) field.removeAttribute('aria-invalid'); };
    ['input', 'change', 'pointerdown'].forEach(ev => field.addEventListener(ev, clear, { once: true }));
    wrap.scrollIntoView({ block: 'center', behavior: 'smooth' });
    if (field.focus && field.tagName !== 'DIV') field.focus({ preventScroll: true });
  }

  /**
   * Opens a dialog. `body` is HTML. `onOpen(box, close)` wires it up.
   * Returns { box, close }. Closing with the X or the backdrop calls onClose(null).
   */
  function modal({ title, body, onOpen, onClose, wide }) {
    const back = document.createElement('div');
    back.className = 'modal-back';
    back.innerHTML = '<div class="modal" role="dialog" aria-modal="true" aria-label="' + esc(title) + '"' + (wide ? ' style="max-width:760px"' : '') + '>' +
      '<div class="modal-head"><h2>' + esc(title) + '</h2><button type="button" aria-label="Close" data-close>&times;</button></div>' +
      body + '</div>';
    document.body.appendChild(back);
    document.body.style.overflow = 'hidden';
    const box = back.querySelector('.modal');
    let closed = false;
    const close = (val) => {
      if (closed) return; closed = true;
      back.remove(); document.body.style.overflow = '';
      if (onClose) onClose(val === undefined ? null : val);
    };
    back.addEventListener('click', e => { if (e.target === back) close(null); });
    box.querySelector('[data-close]').addEventListener('click', () => close(null));
    if (onOpen) onOpen(box, close);
    const first = box.querySelector('input, select, textarea');
    if (first && window.innerWidth > 640) first.focus();
    return { box, close };
  }

  function confirmBox(title, message, okText, danger) {
    return new Promise(resolve => {
      modal({
        title, onClose: resolve,
        body: '<p>' + esc(message) + '</p><div class="modal-foot"><button class="btn secondary" data-no>Cancel</button>' +
          '<button class="btn' + (danger ? ' danger' : '') + '" data-yes>' + esc(okText || 'OK') + '</button></div>',
        onOpen: (box, close) => {
          box.querySelector('[data-no]').onclick = () => close(false);
          box.querySelector('[data-yes]').onclick = () => close(true);
        }
      });
    });
  }

  /** Disables a button and shows a spinner while `fn` runs. */
  async function busy(btn, fn) {
    const html = btn.innerHTML;
    const dark = btn.classList.contains('secondary') || btn.classList.contains('ghost') || btn.classList.contains('danger-text');
    btn.disabled = true; btn.setAttribute('aria-busy', 'true');
    btn.innerHTML = '<span class="spinner' + (dark ? ' dark' : '') + '"></span><span class="busy-txt">Please wait\u2026</span>';
    try { return await fn(); }
    finally { btn.disabled = false; btn.removeAttribute('aria-busy'); btn.innerHTML = html; }
  }

  function minutes(m) {
    if (m == null || isNaN(m)) return '';
    m = Math.max(0, Math.round(m));
    if (m < 60) return m + ' min';
    const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60;
    if (d) return d + ' d ' + h + ' h';
    return h + ' h' + (mm ? ' ' + mm + ' min' : '');
  }
  const since = ms => ms ? minutes((Date.now() - ms) / 60000) : '';

  function badge(doc) {
    const s = doc.status || '';
    const cls = { 'In Transit': 'transit', 'Received': 'received', 'Completed': 'completed', 'Voided': 'voided' }[s] || '';
    // One status mark per row: a document sent back shows a single red "Returned, in transit" pill.
    if (s === 'In Transit' && /^Returned/.test(doc.lastMovement || '')) return '<span class="badge returned">Returned, in transit</span>';
    return '<span class="badge ' + cls + '">' + esc(s) + '</span>';
  }

  /** "In transit to Budget Section" / "With Accounting Section" / "Completed at ..." */
  function whereIs(doc) {
    if (doc.status === 'In Transit') return 'On the way to ' + doc.currentOffice;
    if (doc.status === 'Received') return 'With ' + doc.currentOffice;
    if (doc.status === 'Completed') return 'Completed at ' + doc.currentOffice;
    return 'Voided';
  }

  const loading = '<div class="card skel" role="status" aria-label="Loading">' + '<div class="skel-row"><i></i><i></i><i></i></div>'.repeat(3) + '</div>';

  return { esc, toast, error, errorBox, need, modal, confirmBox, busy, minutes, since, badge, whereIs, loading };
})();
