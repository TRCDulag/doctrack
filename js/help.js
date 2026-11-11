/**
 * help.js: the "Need help?" button at the bottom right, with the ICT helper and four choices:
 * FAQs, ICT Job Order, Contact Info and About the App. Same helper as the TRC HRMIS.
 *
 * Messages from Contact Info go to the ICT Inventory and PMS app as a job order request
 * (its public submitJO action, the same one its "Request ICT help" page uses), so the sender gets a JO number.
 * A screenshot can go with it (PMS 1.8.4 or newer): taken of this page, pasted with Ctrl+V, or picked from the device.
 * It is made smaller here (JPEG, at most 1600 px wide) and sent as a data: URL in "screenshot".
 * Looks are in css/app.css under "Need help?".
 */
const Help = (() => {
  const PMS_URL = 'https://script.google.com/macros/s/AKfycbyZfBU_2nFesgP3UQRnoyDDf0ZXaLA_psBQwwNGXeuE-1RokPMd4SaEZWSWl7GUD6gDog/exec';
  const JO_URL = 'https://trcdulag.github.io/ict-inventory-pms/#request';
  const ICTU = { email: 'jhedd@pm.me', phone: '0935 449 6460', hours: 'Monday to Friday, 8:00 AM to 5:00 PM' };
  const APP_TOPICS = ['Problem with Document Tracking', 'Account, password or PIN', 'Suggestion for Document Tracking'];

  const ico = name => '<span class="hi hi-' + name + '" aria-hidden="true"><i></i></span>';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const qa = (q, a) => '<details><summary>' + q + '</summary><p>' + a + '</p></details>';

  function faqs() {
    return [
      qa('How do I get an account?', 'Ask ICTU. Each person gets their own account, with a username and a temporary password given in person. The app asks you to choose your own password the first time you log in.'),
      qa('I forgot my password, or my PIN is locked.', 'Ask ICTU to reset it. A PIN locks after 5 wrong tries. For safety, passwords and PINs are never sent by chat or email.'),
      qa('How do I send a document?', 'Tap <b>New</b>. Type the title, choose the type and the first office, then tap <b>Log and get tracking number</b>. Print the QR label on page 1 and bring the paper to that office.'),
      qa('How do I receive a document?', 'On <b>My office</b>, tap <b>Scan to receive</b> and point the camera at the QR label. Then sign with your finger, or type your PIN to use your stored signature.'),
      qa('The QR code will not scan.', 'Type the tracking number instead, like <b>10-004</b> or just <b>004</b>. It opens the same document. Good light and holding the phone a little closer also help.'),
      qa('How do I forward, return or complete a document?', 'Open the document and tap <b>Release</b>. Forward sends it to the next office. Return sends it back with a reason. Complete ends the route. Then bring the paper to the office you picked.'),
      qa('It says "Document not routed to your office".', 'The document was not sent to your office, so you cannot receive it. Return the paper to the person who delivered it. The offices involved will see that your office scanned it.'),
      qa('Who can see a document?', 'Only the offices it passed through, and ICTU. You will not find documents of other offices in Track.'),
      qa('What do we do when the internet is down?', 'Use mobile data on your phone. If the printer is down, write the tracking number on page 1 by hand. With no internet at all, use a paper routing slip, then receive and sign in the app when the connection is back.'),
      qa('How do I put the app on my phone or computer?', 'Open the User guide on the login page and see <b>Add the app to your device</b>. It has steps for office computers, Android phones and iPhones.'),
      qa('The app looks old after an update.', 'On a computer, press Ctrl+Shift+R. On a phone, close the app and open it again.'),
      qa('Is my information safe?', 'The app keeps only names, positions, offices, signatures and times, following the Data Privacy Act of 2012. Do not put patient or client names in a document title. Every action is written to an audit trail.'),
      qa('Something is not working. Who do I tell?', 'File an ICT Job Order, or send a message from Contact Info. Say which screen you were on and what you tapped. If there is an error code like E-PIN-01, include it.')
    ].join('');
  }

  function about() {
    const v = App.VERSION;
    return '<p><b>DOH TRC Dulag Document Tracking</b>' + (v ? ', version ' + esc(v) : '') + '.</p>' +
      '<p>Document Tracking follows paper documents as they move from office to office at DOH Treatment and Rehabilitation Center Dulag. ' +
      'The paper is still the official copy. The app records who received it, when, and where it is now, so anyone involved can check without calling around.</p>' +
      '<h3>What it does</h3><ul>' +
      '<li>Gives each document a tracking number and a QR label for its first page.</li>' +
      '<li>Records each receipt with a signature, and each forward, return or completion.</li>' +
      '<li>Shows the full route of a document and where it is now, on any phone or computer.</li>' +
      '<li>Prints a routing status report, and gives ICTU reports on time held per office.</li></ul>' +
      '<h3>Who uses it</h3><p>Every section that sends or receives documents. Section heads and supervisors can check a document even when they are out of the office or on official travel. ICTU manages the accounts.</p>' +
      '<h3>How it runs</h3><p>A web app at <b>tinyurl.com/trcddtrack</b>, with the records kept in the office Google account. It needs an internet connection; mobile data works.</p>' +
      '<h3>Made by</h3><p>Information and Communications Technology Unit (ICTU), DOH TRC Dulag.</p>';
  }

  // Taking a picture of the page works on computers (Chrome, Edge, Firefox) over https. Phones use their own screenshot.
  function canCapture() {
    const md = navigator.mediaDevices;
    return !!(window.isSecureContext && md && md.getDisplayMedia) && !/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  }
  function shotTip() {
    if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent))
      return 'Take a screenshot with your phone first (on most phones, press Power and Volume down together), then tap Choose a picture.';
    return (canCapture() ? 'When the browser asks, choose this tab. ' : '') + 'You can also press Ctrl+V here to paste a picture you copied.';
  }

  let shot = null;   // { data: 'data:image/jpeg;base64,...', kb }

  // Any picture (file, pasted, or a video frame) is drawn on a canvas and saved as a smaller JPEG.
  function shrink(src, w, h) {
    const max = 1600, k = Math.min(1, max / w);
    const c = document.createElement('canvas');
    c.width = Math.round(w * k); c.height = Math.round(h * k);
    const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    g.drawImage(src, 0, 0, c.width, c.height);
    let q = .85, data = c.toDataURL('image/jpeg', q);
    while (data.length > 2.6e6 && q > .4) { q -= .15; data = c.toDataURL('image/jpeg', q); }
    return data;
  }
  function setShot(data, f) {
    const err = f.querySelector('#hd-mail-err');
    if (data && data.length > 2.6e6) { err.textContent = 'That picture is too big. Please choose a smaller one.'; return; }
    shot = data ? { data, kb: Math.round(data.length * .75 / 1024) } : null;
    const prev = f.querySelector('#hd-shot-prev');
    prev.hidden = !shot;
    f.querySelector('#hd-shot-img').src = shot ? shot.data : '';
    if (shot) err.textContent = '';
  }
  function fromBlob(blob, f) {
    const err = f.querySelector('#hd-mail-err');
    if (!blob || !/^image\/(png|jpeg|webp|gif|bmp)$/.test(blob.type)) { err.textContent = 'Please choose a picture (PNG or JPG).'; return; }
    if (blob.size > 25e6) { err.textContent = 'That picture is too big. Please choose a smaller one.'; return; }
    const url = URL.createObjectURL(blob), im = new Image();
    im.onload = () => { setShot(shrink(im, im.naturalWidth, im.naturalHeight), f); URL.revokeObjectURL(url); };
    im.onerror = () => { err.textContent = 'That picture could not be opened. Please try another one.'; URL.revokeObjectURL(url); };
    im.src = url;
  }
  // Takes one picture of the screen the person picks (this tab), with the help window out of the way.
  async function capture(f, dlg) {
    const err = f.querySelector('#hd-mail-err');
    err.textContent = '';
    let stream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: 'browser' }, audio: false,
        preferCurrentTab: true, selfBrowserSurface: 'include', surfaceSwitching: 'exclude' });
    } catch (x) {
      if (x && x.name !== 'NotAllowedError') err.textContent = 'The screenshot could not be taken. You can press Print Screen, then Ctrl+V here.';
      return;
    }
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.srcObject = stream;
    if (dlg.close) dlg.close();
    try {
      await v.play();
      await new Promise(r => setTimeout(r, 450));   // lets the page repaint without the help window
      setShot(shrink(v, v.videoWidth, v.videoHeight), f);
    } catch (x) {
      err.textContent = 'The screenshot could not be taken. You can press Print Screen, then Ctrl+V here.';
    } finally {
      stream.getTracks().forEach(t => t.stop());
      if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
      const prev = f.querySelector('#hd-shot-prev');
      if (!prev.hidden) prev.scrollIntoView({ block: 'nearest' });
    }
  }
  function wireShot(dlg) {
    const f = dlg.querySelector('#hd-mail'), file = f.querySelector('#hd-shot-file');
    const take = f.querySelector('#hd-shot-take');
    if (take) take.addEventListener('click', () => capture(f, dlg));
    f.querySelector('#hd-shot-pick').addEventListener('click', () => file.click());
    file.addEventListener('change', () => { if (file.files[0]) fromBlob(file.files[0], f); file.value = ''; });
    f.querySelector('#hd-shot-del').addEventListener('click', () => setShot(null, f));
    dlg.addEventListener('paste', e => {
      const it = [...((e.clipboardData && e.clipboardData.items) || [])].find(i => i.kind === 'file' && /^image\//.test(i.type));
      if (!it) return;
      e.preventDefault();
      fromBlob(it.getAsFile(), f);
    });
  }

  function contact() {
    return '<dl class="hd-info"><dt>Unit</dt><dd>Information and Communications Technology Unit (ICTU), DOH TRC Dulag</dd>' +
      '<dt>Email</dt><dd><a href="mailto:' + ICTU.email + '">' + ICTU.email + '</a></dd>' +
      '<dt>Phone</dt><dd><a href="tel:' + ICTU.phone.replace(/\s/g, '') + '">' + ICTU.phone + '</a></dd>' +
      '<dt>Office hours</dt><dd>' + ICTU.hours + '</dd></dl>' +
      '<h3>Send a message to ICT support</h3>' +
      '<form class="hd-mail" id="hd-mail" novalidate>' +
      '<label for="hd-kind">What is it about?</label><select id="hd-kind" name="topic">' +
      APP_TOPICS.concat(['Computer, printer or network', 'Other']).map(t => '<option>' + t + '</option>').join('') + '</select>' +
      '<div class="hd-two"><div><label for="hd-first">First name</label><input id="hd-first" name="first" maxlength="60"></div>' +
      '<div><label for="hd-last">Last name</label><input id="hd-last" name="last" maxlength="60"></div></div>' +
      '<label for="hd-office">Office or section</label><input id="hd-office" name="office" maxlength="150">' +
      '<label for="hd-phone">Contact number or local <span class="muted">(so ICTU can call you back)</span></label><input id="hd-phone" name="contact" maxlength="80" inputmode="tel">' +
      '<label for="hd-msg">Message</label><textarea id="hd-msg" name="message" rows="4" maxlength="1500" placeholder="What happened? Which screen were you on?"></textarea>' +
      '<label>Screenshot <span class="muted">(optional)</span></label>' +
      '<div class="hd-shot" id="hd-shot">' +
      '<div class="hd-shot-btns">' +
      (canCapture() ? '<button type="button" class="btn ghost" id="hd-shot-take">Take a screenshot of this page</button>' : '') +
      '<button type="button" class="btn ghost" id="hd-shot-pick">Choose a picture</button>' +
      '<input type="file" id="hd-shot-file" accept="image/png,image/jpeg,image/webp" hidden></div>' +
      '<p class="muted small" id="hd-shot-tip">' + shotTip() + '</p>' +
      '<div class="hd-shot-prev" id="hd-shot-prev" hidden><img id="hd-shot-img" alt="The screenshot that will be sent">' +
      '<button type="button" class="btn ghost" id="hd-shot-del">Remove</button></div></div>' +
      '<p class="hd-err" id="hd-mail-err" role="alert"></p><p class="hd-ok" id="hd-mail-ok" role="status"></p>' +
      '<div class="actions"><button class="btn" id="hd-send">Send to ICT</button></div>' +
      '<p class="muted small">Your message goes to the ICT Unit as a job order request, so you get a JO number. Never put passwords or PINs in a message. A screenshot is seen only by ICTU.</p></form>';
  }

  const dialog = (id, kind, title, body) => '<dialog class="hd-dlg" id="' + id + '" aria-labelledby="' + id + '-t"><div class="hd-dlg-head c-' + kind + '"><span class="hd-dot">' + ico(kind) + '</span>' +
    '<h2 id="' + id + '-t">' + title + '</h2><button type="button" class="hd-x" data-hd-dclose aria-label="Close">' + ico('close') + '</button></div><div class="hd-dlg-body">' + body + '</div></dialog>';

  const opt = (n, kind, label, say, attrs) => '<li class="o' + n + '"><' + (attrs ? 'a' : 'button type="button"') + ' class="hd-opt c-' + kind + '" data-pose="' + kind + '" data-say="' + say + '"' +
    (attrs || ' data-hd-open="hd-' + kind + '"') + '><span class="hd-dot">' + ico(kind) + '</span><span class="hd-lbl">' + label + '</span></' + (attrs ? 'a' : 'button') + '></li>';

  function mount() {
    if (document.getElementById('hd')) return;
    const hd = document.createElement('div');
    hd.className = 'hd'; hd.id = 'hd';
    hd.innerHTML =
      '<div class="hd-panel" id="hd-panel" role="dialog" aria-modal="false" aria-labelledby="hd-hello"><div class="hd-stage">' +
      '<p class="hd-hello" id="hd-hello"><b class="hd-hi">Hi there!</b> <span class="hd-say" data-default="I\'m your ICT helper. What do you need?">I\'m your ICT helper. What do you need?</span></p>' +
      '<div class="hd-figure"><img class="hd-av on" data-pose="wave" src="assets/help/help-wave.png" alt="ICT support helper in a barong with an IT lanyard, waving" width="460" height="440">' +
      ['faq', 'jo', 'contact', 'about'].map(p => '<img class="hd-av" data-pose="' + p + '" src="assets/help/help-' + p + '.png" alt="" aria-hidden="true" width="460" height="440" loading="lazy">').join('') + '</div>' +
      '<button type="button" class="hd-x" data-hd-close aria-label="Close help">' + ico('close') + '</button></div>' +
      '<ul class="hd-menu" role="list">' +
      opt(1, 'faq', 'FAQs', 'Got a question? The common ones are here.') +
      opt(2, 'jo', 'ICT Job Order', 'Something not working? File a job order.', ' href="' + JO_URL + '" target="_blank" rel="noopener"') +
      opt(3, 'contact', 'Contact Info', 'Need ICTU? Send us a message or call.') +
      opt(4, 'about', 'About the App', 'Want to know more about Document Tracking?') +
      '</ul></div>' +
      '<button type="button" class="hd-fab" id="hd-fab" aria-expanded="false" aria-controls="hd-panel" aria-label="Need help?"><span class="hd-q" aria-hidden="true">?</span><span class="hd-tip" aria-hidden="true">Need help?</span></button>' +
      dialog('hd-faq', 'faq', 'Frequently asked questions', faqs()) +
      dialog('hd-contact', 'contact', 'Contact the ICT Unit', contact()) +
      dialog('hd-about', 'about', 'About Document Tracking', '<div data-about></div>');
    document.body.appendChild(hd);
    wire(hd);
  }

  function wire(hd) {
    const fab = hd.querySelector('#hd-fab'), panel = hd.querySelector('#hd-panel');
    const isOpen = () => hd.classList.contains('open');
    const open = kbd => {
      hd.classList.add('open'); fab.setAttribute('aria-expanded', 'true'); fab.setAttribute('aria-label', 'Close help');
      const first = panel.querySelector('.hd-opt');
      if (first && kbd) setTimeout(() => first.focus(), 180);   // keyboard users land on the first choice
    };
    const close = focusFab => {
      if (!isOpen()) return;
      hd.classList.remove('open'); back();
      fab.setAttribute('aria-expanded', 'false'); fab.setAttribute('aria-label', 'Need help?');
      if (focusFab) fab.focus();
    };
    fab.addEventListener('click', e => { isOpen() ? close(false) : open(e.detail === 0); });
    panel.querySelectorAll('[data-hd-close]').forEach(b => b.addEventListener('click', () => close(true)));
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && isOpen() && !hd.querySelector('.hd-dlg[open]')) close(true); });
    document.addEventListener('click', e => { if (isOpen() && !hd.contains(e.target)) close(false); });

    // Arrow keys move between the four choices.
    const opts = Array.from(panel.querySelectorAll('.hd-opt'));
    panel.addEventListener('keydown', e => {
      const i = opts.indexOf(document.activeElement);
      if (i < 0) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { opts[(i + 1) % opts.length].focus(); e.preventDefault(); }
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { opts[(i + opts.length - 1) % opts.length].focus(); e.preventDefault(); }
    });

    // Hovering (or tabbing to) a choice changes his pose and what the bubble says.
    const say = panel.querySelector('.hd-say'), poses = panel.querySelectorAll('.hd-av');
    const pose = (name, text) => {
      poses.forEach(im => im.classList.toggle('on', im.dataset.pose === name));
      if (name === 'wave') hd.removeAttribute('data-pose'); else hd.dataset.pose = name;
      if (say.textContent !== text) { say.textContent = text; say.classList.remove('swap'); void say.offsetWidth; say.classList.add('swap'); }
    };
    const back = () => pose('wave', say.dataset.default);
    opts.forEach(o => {
      const show = () => pose(o.dataset.pose, o.dataset.say);
      o.addEventListener('mouseenter', show); o.addEventListener('focus', show);
      o.addEventListener('mouseleave', () => { if (document.activeElement !== o) back(); });
      o.addEventListener('blur', back);
    });
    panel.querySelector('.c-jo').addEventListener('click', () => close(false));

    // FAQs, Contact Info and About open as dialogs.
    panel.querySelectorAll('[data-hd-open]').forEach(b => b.addEventListener('click', () => {
      const d = hd.querySelector('#' + b.dataset.hdOpen);
      close(false);
      if (d.id === 'hd-about') d.querySelector('[data-about]').innerHTML = about();
      if (d.id === 'hd-contact') prefill(d);
      if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
    }));
    hd.querySelectorAll('.hd-dlg').forEach(d => {
      d.querySelectorAll('[data-hd-dclose]').forEach(b => b.addEventListener('click', () => (d.close ? d.close() : d.removeAttribute('open'))));
      d.addEventListener('click', e => { if (e.target === d && d.close) d.close(); });   // click on the dim backdrop
      d.addEventListener('close', () => fab.focus());
    });

    hd.querySelector('#hd-mail').addEventListener('submit', send);
    wireShot(hd.querySelector('#hd-contact'));
  }

  // A logged-in person's name and office are filled in for them.
  function prefill(d) {
    const u = App.user;
    if (!u) return;
    const f = d.querySelector('#hd-mail'), parts = String(u.name || '').trim().split(/\s+/);
    if (!f.first.value && parts.length > 1) f.first.value = parts.slice(0, -1).join(' ');
    if (!f.last.value && parts.length) f.last.value = parts[parts.length - 1];
    if (!f.office.value) f.office.value = u.office || '';
  }

  async function send(e) {
    e.preventDefault();
    const f = e.target, err = f.querySelector('#hd-mail-err'), ok = f.querySelector('#hd-mail-ok'), btn = f.querySelector('#hd-send');
    err.textContent = ''; ok.textContent = '';
    const need = [['first', 'Please type your first name.'], ['last', 'Please type your last name.'], ['office', 'Please type your office or section.'], ['message', 'Please type your message.']];
    for (const [k, m] of need) if (!f[k].value.trim()) { err.textContent = m; f[k].focus(); return; }
    const topic = f.topic.value, where = location.hash || '#/';
    const body = { action: 'submitJO', device: 'Document Tracking help menu', jo: {
      lastName: f.last.value.trim(), firstName: f.first.value.trim(), unit: f.office.value.trim(), contact: f.contact.value.trim(),
      mode: 'Online', others: 'Document Tracking help menu: ' + topic, equipment: APP_TOPICS.indexOf(topic) >= 0 ? 'Document Tracking' : '',
      description: f.message.value.trim().slice(0, 1400) + ' (Document Tracking ' + (App.VERSION) + ', screen ' + where + ')', urgent: 'No' } };
    if (shot) body.screenshot = { name: 'screenshot.jpg', type: 'image/jpeg', data: shot.data };
    btn.disabled = true; btn.textContent = 'Sending…';
    try {
      const res = await fetch(PMS_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || 'Not sent.');
      ok.textContent = 'Sent. Your job order number is ' + j.jo + '. ICTU will get back to you.' +
        (shot && j.screenshot !== true ? ' The screenshot did not go through, so please describe what you saw, or show it to ICTU.' : '');
      f.message.value = '';
      setShot(null, f);
    } catch (x) {
      err.textContent = (x instanceof SyntaxError || x instanceof TypeError ? 'No connection to the ICT app.' : x.message) +
        ' Please try again, or call ' + ICTU.phone + '.';
    } finally { btn.disabled = false; btn.textContent = 'Send to ICT'; }
  }

  return { mount };
})();
document.addEventListener('DOMContentLoaded', Help.mount);
