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
    version: '1.4.0',
    date: '2026-10-19',
    changes: [
      'A cleaner, calmer look on every screen. The colours, logos, steps and buttons you know are the same.',
      'On a computer, your work now sits on one white page beside the menu, so it is easier to focus on.',
      'Each document shows one clear status: yellow on the way, blue received, red returned, green completed, grey voided.',
      'The route of a document now marks where it is "Now", and returned stops show in red.',
      'If you miss a box or choose nothing, the message now shows right under that box, not only at the bottom of the screen.',
      'While a list is loading you see grey placeholder rows, and empty lists tell you what will appear there.',
      'If something cannot load, the screen says what went wrong, what to do, and gives a "Try again" button.',
      'Reports: the filters fit on one row, and the totals and numbers line up neatly.',
      'Bigger, darker small text, easier-to-tap buttons, and a clear outline for keyboard users.',
      'Long document titles now show in full instead of being cut off.'
    ],
    update: 'App files only. No Apps Script or Sheet change.'
  },
  {
    version: '1.2.1',
    date: '2026-10-15',
    changes: [
      'The README page is now picture-based: a diagram of how a document moves, numbered steps with icons, and screenshots of each screen.'
    ],
    update: 'App files only. No Apps Script change.'
  },
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
