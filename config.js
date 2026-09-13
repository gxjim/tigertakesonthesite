// ─── Tiger Takes on the Thames · site configuration ───────────────────────────
// Everything that changes per deployment lives here. No secrets in this file:
// Strava keys go in Netlify environment variables (see README).

window.TIGER_CONFIG = {
  // Google Sheet ID (the long string in the sheet URL between /d/ and /edit).
  // The sheet must be shared as "Anyone with the link can view".
  sheetId: "1ss0uf0RdpnB8OTYbakJbWtklwme5oo_Q5kM6O6xy6qk",

  // Tab names inside the sheet.
  tabs: { config: "Config", checkpoints: "Checkpoints", sponsors: "Sponsors", rehearsal: "Rehearsal", updates: "Updates", photos: "Photos" },

  // Komoot: paste the embed code (or just its src URL) from Komoot → Share → Embed. Blank hides the map.
  komootEmbed: "<iframe src="https://www.komoot.com/tour/3077428873/embed?share_token=a0QZMTeBSsMuIspt8KnK497MrGJJs54heZVr7n4fAiZWEpcSiO&amp;layout=classic&amp;profile=1" width="100%" height="700" frameborder="0" scrolling="no" allow="fullscreen" allowfullscreen></iframe>",

  // YouTube video ID for the "Why" section (the bit after v= in the link). Blank hides the video.
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

  // Social
  instagram: "tigerspearman_",        // handle without @
  stravaAthleteUrl: "https://www.strava.com/athletes/21649114",  // e.g. https://www.strava.com/athletes/12345
  contactEmail: "tom.spearman@pm.me",

  // Behaviour
  refreshSeconds: 60,
  forecast: { minRatio: 0.85, maxRatio: 1.6, legsToAverage: 2 }
};
