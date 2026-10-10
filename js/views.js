/**
 * views.js: the screens. Each view is async (el, params) and draws into `el`.
 *
 *   inbox     documents with my office: to receive, and on hand to act on
 *   track     my office's documents; scan, or type a full or short tracking number (10-001, 001) or title words
 *   doc       one document: where it is, its route, and the Receive / Release / Print / Void actions
 *   newdoc    log a new document (originating section)
 *   mine      documents my office sent, with their status
 *   reports   all documents and turnaround figures (Admin only)
 *   account   my password, stored signature + PIN, label print settings
 *   admin     users and offices (Admin)
 */
const Views = (() => {
  const { esc, toast, error, modal, confirmBox, busy, minutes, since, badge, whereIs, loading } = UI;
  const go = hash => { location.hash = hash; };
  const isViewer = () => App.user.role === App.cfg.roles.VIEWER;
  const isAdmin = () => App.user.role === App.cfg.roles.ADMIN;
  const officeOptions = (sel, exclude) => App.cfg.offices.filter(o => o !== exclude)
    .map(o => '<option' + (o === sel ? ' selected' : '') + '>' + esc(o) + '</option>').join('');

  function docItem(d, right) {
    return '<li class="item" data-trk="' + esc(d.trk) + '"><div class="main-txt"><div class="t">' + esc(d.title) + '</div>' +
      '<div class="s"><span class="mono">' + esc(d.trk) + '</span> &middot; ' + esc(d.docType) + ' &middot; from ' + esc(d.originOffice) + '</div>' +
      '<div class="s">' + badge(d) + ' ' + esc(whereIs(d)) + '</div></div><div class="r">' + (right || '') + '</div></li>';
  }
  /** Opens what was scanned or typed: a full tracking number opens the document, anything else searches on Track. */
  function openRef(t) {
    if (!t) return;
    const full = QR.extractTrk(t);
    go(full ? '#/doc/' + full : '#/track/' + encodeURIComponent(t));
  }
  function wireItems(el) {
    el.querySelectorAll('[data-trk]').forEach(li => li.addEventListener('click', () => go('#/doc/' + li.dataset.trk)));
  }

  // ---------------- inbox ----------------
  async function inbox(el) {
    el.innerHTML = '<div class="page-head"><div><h1>With my office</h1><p class="muted">' + esc(App.user.office) + '</p></div>' +
      '<button class="btn big" data-scan>' + Icons.scan + ' Scan to receive</button></div><div data-body>' + loading + '</div>';
    el.querySelector('[data-scan]').onclick = async () => { openRef(await Scanner.open()); };
    if (isViewer()) el.querySelector('[data-scan]').classList.add('hidden');
    const r = await Api.call('inbox');
    const toReceive = r.docs.filter(d => d.status === 'In Transit');
    const onHand = r.docs.filter(d => d.status === 'Received');
    App.setBadge(toReceive.length);
    const sec = (title, note, docs, right) => '<div class="card"><h2>' + title + ' <span class="muted small">(' + docs.length + ')</span></h2>' +
      '<p class="small muted" style="margin-top:-6px">' + note + '</p>' +
      (docs.length ? '<ul class="list">' + docs.map(d => docItem(d, right(d))).join('') + '</ul>' : '<div class="empty">None right now.</div>') + '</div>';
    el.querySelector('[data-body]').innerHTML =
      sec('To receive', 'Sent to your office. Sign for each one when the paper copy arrives.', toReceive,
        d => 'sent ' + esc(since(d.statusSinceMs)) + ' ago') +
      sec('On hand', 'Received by your office. When done, forward it, return it, or mark it completed.', onHand,
        d => 'held ' + esc(since(d.statusSinceMs)));
    wireItems(el);
  }

  // ---------------- track ----------------
  // Lists my office's documents by default. Typing searches only documents my office is involved in (Admin: all).
  // A short number works: "10-001" (month-number) or "001". If the number matches exactly one document, it opens.
  async function track(el, query) {
    el.innerHTML = '<h1>Track a document</h1><div class="card">' +
      '<button class="btn big block" data-scan>' + Icons.scan + ' Scan QR code</button>' +
      '<p class="muted small" style="text-align:center;margin:12px 0">or type the tracking number (e.g. 10-001 or just 001) or words from the title</p>' +
      '<div class="row"><input type="search" class="grow mono" placeholder="10-001" autocapitalize="characters" data-trk-in>' +
      '<button class="btn" data-go>Find</button></div></div><div data-results>' + loading + '</div>';
    const input = el.querySelector('[data-trk-in]'), out = el.querySelector('[data-results]');
    el.querySelector('[data-scan]').onclick = async () => { openRef(await Scanner.open()); };

    const show = async (q, autoOpen) => {
      out.innerHTML = loading;
      const r = await Api.call('find', { q });
      if (autoOpen && r.byNumber && r.docs.length === 1) { go('#/doc/' + r.docs[0].trk); return; }
      const title = !q ? 'Your office\'s documents' : 'Results for "' + esc(q) + '"';
      const note = !q ? 'Documents your office sent or received, newest first.'
        : (isAdmin() ? 'All documents.' : 'Only documents your office sent or received are searched.');
      out.innerHTML = '<div class="card"><h2>' + title + ' <span class="muted small">(' + r.total + (r.total > r.docs.length ? ', newest ' + r.docs.length + ' shown' : '') + ')</span></h2>' +
        '<p class="small muted" style="margin-top:-6px">' + note + '</p>' +
        (r.docs.length ? '<ul class="list">' + r.docs.map(d => docItem(d, esc(d.loggedAt))).join('') + '</ul>'
          : '<div class="empty">' + (q ? 'No document found. Check the number, or it may belong to offices other than yours.' : 'No documents yet.') + '</div>') + '</div>';
      wireItems(out);
    };
    const find = () => {
      const v = input.value.trim();
      const full = QR.extractTrk(v);
      if (full) { go('#/doc/' + full); return; }
      show(v, true).catch(error);
    };
    el.querySelector('[data-go]').onclick = find;
    input.addEventListener('keydown', e => { if (e.key === 'Enter') find(); });
    input.addEventListener('search', () => { if (!input.value) show('', false).catch(error); });   // the (x) clear button
    if (query) input.value = query;
    await show(query || '', !!query);
  }

  // ---------------- one document ----------------
  async function doc(el, trk) {
    el.innerHTML = loading;
    const r = await Api.call('getDoc', { trk });
    const d = r.doc, stops = r.stops, last = stops[stops.length - 1];
    const open = d.status === 'In Transit' || d.status === 'Received';
    let heroNote = '';
    if (d.status === 'In Transit') heroNote = 'Sent by ' + last.fromOffice + ' ' + since(last.sentAtMs) + ' ago, not yet received.';
    if (d.status === 'Received') heroNote = 'Received by ' + last.receivedBy + ' ' + since(last.receivedAtMs) + ' ago.';
    if (d.status === 'Completed') heroNote = 'Completed ' + d.completedAt + '. Total time ' + minutes((d.completedAtMs - d.loggedAtMs) / 60000) + '.';
    if (d.status === 'Voided') heroNote = d.remarks;

    const timeline = stops.map(s => {
      const cls = s.releasedAt ? 'done' : (s === last && open ? 'now' : '');
      let meta = '<div class="meta">' + esc(s.movement) + ' by ' + esc(s.sentBy) + ' (' + esc(s.fromOffice) + '), ' + esc(s.sentAt) + '</div>';
      if (s.receivedAt) meta += '<div class="meta">Received by <b>' + esc(s.receivedBy) + '</b>' + (s.receivedFor ? ' for ' + esc(s.receivedFor) : '') +
        ', ' + esc(s.receivedAt) + ' &middot; ' + esc(s.signMethod) + (s.transitMinutes != null ? ' &middot; in transit ' + minutes(s.transitMinutes) : '') + '</div>';
      else if (s === last && open) meta += '<div class="meta"><b>Not yet received</b> &middot; ' + since(s.sentAtMs) + ' so far</div>';
      if (s.releasedAt) meta += '<div class="meta">' + esc(s.action) + (s.returnReason ? ': ' + esc(s.returnReason) : '') + ' &rarr; <b>' + esc(s.outcome) + '</b>, ' +
        esc(s.releasedAt) + ' &middot; held ' + minutes(s.heldMinutes) + '</div>' + (s.remarks ? '<div class="meta">Remarks: ' + esc(s.remarks) + '</div>' : '');
      else if (s.receivedAt && open) meta += '<div class="meta"><b>Pending action</b> &middot; held ' + since(s.receivedAtMs) + ' so far</div>';
      return '<li class="' + cls + (s.movement === 'Returned' ? ' ret' : '') + '"><div class="office">' + s.stop + '. ' + esc(s.toOffice) + '</div>' + meta + '</li>';
    }).join('');

    const actions = [];
    if (r.canReceive) actions.push('<button class="btn big grow" data-receive>' + Icons.sign + ' Receive and sign</button>');
    if (r.canRelease) actions.push('<button class="btn big grow" data-release>' + Icons.send + ' Release (forward / return / complete)</button>');

    el.innerHTML =
      '<div class="page-head"><div><div class="mono muted">' + esc(d.trk) + '</div><h1>' + esc(d.title) + '</h1></div><div>' + badge(d) + '</div></div>' +
      '<div class="status-hero"><div class="grow"><div class="where">' + esc(whereIs(d)) + '</div><div class="small muted">' + esc(heroNote) + '</div></div></div>' +
      (actions.length ? '<div class="row" style="margin-bottom:14px">' + actions.join('') + '</div>' : '') +
      '<div class="grid2"><div class="card"><h2>Route so far</h2><ul class="timeline">' + timeline + '</ul></div>' +
      '<div><div class="card"><h2>Details</h2><dl class="kv">' +
      '<dt>Type</dt><dd>' + esc(d.docType) + '</dd>' + (d.pages ? '<dt>Pages</dt><dd>' + esc(d.pages) + '</dd>' : '') +
      '<dt>From</dt><dd>' + esc(d.originOffice) + '</dd><dt>Logged</dt><dd>' + esc(d.loggedAt) + ' by ' + esc(d.loggedBy) + '</dd>' +
      (d.finalDest ? '<dt>Final destination</dt><dd>' + esc(d.finalDest) + '</dd>' : '') +
      '<dt>Stops</dt><dd>' + d.stops + (d.returns ? ' (' + d.returns + ' returned)' : '') + '</dd>' +
      (d.remarks && d.status !== 'Voided' ? '<dt>Remarks</dt><dd>' + esc(d.remarks) + '</dd>' : '') + '</dl></div>' +
      '<div class="card"><h2>Print</h2><div class="row">' +
      '<button class="btn secondary grow" data-report>' + Icons.print + ' Status report</button>' +
      '<button class="btn secondary grow" data-label>' + Icons.qr + ' Tracking label</button></div>' +
      (r.canVoid ? '<button class="btn ghost" data-void style="margin-top:8px">Void this entry</button>' : '') + '</div></div></div>';

    const reload = () => doc(el, trk);
    const q = s => el.querySelector(s);
    if (q('[data-receive]')) q('[data-receive]').onclick = () => receiveDialog(d, reload);
    if (q('[data-release]')) q('[data-release]').onclick = () => releaseDialog(d, r.previousOffice, reload);
    q('[data-label]').onclick = () => labelDialog(d.trk);
    q('[data-report]').onclick = e => busy(e.currentTarget, async () => Print.report(await Api.call('report', { trk: d.trk }))).catch(error);
    if (q('[data-void]')) q('[data-void]').onclick = () => voidDialog(d, reload);
  }

  function receiveDialog(d, done) {
    const u = App.user, mates = App.cfg.officeMates;
    const touch = navigator.maxTouchPoints > 0;
    const live = touch || !u.hasSignature;
    modal({
      title: 'Receive ' + d.trk,
      body: '<p class="small muted" style="margin-top:-6px">' + esc(d.title) + '</p>' +
        '<div class="notice info">Confirm the paper copy is in your hands, complete with its attachments, before you sign.</div>' +
        '<div class="choice"><label><input type="radio" name="m" value="live"' + (live ? ' checked' : '') + '> Sign now</label>' +
        '<label><input type="radio" name="m" value="stored"' + (live ? '' : ' checked') + (u.hasSignature ? '' : ' disabled') + '> Stored signature + PIN</label></div>' +
        (u.hasSignature ? '' : '<p class="small muted" style="margin-top:-6px">To use a stored signature on a desktop, set it up once in My Account.</p>') +
        '<div data-live-box><div data-pad></div><div class="row" style="justify-content:flex-end"><button class="btn ghost" data-clear>Clear</button></div></div>' +
        '<label class="f hidden" data-pin-box><span>Your PIN</span><input type="password" inputmode="numeric" autocomplete="off" maxlength="6" data-pin></label>' +
        (mates.length ? '<label class="f"><span>Receiving for someone else? (optional)</span><select data-for><option value="">No, I am the receiver</option>' +
          mates.map(m => '<option>' + esc(m.name) + '</option>').join('') + '</select><small>You still sign as yourself; the record shows "received for".</small></label>' : '') +
        '<div class="modal-foot"><button class="btn secondary" data-cancel>Cancel</button><button class="btn" data-ok>Confirm receipt</button></div>',
      onOpen: (box, close) => {
        const pad = SignaturePad.mount(box.querySelector('[data-pad]'));
        const sync = () => {
          const stored = box.querySelector('input[name=m]:checked').value === 'stored';
          box.querySelector('[data-live-box]').classList.toggle('hidden', stored);
          box.querySelector('[data-pin-box]').classList.toggle('hidden', !stored);
        };
        box.querySelectorAll('input[name=m]').forEach(i => i.addEventListener('change', sync)); sync();
        box.querySelector('[data-clear]').onclick = () => pad.clear();
        box.querySelector('[data-cancel]').onclick = () => close();
        box.querySelector('[data-ok]').onclick = e => {
          const method = box.querySelector('input[name=m]:checked').value;
          const body = { trk: d.trk, method, receivedFor: box.querySelector('[data-for]') ? box.querySelector('[data-for]').value : '' };
          if (method === 'live') { if (pad.isEmpty()) return toast('Please sign in the box first.', true); body.signature = pad.toDataURL(); }
          else { body.pin = box.querySelector('[data-pin]').value; if (!/^\d{4,6}$/.test(body.pin)) return toast('Enter your 4 to 6 digit PIN.', true); }
          busy(e.currentTarget, async () => {
            const res = await Api.call('receive', body);
            close(); toast('Received ' + res.trk + ' at ' + res.receivedAt + '.'); done();
          }).catch(error);
        };
      }
    });
  }

  function releaseDialog(d, previousOffice, done) {
    const lists = App.cfg.lists;
    const actions = (lists['Action'] || []).map(a => '<option>' + esc(a.label) + '</option>').join('');
    const reasons = (lists['Return Reason'] || []).map(a => '<option value="' + esc(a.code) + '" data-needs="' + (a.needsRemarks ? 1 : 0) + '">' +
      esc(a.code + ' - ' + a.label) + '</option>').join('');
    const isOrigin = d.originOffice === App.user.office;
    const prevIsOrigin = previousOffice === d.originOffice;
    modal({
      title: 'Release ' + d.trk,
      body: '<p class="small muted" style="margin-top:-6px">' + esc(d.title) + '</p>' +
        '<div class="choice"><label><input type="radio" name="n" value="forward" checked> Forward</label>' +
        (isOrigin ? '' : '<label><input type="radio" name="n" value="return"> Return</label>') +
        '<label><input type="radio" name="n" value="complete"> Complete</label></div>' +
        '<div data-sec="forward complete"><label class="f"><span>Action taken</span><select data-action><option value="">Choose...</option>' + actions + '</select></label></div>' +
        '<div data-sec="forward"><label class="f"><span>Forward to</span><select data-to><option value="">Choose the next office...</option>' +
        officeOptions('', App.user.office) + '</select>' +
        (d.finalDest ? '<small>Final destination named by the origin: ' + esc(d.finalDest) + '</small>' : '') + '</label></div>' +
        '<div data-sec="return"><span class="small" style="font-weight:600;color:var(--navy)">Return to</span><div class="choice">' +
        '<label><input type="radio" name="rt" value="previous" checked> <span>Previous office<br><small class="muted">' + esc(previousOffice) + '</small></span></label>' +
        (prevIsOrigin ? '' : '<label><input type="radio" name="rt" value="origin"> <span>Originating office<br><small class="muted">' + esc(d.originOffice) + '</small></span></label>') +
        '</div><label class="f"><span>Reason for return</span><select data-reason><option value="">Choose...</option>' + reasons + '</select></label></div>' +
        '<div data-sec="complete"><div class="notice warn">Completing ends the route here. The originating office will see it as Completed.</div></div>' +
        '<label class="f"><span data-rem-label>Remarks (optional)</span><textarea data-remarks maxlength="1000"></textarea></label>' +
        '<div class="modal-foot"><button class="btn secondary" data-cancel>Cancel</button><button class="btn" data-ok>Release</button></div>',
      onOpen: (box, close) => {
        const next = () => box.querySelector('input[name=n]:checked').value;
        const sync = () => {
          box.querySelectorAll('[data-sec]').forEach(s => s.classList.toggle('hidden', s.dataset.sec.split(' ').indexOf(next()) < 0));
          const opt = box.querySelector('[data-reason]').selectedOptions[0];
          const needs = next() === 'return' && opt && opt.dataset.needs === '1';
          box.querySelector('[data-rem-label]').textContent = needs ? 'Remarks (required for this reason)' : 'Remarks (optional)';
          box.querySelector('[data-ok]').textContent = next() === 'forward' ? 'Forward' : next() === 'return' ? 'Return' : 'Mark completed';
        };
        box.querySelectorAll('input[name=n]').forEach(i => i.addEventListener('change', sync));
        box.querySelector('[data-reason]').addEventListener('change', sync); sync();
        box.querySelector('[data-cancel]').onclick = () => close();
        box.querySelector('[data-ok]').onclick = e => {
          const body = { trk: d.trk, next: next(), remarks: box.querySelector('[data-remarks]').value.trim() };
          if (body.next !== 'return') { body.actionTaken = box.querySelector('[data-action]').value; if (!body.actionTaken) return toast('Choose the action taken.', true); }
          if (body.next === 'forward') { body.toOffice = box.querySelector('[data-to]').value; if (!body.toOffice) return toast('Choose the office to forward to.', true); }
          if (body.next === 'return') {
            body.returnTo = (box.querySelector('input[name=rt]:checked') || {}).value || 'previous';
            body.reasonCode = box.querySelector('[data-reason]').value;
            if (!body.reasonCode) return toast('Choose the reason for return.', true);
            const opt = box.querySelector('[data-reason]').selectedOptions[0];
            if (opt.dataset.needs === '1' && !body.remarks) return toast('Remarks are required for this reason.', true);
          }
          busy(e.currentTarget, async () => {
            const res = await Api.call('release', body);
            close(); toast(res.trk + ': ' + res.outcome + '.'); done();
          }).catch(error);
        };
      }
    });
  }

  function voidDialog(d, done) {
    modal({
      title: 'Void ' + d.trk,
      body: '<p>Voiding keeps the record but marks it cancelled. Use it for a wrong or duplicate entry.</p>' +
        '<label class="f"><span>Reason</span><textarea data-reason maxlength="500"></textarea></label>' +
        '<div class="modal-foot"><button class="btn secondary" data-cancel>Cancel</button><button class="btn danger" data-ok>Void entry</button></div>',
      onOpen: (box, close) => {
        box.querySelector('[data-cancel]').onclick = () => close();
        box.querySelector('[data-ok]').onclick = e => {
          const reason = box.querySelector('[data-reason]').value.trim();
          if (!reason) return toast('A reason is required.', true);
          busy(e.currentTarget, async () => { await Api.call('voidDoc', { trk: d.trk, reason }); close(); toast(d.trk + ' voided.'); done(); }).catch(error);
        };
      }
    });
  }

  /** Corner picker + print. Settings start from the office's saved choice. */
  function labelDialog(trk) {
    const s = Object.assign({}, App.cfg.label);
    const corners = ['UL', 'UR', 'LL', 'LR'];
    modal({
      title: 'Print tracking label',
      body: '<div class="row" style="align-items:flex-start;gap:16px"><div class="qr-preview">' + QR.svg(trk) +
        '<div class="mono" style="text-align:center;font-weight:700">' + esc(trk) + '</div></div>' +
        '<div class="grow"><p class="small" style="margin-top:0">Put the document\'s <b>first page</b> in the printer. Only this small QR code and number are printed, in the corner you pick.</p></div></div>' +
        '<label class="f"><span>Paper</span><select data-paper>' + Object.keys(Print.PAPER).map(k => '<option value="' + k + '"' + (k === s.paper ? ' selected' : '') + '>' + Print.PAPER_NAMES[k] + '</option>').join('') + '</select></label>' +
        '<div class="choice"><label><input type="radio" name="o" value="portrait"' + (s.orientation !== 'landscape' ? ' checked' : '') + '> Portrait</label>' +
        '<label><input type="radio" name="o" value="landscape"' + (s.orientation === 'landscape' ? ' checked' : '') + '> Landscape</label></div>' +
        '<span class="small" style="font-weight:600;color:var(--navy)">Corner (keep it clear of the header and text)</span>' +
        '<div class="choice" style="grid-template-columns:1fr 1fr">' + corners.map(c => '<label><input type="radio" name="c" value="' + c + '"' + (c === s.corner ? ' checked' : '') + '> ' + Print.CORNERS[c] + '</label>').join('') + '</div>' +
        '<label class="f" style="display:flex;gap:8px;align-items:center"><input type="checkbox" data-remember checked style="width:18px;height:18px"> <span style="margin:0;font-weight:500">Remember as my office\'s default</span></label>' +
        '<p class="small muted">Size: 2 cm QR code with the number in 8 pt bold, 1 cm from the page edges. Fine-tune the position in My Account &gt; Label settings.</p>' +
        '<div class="modal-foot"><button class="btn secondary" data-cancel>Cancel</button><button class="btn" data-ok>' + Icons.print + ' Print label</button></div>',
      onOpen: (box, close) => {
        box.querySelector('[data-cancel]').onclick = () => close();
        box.querySelector('[data-ok]').onclick = async () => {
          s.paper = box.querySelector('[data-paper]').value;
          s.orientation = box.querySelector('input[name=o]:checked').value;
          s.corner = box.querySelector('input[name=c]:checked').value;
          const remember = box.querySelector('[data-remember]').checked;
          close();
          Print.label(trk, s, false);
          if (remember && !isViewer()) {
            App.cfg.label = Object.assign({}, s);
            Api.call('saveLabel', { label: s }).catch(error);
          }
        };
      }
    });
  }

  // ---------------- new document ----------------
  async function newdoc(el) {
    if (isViewer()) { el.innerHTML = '<div class="notice warn">Viewer accounts cannot log documents.</div>'; return; }
    const types = (App.cfg.lists['Document Type'] || []).map(t => '<option>' + esc(t.label) + '</option>').join('');
    el.innerHTML = '<h1>Log a document</h1><p class="muted">Enter the details and the <b>first</b> office only. Each office that receives it chooses where it goes next.</p>' +
      '<form class="card" data-form autocomplete="off">' +
      '<label class="f"><span>Title / subject</span><input type="text" name="title" maxlength="300" required>' +
      '<small>Keep it general. Do not include patient or client names, diagnoses or case numbers.</small></label>' +
      '<div class="grid2"><label class="f"><span>Document type</span><select name="docType" required><option value="">Choose...</option>' + types + '</select></label>' +
      '<label class="f"><span>Pages / attachments (optional)</span><input type="text" name="pages" maxlength="100" placeholder="e.g. 3 pages, 2 attachments"></label></div>' +
      '<div class="grid2"><label class="f"><span>Send to (first office)</span><select name="firstOffice" required><option value="">Choose...</option>' + officeOptions('', App.user.office) + '</select></label>' +
      '<label class="f"><span>Final destination (optional)</span><select name="finalDest"><option value="">Not specified</option>' + officeOptions('', '') + '</select>' +
      '<small>Only if you already know where it must end up.</small></label></div>' +
      '<label class="f"><span>Remarks (optional)</span><textarea name="remarks" maxlength="1000"></textarea></label>' +
      '<button class="btn big block" type="submit">Log and get tracking number</button></form>';
    const form = el.querySelector('[data-form]');
    form.onsubmit = e => {
      e.preventDefault();
      const doc = Object.fromEntries(new FormData(form).entries());
      if (!doc.title.trim() || !doc.docType || !doc.firstOffice) return toast('Fill in the title, type and first office.', true);
      busy(form.querySelector('[type=submit]'), async () => {
        const r = await Api.call('logDoc', { doc });
        el.innerHTML = '<div class="card" style="text-align:center"><div class="notice ok">Logged and sent to ' + esc(doc.firstOffice) + '.</div>' +
          '<div class="qr-preview">' + QR.svg(r.trk) + '</div><div class="big-trk">' + esc(r.trk) + '</div>' +
          '<p class="muted">Print the label on the document\'s first page, then bring the paper copy to ' + esc(doc.firstOffice) + '.</p>' +
          '<div class="row" style="justify-content:center"><button class="btn big" data-label>' + Icons.qr + ' Print label</button>' +
          '<a class="btn secondary big" href="#/doc/' + esc(r.trk) + '">Open document</a><a class="btn ghost" href="#/new" data-again>Log another</a></div></div>';
        el.querySelector('[data-label]').onclick = () => labelDialog(r.trk);
        el.querySelector('[data-again]').onclick = e2 => { e2.preventDefault(); newdoc(el); };
      }).catch(error);
    };
  }

  // ---------------- my office's documents ----------------
  async function mine(el) {
    el.innerHTML = '<div class="page-head"><div><h1>Sent by my office</h1><p class="muted">Where each document from ' + esc(App.user.office) + ' is now.</p></div>' +
      '<select data-filter style="max-width:220px"><option value="">All</option><option value="open">Still moving</option>' +
      '<option>Completed</option><option>Voided</option></select></div><div class="card" data-body>' + loading + '</div>';
    const r = await Api.call('myOffice', { days: 180 });
    const draw = () => {
      const f = el.querySelector('[data-filter]').value;
      const docs = r.docs.filter(d => !f || (f === 'open' ? (d.status === 'In Transit' || d.status === 'Received') : d.status === f));
      el.querySelector('[data-body]').innerHTML = docs.length ? '<ul class="list">' + docs.map(d => docItem(d,
        (d.status === 'In Transit' || d.status === 'Received') ? esc(since(d.statusSinceMs)) + ' there' : esc(d.statusSince))).join('') + '</ul>'
        : '<div class="empty">No documents here.</div>';
      wireItems(el);
    };
    el.querySelector('[data-filter]').onchange = draw; draw();
  }

  // ---------------- reports (Admin, Viewer) ----------------
  async function reports(el) {
    if (!isAdmin()) { el.innerHTML = '<div class="notice warn">Reports are for Admin accounts.</div>'; return; }
    const today = new Date(), first = new Date(today.getFullYear(), today.getMonth(), 1);
    const iso = x => new Date(x.getTime() - x.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    el.innerHTML = '<h1>Reports</h1><div class="card"><div class="grid2">' +
      '<label class="f"><span>From</span><input type="date" data-from value="' + iso(first) + '"></label>' +
      '<label class="f"><span>To</span><input type="date" data-to value="' + iso(today) + '"></label></div>' +
      '<div class="grid2"><label class="f"><span>Status</span><select data-status><option value="">All</option><option>In Transit</option><option>Received</option><option>Completed</option><option>Voided</option></select></label>' +
      '<label class="f"><span>Office</span><select data-office><option value="">All offices</option>' + officeOptions('', '') + '</select></label></div>' +
      '<label class="f"><span>Search</span><input type="search" data-q placeholder="Tracking no., title, type..."></label>' +
      '<button class="btn" data-run>Show</button></div><div data-out></div>';
    const run = async () => {
      const out = el.querySelector('[data-out]');
      out.innerHTML = loading;
      const p = { from: el.querySelector('[data-from]').value, to: el.querySelector('[data-to]').value };
      const [s, list] = await Promise.all([Api.call('stats', p), Api.call('search', Object.assign({
        status: el.querySelector('[data-status]').value, office: el.querySelector('[data-office]').value, q: el.querySelector('[data-q]').value }, p))]);
      const t = s.totals;
      out.innerHTML = '<div class="stats">' + [['Logged', t.logged], ['In transit', t.inTransit], ['Received, pending', t.received], ['Completed', t.completed], ['Voided', t.voided]]
        .map(x => '<div class="stat"><b>' + x[1] + '</b><span>' + x[0] + '</span></div>').join('') + '</div>' +
        '<div class="card"><h2>Time held per office</h2><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Office</th><th>Received</th><th>Average time held</th><th>Pending now</th><th>Returns made</th></tr></thead><tbody>' +
        (s.offices.map(o => '<tr><td>' + esc(o.office) + '</td><td>' + o.received + '</td><td>' + (o.avgHeldMinutes == null ? '' : minutes(o.avgHeldMinutes)) +
          '</td><td>' + o.pending + '</td><td>' + o.returnsMade + '</td></tr>').join('') || '<tr><td colspan="5" class="muted">No data</td></tr>') +
        '</tbody></table></div></div>' +
        (s.reasons.length ? '<div class="card"><h2>Return reasons</h2><table class="tbl"><tbody>' + s.reasons.map(x => '<tr><td>' + esc(x.reason) + '</td><td style="width:60px">' + x.count + '</td></tr>').join('') + '</tbody></table></div>' : '') +
        '<div class="card"><h2>Documents <span class="muted small">(' + list.total + (list.total > 500 ? ', newest 500 shown' : '') + ')</span></h2>' +
        (list.docs.length ? '<ul class="list">' + list.docs.map(d => docItem(d, esc(d.loggedAt))).join('') + '</ul>' : '<div class="empty">No documents match.</div>') + '</div>';
      wireItems(out);
    };
    el.querySelector('[data-run]').onclick = e => busy(e.currentTarget, run).catch(error);
    run().catch(error);
  }

  // ---------------- my account ----------------
  async function account(el) {
    const u = App.user, s = App.cfg.label;
    el.innerHTML = '<h1>My account</h1>' +
      '<div class="card"><dl class="kv"><dt>Name</dt><dd>' + esc(u.name) + '</dd><dt>Position</dt><dd>' + esc(u.position) + '</dd>' +
      '<dt>Office</dt><dd>' + esc(u.office) + '</dd><dt>Role</dt><dd>' + esc(u.role) + '</dd><dt>Username</dt><dd class="mono">' + esc(u.username) + '</dd></dl></div>' +
      '<div class="card"><h2>Stored signature and PIN</h2><p class="small muted">For signing on a desktop without a touchscreen. Your PIN is personal: never share it, not even with your secretary.</p>' +
      '<div data-sig>' + (u.hasSignature ? '<div class="notice ok">Your stored signature is set up.' + (u.pinLocked ? ' <b>PIN locked: ask ICTU to reset it.</b>' : '') + '</div>' : '<div class="notice warn">Not set up yet.</div>') + '</div>' +
      '<button class="btn secondary" data-set-sig>' + (u.hasSignature ? 'Replace signature and PIN' : 'Set up signature and PIN') + '</button></div>' +
      (isViewer() ? '' : '<div class="card"><h2>Label settings for ' + esc(u.office) + '</h2><p class="small muted">Saved for everyone in your office. Print a test on plain paper to check the position, then adjust.</p>' +
      '<div class="grid2"><label class="f"><span>Paper</span><select data-paper>' + Object.keys(Print.PAPER).map(k => '<option value="' + k + '"' + (k === s.paper ? ' selected' : '') + '>' + Print.PAPER_NAMES[k] + '</option>').join('') + '</select></label>' +
      '<label class="f"><span>Orientation</span><select data-orient><option value="portrait">Portrait</option><option value="landscape"' + (s.orientation === 'landscape' ? ' selected' : '') + '>Landscape</option></select></label></div>' +
      '<label class="f"><span>Corner</span><select data-corner>' + Object.keys(Print.CORNERS).map(c => '<option value="' + c + '"' + (c === s.corner ? ' selected' : '') + '>' + Print.CORNERS[c] + '</option>').join('') + '</select></label>' +
      '<div class="grid2"><label class="f"><span>Move right (mm, negative = left)</span><input type="number" step="0.5" min="-30" max="30" data-ox value="' + s.offsetX + '"></label>' +
      '<label class="f"><span>Move down (mm, negative = up)</span><input type="number" step="0.5" min="-30" max="30" data-oy value="' + s.offsetY + '"></label></div>' +
      '<div class="row"><button class="btn secondary" data-test>Print test page</button><button class="btn" data-save-label>Save</button></div></div>') +
      '<div class="card"><h2>Change password</h2><form data-pw autocomplete="off">' +
      '<label class="f"><span>Current password</span><input type="password" name="oldPassword" autocomplete="current-password"></label>' +
      '<label class="f"><span>New password</span><input type="password" name="newPassword" autocomplete="new-password"><small>At least 8 characters, with letters and numbers.</small></label>' +
      '<button class="btn" type="submit">Change password</button></form></div>' +
      '<button class="btn secondary block" data-logout>Log out</button>' +
      '<p class="small muted" style="text-align:center;margin-top:16px">' + esc(App.cfg.app.name) + ' v' + esc(App.cfg.app.version) + ' &middot; app ' + esc(App.VERSION) + '</p>';

    const q = x => el.querySelector(x);
    q('[data-set-sig]').onclick = () => signatureSetup(() => account(el));
    const labelNow = () => ({ paper: q('[data-paper]').value, orientation: q('[data-orient]').value, corner: q('[data-corner]').value,
      offsetX: Number(q('[data-ox]').value) || 0, offsetY: Number(q('[data-oy]').value) || 0 });
    if (q('[data-test]')) {
      q('[data-test]').onclick = () => Print.label('DT-0000-00-000', labelNow(), true);
      q('[data-save-label]').onclick = e => busy(e.currentTarget, async () => {
        await Api.call('saveLabel', { label: labelNow() }); App.cfg.label = labelNow(); toast('Label settings saved for ' + u.office + '.');
      }).catch(error);
    }
    q('[data-pw]').onsubmit = e => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.target).entries());
      busy(e.target.querySelector('[type=submit]'), async () => { await Api.call('changePassword', f); e.target.reset(); toast('Password changed.'); }).catch(error);
    };
    q('[data-logout]').onclick = () => App.logout();
  }

  function signatureSetup(done) {
    modal({
      title: 'Stored signature and PIN',
      body: '<p class="small">Sign the way you sign official documents. This stored signature is stamped only when you enter your PIN, and the record marks it "Stored signature (PIN)".</p>' +
        '<div data-pad></div><div class="row" style="justify-content:flex-end"><button class="btn ghost" data-clear>Clear</button></div>' +
        '<div class="grid2"><label class="f"><span>New PIN (4 to 6 digits)</span><input type="password" inputmode="numeric" maxlength="6" data-pin autocomplete="off"></label>' +
        '<label class="f"><span>Repeat PIN</span><input type="password" inputmode="numeric" maxlength="6" data-pin2 autocomplete="off"></label></div>' +
        '<label class="f"><span>Your password (to confirm it is you)</span><input type="password" data-pw autocomplete="current-password"></label>' +
        '<div class="notice info small">Privacy notice: your signature image and a scrambled (hashed) copy of your PIN are stored in the office\'s private Google account, ' +
        'only to record document receipts, as allowed by the Data Privacy Act (RA 10173). Ask ICTU to see or correct your record.</div>' +
        '<div class="modal-foot"><button class="btn secondary" data-cancel>Cancel</button><button class="btn" data-ok>Save</button></div>',
      onOpen: (box, close) => {
        const pad = SignaturePad.mount(box.querySelector('[data-pad]'));
        box.querySelector('[data-clear]').onclick = () => pad.clear();
        box.querySelector('[data-cancel]').onclick = () => close();
        box.querySelector('[data-ok]').onclick = e => {
          const pin = box.querySelector('[data-pin]').value;
          if (pad.isEmpty()) return toast('Please sign in the box first.', true);
          if (!/^\d{4,6}$/.test(pin)) return toast('The PIN must be 4 to 6 digits.', true);
          if (pin !== box.querySelector('[data-pin2]').value) return toast('The two PINs do not match.', true);
          if (/^(\d)\1+$/.test(pin) || '0123456789'.indexOf(pin) >= 0) return toast('Choose a PIN that is harder to guess.', true);
          busy(e.currentTarget, async () => {
            const r = await Api.call('setSignature', { signature: pad.toDataURL(), pin, password: box.querySelector('[data-pw]').value });
            App.user = r.user; close(); toast('Stored signature and PIN saved.'); done();
          }).catch(error);
        };
      }
    });
  }

  // ---------------- admin ----------------
  async function admin(el) {
    if (!isAdmin()) { el.innerHTML = '<div class="notice warn">Admin only.</div>'; return; }
    el.innerHTML = '<div class="page-head"><h1>Admin</h1><button class="btn" data-new>+ New user</button></div>' +
      '<div class="card"><h2>Users</h2><input type="search" placeholder="Search name, office, username" data-q style="margin-bottom:10px"><div class="tbl-wrap" data-users>' + loading + '</div></div>' +
      '<div class="card"><h2>Offices</h2><div data-offices>' + loading + '</div>' +
      '<div class="row" style="margin-top:10px"><input type="text" class="grow" placeholder="New office name" data-new-office>' +
      '<input type="text" style="max-width:110px" placeholder="Code" data-new-code><button class="btn secondary" data-add-office>Add</button></div></div>' +
      '<p class="small muted">Document types, actions and return reasons are edited in the Lists tab of the Google Sheet.</p>';
    const [users, offices] = await Promise.all([Api.call('listUsers'), Api.call('listOffices')]);
    const drawUsers = () => {
      const q = el.querySelector('[data-q]').value.toLowerCase();
      const rows = users.users.filter(x => !q || [x.name, x.username, x.office, x.role].join(' ').toLowerCase().indexOf(q) >= 0);
      el.querySelector('[data-users]').innerHTML = '<table class="tbl"><thead><tr><th>Name</th><th>Office</th><th>Role</th><th>Status</th><th></th></tr></thead><tbody>' +
        rows.map(x => '<tr><td><b>' + esc(x.name) + '</b><br><span class="mono small muted">' + esc(x.username) + '</span></td><td>' + esc(x.office) + '</td><td>' + esc(x.role) + '</td>' +
          '<td>' + esc(x.status) + (x.mustChange ? '<br><small class="muted">temp password</small>' : '') + (x.pinLocked ? '<br><small style="color:var(--red)">PIN locked</small>' : '') +
          (x.hasSignature ? '' : '<br><small class="muted">no stored signature</small>') + '</td>' +
          '<td><button class="btn secondary" data-u="' + esc(x.username) + '">Manage</button></td></tr>').join('') + '</tbody></table>';
      el.querySelectorAll('[data-u]').forEach(b => b.onclick = () => manageUser(users.users.filter(x => x.username === b.dataset.u)[0], () => admin(el)));
    };
    el.querySelector('[data-q]').oninput = drawUsers; drawUsers();
    el.querySelector('[data-offices]').innerHTML = '<table class="tbl"><tbody>' + offices.offices.map(o => '<tr><td>' + esc(o.office) + '</td><td class="mono">' + esc(o.code) + '</td>' +
      '<td>' + (o.active ? 'Active' : '<span class="muted">Inactive</span>') + '</td><td style="text-align:right"><button class="btn ghost" data-o="' + esc(o.office) + '" data-active="' + (o.active ? 1 : 0) + '">' +
      (o.active ? 'Deactivate' : 'Activate') + '</button></td></tr>').join('') + '</tbody></table>';
    el.querySelectorAll('[data-o]').forEach(b => b.onclick = () => busy(b, async () => {
      await Api.call('saveOffice', { office: b.dataset.o, active: b.dataset.active !== '1' }); await App.refreshConfig(); admin(el);
    }).catch(error));
    el.querySelector('[data-add-office]').onclick = e => {
      const name = el.querySelector('[data-new-office]').value.trim();
      if (!name) return toast('Type the office name.', true);
      busy(e.currentTarget, async () => {
        await Api.call('saveOffice', { office: name, code: el.querySelector('[data-new-code]').value.trim(), active: true });
        await App.refreshConfig(); toast('Office added.'); admin(el);
      }).catch(error);
    };
    el.querySelector('[data-new]').onclick = () => userForm(null, () => admin(el));
  }

  function showTempPassword(username, pw) {
    modal({ title: 'Temporary password',
      body: '<p>Give these to the user in person or by private message. They must change the password at first login. This password is shown only once.</p>' +
        '<dl class="kv"><dt>Username</dt><dd class="mono">' + esc(username) + '</dd><dt>Password</dt><dd class="mono" style="font-size:1.3rem">' + esc(pw) + '</dd></dl>' +
        '<div class="modal-foot"><button class="btn" data-ok>Done</button></div>',
      onOpen: (box, close) => { box.querySelector('[data-ok]').onclick = () => close(); } });
  }

  function userForm(u, done) {
    const roles = App.cfg.roles;
    modal({
      title: u ? 'Edit ' + u.username : 'New user',
      body: '<form data-f autocomplete="off">' + (u ? '' : '<label class="f"><span>Username</span><input type="text" name="username" placeholder="e.g. jdelacruz" autocapitalize="off"><small>Letters, numbers, dots or underscores.</small></label>') +
        '<label class="f"><span>Full name</span><input type="text" name="name" value="' + esc(u ? u.name : '') + '"></label>' +
        '<label class="f"><span>Position</span><input type="text" name="position" value="' + esc(u ? u.position : '') + '"></label>' +
        '<label class="f"><span>Office</span><select name="office">' + officeOptions(u ? u.office : '', '') + '</select></label>' +
        '<label class="f"><span>Role</span><select name="role">' + [roles.USER, roles.VIEWER, roles.ADMIN].map(r => '<option' + (u && u.role === r ? ' selected' : '') + '>' + esc(r) + '</option>').join('') + '</select>' +
        '<small>Section User: logs, receives and releases documents. Viewer: looks up and prints only. Admin: ICTU.</small></label>' +
        '<div class="modal-foot"><button type="button" class="btn secondary" data-cancel>Cancel</button><button class="btn" type="submit">' + (u ? 'Save' : 'Create user') + '</button></div></form>',
      onOpen: (box, close) => {
        box.querySelector('[data-cancel]').onclick = () => close();
        const f = box.querySelector('[data-f]');
        f.onsubmit = e => {
          e.preventDefault();
          const user = Object.fromEntries(new FormData(f).entries());
          if (u) user.username = u.username;
          busy(f.querySelector('[type=submit]'), async () => {
            if (u) { await Api.call('updateUser', { user }); close(); toast('Saved.'); done(); }
            else { const r = await Api.call('createUser', { user }); close(); done(); showTempPassword(r.username, r.tempPassword); }
          }).catch(error);
        };
      }
    });
  }

  function manageUser(u, done) {
    const act = async (kind, confirmText) => {
      if (confirmText && !(await confirmBox('Confirm', confirmText, 'Yes', kind === 'disable'))) return;
      try {
        const r = await Api.call('userAction', { username: u.username, kind });
        done();
        if (r.tempPassword) showTempPassword(u.username, r.tempPassword); else toast('Done.');
      } catch (e) { error(e); }
    };
    modal({
      title: u.name,
      body: '<p class="small muted">' + esc(u.username + ' · ' + u.office + ' · ' + u.role + ' · ' + u.status) + (u.lastLogin ? ' · last login ' + esc(u.lastLogin) : '') + '</p>' +
        '<div style="display:grid;gap:8px">' +
        '<button class="btn secondary" data-k="edit">Edit name, office or role</button>' +
        '<button class="btn secondary" data-k="password">Reset password (also unlocks)</button>' +
        '<button class="btn secondary" data-k="pin">Reset PIN (keeps signature)</button>' +
        '<button class="btn secondary" data-k="signature">Clear stored signature and PIN</button>' +
        (u.status === 'Disabled' ? '<button class="btn" data-k="enable">Enable account</button>' : '<button class="btn danger" data-k="disable">Disable account</button>') +
        (u.status === 'Locked' ? '<button class="btn" data-k="enable">Unlock account</button>' : '') + '</div>',
      onOpen: (box, close) => {
        box.querySelectorAll('[data-k]').forEach(b => b.onclick = () => {
          const k = b.dataset.k; close();
          if (k === 'edit') return userForm(u, done);
          const msgs = { password: 'Give ' + u.name + ' a new temporary password?', pin: 'Reset the PIN of ' + u.name + '? Only do this when they ask in person.',
            signature: 'Clear the stored signature and PIN of ' + u.name + '?', disable: 'Disable ' + u.name + '? They are signed out at once.' };
          act(k, msgs[k]);
        });
      }
    });
  }

  return { inbox, track, doc, newdoc, mine, reports, account, admin, signatureSetup };
})();
