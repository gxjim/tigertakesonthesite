# Tiger Takes on the Thames — site

Plain HTML/CSS/JS, no build step. Deploys to Netlify (functions included) or any static host (without the JustGiving/Strava functions).

## Files
- `index.html` — the page. Hero → fundraising → **the river** (every checkpoint and marathon, top to bottom, with the story after Oxford) → training / press.
- `styles.css` — v2 "river spine": My Name'5 Doddie navy (#002169) on paper, yellow only for Tiger/live, tartan as a thin strip. Lora + Work Sans.
- `app.js` — reads the Google Sheet, computes forecasts, builds the vertical river (checkpoints, marathons, sponsors, photos), positions Tiger, wires share/donate. Preview the live/finished look without touching the sheet: add `?demo=live` or `?demo=finished` to the URL.
- `config.js` — the only file you edit per deployment (sheet ID, JustGiving page link, handles). No secrets.
- `netlify/functions/sheet.mjs` — proxies the Google Sheet CSV (Google doesn't allow the browser to fetch it directly).
- `netlify/functions/strava.mjs` — training stats (needs env `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `STRAVA_REFRESH_TOKEN`).
- `img/` — `hero.jpg` (portrait 4:5), `story.jpg` (4:5 / 4:3), `og.jpg` (1200×630 for link previews), and one photo per marathon: `leg-1.jpg` … `leg-7.jpg` (landscape, ~1600px wide, under 400KB). A marathon with no photo simply shows no photo. Or point at any image URL from the sheet (`photo_url` column, Sponsors tab).

## Go-live checklist (in order)
1. **Google Sheet.** Import `tiger-sheet-template.xlsx` into Tom's Google account (File → Import → Replace spreadsheet), or add the four tabs to his existing sheet with the same headers. Share → Anyone with the link → Viewer. Give Jamie and the crew Editor. Copy the sheet ID from the URL into `config.js → sheetId`.
2. **Deploy.** Push this folder to a GitHub repo, then Netlify → Add new site → Import from Git. Publish directory `.`; no build command. You get a `*.netlify.app` URL immediately.
3. **Fundraising total.** We tried JustGiving's public API and it doesn't cover this page (their newer page platform isn't in the legacy API's index), so the raised total is manual: put the page URL in `config.js → justGiving.pageUrl` (for the Donate button), and keep the `total_override` cell in the Config tab updated by eye from the JustGiving page — see "How the sheet drives the page" below. Optionally fill in `donor_count` the same way.
   Strava: only if it's easy. Set `stravaAthleteUrl` in `config.js` and a "Strava" button appears in Follow along; leave it blank and nothing shows. The old Strava stats box is gone.
4. **Strava (optional, skip unless wanted).** Tom creates an API app at strava.com/settings/api (Authorization Callback Domain = your netlify domain). Put Client ID and Secret in Netlify env vars. Tom opens:
   `https://www.strava.com/oauth/authorize?client_id=CLIENT_ID&response_type=code&redirect_uri=https://YOURSITE.netlify.app/.netlify/functions/strava&approval_prompt=force&scope=read,activity:read`
   He clicks Authorise; the page shows a refresh token; paste it into env var `STRAVA_REFRESH_TOKEN`; redeploy. Set `stravaAthleteUrl` in `config.js`.
5. **Domain.** Tom buys it; Netlify → Domain management → add custom domain → follow the DNS instructions. HTTPS is automatic.
6. **Content.** Photos into `img/` (see above), story/press text in `index.html` (edit on GitHub: open the file → pencil icon → change words between the tags → Commit), sponsor prices/status/photos/captions into the Sponsors tab, runners per leg into the Checkpoints `runners` column.
7. **Redirect** the old Google Site to the new domain (Google Sites → Settings → announcement banner, or just replace the home page with a link).

## How the sheet drives the page
- `Config` tab, `key`/`value` rows:
  - `state` — blank (auto: before → live at 05:00 Sat → finished when the Barrier has an actual time), or force `before` / `live` / `finished`.
  - `livetrack_url` — the Garmin LiveTrack link. Paste Saturday 05:00. Replace if the session restarts.
  - `total_override` — the current JustGiving raised total, typed in by hand (this is the ONLY source for the total — there's no live API link). Update it as often as you like; Tom or crew just glance at the JustGiving page and type the number in.
  - `donor_count` — optional; the "X supporters" number, same manual update.
  - `rehearsal` — `yes` makes the page read the `Rehearsal` tab instead of `Checkpoints`.
  - `last_update` — free text shown under the map, e.g. `Sat 13:12`.
- `Sponsors` tab, one row per marathon (`leg` 1–7): `price` (a number, shown as £), `status` (`available` / `taken`), `sponsor` (name shown), optional `photo_url` (overrides `img/leg-N.jpg`), `caption` (shown on the photo), `note` (a sentence under the photo — e.g. who's running that stretch, or a memory of it).
- `Checkpoints` tab: crew type the **actual** time as `12:58` (day is inferred) or `2026-10-10 12:58`. That's all that *must* happen on the day.
  - **Tom's current pace (easiest)** — in the `Config` tab add a row `current_pace` and type his pace as minutes per km, e.g. `6:30` (write `9:45 /mi` if you think in miles). Every remaining checkpoint is then forecast at that pace from his last confirmed checkpoint, and the page labels them *at Tom's pace*. Change it whenever he speeds up or slows down; clear it to go back to the automatic forecast. A `pace` column on the Checkpoints tab does the same per stretch if you want different paces for different legs.
  - **Tom's own estimate for one checkpoint** — add a column headed `eta`. When Tom (or whoever's with him) has a view on the next checkpoint — "I'll be in Henley about 02:40" — type `02:40` into that checkpoint's `eta` cell. The page shows it as *Tom's estimate* instead of the automatic forecast, and re-flows the later checkpoints from it. Leave it blank and the page forecasts from his recent pace. Clear it (or it's ignored) once the actual time is in.
  - Same for the `Rehearsal` tab.
- `Updates` tab (Tom's posts — "Notes from the towpath"): columns `date`, `title`, `body`, `photo_url`, `link`. One row per post, oldest at the top; the page shows newest first, three at a time with an "Earlier posts" button. `body` can be several paragraphs (Alt+Enter for a new line inside the cell); web addresses become links. `photo_url` is optional — a direct image link (a photo committed to `img/` works: `img/post-1.jpg`), or a public Google Drive image in the form `https://drive.google.com/uc?export=view&id=FILE_ID`. `link` is optional (a Strava or Instagram post gets a matching button label). The section is hidden until the first post exists.
- `Config` tab extra: `pace_note` — a short free-text line shown under the live headline, e.g. `Tom: legs fine, walking the hills` or `Stopped 10 min at Goring for food`. Blank hides it.
- Forecast: pace ratio over the last 2 completed legs vs plan (clamped 0.85–1.6×) applied to each remaining planned leg.
- The page re-reads the sheet every 60 s. Google's CSV endpoint can lag by up to a minute or two.

## Rehearsal
Set `rehearsal` to `yes`, put made-up checkpoints for the training route in the `Rehearsal` tab, run the drill, then set it back to `no`. The public `Checkpoints` tab is untouched.

## To verify before launch
- Doddie Foundation charity number shown in the footer (SC047871, confirmed from the live JustGiving page) and their "in aid of" logo rules.
- Open Graph image renders in WhatsApp (paste the URL into a chat with yourself).
