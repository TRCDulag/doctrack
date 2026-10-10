/**
 * config.js: the ONLY file you normally need to edit.
 *
 * apiUrl: the Apps Script Web app URL (ends in /exec). Get it from Deploy > Manage deployments.
 *         Keep the same deployment when updating the script, so this URL never changes.
 * Images: replace the files in assets/ (keep the same names), or point these paths to new files.
 */
window.APP_CONFIG = {
  apiUrl: 'https://script.google.com/macros/s/AKfycbzFUTfOOlUJJ7oadBOdbqSO3wjnZrfd9pdARCXngh4V9yJoL66zISo5hhSwkag4BHCq/exec',

  appName: 'Document Tracking',
  orgName: 'DOH Treatment and Rehabilitation Center - Dulag',
  orgAddress: 'Brgy. Highway, Dulag, Leyte',

  logos: {
    // Header rule: WHITE header on dark or navy backgrounds, BLACK header on white or bright backgrounds.
    headerWhite: 'assets/logos/header-white.png',  // login wallpaper on phones and the navy app bar on wide screens
    headerBlack: 'assets/logos/header-black.png',  // printed status report (white paper)
    main: 'assets/logos/trc-dulag.png'             // round seal in the navy app bar on phones, where the full header is too wide
  },
  wallpaper: 'assets/wallpaper/login.jpg',          // login background: the facility banner, softened (less saturation and contrast)

  requestTimeoutSeconds: 30
};
