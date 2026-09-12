/* ─── Tiger Takes on the Thames · app ─────────────────────────────────────────
   Plain JS, no build step. Reads a Google Sheet (shared "anyone with link can
   view") via the gviz CSV endpoint, JustGiving via a Netlify function, and
   renders the tracker, forecast and sponsor legs. Falls back to sample data so
   the page renders before anything is connected.                             */

(() => {
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

  const SAMPLE_SPONSORS = [1,2,3,4,5,6,7].map(n => ({ leg:n, from:"", to:"", price:"", status:"available", sponsor:"", logo:"" }));
  const SAMPLE_CONFIG = { state:"", livetrack_url:"", total_override:"", rehearsal:"no", last_update:"" };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const fmtGBP = (n) => "£" + Math.round(n).toLocaleString("en-GB");
  const fmtTime = (d) => d ? d.toLocaleTimeString("en-GB", { hour:"2-digit", minute:"2-digit", timeZone: LONDON }) : "—";
  const fmtDay = (d) => d ? d.toLocaleDateString("en-GB", { weekday:"short", timeZone: LONDON }) : "";
  const minutes = (ms) => Math.round(ms / 60000);
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
  async function sheetTab(tab) {
    const url = `https://docs.google.com/spreadsheets/d/${C.sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}&_=${Date.now()}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Sheet ${tab}: ${res.status}`);
    const rows = parseCSV(await res.text());
    const head = rows.shift().map(h => h.trim().toLowerCase().replace(/\s+/g, "_"));
    return rows.filter(r => r.some(c => c && c.trim())).map(r => Object.fromEntries(head.map((h, i) => [h, (r[i] || "").trim()])));
  }

  // ── Data loading ──────────────────────────────────────────────────────────
  async function loadSheet() {
    if (!C.sheetId) return { config: SAMPLE_CONFIG, checkpoints: SAMPLE_CHECKPOINTS, sponsors: SAMPLE_SPONSORS, source: "sample" };
    const [cfgRows, sponsors] = await Promise.all([sheetTab(C.tabs.config), sheetTab(C.tabs.sponsors)]);
    const config = Object.assign({}, SAMPLE_CONFIG, Object.fromEntries(cfgRows.map(r => [r.key, r.value])));
    const tab = (config.rehearsal || "").toLowerCase() === "yes" ? C.tabs.rehearsal : C.tabs.checkpoints;
    const cps = (await sheetTab(tab)).map(r => ({ id:+r.id, name:r.name, miles:+r.miles, target:r.target, actual:r.actual, runners:r.runners || "", note:r.note || "" }));
    return { config, checkpoints: cps, sponsors: sponsors.map(s => ({ leg:+s.leg, from:s.from, to:s.to, price:s.price, status:(s.status||"available").toLowerCase(), sponsor:s.sponsor, logo:s.logo_url || s.logo || "" })), source: "sheet" };
  }

  async function loadJustGiving(config) {
    if (config.total_override) return { raised: +String(config.total_override).replace(/[^\d.]/g, ""), source: "override" };
    if (!C.justGiving.pageShortName) return null;
    try {
      const res = await fetch(`/.netlify/functions/justgiving?page=${encodeURIComponent(C.justGiving.pageShortName)}`, { cache: "no-store" });
      if (!res.ok) throw new Error(res.status);
      const j = await res.json();
      return { raised: +j.raised, donors: j.donors, target: j.target ? +j.target : null, source: "justgiving" };
    } catch (e) { console.warn("JustGiving unavailable", e); return null; }
  }

  // ── Forecast model ────────────────────────────────────────────────────────
  // Returns checkpoints enriched with Date objects, forecast Dates and status.
  function computeForecast(cps, now) {
    let prevRef = raceStart;
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
      cp.forecastAt = new Date(cursor.getTime() + plannedLeg * ratio);
      // If he's already later than the forecast, forecast = now + a little (he hasn't arrived).
      if (now > cp.forecastAt && prev.actualAt) cp.forecastAt = new Date(now.getTime() + 5 * 60000);
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
    return { cps, ratio, lastDone, position, delayMin: lastDone ? minutes(lastDone.actualAt - lastDone.targetAt) : 0 };
  }

  // ── Render: river ─────────────────────────────────────────────────────────
  function renderRiver(model, state) {
    const svg = $("#river");
    const W = 1400, H = 170, padL = 40, padR = 40;
    const total = model.cps[model.cps.length - 1].miles;
    const x = (mi) => padL + (mi / total) * (W - padL - padR);
    // Gentle meander: y varies with a slow sine so it reads as a river, not a ruler.
    const y = (mi) => 78 + Math.sin(mi / total * Math.PI * 3) * 22;
    const pts = []; for (let mi = 0; mi <= total; mi += 2) pts.push([x(mi), y(mi)]);
    pts.push([x(total), y(total)]);
    const d = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
    const doneMiles = model.position.miles;
    const dPts = pts.filter(p => p[0] <= x(doneMiles)); dPts.push([x(doneMiles), y(doneMiles)]);
    const dDone = dPts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");

    let out = `<path d="${d}" fill="none" stroke="#cfe3f2" stroke-width="10" stroke-linecap="round"/>`;
    if (doneMiles > 0) out += `<path d="${dDone}" fill="none" stroke="#0f4c81" stroke-width="10" stroke-linecap="round"/>`;
    model.cps.forEach((cp, i) => {
      const cx = x(cp.miles), cy = y(cp.miles);
      const done = cp.status === "done";
      out += `<circle cx="${cx}" cy="${cy}" r="6" fill="${done ? "#0f4c81" : "#ffffff"}" stroke="${done ? "#0f4c81" : "#9fb3c8"}" stroke-width="2"/>`;
      const above = i % 2 === 0;
      const ty = above ? cy - 26 : cy + 36;
      out += `<text x="${cx}" y="${ty}" text-anchor="middle" font-family="Work Sans, system-ui, sans-serif" font-size="12" font-weight="${cp.status === "next" ? 600 : 400}" fill="${done ? "#0f4c81" : "#5d6673"}">${cp.name}</text>`;
      out += `<text x="${cx}" y="${ty + 14}" text-anchor="middle" font-family="Work Sans, system-ui, sans-serif" font-size="10" fill="#8a94a0">${fmtTime(cp.status === "done" ? cp.actualAt : cp.forecastAt)}</text>`;
    });
    if (state !== "before" && model.lastDone) {
      const cx = x(doneMiles), cy = y(doneMiles);
      out += `<circle cx="${cx}" cy="${cy}" r="14" fill="#f5c400" stroke="#ffffff" stroke-width="3"/>`;
      out += `<text x="${cx}" y="${cy + 4}" text-anchor="middle" font-family="Work Sans, system-ui, sans-serif" font-size="10" font-weight="700" fill="#1f2a37">T</text>`;
    }
    svg.innerHTML = out;
    // Scroll the strip so Tiger (or the start) is in view.
    const scroller = $("#river-scroll");
    const target = x(state === "before" ? 0 : doneMiles) - scroller.clientWidth / 2;
    scroller.scrollLeft = Math.max(0, target);
  }

  // ── Render: table ─────────────────────────────────────────────────────────
  function renderTable(model, state) {
    const rows = [];
    model.cps.forEach((cp, i) => {
      const delta = cp.status === "done" ? minutes(cp.actualAt - cp.targetAt) : (cp.status === "next" || cp.status === "upcoming") ? minutes(cp.forecastAt - cp.targetAt) : 0;
      const deltaHtml = (state !== "before" && delta !== 0) ? `<span class="delta ${delta > 0 ? "late" : "early"}">${delta > 0 ? "+" : "−"}${Math.abs(delta)}m</span>` : "";
      const right = cp.status === "done" ? `<span class="actual">${fmtTime(cp.actualAt)}</span>${deltaHtml}` : state === "before" ? `<span class="forecast" style="color:var(--muted);font-weight:400">—</span>` : `<span class="forecast">${fmtTime(cp.forecastAt)}</span>${deltaHtml}`;
      const runners = cp.runners ? `<span class="runners">Next leg with ${cp.runners}</span>` : "";
      rows.push(`<div class="cp-row ${cp.status}"><div>${cp.name}${runners}</div><div>${cp.miles}</div><div>${fmtDay(cp.targetAt)} ${fmtTime(cp.targetAt)}</div><div>${right}</div></div>`);
      if (state === "live" && model.lastDone === cp && model.position.next) {
        rows.push(`<div class="cp-row tiger-row"><div><strong>Tiger is here</strong> · about mile ${model.position.miles.toFixed(0)} · ${model.delayMin === 0 ? "on schedule" : (model.delayMin > 0 ? model.delayMin + " min behind plan" : Math.abs(model.delayMin) + " min ahead of plan")}</div></div>`);
      }
    });
    $("#cp-rows").innerHTML = rows.join("");
  }

  // ── Render: headline, buttons, fundraising, sponsors ──────────────────────
  function renderHead(model, state, config) {
    const h = $("#position-headline"), s = $("#position-sub"), l = $("#live-label");
    if (state === "before") {
      l.textContent = "Route and target times";
      h.textContent = "184 miles, 15 checkpoints, one weekend";
      s.textContent = "Times below are the plan. This section goes live at 05:00 on Saturday 10 October.";
    } else if (state === "finished") {
      const fin = model.cps[model.cps.length - 1];
      l.textContent = "Finished";
      h.textContent = fin.actualAt ? `He did it. Thames Barrier at ${fmtTime(fin.actualAt)} on ${fmtDay(fin.actualAt)}.` : "He did it.";
      const elapsed = fin.actualAt ? (fin.actualAt - raceStart) / 3600000 : null;
      s.textContent = elapsed ? `184 miles in ${Math.floor(elapsed)} hours ${Math.round((elapsed % 1) * 60)} minutes. The fundraising page stays open.` : "The fundraising page stays open.";
    } else {
      l.textContent = `Live · ${fmtDay(new Date())} ${fmtTime(new Date())}`;
      if (!model.lastDone) { h.textContent = "At the source, waiting for 05:00"; s.textContent = "The first checkpoint is Cricklade, 12.5 miles."; }
      else if (!model.position.next) { h.textContent = "Tom has reached the Thames Barrier"; s.textContent = ""; }
      else {
        h.textContent = `Tom is between ${model.lastDone.name} and ${model.position.next.name}`;
        s.textContent = `${model.position.miles.toFixed(0)} miles in · ${model.delayMin === 0 ? "on schedule" : (model.delayMin > 0 ? model.delayMin + " minutes behind plan" : Math.abs(model.delayMin) + " minutes ahead")} · ${model.position.next.name} forecast ${fmtTime(model.position.next.forecastAt)}`;
      }
    }
    const lt = $("#livetrack-btn");
    if (state === "live" && config.livetrack_url) { lt.href = config.livetrack_url; lt.hidden = false; } else lt.hidden = true;
    $("#updated").textContent = config.last_update ? `Sheet updated ${config.last_update}` : "";
  }

  function renderRaise(jg) {
    const target = (jg && jg.target) || C.justGiving.target;
    $("#target").textContent = fmtGBP(target);
    if (jg && jg.raised != null) {
      $("#raised").textContent = fmtGBP(jg.raised);
      $("#bar-fill").style.width = Math.min(100, (jg.raised / target) * 100).toFixed(1) + "%";
      $("#donor-count").textContent = jg.donors ? `${jg.donors.toLocaleString("en-GB")} supporters` : "";
    } else {
      $("#raised").textContent = "£26,000+";
      $("#bar-fill").style.width = "52%";
    }
  }

  function renderSponsors(sponsors, cps) {
    // Leg n spans checkpoints (2n-1) → (2n+1) on a 16-checkpoint route: 1→3, 3→5, … 13→15, plus 15→16 for the last.
    const legs = sponsors.length ? sponsors : SAMPLE_SPONSORS;
    $("#legs").innerHTML = legs.map(s => {
      const a = cps[(s.leg - 1) * 2], b = s.leg === legs.length ? cps[cps.length - 1] : cps[Math.min(cps.length - 1, s.leg * 2)];
      const from = s.from || (a && a.name) || "", to = s.to || (b && b.name) || "";
      const miles = a && b ? `${(b.miles - a.miles).toFixed(0)} miles` : "";
      const taken = s.status === "taken" || s.status === "sponsored";
      const status = taken ? `Sponsored by ${s.sponsor || "a friend of Tom's"}` : `Available <span class="price">${s.price ? "· " + s.price : ""}</span>`;
      return `<div class="leg ${taken ? "taken" : "open"}"><span class="n">Leg ${s.leg}</span><span class="route">${from} → ${to}</span><span class="miles">${miles}</span><span class="status">${status}</span></div>`;
    }).join("");
  }

  // ── Share ─────────────────────────────────────────────────────────────────
  function shareText(model, state, jg) {
    const raised = jg && jg.raised != null ? fmtGBP(jg.raised) : "over £26,000";
    if (state === "live" && model.lastDone && model.position.next)
      return `Tiger is between ${model.lastDone.name} and ${model.position.next.name}, ${model.position.miles.toFixed(0)} miles into 184 along the Thames for MND. ${raised} raised so far. Follow and donate: ${location.origin}`;
    if (state === "finished") return `Tom ran the whole Thames. 184 miles, one go, for MND. ${raised} raised. ${location.origin}`;
    return `Tom is running the entire 184-mile Thames Path in under 40 hours on 10–11 October for MND research. ${raised} raised so far. ${location.origin}`;
  }

  // ── Countdown ─────────────────────────────────────────────────────────────
  function tickCountdown() {
    const el = $("#countdown b"); const ms = raceStart - new Date();
    if (ms <= 0) { el.textContent = "Go"; return; }
    const d = Math.floor(ms / 86400000), h = Math.floor(ms % 86400000 / 3600000);
    el.textContent = d > 0 ? `${d}d ${h}h` : `${h}h ${Math.floor(ms % 3600000 / 60000)}m`;
  }

  // ── Main ──────────────────────────────────────────────────────────────────
  let latest = { model: null, state: "before", jg: null };
  function deriveState(config, model) {
    if (config.state && ["before","live","finished"].includes(config.state.toLowerCase())) return config.state.toLowerCase();
    const now = new Date();
    if (model.cps[model.cps.length - 1].actualAt) return "finished";
    return now >= raceStart ? "live" : "before";
  }

  async function refresh() {
    try {
      const data = await loadSheet();
      const now = new Date();
      const model = computeForecast(data.checkpoints, now);
      const state = deriveState(data.config, model);
      document.body.dataset.state = state;
      const jg = await loadJustGiving(data.config);
      latest = { model, state, jg };
      renderHead(model, state, data.config);
      renderRiver(model, state);
      renderTable(model, state);
      renderRaise(jg);
      renderSponsors(data.sponsors, data.checkpoints);
      if (data.source === "sample") console.info("Tiger: rendering sample data — set sheetId in config.js");
    } catch (e) { console.error("Tiger refresh failed", e); }
  }

  function wireStatic() {
    const jgUrl = C.justGiving.pageUrl;
    ["#donate-btn", "#nav-donate"].forEach(s => { $(s).href = jgUrl; });
    ["#sponsor-mail", "#press-mail"].forEach(s => { $(s).href = `mailto:${C.contactEmail}?subject=Tiger%20Takes%20on%20the%20Thames`; });
    const insta = C.instagram ? `https://www.instagram.com/${C.instagram}/` : "#";
    $("#insta-btn").href = insta;
    ["#strava-btn", "#strava-btn-2"].forEach(s => { $(s).href = C.stravaAthleteUrl || "#"; });
    $("#share-btn").addEventListener("click", async () => {
      const text = shareText(latest.model || computeForecast(SAMPLE_CHECKPOINTS, new Date()), latest.state, latest.jg);
      if (navigator.share) { try { await navigator.share({ text }); return; } catch (e) { /* cancelled */ } }
      try { await navigator.clipboard.writeText(text); $("#share-btn").textContent = "Copied — paste it anywhere"; setTimeout(() => $("#share-btn").textContent = "Share this update", 2500); } catch (e) { prompt("Copy this:", text); }
    });
  }

  async function loadTraining() {
    try {
      const res = await fetch("/.netlify/functions/strava", { cache: "no-store" });
      if (!res.ok) return;
      const t = await res.json();
      const b = document.querySelectorAll("#train-stats b");
      b[0].textContent = Math.round(t.ytdMiles).toLocaleString("en-GB");
      b[1].textContent = `${t.longestMiles.toFixed(0)} mi`;
      b[2].textContent = t.runsLast4Weeks;
      $("#train-list").innerHTML = t.recent.map(r => `<div class="train-item"><span>${r.name}</span><span>${r.miles.toFixed(1)} mi</span><span>${r.date}</span></div>`).join("");
    } catch (e) { /* section keeps its dashes until Strava is wired */ }
  }

  wireStatic();
  tickCountdown(); setInterval(tickCountdown, 30000);
  refresh(); setInterval(refresh, (C.refreshSeconds || 60) * 1000);
  loadTraining();
})();
