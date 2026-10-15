/** readme.js: fills the changelog on readme.html from js/changelog.js. */
(function () {
  const box = document.querySelector('[data-changelog]');
  const list = window.CHANGELOG || [];
  if (!box || !list.length) return;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  box.innerHTML = list.map(e =>
    '<article class="change"><h3>Version ' + esc(e.version) + ' <span class="muted small">' + esc(e.date) + '</span></h3>' +
    '<ul>' + e.changes.map(c => '<li>' + esc(c) + '</li>').join('') + '</ul>' +
    (e.update ? '<p class="small muted">Update: ' + esc(e.update) + '</p>' : '') + '</article>').join('');
})();
