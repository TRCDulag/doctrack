/**
 * signature.js: a signature pad drawn with a finger, stylus or mouse.
 *   const pad = SignaturePad.mount(containerElement);
 *   pad.isEmpty(); pad.clear(); pad.toDataURL();   // PNG, trimmed to the ink, max 600 px wide
 *   SignaturePad.fromImageFile(file)                 // an uploaded picture of a signature, cleaned the same way
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

  /**
   * Turns a photo or scan of a signature (PNG or JPG) into the same kind of image the pad makes:
   * the paper becomes transparent, the margins are trimmed to the ink, and it is at most 600 px wide.
   * Resolves to a PNG data URL, or rejects with a message for the user.
   */
  function fromImageFile(file) {
    return new Promise((resolve, reject) => {
      if (!file || !/^image\/(png|jpe?g)$/.test(file.type)) return reject(new Error('Choose a PNG or JPG picture of your signature.'));
      if (file.size > 10 * 1024 * 1024) return reject(new Error('That picture is too large. Use one under 10 MB.'));
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That picture could not be opened. Try another PNG or JPG.')); };
      img.onload = () => {
        URL.revokeObjectURL(url);
        // Work at a manageable size: big phone photos are scaled down first.
        const fit = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.max(1, Math.round(img.naturalWidth * fit)), h = Math.max(1, Math.round(img.naturalHeight * fit));
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const data = ctx.getImageData(0, 0, w, h), px = data.data;

        // The paper is the bright majority: take a high percentile of brightness as its shade (copes with grey photos).
        const lum = new Float32Array(w * h);
        const hist = new Uint32Array(256);
        for (let i = 0; i < w * h; i++) {
          const a = px[i * 4 + 3] / 255;   // transparent PNG areas count as paper
          const l = (0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2]) * a + 255 * (1 - a);
          lum[i] = l; hist[Math.round(l)]++;
        }
        let seen = 0, paper = 255;
        for (let v = 0; v < 256; v++) { seen += hist[v]; if (seen >= w * h * 0.6) { paper = v; break; } }
        const ink = paper - 60, soft = paper - 25;   // darker than ink = solid; between ink and soft = faded edge

        let minX = w, minY = h, maxX = -1, maxY = -1, count = 0;
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          const i = y * w + x, l = lum[i];
          const alpha = l <= ink ? 255 : l >= soft ? 0 : Math.round(255 * (soft - l) / (soft - ink));
          px[i * 4 + 3] = Math.min(px[i * 4 + 3], alpha);
          if (alpha > 128) { count++; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
        }
        if (paper < 120 || count < 150 || maxX - minX < 40) {
          return reject(new Error('No clear signature found. Sign in dark ink on plain white paper, take the photo in good light, and crop it close.'));
        }
        if (count > w * h * 0.45) return reject(new Error('The picture is too dark. Use a photo of dark ink on plain white paper.'));
        ctx.putImageData(data, 0, 0);

        const pad = 8;
        const sx = Math.max(0, minX - pad), sy = Math.max(0, minY - pad);
        const sw = Math.min(w - sx, maxX - minX + pad * 2), sh = Math.min(h - sy, maxY - minY + pad * 2);
        const scale = Math.min(1, 600 / sw);
        const out = document.createElement('canvas');
        out.width = Math.max(1, Math.round(sw * scale)); out.height = Math.max(1, Math.round(sh * scale));
        const o = out.getContext('2d');
        o.imageSmoothingQuality = 'high';
        o.drawImage(c, sx, sy, sw, sh, 0, 0, out.width, out.height);
        resolve(out.toDataURL('image/png'));
      };
      img.src = url;
    });
  }

  return { mount, fromImageFile };
})();
