/**
 * ui.js: small display helpers shared by every screen (escaping, toasts, dialogs, badges, durations).
 */
const UI = (() => {
  /** Escapes text before it goes into HTML. Use it for EVERY value that came from a user or the server. */
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function toast(msg, isError) {
    document.querySelectorAll('.toast').forEach(t => t.remove());
    const t = document.createElement('div');
    t.className = 'toast' + (isError ? ' err' : '');
    t.setAttribute('role', isError ? 'alert' : 'status');
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), isError ? 7000 : 3500);
  }

  /** Shows an error from Api.call (or any error) as a red toast. */
  function error(e) {
    console.error(e);
    toast(e && e.code ? e.toString() : (e && e.message) || String(e), true);
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
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';
    try { return await fn(); }
    finally { btn.disabled = false; btn.innerHTML = html; }
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
    let html = '<span class="badge ' + cls + '">' + esc(s) + '</span>';
    if (s === 'In Transit' && /^Returned/.test(doc.lastMovement || '')) html += ' <span class="badge returned">Returned</span>';
    return html;
  }

  /** "In transit to Budget Section" / "With Accounting Section" / "Completed at ..." */
  function whereIs(doc) {
    if (doc.status === 'In Transit') return 'On the way to ' + doc.currentOffice;
    if (doc.status === 'Received') return 'With ' + doc.currentOffice;
    if (doc.status === 'Completed') return 'Completed at ' + doc.currentOffice;
    return 'Voided';
  }

  const loading = '<div class="loading"><span class="spinner dark"></span></div>';

  return { esc, toast, error, modal, confirmBox, busy, minutes, since, badge, whereIs, loading };
})();
