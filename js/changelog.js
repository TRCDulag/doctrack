/**
 * changelog.js: the list of changes, newest first. It is shown on the README page (readme.html).
 *
 * EVERY TIME THE APP OR THE SCRIPT CHANGES, add an entry at the TOP with the new version
 * (the same number as VERSION in js/app.js and CACHE_VERSION in sw.js), the date,
 * and one plain line per change that a user would notice.
 * If the Apps Script files changed too, say so in "update", so ICTU knows to redeploy.
 */
window.CHANGELOG = [
  {
    version: '1.2.0',
    date: '2026-10-15',
    changes: [
      'Added a README button on the login page. It opens a short guide to the app and this list of changes.',
      'Started this changelog. Every change from today on is listed here.'
    ],
    update: 'App files only. No Apps Script change.'
  }
];
