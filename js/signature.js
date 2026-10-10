/**
 * signature.js: a signature pad drawn with a finger, stylus or mouse.
 *   const pad = SignaturePad.mount(containerElement);
 *   pad.isEmpty(); pad.clear(); pad.toDataURL();   // PNG, trimmed to the ink, max 600 px wide
 */
const SignaturePad = (() => {
  function mount(container) {
    container.classList.add('sigpad');
    container.innerHTML = '<canvas aria-label="Signature pad: sign here"></canvas><div class="hint">Sign above this line</div>';
    const canvas = container.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    let drawing = false, last = null, inked = false;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    function resize() {
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      const r = canvas.getBoundingClientRect();
      canvas.width = Math.round(r.width * ratio);
      canvas.height = Math.round(r.height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#0B1F4D'; ctx.lineWidth = 2.4;
      clear();
    }
    function pos(e) { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    function track(p) { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); }

    canvas.addEventListener('pointerdown', e => {
      e.preventDefault(); canvas.setPointerCapture(e.pointerId);
      drawing = true; last = pos(e); track(last);
      ctx.beginPath(); ctx.arc(last.x, last.y, 1.2, 0, Math.PI * 2); ctx.fillStyle = ctx.strokeStyle; ctx.fill();
    });
    canvas.addEventListener('pointermove', e => {
      if (!drawing) return;
      e.preventDefault();
      const p = pos(e);
      ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke();
      last = p; track(p); inked = true;
    });
    const end = () => { drawing = false; };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);

    function clear() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      inked = false; minX = minY = Infinity; maxX = maxY = -Infinity;
    }

    // A signature needs some real ink, not a tap.
    function isEmpty() { return !inked || (maxX - minX < 25 && maxY - minY < 12); }

    function toDataURL() {
      const ratio = canvas.width / canvas.getBoundingClientRect().width;
      const pad = 8;
      const sx = Math.max(0, (minX - pad) * ratio), sy = Math.max(0, (minY - pad) * ratio);
      const sw = Math.min(canvas.width - sx, (maxX - minX + pad * 2) * ratio);
      const sh = Math.min(canvas.height - sy, (maxY - minY + pad * 2) * ratio);
      const scale = Math.min(1, 600 / sw);
      const out = document.createElement('canvas');
      out.width = Math.max(1, Math.round(sw * scale)); out.height = Math.max(1, Math.round(sh * scale));
      out.getContext('2d').drawImage(canvas, sx, sy, sw, sh, 0, 0, out.width, out.height);
      return out.toDataURL('image/png');
    }

    requestAnimationFrame(resize);
    return { clear, isEmpty, toDataURL };
  }
  return { mount };
})();
