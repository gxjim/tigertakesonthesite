// Netlify function: proxies a Google Sheet tab as CSV, server-to-server.
// Browsers can't fetch Google's gviz CSV endpoint directly (no CORS headers on
// their side), so this function fetches it here and hands the CSV back with
// permissive headers. Needs the sheet shared "Anyone with the link can view".
export default async (req) => {
  const url = new URL(req.url);
  const sheetId = url.searchParams.get("sheetId");
  const tab = url.searchParams.get("tab");
  if (!sheetId || !tab) return new Response("missing sheetId or tab", { status: 400 });
  try {
    // headers=1 is essential: without it Google guesses how many rows are header rows, and a
    // sparse key/value tab gets its first several rows glued into one cell.
    const gviz = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/gviz/tq?tqx=out:csv&headers=1&sheet=${encodeURIComponent(tab)}`;
    const r = await fetch(gviz, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!r.ok) return new Response(`sheet fetch ${r.status}`, { status: 502 });
    const text = await r.text();
    return new Response(text, {
      status: 200,
      headers: { "content-type": "text/csv; charset=utf-8", "access-control-allow-origin": "*", "cache-control": "public, max-age=30" }
    });
  } catch (e) {
    return new Response(String(e), { status: 500 });
  }
};

