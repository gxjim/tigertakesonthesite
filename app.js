/* ─── Tiger Takes on the Thames · app ─────────────────────────────────────────
   Plain JS, no build step. Reads a Google Sheet via a Netlify proxy function,
   computes the forecast and renders the vertical river of checkpoints, legs,
   sponsors and photos. Falls back to sample data so
   the page renders before anything is connected.                             */

(() => {
  if (!window.TIGER_CONFIG) {
    // config.js failed to load or parse (a stray quote is the usual cause). Say so visibly rather than showing a blank river.
    const n = document.createElement("p");
    n.style.cssText = "margin:16px auto;max-width:60ch;padding:12px 16px;background:#fff4cc;border:1px solid #f1dc8c;border-radius:6px;font:14px system-ui,sans-serif;color:#14181f";
    n.textContent = "The site's settings file (config.js) has an error, so live data can't load. Usually a quote mark in the wrong place — restore the previous version of config.js on GitHub.";
    (document.querySelector("main") || document.body).prepend(n);
    return;
  }
  const C = window.TIGER_CONFIG;
  const $ = (s) => document.querySelector(s);
  const LONDON = "Europe/London";

  // ── Sample data (replaced by the sheet as soon as sheetId is set) ─────────
  const SAMPLE_CHECKPOINTS = [
    ["1","Source","0","2026-10-10 05:00","","Tom solo",""],
    ["2","Cricklade","12.5","2026-10-10 07:24","","",""],
    ["3","Lechlade","24","2026-10-10 09:36","","",""],
    ["4","Newbridge","41","2026-10-10 12:53","","",""],
    ["5","Oxford","55","2026-10-10 15:41","","",""],
    ["6","Abingdon","64","2026-10-10 17:29","","",""],
    ["7","Wallingford","78","2026-10-10 20:11","","",""],
    ["8","Goring","88","2026-10-10 22:11","","",""],
    ["9","Reading","99","2026-10-11 00:17","","",""],
    ["10","Henley","109","2026-10-11 02:12","","",""],
    ["11","Marlow","118","2026-10-11 04:00","","",""],
    ["12","Windsor","133","2026-10-11 06:51","","",""],
    ["13","Shepperton","147","2026-10-11 09:36","","",""],
    ["14","Richmond","161","2026-10-11 12:24","","",""],
    ["15","Westminster","173","2026-10-11 14:48","","",""],
    ["16","Thames Barrier","184","2026-10-11 17:00","","",""]
  ].map(r => ({ id:+r[0], name:r[1], miles:+r[2], target:r[3], actual:r[4], runners:r[5], note:r[6] }));

  const SAMPLE_SPONSORS = [1,2,3,4,5,6,7].map(n => ({ leg:n, from:"", to:"", price:"", status:"available", sponsor:"", logo:"", photo:"", caption:"", note:"" }));
  const SAMPLE_CONFIG = { state:"", livetrack_url:"", total_override:"", donor_count:"", rehearsal:"no", last_update:"", pace_note:"", current_pace:"", instagram_embed:"", instagram_embed_2:"", instagram_embed_3:"" };

  // ── Helpers ───────────────────────────────────────────────────────────────
const fmtGBP = (n) => "£" + Math.round(n).toLocaleString("en-GB");
const fmtTime = (d) => d ? d.toLocaleTimeString("en-GB", { hour:"2-digit", minute:"2-digit", timeZone: LONDON }) : "—";
const fmtDay = (d) => d ? d.toLocaleDateString("en-GB", { weekday:"short", timeZone: LONDON }) : "";
const minutes = (ms) => Math.round(ms / 60000);
const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" }[c]));

// A photo reference only counts if a browser could load it: a web address, or a file in img/.
// Phone filenames (IMG_1234.HEIC) and HEIC generally are ignored rather than left as empty boxes.
function usablePhoto(v) {
  const s = String(v || "").trim();
  if (!s) return "";
  if (/\.heic(\?|$)/i.test(s)) return "";
  if (/^https?:\/\//i.test(s)) return s;
  if (/^img\//i.test(s) && /\.(jpe?g|png|webp|gif|avif)$/i.test(s)) return s;
  return "";
}

function driveImageUrl(url) {
  if (!url) return "";

  const s = String(url).trim();

  const fileMatch = s.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (fileMatch) {
    return `https://drive.google.com/thumbnail?id=${fileMatch[1]}&sz=w1600`;
  }

  const openMatch = s.match(/drive\.google\.com\/open\?id=([^&]+)/);
  if (openMatch) {
    return `https://drive.google.com/thumbnail?id=${openMatch[1]}&sz=w1600`;
  }

  return s;
}

const raceStart = new Date(C.race.start);

  // Parse "2026-10-10 12:58" (London time) or "12:58" (day inferred from a reference time).
  function parseLondon(str, ref) {
    if (!str) return null;
    str = String(str).trim();
    let m = str.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})/);
    if (m) return londonDate(+m[1], +m[2], +m[3], +m[4], +m[5]);
    m = str.match(/^(\d{1,2}):(\d{2})/);
    if (m && ref) {
      // Try the ref day and its neighbours; pick the one closest to ref.
      const cands = [-1,0,1].map(off => {
        const d = new Date(ref.getTime() + off*86400000);
        const p = londonParts(d);
        return londonDate(p.y, p.mo, p.d, +m[1], +m[2]);
      });
      return cands.sort((a,b) => Math.abs(a-ref) - Math.abs(b-ref))[0];
    }
    const d = new Date(str);
    return isNaN(d) ? null : d;
  }
  function londonParts(d) {
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: LONDON, year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", hour12:false }).formatToParts(d).map(x => [x.type, x.value]));
    return { y:+p.year, mo:+p.month, d:+p.day, h:+p.hour % 24, mi:+p.minute };
  }
  function londonDate(y, mo, d, h, mi) {
    // Build a UTC guess, then correct by the London offset at that instant (handles BST).
    const guess = new Date(Date.UTC(y, mo-1, d, h, mi));
    const p = londonParts(guess);
    const asLondon = Date.UTC(p.y, p.mo-1, p.d, p.h, p.mi);
    return new Date(guess.getTime() - (asLondon - guess.getTime()));
  }

  // Minimal CSV parser (handles quotes and commas in quotes).
  function parseCSV(text) {
    const rows = []; let row = [], cell = "", q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) { if (ch === '"') { if (text[i+1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
      else if (ch === '"') q = true;
      else if (ch === ",") { row.push(cell); cell = ""; }
      else if (ch === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
      else if (ch !== "\r") cell += ch;
    }
    if (cell.length || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }
  // A tab name that doesn't exist makes Google return the workbook's first sheet instead of
  // an error, so every read is checked for the columns it must have.
  function expect(rows, required, tab) {
    if (!rows.length) return rows;
    const have = Object.keys(rows[0]);
    const ok = required.every(r => have.some(h => h === r || h.includes(r)));
    if (!ok) { console.warn(`Tiger: "${tab}" doesn't look right (columns: ${have.join(", ")}) — ignoring it`); return []; }
    return rows;
  }

  async function sheetTab(tab) {
    // `_` changes only every 30s: fresh enough for the day, but lets the CDN serve most polls.
    const bucket = Math.floor(Date.now() / 30000);
    const url = `/.netlify/functions/sheet?sheetId=${encodeURIComponent(C.sheetId)}&tab=${encodeURIComponent(tab)}&_=${bucket}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Sheet ${tab}: ${res.status}`);
    const rows = parseCSV(await res.text());
    const head = rows.shift().map(h => h.trim().toLowerCase().replace(/\s+/g, "_"));
    return rows.filter(r => r.some(c => c && c.trim())).map(r => Object.fromEntries(head.map((h, i) => [h, (r[i] || "").trim()])));
  }

  // ── Data loading ──────────────────────────────────────────────────────────
// ── Data loading ──────────────────────────────────────────────────────────
const SLOW = { at: 0 };   // sponsors / updates / photos, re-read every 10 minutes

async function loadSheet() {
  if (!C.sheetId) {
    return {
      config: SAMPLE_CONFIG,
      checkpoints: SAMPLE_CHECKPOINTS,
      sponsors: SAMPLE_SPONSORS,
      updates: [],
      photos: [],
      source: "sample"
    };
  }

  // Config + checkpoints change minute to minute on the day;
  // sponsors, updates and photos don't.
  const slowDue = !SLOW.at || (Date.now() - SLOW.at) > 10 * 60 * 1000;

  const [cfgRows, ...slow] = await Promise.all([
    sheetTab(C.tabs.config),
    ...(slowDue
      ? [
          sheetTab(C.tabs.sponsors),
          sheetTab(C.tabs.updates || "Updates").catch(() => []),
          sheetTab(C.tabs.photos || "Photos").catch(() => [])
        ]
      : [])
  ]);

  if (slowDue) {
    SLOW.sponsors = slow[0];
    SLOW.updates = slow[1];
    SLOW.photos = slow[2];
    SLOW.at = Date.now();
  }

  const sponsors = SLOW.sponsors || [];
  const updates = SLOW.updates || [];
  const photos = SLOW.photos || [];

  const config = Object.assign(
    {},
    SAMPLE_CONFIG,
    Object.fromEntries(cfgRows.map(r => [r.key, r.value]))
  );

  const tab =
    (config.rehearsal || "").toLowerCase() === "yes"
      ? C.tabs.rehearsal
      : C.tabs.checkpoints;

  const cps = (await sheetTab(tab)).map(r => {
    const rk = Object.keys(r).find(k => /runner/.test(k));
      const ck = Object.keys(r).find(k => /crew/.test(k));

    return {
      id: +r.id,
      name: r.name,
      miles: +r.miles,
      target: r.target,
      actual: r.actual,
      runners: (rk ? r[rk] : "") || "",
      note: r.note || "",
      eta: r.eta || r.tom_eta || "",
      pace: r.pace || r.current_pace || ""
    };
  });

  return {
    config,

    checkpoints: cps,

    sponsors: sponsors.map(s => ({
      leg: +s.leg,
      from: s.from,
      to: s.to,
      price: s.price,
      status: (s.status || "available").toLowerCase(),
      sponsor: s.sponsor,
      logo: s.logo_url || s.logo || "",
      photo: usablePhoto(driveImageUrl(s.photo_url || s.photo || "")),
      caption: s.caption || "",
      note: s.note || ""
    })),

    updates: updates
      .map(u => ({
        date: u.date || "",
        title: u.title || "",
        body: u.body || u.text || "",
        photo: usablePhoto(driveImageUrl(u.photo_url || u.photo || "")),
        link:
          u.link ||
          u[Object.keys(u).find(k => /^link/.test(k)) || "link"] ||
          ""
      }))
      .filter(u => u.title || u.body),

    photos: photos
      .map(p => ({
        url: usablePhoto(driveImageUrl(p.url || p.photo_url || "")),
        caption: p.caption || ""
      }))
      .filter(p => p.url),

    source: "sheet"
  };
}

  // Fundraising total comes from the Config tab (Tom or crew type in the
  // current JustGiving total by hand — see README). No API call: JustGiving's
  // public API doesn't cover this page's newer page platform, so the sheet is
  // the single source of truth here.
  function loadJustGiving(config) {
    if (!config.total_override) return null;
    const donors = config.donor_count ? +String(config.donor_count).replace(/[^\d]/g, "") : null;
    return { raised: +String(config.total_override).replace(/[^\d.]/g, ""), donors, source: "override" };
  }

  // Pace: "6:30" or "6.5" = minutes per km (Tom's sheet convention); add "/mi" or "mi" for minutes per mile.
  // Returns minutes per MILE, or null.
  function parsePace(str) {
    if (!str) return null;
    const t = String(str).trim().toLowerCase();
    const perMile = /mi/.test(t) && !/km/.test(t);
    const m = t.match(/(\d+)[:.](\d+)/) || t.match(/(\d+)/);
    if (!m) return null;
    let mins = m[2] != null ? (t.includes(":") ? +m[1] + (+m[2]) / 60 : parseFloat(m[1] + "." + m[2])) : +m[1];
    if (!isFinite(mins) || mins <= 0) return null;
    return perMile ? mins : mins * 1.609344;
  }

  // ── Forecast model ────────────────────────────────────────────────────────
  // Returns checkpoints enriched with Date objects, forecast Dates and status.
  function computeForecast(cps, now, config = {}) {
    const configPace = parsePace(config.current_pace);
    const start = (cps[0] && parseLondon(cps[0].target, raceStart)) || raceStart;
    let prevRef = start;
    cps.forEach(cp => {
      cp.targetAt = parseLondon(cp.target, prevRef) || prevRef;
      cp.actualAt = cp.actual ? parseLondon(cp.actual, cp.targetAt) : null;
      prevRef = cp.targetAt;
    });
    const done = cps.filter(cp => cp.actualAt);
    const lastDone = done[done.length - 1] || null;

    // Pace ratio = actual elapsed / planned elapsed over the last N completed legs (clamped).
    let ratio = 1;
    if (done.length >= 2) {
      const n = Math.min(C.forecast.legsToAverage, done.length - 1);
      const a = done[done.length - 1 - n], b = done[done.length - 1];
      const plannedMs = b.targetAt - a.targetAt, actualMs = b.actualAt - a.actualAt;
      if (plannedMs > 0 && actualMs > 0) ratio = Math.min(C.forecast.maxRatio, Math.max(C.forecast.minRatio, actualMs / plannedMs));
    }
    let cursor = lastDone ? lastDone.actualAt : null;
    cps.forEach((cp, i) => {
      if (cp.actualAt) { cp.status = "done"; cp.forecastAt = cp.actualAt; cursor = cp.actualAt; return; }
      if (!lastDone) { cp.status = "planned"; cp.forecastAt = cp.targetAt; return; }
      const prev = cps[i - 1];
      const plannedLeg = cp.targetAt - prev.targetAt;
      // Tom's own estimate (sheet column `eta`) beats the model, and re-anchors the pace for the legs after it.
      const etaAt = cp.eta ? parseLondon(cp.eta, cp.targetAt) : null;
      const legPace = parsePace(cp.pace) || configPace;   // minutes per mile, from the sheet
      if (etaAt && etaAt > cursor) {
        cp.forecastAt = etaAt; cp.manual = "eta";
        if (plannedLeg > 0) ratio = Math.min(C.forecast.maxRatio, Math.max(C.forecast.minRatio, (etaAt - cursor) / plannedLeg));
      } else if (legPace) {
        cp.forecastAt = new Date(cursor.getTime() + (cp.miles - prev.miles) * legPace * 60000); cp.manual = "pace";
        if (now > cp.forecastAt && prev.actualAt) cp.forecastAt = new Date(now.getTime() + 5 * 60000);
        if (plannedLeg > 0) ratio = Math.min(C.forecast.maxRatio, Math.max(C.forecast.minRatio, (cp.forecastAt - cursor) / plannedLeg));
      } else {
        cp.forecastAt = new Date(cursor.getTime() + plannedLeg * ratio);
        // If he's already later than the forecast, forecast = now + a little (he hasn't arrived).
        if (now > cp.forecastAt && prev.actualAt) cp.forecastAt = new Date(now.getTime() + 5 * 60000);
      }
      cursor = cp.forecastAt;
      cp.status = prev.actualAt ? "next" : "upcoming";
    });
    // Position: between lastDone and next, by time fraction.
    let position = { miles: 0, fraction: 0, lastDone, next: cps[lastDone ? cps.indexOf(lastDone) + 1 : 0] || null };
    if (lastDone && position.next) {
      const span = position.next.forecastAt - lastDone.actualAt;
      const f = span > 0 ? Math.min(1, Math.max(0, (now - lastDone.actualAt) / span)) : 0;
      position.fraction = f;
      position.miles = lastDone.miles + f * (position.next.miles - lastDone.miles);
    } else if (lastDone && !position.next) { position.miles = lastDone.miles; position.fraction = 1; }
    return { cps, ratio, lastDone, position, start, delayMin: lastDone ? minutes(lastDone.actualAt - lastDone.targetAt) : 0 };
  }

  // ── Render: the river (vertical flow of checkpoints and legs) ─────────────
  // Leg n spans checkpoints (2n-1) → (2n+1); the last leg runs to the final checkpoint.
  function legBounds(n, cps, legCount) {
    const a = cps[(n - 1) * 2];
    const b = n === legCount ? cps[cps.length - 1] : cps[Math.min(cps.length - 1, n * 2)];
    return [a, b];
  }
  function legForIndex(i, legCount) { // which leg starts at checkpoint index i (0-based)? null if none
    if (i % 2 !== 0) return null;
    const n = i / 2 + 1;
    return n <= legCount ? n : null;
  }
  const delayText = (min) => min === 0 ? "on schedule" : (min > 0 ? `${min} min behind plan` : `${Math.abs(min)} min ahead of plan`);

  function renderJourney(model, state, config, sponsors) {
    const flow = $("#flow");
    const cps = model.cps;
    const legs = sponsors.length ? sponsors : SAMPLE_SPONSORS;
    const legCount = legs.length;
    const html = [];
    const meander = (i) => 0.5 + 0.42 * Math.sin(i * 1.15); // 0.08–0.92 across the rail
    // Grid rows: checkpoint i sits on row 2i+1; the row after it (2i+2) is a spacer whose
    // height gives the river its length. Marathon blocks (left column) span from their
    // first checkpoint's row to their last checkpoint's row.
    // Three rows per checkpoint: (3i+1) marathon strip on phones, (3i+2) the checkpoint, (3i+3) spacer.
    const rowOf = (i) => 3 * i + 2;

    cps.forEach((cp, i) => {
      const first = i === 0, last = i === cps.length - 1;
      const mx = `calc(var(--rail) * ${meander(i).toFixed(3)})`;
      let times;
      if (cp.status === "done") {
        const d = minutes(cp.actualAt - cp.targetAt);
        times = `<b>${fmtDay(cp.actualAt)} ${fmtTime(cp.actualAt)}${state !== "before" && d ? `<span class="delta ${d > 0 ? "late" : "early"}">${d > 0 ? "+" : "−"}${Math.abs(d)}m</span>` : ""}</b><span>plan ${fmtTime(cp.targetAt)}</span>`;
      } else if (state === "before") {
        times = `<b>${fmtDay(cp.targetAt)} ${fmtTime(cp.targetAt)}</b><span>plan</span>`;
      } else {
        const d = minutes(cp.forecastAt - cp.targetAt);
        times = `<b>${fmtTime(cp.forecastAt)}${d ? `<span class="delta ${d > 0 ? "late" : "early"}">${d > 0 ? "+" : "−"}${Math.abs(d)}m</span>` : ""}</b><span>${cp.manual === "eta" ? "Tom's estimate" : cp.manual === "pace" ? "at Tom's pace" : "forecast"} · plan ${fmtTime(cp.targetAt)}</span>`;
      }
      const runners = cp.runners ? `<div class="runners">Main support runner is ${esc(cp.runners)}</div>` : "";
      const crew = cp.crew ? `<div class="runners">Support crew is ${esc(cp.crew)}</div>` : "";
      const cpNote = cp.note ? `<p class="cp-note">${esc(cp.note)}</p>` : "";

      // Marathon that starts at this checkpoint (if any): its photo + note sit on the right, under the checkpoint.
      const n = legForIndex(i, legCount);
      let stretch = "";
      if (n && !last && (config.rehearsal || "").toLowerCase() !== "yes") {
        const sp = legs.find(l => l.leg === n) || {};
        const photo = sp.photo || `img/leg-${n}.jpg`;
        const cap = sp.caption ? `<figcaption class="cap">${esc(sp.caption)}</figcaption>` : "";
        const note = sp.note ? `<p class="note">${esc(sp.note)}</p>` : "";
        stretch = `<figure class="leg-photo"><img src="${esc(photo)}" alt="" loading="lazy" onload="this.parentNode.classList.add('loaded')">${cap}</figure>${note}`;
      }
      const nextMiles = last ? 0 : cps[i + 1].miles - cp.miles;
      html.push(`<li class="node ${cp.status || ""} ${first ? "first" : ""} ${last ? "last" : ""}" data-i="${i}" style="--mx:${mx};grid-row:${rowOf(i)}">
        <span class="mark"></span>
        <div class="name">${esc(cp.name)}<small>mile ${cp.miles}</small></div>
        <div class="times">${times}</div>${runners}${crew}${cpNote}${stretch}</li>`);
      if (!last) html.push(`<li class="spacer" style="grid-row:${rowOf(i) + 1};min-height:${Math.max(28, Math.round(nextMiles * 4.5))}px"></li>`);

      // Marathon block (left column), spanning its two half-marathons. Not during a rehearsal — the legs don't map.
      if (n && !last && (config.rehearsal || "").toLowerCase() !== "yes") {
        const s = legs.find(l => l.leg === n) || { leg: n, status: "available" };
        const [a, b] = legBounds(n, cps, legCount);
        const bi = cps.indexOf(b);
        const miles = a && b ? b.miles - a.miles : 0;
        const taken = s.status === "taken" || s.status === "sponsored";
        const price = s.price ? (/^\d+(\.\d+)?$/.test(String(s.price).trim()) ? "£" + Number(s.price).toLocaleString("en-GB") : s.price) : "";
        const status = taken
          ? `<span class="sponsor">Sponsored by ${esc(s.sponsor || "a friend of Tom's")}</span>`
          : `<span class="open">Unsponsored${price ? ` · ${price}` : ""}</span><a class="btn btn-small btn-ghost" href="sponsor.html">Sponsor this marathon</a>`;
        html.push(`<li class="leg ${taken ? "taken" : "open"}" data-leg="${n}" style="--r1:${rowOf(i)};--r2:${rowOf(bi)};--mrow:${rowOf(i) - 1}">
          <span class="arrow" aria-hidden="true"></span>
          <div class="leg-inner">
            <span class="n">Marathon ${n}</span>
            <span class="route">${esc(a.name)} → ${esc(b.name)}</span>
            <span class="miles">${miles.toFixed(0)} miles · two checkpoints</span>
            ${status}
          </div></li>`);
      }
    });

    if (state === "finished") {
      const fin = cps[cps.length - 1];
      const elapsed = fin.actualAt ? (fin.actualAt - model.start) / 3600000 : null;
      html.push(`<li class="finish-card" style="grid-row:${rowOf(cps.length - 1) + 1}"><h3>He did it.</h3><p>${elapsed ? `${cps[cps.length - 1].miles} miles in ${Math.floor(elapsed)} hours ${Math.round((elapsed % 1) * 60)} minutes.` : `${cps[cps.length - 1].miles} miles, one go.`} The fundraising page stays open — if the run moved you, the button at the top is the way to say so.</p></li>`);
    }
    flow.innerHTML = html.join("");

    // Tiger marker element
    let tiger = $(".tiger");
    if (!tiger) { tiger = document.createElement("div"); tiger.className = "tiger"; tiger.innerHTML = `T<span class="label"></span>`; $(".river-wrap").appendChild(tiger); }
    const narrow = window.innerWidth < 900;
    tiger.querySelector(".label").textContent = model.lastDone && model.position.next ? (narrow ? `mile ${model.position.miles.toFixed(0)}` : `Tiger · mile ${model.position.miles.toFixed(0)} · ${delayText(model.delayMin)}`) : "";

    drawRiver(model, state);
  }

  // Draws the SVG river through the checkpoint marks, fills the completed part,
  // and positions the Tiger marker. Re-run on resize.
  function drawRiver(model, state) {
    const wrap = $(".river-wrap"), svg = $("#river-svg");
    const nodes = Array.from(wrap.querySelectorAll(".node"));
    if (nodes.length < 2) return;
    const wr = wrap.getBoundingClientRect();
    const pts = nodes.map(n => { const r = n.querySelector(".mark").getBoundingClientRect(); return [r.left + r.width / 2 - wr.left, r.top + r.height / 2 - wr.top]; });
    svg.setAttribute("viewBox", `0 0 ${wr.width} ${wr.height}`);
    svg.setAttribute("width", wr.width); svg.setAttribute("height", wr.height);

    // Smooth vertical meander: cubic segments with vertical tangents.
    let d = `M ${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      const cy = (y1 - y0) * 0.5;
      d += ` C ${x0} ${y0 + cy}, ${x1} ${y1 - cy}, ${x1} ${y1}`;
    }
    svg.innerHTML = `<path id="river-base" d="${d}" fill="none" stroke="#c9d8ee" stroke-width="10" stroke-linecap="round"/>
                     <path id="river-done" d="${d}" fill="none" stroke="#002169" stroke-width="10" stroke-linecap="round"/>`;
    const base = svg.querySelector("#river-base"), done = svg.querySelector("#river-done");
    const L = base.getTotalLength();

    // Length along the path at each node (approximate by sampling).
    const nodeLen = [0];
    let acc = 0, prev = base.getPointAtLength(0), k = 1;
    const steps = Math.max(200, Math.round(L / 6));
    for (let s = 1; s <= steps && k < pts.length; s++) {
      const len = (s / steps) * L, p = base.getPointAtLength(len);
      if (p.y >= pts[k][1] - 0.5) { nodeLen.push(len); k++; }
      prev = p;
    }
    while (nodeLen.length < pts.length) nodeLen.push(L);

    let tigerLen = 0;
    if (state !== "before" && model.lastDone) {
      const i = model.cps.indexOf(model.lastDone);
      const j = Math.min(i + 1, pts.length - 1);
      tigerLen = nodeLen[i] + (nodeLen[j] - nodeLen[i]) * (model.position.next ? model.position.fraction : 1);
    }
    done.setAttribute("stroke-dasharray", `${tigerLen} ${L}`);

    const tiger = $(".tiger");
    if (tiger) {
      const p = base.getPointAtLength(tigerLen);
      tiger.style.left = p.x + "px"; tiger.style.top = p.y + "px";
    }
  }

  // ── Render: headline, buttons, fundraising ────────────────────────────────
  function renderHead(model, state, config) {
    const h = $("#position-headline"), s = $("#position-sub"), l = $("#live-label");
    const reh = (config.rehearsal || "").toLowerCase() === "yes";
    const first = model.cps[0], lastCp = model.cps[model.cps.length - 1];
    document.body.dataset.rehearsal = reh ? "yes" : "no";
    if (reh && state === "before") {
      l.textContent = "Test run";
      h.textContent = `${config.rehearsal_title || "Rehearsal"}: ${first.name} to ${lastCp.name}`;
      s.textContent = `${lastCp.miles} miles, ${model.cps.length} checkpoints. A dress rehearsal for the tracker, the crew and the legs. Starts ${fmtDay(model.start)} ${fmtTime(model.start)}.`;
    } else if (state === "before") {
      l.textContent = "The route";
      h.textContent = "Running the Length of the Thames";
      s.textContent = "The Thames Path runs for 184 miles from the river\u2019s source in the Cotswolds to the Thames Barrier in London. I\u2019m aiming to run at around 6:30 min/km, with a short walking break every 30 minutes, and to finish in under 40 hours \u2014 before sunset on Sunday.";
    } else if (state === "finished") {
      const fin = model.cps[model.cps.length - 1];
      l.textContent = reh ? "Test run · finished" : "Finished";
      h.textContent = fin.actualAt ? `He did it. ${fin.name} at ${fmtTime(fin.actualAt)} on ${fmtDay(fin.actualAt)}.` : "He did it.";
      const elapsed = fin.actualAt ? (fin.actualAt - model.start) / 3600000 : null;
      s.textContent = elapsed ? `${model.cps[model.cps.length - 1].miles} miles in ${Math.floor(elapsed)} hours ${Math.round((elapsed % 1) * 60)} minutes. The fundraising page stays open.` : "The fundraising page stays open.";
    } else {
      l.textContent = `${reh ? "Test run · live" : "Live"} · ${fmtDay(new Date())} ${fmtTime(new Date())}`;
      if (!model.lastDone) { h.textContent = `At ${first.name}, waiting for ${fmtTime(model.start)}`; s.textContent = `The first checkpoint is ${model.cps[1].name}, ${model.cps[1].miles} miles in.`; }
      else if (!model.position.next) { h.textContent = `Tom has reached ${lastCp.name}`; s.textContent = ""; }
      else {
        h.textContent = `Tiger is between ${model.lastDone.name} and ${model.position.next.name}`;
        s.textContent = `${model.position.miles.toFixed(0)} miles in · ${delayText(model.delayMin)} · ${model.position.next.name} ${model.position.next.manual === "eta" ? "expected (Tom's estimate)" : model.position.next.manual === "pace" ? "at Tom's current pace" : "forecast"} ${fmtTime(model.position.next.forecastAt)}${config.pace_note ? " · " + config.pace_note : ""}`;
      }
    }
    const lt = $("#livetrack-btn");
    if (state === "live" && config.livetrack_url) { lt.href = config.livetrack_url; lt.hidden = false; } else lt.hidden = true;
    $("#jump-btn").hidden = !(state === "live" && model.lastDone && model.position.next);
    $("#updated").textContent = config.last_update ? `Sheet updated ${config.last_update}` : "";
  }

  // ── Render: updates (Tom's posts from the Updates tab) ────────────────────
  function renderUpdates(updates) {
    const sec = $("#updates"), list = $("#posts");
    if (!updates || !updates.length) { sec.hidden = true; return; }
    sec.hidden = false;
    const posts = updates.slice().reverse(); // sheet is oldest-first; show newest first
    const linkify = (t) => esc(t).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
    // Each post is collapsed to its date, title and opening line; clicking opens it.
    // <details> does the work natively, so it keeps working without JS and is keyboard accessible.
    list.innerHTML = posts.map((u, i) => {
      const paras = u.body.split(/\n{2,}|\n/).map(t => t.trim()).filter(Boolean);
      return `<details class="post${i >= 3 ? " older" : ""}">
        <summary>
          <div class="post-head">
            <p class="eyebrow">${esc(u.date)}</p>
            ${u.title ? `<h3>${esc(u.title)}</h3>` : ""}
          </div>
          <span class="post-toggle" aria-hidden="true"></span>
        </summary>
        <div class="post-body">
          ${u.photo ? `<figure class="post-photo"><img src="${esc(u.photo)}" alt="" loading="lazy" onerror="this.parentNode.remove()"></figure>` : ""}
          ${paras.map(par => `<p>${linkify(par)}</p>`).join("")}
          ${u.link ? `<p><a href="${esc(u.link)}" target="_blank" rel="noopener">${/strava/i.test(u.link) ? "See the run on Strava" : /instagram/i.test(u.link) ? "See the post on Instagram" : "Read more"}</a></p>` : ""}
        </div></details>`;
    }).join("");
    const more = $("#posts-more");
    more.hidden = posts.length <= 3;
    more.onclick = () => { list.querySelectorAll(".older").forEach(p => p.classList.remove("older")); more.hidden = true; };
  }

  // ── Render: photo carousel ────────────────────────────────────────────────
  // Photos from the `Photos` tab (url, caption) if present; otherwise img/photo-1.jpg … photo-24.jpg
  // plus the four we know exist. Missing files are skipped silently.
  let galleryBuilt = false;
  function renderGallery(photos) {
    if (galleryBuilt) return; galleryBuilt = true;
    const track = $("#gallery-track"), sec = $("#gallery");
    photos = (photos || []).filter(p => p && p.url);
    const list = photos.length ? photos : [
      { url: "img/hero.jpg", caption: "" }, { url: "img/towpath.jpg", caption: "" }, { url: "img/story.jpg", caption: "" }, { url: "img/stretching.jpg", caption: "" },
      ...Array.from({ length: 24 }, (_, i) => ({ url: `img/photo-${i + 1}.jpg`, caption: "" }))
    ];
    track.innerHTML = list.map((p, i) => `<figure class="slide">
      <img src="${esc(p.url)}" alt="${esc(p.caption)}" ${i < 12 ? "" : 'loading="lazy"'}>
      ${p.caption ? `<figcaption>${esc(p.caption)}</figcaption>` : ""}</figure>`).join("");

    // Show each photo as it arrives; drop the ones that fail. The section only disappears if
    // every single image failed — never on a timer, because images below the fold load late.
    track.querySelectorAll("img").forEach(img => {
      const done = () => { if (!track.querySelector(".slide")) sec.hidden = true; };
      img.addEventListener("load", () => { img.parentNode.classList.add("loaded"); sec.hidden = false; });
      img.addEventListener("error", () => { img.parentNode.remove(); done(); });
      if (img.complete && img.naturalWidth) img.parentNode.classList.add("loaded");
    });

    const step = (dir) => { const w = track.querySelector(".slide")?.getBoundingClientRect().width || 300; track.scrollBy({ left: dir * (w + 12), behavior: "smooth" }); };
    $("#gal-prev").onclick = () => step(-1); $("#gal-next").onclick = () => step(1);
  }

  // ── Render: Komoot map (optional) ────────────────────────────────────────
  function renderVideo(config = {}) {
    const v = $("#video"); if (!v) return;
    let id = config.youtube_id || C.youtubeId || "";
    const m = id.match(/(?:v=|youtu\.be\/|embed\/)([\w-]{6,})/); if (m) id = m[1];   // a full link works too
    if (!id) { v.hidden = true; return; }
    const src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0`;
    v.hidden = false; const f = v.querySelector("iframe"); if (f.src !== src) f.src = src;
  }
  // Instagram posts, driven from the sheet: paste post links into Config `instagram_embed`
  // (one cell can hold several, separated by commas or new lines) or `instagram_embed_2` /
  // `instagram_embed_3`. Only instagram.com addresses are accepted; nothing shows without one.
  let instaLoaded = false;
  function renderEmbeds(config = {}) {
    const wrap = $("#insta-embeds"), follow = $("#follow");
    if (!wrap) return;
    const raw = [config.instagram_embed, config.instagram_embed_2, config.instagram_embed_3].filter(Boolean).join(" ");
    const urls = (String(raw).match(/https?:\/\/(?:www\.)?instagram\.com\/(?:p|reel|tv)\/[\w-]+\/?/g) || []).slice(0, 3);
    const key = urls.join("|");
    if (wrap.dataset.key === key) return;
    wrap.dataset.key = key;

    if (!urls.length) { wrap.innerHTML = ""; if (follow) follow.hidden = true; return; }
    if (follow) follow.hidden = false;
    wrap.innerHTML = urls.map(u => `<blockquote class="instagram-media" data-instgrm-permalink="${esc(u)}" data-instgrm-version="14"></blockquote>`).join("");

    if (!instaLoaded) {
      instaLoaded = true;
      const sc = document.createElement("script");
      sc.async = true; sc.src = "https://www.instagram.com/embed.js";
      document.body.appendChild(sc);
    } else if (window.instgrm && window.instgrm.Embeds) {
      window.instgrm.Embeds.process();
    }
  }

  function renderKomoot(config = {}) {
    const wrap = $("#komoot"); if (!wrap) return;
    let src = config.komoot_embed || C.komootEmbed || "";
    src = src.replace(/&amp;/g, "&");
    const m = src.match(/src="([^"]+)"/); if (m) src = m[1];              // accept the whole <iframe> code too
    if (!src) { wrap.hidden = true; return; }
    wrap.hidden = false;
    const f = wrap.querySelector("iframe");
    if (f.src !== src) f.src = src;
  }

  function renderRaise(jg) {
    const target = (jg && jg.target) || C.justGiving.target;
    $("#target").textContent = fmtGBP(target);
    if (jg && jg.raised != null) {
      $("#raised").textContent = fmtGBP(jg.raised);
      $("#bar-fill").style.width = Math.min(100, (jg.raised / target) * 100).toFixed(1) + "%";
      $("#donor-count").textContent = jg.donors ? `${jg.donors.toLocaleString("en-GB")} supporters` : "";
    } else {
      $("#raised").textContent = "£31,000+";
      $("#bar-fill").style.width = "62%";
    }
  }
  // ── Share ─────────────────────────────────────────────────────────────────
  function shareText(model, state, jg) {
    const raised = jg && jg.raised != null ? fmtGBP(jg.raised) : "over £31,000";
    if (document.body.dataset.rehearsal === "yes" && model.lastDone && model.position.next)
      return `Test run: Tiger is between ${model.lastDone.name} and ${model.position.next.name}, ${model.position.miles.toFixed(0)} miles in — a dress rehearsal for 184 miles of Thames in October. ${location.origin}`;
    if (state === "live" && model.lastDone && model.position.next)
      return `Tiger is between ${model.lastDone.name} and ${model.position.next.name}, ${model.position.miles.toFixed(0)} miles into 184 along the Thames for MND. ${raised} raised so far. Follow and donate: ${location.origin}`;
    if (state === "finished") return `Tom ran the whole Thames. 184 miles, one go, for MND. ${raised} raised. ${location.origin}`;
    return `Tom is running the entire 184-mile Thames Path in under 40 hours on 10–11 October for MND research. ${raised} raised so far. ${location.origin}`;
  }

  // ── Countdown ─────────────────────────────────────────────────────────────
  // Banner: "£x raised so far" alternating with "x days to go", scrolling slowly.
  function renderTicker(jg, state) {
    const track = $("#ticker-track"); if (!track) return;
    const ms = raceStart - new Date();
    const days = Math.max(0, Math.ceil(ms / 86400000));
    const raised = jg && jg.raised != null ? fmtGBP(jg.raised) : null;
    const bits = [];
    if (raised) bits.push(`${raised} raised so far`);
    // The second message follows the state of the run, not the calendar, so a
    // rehearsal or a demo preview doesn't sit there counting down to October.
    if (state === "finished") bits.push("He did it — 184 miles");
    else if (state === "live") bits.push("Running now");
    else if (ms > 0) bits.push(days === 1 ? "1 day to go" : `${days} days to go`);
    else bits.push("Running now");
    if (!bits.length) return;
    const key = bits.join("|");
    if (track.dataset.key === key) return;
    track.dataset.key = key;
    // Repeated so the strip is always wider than the screen and the loop is seamless.
    const run = bits.concat(bits, bits, bits).map(b => `<span>${esc(b)}</span>`).join('<i aria-hidden="true">•</i>');
    track.innerHTML = `<div class="ticker-run">${run}</div><div class="ticker-run" aria-hidden="true">${run}</div>`;
  }

  function tickCountdown() {
    const el = $("#countdown"); if (!el) return;
    const ms = raceStart - new Date();
    if (ms <= 0) { el.textContent = ""; return; }
    const d = Math.floor(ms / 86400000), h = Math.floor(ms % 86400000 / 3600000);
    el.textContent = " · " + (d > 0 ? `${d} day${d === 1 ? "" : "s"} to go` : `${h}h ${Math.floor(ms % 3600000 / 60000)}m to go`);
  }

  // ── Main ──────────────────────────────────────────────────────────────────
  let latest = { model: null, state: "before", jg: null };
  let scrolledToTiger = false;
  function deriveState(config, model) {
    if (config.state && ["before","live","finished"].includes(config.state.toLowerCase())) return config.state.toLowerCase();
    const now = new Date();
    if (model.cps[model.cps.length - 1].actualAt) return "finished";
    return now >= model.start ? "live" : "before";
  }

  function scrollToTiger() {
    const t = $(".tiger"); if (!t) return;
    t.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function refresh() {
    try {
      let data;
      try { data = await loadSheet(); }
      catch (e) {
        // Sheet unreachable: draw the planned route from the built-in copy rather than nothing.
        console.warn("Sheet unavailable, using built-in plan", e);
        data = { config: Object.assign({}, SAMPLE_CONFIG, { total_override: "" }), checkpoints: SAMPLE_CHECKPOINTS.map(c => Object.assign({}, c)), sponsors: SAMPLE_SPONSORS, updates: [], photos: [], source: "fallback" };
      }
      document.body.dataset.source = data.source;
      let now = new Date();
      // Preview hook for testing without touching the sheet: ?demo=live or ?demo=finished
      const demo = new URLSearchParams(location.search).get("demo") || window.__DEMO || "";
      if (demo === "live" || demo === "finished") {
        const upto = demo === "live" ? 8 : data.checkpoints.length;
        data.checkpoints.forEach((cp, i) => { if (i < upto) cp.actual = i === 0 ? cp.target : (() => { const t = parseLondon(cp.target, raceStart); const p = londonParts(new Date(t.getTime() + i * 4 * 60000)); return `${p.y}-${String(p.mo).padStart(2,"0")}-${String(p.d).padStart(2,"0")} ${String(p.h).padStart(2,"0")}:${String(p.mi).padStart(2,"0")}`; })(); });
        data.config.state = demo;
        if (!data.updates.length) data.updates = [
          { date: "3 Oct", title: "Last long one done", body: "38 miles from Lechlade to Oxford this morning with Ed and Sam. Legs fine, feet less so.\nThe towpath past Newbridge is going to be beautiful at dawn.", photo: "img/towpath.jpg", link: "" },
          { date: "6 Oct", title: "Four days", body: "Kit list is done, crew rota is done, and Mum has told me to stop fussing. Thank you to everyone who has donated this week — past £31,000 now.", photo: "", link: "" }
        ];
        if (demo === "live") { data.config.current_pace = data.config.current_pace || "8:15"; data.config.pace_note = data.config.pace_note || "Tom: legs OK, walking the hills"; }
        if (demo === "live") { const last = parseLondon(data.checkpoints[upto - 1].actual, raceStart); now = new Date(last.getTime() + 55 * 60000); }
      }
      const model = computeForecast(data.checkpoints, now, data.config);
      const state = deriveState(data.config, model);
      document.body.dataset.state = state;
      const jg = loadJustGiving(data.config);
      latest = { model, state, jg };
      renderHead(model, state, data.config);
      renderRaise(jg);
      renderTicker(jg, state);
      renderJourney(model, state, data.config, data.sponsors);
      renderUpdates(data.updates);
      renderGallery(data.photos);
      renderKomoot(data.config);
      renderVideo(data.config);
      renderEmbeds(data.config);
      // Images load later and change layout — redraw the river when they do.
      $("#flow").querySelectorAll("img").forEach(img => { if (!img.complete) img.addEventListener("load", () => drawRiver(model, state), { once: true }); });
      if (state === "live" && model.lastDone && model.position.next && !scrolledToTiger && !location.hash) { scrolledToTiger = true; setTimeout(scrollToTiger, 600); }
      if (data.source === "sample") console.info("Tiger: rendering sample data — set sheetId in config.js");
      $("#updated").textContent = data.source === "fallback" ? "Live data temporarily unavailable — showing the plan." : ($("#updated").textContent || "");
    } catch (e) { console.error("Tiger refresh failed", e); }
  }

  // The header carries the banner, the title and the dates at the top of the page,
  // then collapses to a slim bar once you have scrolled past the intro — otherwise
  // it would follow you down the whole page and eat a third of a phone screen.
  function wireHeader() {
    const mark = () => document.body.classList.toggle("scrolled", window.scrollY > 220);
    mark();
    window.addEventListener("scroll", mark, { passive: true });
  }

  function wireStatic() {
    const jgUrl = C.justGiving.pageUrl;
    ["#donate-btn", "#nav-donate"].forEach(s => { $(s).href = jgUrl; });
    ["#sponsor-mail", "#press-mail"].forEach(s => { $(s).href = `mailto:${C.contactEmail}?subject=Tiger%20Takes%20on%20the%20Thames`; });
    $("#jump-btn").addEventListener("click", scrollToTiger);
    $("#share-btn").addEventListener("click", async () => {
      const text = shareText(latest.model || computeForecast(SAMPLE_CHECKPOINTS, new Date()), latest.state, latest.jg);
      if (navigator.share) { try { await navigator.share({ text }); return; } catch (e) { /* cancelled */ } }
      try { await navigator.clipboard.writeText(text); $("#share-btn").textContent = "Copied — paste it anywhere"; setTimeout(() => $("#share-btn").textContent = "Share this update", 2500); } catch (e) { prompt("Copy this:", text); }
    });
    let rt; window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => latest.model && drawRiver(latest.model, latest.state), 120); });
    document.fonts && document.fonts.ready.then(() => latest.model && drawRiver(latest.model, latest.state));
  }


  // Count the hero numbers up once, when they come into view.
  function animateStats() {
    const els = document.querySelectorAll("[data-count]");
    if (!els.length) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const run = (el) => {
      const to = +el.dataset.count, prefix = el.dataset.prefix || "", suffix = el.dataset.suffix || "", t0 = performance.now(), dur = 1400;
      const step = (t) => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.textContent = prefix + Math.round(to * e).toLocaleString("en-GB") + suffix; if (k < 1) requestAnimationFrame(step); };
      if (reduce) el.textContent = prefix + to.toLocaleString("en-GB") + suffix; else requestAnimationFrame(step);
    };
    const io = new IntersectionObserver((entries) => entries.forEach(en => { if (en.isIntersecting) { run(en.target); io.unobserve(en.target); } }), { threshold: 0.4 });
    els.forEach(el => io.observe(el));
    document.querySelectorAll(".stat, .hero-stat").forEach((el, i) => { el.style.setProperty("--i", i); });
  }

  // ── Tabs ──────────────────────────────────────────────────────────────────
  function wireTabs() {
    const tabs = Array.from(document.querySelectorAll(".tab"));
    if (!tabs.length) return;
    const show = (id) => {
      tabs.forEach(t => {
        const on = t.id === id;
        t.setAttribute("aria-selected", on ? "true" : "false");
        const panel = document.getElementById(t.getAttribute("aria-controls"));
        if (panel) panel.hidden = !on;
      });
      if (latest.model) drawRiver(latest.model, latest.state);   // the river needs a visible box to measure
    };
    tabs.forEach(t => t.addEventListener("click", () => show(t.id)));
    // Keyboard: left/right move between tabs, as people expect of a tablist.
    tabs.forEach((t, i) => t.addEventListener("keydown", e => {
      const n = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (!n) return;
      e.preventDefault();
      const next = tabs[(i + n + tabs.length) % tabs.length];
      next.focus(); show(next.id);
    }));
    // A link to #river or #updates should open that tab, not just jump.
    const forHash = { "#river": "tab-run", "#story": "tab-reason", "#updates": "tab-updates" };
    const openForHash = () => { const id = forHash[location.hash]; if (id) { show(id); document.getElementById("tabs").scrollIntoView({ behavior: "smooth", block: "start" }); } };
    document.querySelectorAll('a[href^="#"], a[href*="index.html#"]').forEach(a => {
      a.addEventListener("click", () => { const h = "#" + a.getAttribute("href").split("#")[1]; if (forHash[h]) setTimeout(() => show(forHash[h]), 0); });
    });
    window.addEventListener("hashchange", openForHash);
    openForHash();
    window.__showTab = show;
  }

  window.__refresh = refresh;
  wireStatic();
  wireHeader();
  wireTabs();
  renderKomoot();
  renderVideo();
  animateStats();
  tickCountdown(); setInterval(tickCountdown, 30000);
  // Poll fast only when it matters: every minute once the run is under way, otherwise every 5.
  let pollMs = 0, pollTimer = null;
  function schedulePoll() {
    const live = document.body.dataset.state === "live";
    const want = (live ? (C.refreshSeconds || 60) : (C.idleRefreshSeconds || 300)) * 1000;
    if (want === pollMs) return;
    pollMs = want; clearInterval(pollTimer); pollTimer = setInterval(() => { refresh().then(schedulePoll); }, pollMs);
  }
  // Don't poll at all while the tab is hidden in someone's background.
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh().then(schedulePoll); });
  refresh().then(schedulePoll);
})();
