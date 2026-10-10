/**
 * print.js: the two printouts.
 *
 * 1) Print-over label: only the QR code (2 cm) with the tracking number (8 pt bold) under it, placed
 *    in the chosen corner, 10 mm from the edges (+ the office's calibration offset). The user feeds the
 *    document's actual first page into the printer, so nothing else is printed.
 * 2) Routing status report (A4): the offices reached so far, the current pending office highlighted,
 *    an inquiry box and acknowledgment lines.
 */
const Print = (() => {
  // Paper sizes in millimetres (portrait). "Long" is the 8.5 x 13 in long bond common in government offices.
  const PAPER = { A4: [210, 297], Letter: [215.9, 279.4], Long: [215.9, 330.2], Legal: [215.9, 355.6] };
  const PAPER_NAMES = { A4: 'A4 (210 x 297 mm)', Letter: 'Letter (8.5 x 11 in)', Long: 'Long / Folio (8.5 x 13 in)', Legal: 'Legal (8.5 x 14 in)' };
  const CORNERS = { UL: 'Upper left', UR: 'Upper right', LL: 'Lower left', LR: 'Lower right' };
  const EDGE = 10, LABEL_W = 24, LABEL_H = 24;   // mm: a 20 mm QR centred over the number, which is a bit wider

  function pageSize(s) {
    const p = PAPER[s.paper] || PAPER.A4;
    return s.orientation === 'landscape' ? [p[1], p[0]] : [p[0], p[1]];
  }

  /** Top-left position of the label on the page, in mm. */
  function labelPos(s) {
    const [W, H] = pageSize(s);
    const left = /L$/.test(s.corner) ? EDGE : W - EDGE - LABEL_W;
    const top = /^U/.test(s.corner) ? EDGE : H - EDGE - LABEL_H;
    return [left + Number(s.offsetX || 0), top + Number(s.offsetY || 0)];
  }

  function run(html, pageCss) {
    const root = document.getElementById('print-root');
    let style = document.getElementById('print-page-style');
    if (!style) { style = document.createElement('style'); style.id = 'print-page-style'; document.head.appendChild(style); }
    style.textContent = '@media print { @page { ' + pageCss + ' } }';
    root.innerHTML = html;
    document.body.classList.add('printing');
    const cleanup = () => { document.body.classList.remove('printing'); root.innerHTML = ''; window.removeEventListener('afterprint', cleanup); };
    window.addEventListener('afterprint', cleanup);
    const imgs = Array.from(root.querySelectorAll('img'));
    Promise.all(imgs.map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; }))).then(() => {
      setTimeout(() => { window.print(); setTimeout(cleanup, 1000); }, 50);
    });
  }

  /** Prints the label. With test=true it also prints a dashed page outline and instructions, on plain paper. */
  function label(trk, s, test) {
    const [W, H] = pageSize(s);
    const [x, y] = labelPos(s);
    let html = '<div class="lbl-page" style="width:' + W + 'mm;height:' + H + 'mm">';
    if (test) {
      html += '<div class="lbl-test-frame" style="left:' + EDGE + 'mm;top:' + EDGE + 'mm;width:' + (W - 2 * EDGE) + 'mm;height:' + (H - 2 * EDGE) + 'mm"></div>' +
        '<div class="lbl-test-note"><b>Label position test</b><br>' + UI.esc(PAPER_NAMES[s.paper] + ', ' + s.orientation + ', ' + CORNERS[s.corner]) +
        '<br><br>The dashed line should be 10 mm from every edge.<br>Lay this sheet over a document page against a window or light: ' +
        'if the label covers the header or text, choose another corner or adjust the offset in My Account.</div>';
    }
    html += '<div class="lbl" style="left:' + x + 'mm;top:' + y + 'mm">' + QR.svg(trk) + '<div class="n">' + UI.esc(trk) + '</div></div></div>';
    run(html, 'size: ' + W + 'mm ' + H + 'mm; margin: 0;');
  }

  function dt(text) { return UI.esc(text || ''); }

  /** Prints the routing status report for data returned by the "report" request. */
  function report(r) {
    const cfg = window.APP_CONFIG;
    const d = r.doc;
    const last = r.stops[r.stops.length - 1];
    const pendingOffice = (d.status === 'In Transit' || d.status === 'Received') ? d.currentOffice : '';
    const rows = r.stops.map(s => {
      const isPending = s === last && pendingOffice;
      const received = s.receivedAt
        ? dt(s.receivedBy) + (s.receivedFor ? '<br><small>for ' + dt(s.receivedFor) + '</small>' : '') +
          (s.signature ? '<img class="sig" src="' + s.signature + '" alt="signature">' : '') + '<small>' + dt(s.signMethod) + '</small>'
        : '<i>Not yet received</i>';
      const held = s.releasedAt ? UI.minutes(s.heldMinutes) : (s.receivedAt ? UI.minutes((r.printedAtMs - s.receivedAtMs) / 60000) + ' so far' : '');
      const outcome = s.releasedAt
        ? dt(s.action) + (s.returnReason ? '<br><small>' + dt(s.returnReason) + '</small>' : '') +
          '<br><small>' + dt(s.outcome) + ', ' + dt(s.releasedAt) + '</small>' + (s.remarks ? '<br><small>Remarks: ' + dt(s.remarks) + '</small>' : '')
        : (isPending ? '<b>PENDING</b>' : '');
      return '<tr class="' + (isPending ? 'pending' : '') + '"><td>' + s.stop + '</td><td>' + dt(s.toOffice) +
        '<br><small>' + dt(s.movement) + ' by ' + dt(s.fromOffice) + ', ' + dt(s.sentAt) + '</small></td>' +
        '<td>' + received + '</td><td>' + dt(s.receivedAt) + '</td><td>' + outcome + '</td><td>' + held + '</td></tr>';
    }).join('');

    let pendingLine = 'This document is ' + dt(d.status).toLowerCase() + '.';
    if (d.status === 'In Transit') pendingLine = 'Sent to <b>' + dt(d.currentOffice) + '</b> on ' + dt(last.sentAt) + ' and <b>not yet received</b> (' + UI.minutes((r.printedAtMs - last.sentAtMs) / 60000) + ').';
    if (d.status === 'Received') pendingLine = 'Pending at <b>' + dt(d.currentOffice) + '</b>, received ' + dt(last.receivedAt) + ' by ' + dt(last.receivedBy) + ' (' + UI.minutes((r.printedAtMs - last.receivedAtMs) / 60000) + ' so far).';

    const html = '<div class="rep" style="position:relative">' +
      '<img class="hdr" src="' + UI.esc(cfg.logos.headerBlack) + '" alt="">' +
      '<h1>DOCUMENT ROUTING STATUS REPORT</h1>' +
      '<div class="sub">As of ' + dt(r.printedAt) + '</div>' +
      '<div class="qr">' + QR.svg(d.trk) + dt(d.trk) + '</div>' +
      '<table class="det" style="width:76%">' +
      '<tr><td>Tracking No.</td><td><b>' + dt(d.trk) + '</b></td></tr>' +
      '<tr><td>Title / Subject</td><td>' + dt(d.title) + '</td></tr>' +
      '<tr><td>Document Type</td><td>' + dt(d.docType) + (d.pages ? ' &middot; ' + dt(d.pages) : '') + '</td></tr>' +
      '<tr><td>Originating Office</td><td>' + dt(d.originOffice) + ' &middot; logged by ' + dt(d.loggedBy) + ', ' + dt(d.loggedAt) + '</td></tr>' +
      (d.finalDest ? '<tr><td>Final Destination</td><td>' + dt(d.finalDest) + '</td></tr>' : '') +
      '<tr><td>Current Status</td><td>' + pendingLine + '</td></tr>' +
      '</table>' +
      '<table><thead><tr><th style="width:7mm">#</th><th>Office</th><th>Received by / signature</th><th style="width:27mm">Date &amp; time received</th>' +
      '<th>Action / outcome</th><th style="width:18mm">Time held</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<div class="small" style="margin:-2mm 0 4mm;font-size:8pt;color:#444">Only offices the document has reached are listed. The next office is chosen by the office that releases it.</div>' +
      '<div class="box"><b>Follow-up inquiry' + (pendingOffice ? ' to ' + dt(pendingOffice) : '') + '</b>Remarks / action to be taken / expected release date:</div>' +
      '<div class="sigs"><div>Inquired by (name, signature, date)</div><div>Acknowledged by ' + (pendingOffice ? dt(pendingOffice) + ' ' : '') + '(name, signature, date)</div></div>' +
      '<div class="foot"><span>Printed by ' + dt(r.printedBy) + ', ' + dt(r.printedAt) + '. System-generated from the ' + dt(cfg.appName) + ' app.</span><span>' + dt(d.trk) + '</span></div>' +
      '</div>';
    run(html, 'size: A4 portrait; margin: 0;');
  }

  return { label, report, PAPER, PAPER_NAMES, CORNERS, labelPos, pageSize };
})();
