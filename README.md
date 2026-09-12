# Tiger Takes on the Thames — site

Plain HTML/CSS/JS, no build step. Deploys to Netlify (functions included) or any static host (without the JustGiving/Strava functions).

## Files
- `index.html` — the page. Sections: hero, fundraising, tracker, story, sponsor, training, updates, press.
- `styles.css` — direction C ("warm riverside"): paper, river blue, Doddie yellow, Lora + Work Sans.
- `app.js` — reads the Google Sheet, computes forecasts, draws the river, wires share/donate.
- `config.js` — the only file you edit per deployment (sheet ID, JustGiving page, handles). No secrets.
- `netlify/functions/justgiving.js` — proxies the JustGiving total (needs env `JUSTGIVING_APPID`).
- `netlify/functions/strava.js` — training stats (needs env `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `STRAVA_REFRESH_TOKEN`).
- `img/` — drop `hero.jpg` (portrait, 4:5), `story.jpg` (4:3), `og.jpg` (1200×630 for link previews).

## Go-live checklist (in order)
1. **Google Sheet.** Import `tiger-sheet-template.xlsx` into Tom's Google account (File → Import → Replace spreadsheet), or add the four tabs to his existing sheet with the same headers. Share → Anyone with the link → Viewer. Give Jamie and the crew Editor. Copy the sheet ID from the URL into `config.js → sheetId`.
2. **Deploy.** Push this folder to a GitHub repo, then Netlify → Add new site → Import from Git. Publish directory `.`; no build command. You get a `*.netlify.app` URL immediately.
3. **JustGiving.** developer.justgiving.com → sign up → Applications → copy AppID. Netlify → Site settings → Environment variables → `JUSTGIVING_APPID`. Put the page short name and full URL in `config.js`. Redeploy. Check `/.netlify/functions/justgiving?page=<shortname>` returns JSON, and compare the field names in the function with the real response once.
4. **Strava (one time, Tom present).** Tom creates an API app at strava.com/settings/api (Authorization Callback Domain = your netlify domain). Put Client ID and Secret in Netlify env vars. Tom opens:
   `https://www.strava.com/oauth/authorize?client_id=CLIENT_ID&response_type=code&redirect_uri=https://YOURSITE.netlify.app/.netlify/functions/strava&approval_prompt=force&scope=read,activity:read`
   He clicks Authorise; the page shows a refresh token; paste it into env var `STRAVA_REFRESH_TOKEN`; redeploy. Set `stravaAthleteUrl` in `config.js`.
5. **Domain.** Tom buys it; Netlify → Domain management → add custom domain → follow the DNS instructions. HTTPS is automatic.
6. **Content.** Photos into `img/`, story text into `index.html`, sponsor prices and status into the Sponsors tab, runners per leg into the Checkpoints `runners` column.
7. **Redirect** the old Google Site to the new domain (Google Sites → Settings → announcement banner, or just replace the home page with a link).

## How the sheet drives the page
- `Config` tab, `key`/`value` rows:
  - `state` — blank (auto: before → live at 05:00 Sat → finished when the Barrier has an actual time), or force `before` / `live` / `finished`.
  - `livetrack_url` — the Garmin LiveTrack link. Paste Saturday 05:00. Replace if the session restarts.
  - `total_override` — a number; shown instead of the JustGiving API if set (fallback if the API is down).
  - `rehearsal` — `yes` makes the page read the `Rehearsal` tab instead of `Checkpoints`.
  - `last_update` — free text shown under the map, e.g. `Sat 13:12`.
- `Checkpoints` tab: crew type the **actual** time as `12:58` (day is inferred) or `2026-10-10 12:58`. Nothing else needs touching on the day.
- Forecast: pace ratio over the last 2 completed legs vs plan (clamped 0.85–1.6×) applied to each remaining planned leg.
- The page re-reads the sheet every 60 s. Google's CSV endpoint can lag by up to a minute or two.

## Rehearsal
Set `rehearsal` to `yes`, put made-up checkpoints for the training route in the `Rehearsal` tab, run the drill, then set it back to `no`. The public `Checkpoints` tab is untouched.

## To verify before launch
- Doddie Foundation charity number shown in the footer (SC047906) and their "in aid of" logo rules.
- JustGiving response field names (step 3).
- Open Graph image renders in WhatsApp (paste the URL into a chat with yourself).
