// Netlify function: proxies the JustGiving fundraising page total so the browser
// never needs the AppID and we can cache for 60s. Env var: JUSTGIVING_APPID.
export default async (req) => {
  const url = new URL(req.url);
  const page = url.searchParams.get("page");
  const appId = process.env.JUSTGIVING_APPID;
  if (!page || !appId) return new Response(JSON.stringify({ error: "missing page or JUSTGIVING_APPID" }), { status: 400 });
  try {
    const r = await fetch(`https://api.justgiving.com/v1/fundraising/pages/${encodeURIComponent(page)}`, {
      headers: { "x-api-key": appId, Accept: "application/json" }
    });
    if (!r.ok) return new Response(JSON.stringify({ error: `justgiving ${r.status}` }), { status: 502 });
    const j = await r.json();
    // Field names per JustGiving v1 "Get fundraising page details". Verify once against a real response.
    const body = {
      raised: Number(j.grandTotalRaisedExcludingGiftAid ?? j.totalRaisedOnline ?? 0),
      raisedWithGiftAid: Number(j.totalRaisedOnline ?? 0) + Number(j.totalEstimatedGiftAid ?? 0),
      target: Number(j.fundraisingTarget ?? 0),
      donors: undefined,
      currency: j.currencyCode
    };
    return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json", "cache-control": "public, max-age=60" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
};

export const config = { path: "/.netlify/functions/justgiving" };
