// Netlify function: Tom's training summary from Strava.
// Env vars: STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_REFRESH_TOKEN (see README for the one-time authorisation).
// Also serves the one-time code exchange at ?code=... (returns the refresh token once; then delete this branch if you like).
const M = 0.000621371;

export default async (req) => {
  const url = new URL(req.url);
  const id = process.env.STRAVA_CLIENT_ID, secret = process.env.STRAVA_CLIENT_SECRET;
  if (!id || !secret) return json({ error: "STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET not set" }, 400);

  // One-time: exchange the authorisation code for tokens.
  const code = url.searchParams.get("code");
  if (code) {
    const r = await fetch("https://www.strava.com/oauth/token", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ client_id: id, client_secret: secret, code, grant_type: "authorization_code" }) });
    const j = await r.json();
    return new Response(`<pre>Copy this into Netlify env var STRAVA_REFRESH_TOKEN, then redeploy:\n\n${j.refresh_token || JSON.stringify(j, null, 2)}</pre>`, { headers: { "content-type": "text/html" } });
  }

  const refresh = process.env.STRAVA_REFRESH_TOKEN;
  if (!refresh) return json({ error: "STRAVA_REFRESH_TOKEN not set" }, 400);
  try {
    const t = await (await fetch("https://www.strava.com/oauth/token", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ client_id: id, client_secret: secret, refresh_token: refresh, grant_type: "refresh_token" }) })).json();
    const auth = { Authorization: `Bearer ${t.access_token}` };
    const athlete = await (await fetch("https://www.strava.com/api/v3/athlete", { headers: auth })).json();
    const stats = await (await fetch(`https://www.strava.com/api/v3/athletes/${athlete.id}/stats`, { headers: auth })).json();
    const after = Math.floor(Date.now() / 1000) - 28 * 86400;
    const acts = await (await fetch(`https://www.strava.com/api/v3/athlete/activities?per_page=50&after=${after}`, { headers: auth })).json();
    const runs = (Array.isArray(acts) ? acts : []).filter(a => /Run/.test(a.type || a.sport_type || ""));
    const body = {
      ytdMiles: (stats.ytd_run_totals?.distance || 0) * M,
      longestMiles: (stats.biggest_ride_distance ? 0 : 0) || Math.max(0, ...runs.map(a => a.distance * M)),
      runsLast4Weeks: runs.length,
      recent: runs.slice(0, 6).map(a => ({ name: a.name, miles: a.distance * M, date: new Date(a.start_date_local).toLocaleDateString("en-GB", { day: "numeric", month: "short" }), url: `https://www.strava.com/activities/${a.id}` })),
      athleteUrl: `https://www.strava.com/athletes/${athlete.id}`
    };
    return json(body, 200, { "cache-control": "public, max-age=900" });
  } catch (e) { return json({ error: String(e) }, 500); }
};

const json = (b, status = 200, extra = {}) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json", ...extra } });
