// ─── Tiger Takes on the Thames · site configuration ───────────────────────────
// Everything that changes per deployment lives here. No secrets in this file:
// Strava keys go in Netlify environment variables (see README).

window.TIGER_CONFIG = {
  // Google Sheet ID (the long string in the sheet URL between /d/ and /edit).
  // The sheet must be shared as "Anyone with the link can view".
  sheetId: "1ss0uf0RdpnB8OTYbakJbWtklwme5oo_Q5kM6O6xy6qk",

  // Tab names inside the sheet.
  tabs: { config: "Config", checkpoints: "Checkpoints", sponsors: "Sponsors", rehearsal: "Rehearsal", updates: "Updates", photos: "Photos" },

  // Komoot map. EASIEST: don't edit this file — put the embed code in the Google Sheet instead
  // (Config tab, key `komoot_embed`, paste the whole <iframe …> code or just its web address).
  // If you do set it here, keep it between the backticks ` ` — the embed code contains "quotes".
  komootEmbed: `https://www.komoot.com/tour/3077428873/embed?share_token=a0QZMTeBSsMuIspt8KnK497MrGJJs54heZVr7n4fAiZWEpcSiO&layout=classic&profile=1`,

  // YouTube video for the "Why" section: the bit after v= in the link. Can also be set in the
  // sheet (Config key `youtube_id`). Blank hides the video.
  youtubeId: "-kX5uTaqBJs",

  // JustGiving: page link only (used for the Donate button). The raised total
  // is NOT pulled from the API — JustGiving's public API doesn't cover this
  // page's newer platform, so the total comes from the Config tab's
  // total_override cell instead (Tom/crew update it by hand). See README.
  justGiving: {
    pageUrl: "https://www.justgiving.com/page/thamespathmnd",
    target: 50000
  },

  // Race timing (Europe/London). Start is the Source checkpoint's target time.
  race: {
    start: "2026-10-10T05:00:00+01:00",
    plannedFinish: "2026-10-11T17:00:00+01:00",
    totalMiles: 184
  },

  // Contact
  contactEmail: "tom.spearman@pm.me",

  // Behaviour
  refreshSeconds: 60,        // while he's running
  idleRefreshSeconds: 300,   // before and after — keeps Netlify credit use down
  forecast: { minRatio: 0.85, maxRatio: 1.6, legsToAverage: 2 }
};
