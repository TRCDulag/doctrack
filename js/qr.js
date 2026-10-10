/**
 * qr.js: QR codes for tracking numbers (uses vendor/qrcode.js) and reading them back (vendor/jsQR.js).
 *
 * The QR holds ONLY the tracking number (e.g. DT-2026-10-001). That keeps the code small
 * (21 x 21 modules) so a 2 cm print still scans easily, and it carries no personal data.
 */
const QR = (() => {
  const TRK_RE = /DT-\d{4}-\d{2}-\d{3,}/i;

  /** Pulls a tracking number out of scanned or typed text. Returns '' if none. */
  function extractTrk(text) {
    const m = String(text || '').toUpperCase().replace(/\s+/g, '').match(TRK_RE);
    return m ? m[0] : '';
  }

  /** An SVG string of the QR code with a 2-module white border, scaled by CSS to any size. */
  function svg(text) {
    const qr = qrcode(0, 'M');                       // version chosen automatically; medium error correction
    qr.addData(String(text).toUpperCase(), 'Alphanumeric');
    qr.make();
    const n = qr.getModuleCount(), q = 2, size = n + q * 2;
    let d = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += 'M' + (c + q) + ' ' + (r + q) + 'h1v1h-1z';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + size + ' ' + size + '" shape-rendering="crispEdges">' +
      '<rect width="' + size + '" height="' + size + '" fill="#fff"/><path d="' + d + '" fill="#000"/></svg>';
  }

  /** Reads a QR code from ImageData. Returns the text or ''. */
  function decode(imageData) {
    const res = window.jsQR ? jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'attemptBoth' }) : null;
    return res ? res.data : '';
  }

  /** Reads a QR code from a photo file (the "Take a photo" option). */
  function decodeFile(file) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const tries = [1200, 800, 1800];                 // a few sizes: tiny codes in big photos read better at one of them
        for (const max of tries) {
          const scale = Math.min(1, max / Math.max(img.width, img.height));
          const c = document.createElement('canvas');
          c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
          const ctx = c.getContext('2d');
          ctx.drawImage(img, 0, 0, c.width, c.height);
          const text = decode(ctx.getImageData(0, 0, c.width, c.height));
          if (text) { URL.revokeObjectURL(img.src); return resolve(text); }
        }
        URL.revokeObjectURL(img.src);
        resolve('');
      };
      img.onerror = () => resolve('');
      img.src = URL.createObjectURL(file);
    });
  }

  return { svg, decode, decodeFile, extractTrk };
})();

/**
 * Scanner.open(): asks for a tracking number by camera, photo or typing.
 * Resolves to a tracking number, or null if cancelled.
 *  - Live camera: uses the phone/tablet camera and reads codes continuously.
 *  - Take a photo: opens the camera app (or file picker on a PC); works even where live camera is blocked.
 *  - Type it: for desktops without a camera.
 */
const Scanner = (() => {
  function open() {
    return new Promise(resolve => {
      let stream = null, raf = 0, done = false, detector = null;
      const stop = () => {
        cancelAnimationFrame(raf);
        if (stream) stream.getTracks().forEach(t => t.stop());
        stream = null;
      };
      const { box, close } = UI.modal({
        title: 'Scan QR code',
        body:
          '<div class="scan-box hidden" data-live><video playsinline muted></video><div class="frame"></div></div>' +
          '<p class="small muted" data-msg>Point the camera at the QR code on the document\'s first page.</p>' +
          '<div class="row" style="margin-bottom:14px">' +
          '<button class="btn secondary grow" data-photo>Take a photo of the QR</button>' +
          '<input type="file" accept="image/*" capture="environment" class="hidden" data-file></div>' +
          '<label class="f"><span>Or type the tracking number</span>' +
          '<div class="row"><input type="text" class="grow mono" placeholder="DT-2026-10-001" autocapitalize="characters" data-typed>' +
          '<button class="btn" data-go>Open</button></div></label>',
        onClose: val => { stop(); resolve(val || null); },
        onOpen: (b, closeFn) => {
          const finish = trk => { if (!done) { done = true; if (navigator.vibrate) navigator.vibrate(60); closeFn(trk); } };
          const msg = b.querySelector('[data-msg]');
          b.querySelector('[data-go]').onclick = () => {
            const t = QR.extractTrk(b.querySelector('[data-typed]').value);
            if (t) finish(t); else UI.toast('Type the full tracking number, like DT-2026-10-001.', true);
          };
          b.querySelector('[data-typed]').addEventListener('keydown', e => { if (e.key === 'Enter') b.querySelector('[data-go]').click(); });
          const file = b.querySelector('[data-file]');
          b.querySelector('[data-photo]').onclick = () => file.click();
          file.onchange = async () => {
            if (!file.files[0]) return;
            msg.textContent = 'Reading the photo...';
            const t = QR.extractTrk(await QR.decodeFile(file.files[0]));
            file.value = '';
            if (t) finish(t);
            else msg.textContent = 'No tracking QR found in that photo. Hold the phone closer so the code fills more of the picture, or type the number.';
          };
          startLive(b, finish, msg);
        }
      });

      async function startLive(b, finish, msg) {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          msg.textContent = 'Live camera is not available here. Use "Take a photo" or type the number.';
          return;
        }
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false });
        } catch (e) {
          msg.textContent = 'Camera permission was not given. Use "Take a photo" or type the number.';
          return;
        }
        if (done) return stop();
        const live = b.querySelector('[data-live]'), video = live.querySelector('video');
        live.classList.remove('hidden');
        video.srcObject = stream;
        await video.play().catch(() => {});
        if ('BarcodeDetector' in window) {
          try { detector = new BarcodeDetector({ formats: ['qr_code'] }); } catch (e) { detector = null; }
        }
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        let lastTick = 0;
        const tick = async (t) => {
          if (done || !stream) return;
          raf = requestAnimationFrame(tick);
          if (t - lastTick < 150 || video.readyState < 2) return;   // about 6 reads a second is plenty
          lastTick = t;
          let text = '';
          if (detector) {
            try { const codes = await detector.detect(video); text = codes[0] ? codes[0].rawValue : ''; } catch (e) { detector = null; }
          } else {
            const w = video.videoWidth, h = video.videoHeight, s = Math.min(1, 720 / Math.max(w, h));
            canvas.width = Math.round(w * s); canvas.height = Math.round(h * s);
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            text = QR.decode(ctx.getImageData(0, 0, canvas.width, canvas.height));
          }
          const trk = QR.extractTrk(text);
          if (trk) finish(trk);
        };
        raf = requestAnimationFrame(tick);
      }
    });
  }
  return { open };
})();
