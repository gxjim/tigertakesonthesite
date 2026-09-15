# Tiger Takes on the Thames — how to update the website

*Written for Tom. You can paste this whole document into ChatGPT (or any assistant) and ask it questions — it has everything needed to help you.*

## What the site is, in one paragraph

The site at **tigertakesonthethames.com** is a simple website with no admin login. It is made of a handful of plain text files that live in a **GitHub** repository called `gxjim/tigertakesonthesite` (you are a collaborator, so you can edit them). Whenever a file in that repository changes, a service called **Netlify** automatically rebuilds and publishes the site within about a minute. Anything that changes often — checkpoint times, the fundraising total, sponsors, your blog posts, your current pace on the day — lives in a **Google Sheet** that the site reads every 60 seconds. So there are two ways to change the site: **edit the Google Sheet** (for live data and posts, no technical steps at all) or **edit a file on GitHub** (for photos and fixed wording).

Rule of thumb: if it's something that changes, it's in the Sheet. If it's a photo or a sentence that will stay the same for weeks, it's on GitHub.

---

## Part 1 — The Google Sheet (day-to-day updates, no GitHub needed)

Open the sheet from your Google Drive (the one Jamie set up; it has tabs called Config, Checkpoints, Sponsors, Rehearsal and Updates). Edits appear on the site within about a minute. Anyone you give edit access to (crew, family) can do this from a phone in the Google Sheets app.

### Config tab (two columns: `key` and `value`)
| key | what to type in `value` |
|---|---|
| `total_override` | The current JustGiving total, e.g. `31338` or `£31,338.31`. **This is the only place the fundraising total comes from** — the site does not talk to JustGiving. Update it whenever you like. |
| `donor_count` | Optional. Number of supporters, shown next to the total. |
| `livetrack_url` | On race morning, paste your Garmin LiveTrack link here. A "Where is Tiger right now" button appears. If the session restarts, paste the new link. |
| `current_pace` | On the day: your current pace in **minutes per km**, e.g. `6:30`. Every remaining checkpoint is forecast at that pace from your last confirmed checkpoint. Change it as you speed up or slow down. Leave blank and the site forecasts automatically from your last two legs. (If someone thinks in miles, write `9:45 /mi`.) |
| `pace_note` | Optional short line shown under the live headline, e.g. `Tom: legs fine, walking the hills` or `10 min stop at Goring for food`. |
| `state` | Leave blank — the site works out before / live / finished by itself. Only type `live` or `finished` to force it. |
| `rehearsal` | `yes` makes the site use the Rehearsal tab instead of Checkpoints (for a practice run). Set back to `no` afterwards. |
| `last_update` | Your own short status line, in your words — it appears beside the tracker and on the moving Tiger marker on the river, exactly as you type it (e.g. `Rain easing, moving well`). Leave blank for nothing. |
| `komoot_embed` | Paste the whole Komoot embed code here (Komoot → Share → Embed → copy), or just its web address. The map appears above the river. **Do this here, not in config.js** — the sheet doesn't mind the quote marks in the code; a code file does. |
| `youtube_id` | Optional: a YouTube link or ID for the video in the "Why" section. |
| `instagram_embed` | Optional: paste the web address of one Instagram post (`https://www.instagram.com/p/XXXXXXX/`). The post itself then appears on the page under "Follow along". You can put two or three addresses in this one cell, separated by commas or line breaks, or use the extra keys below. |
| `instagram_embed_2` | Optional: a second Instagram post. |
| `instagram_embed_3` | Optional: a third Instagram post. Three is the maximum the page shows. |

**The Config tab is one key per row**: `key` in A1 and `value` in B1, then `state` in A2, `livetrack_url` in A3, and so on down column A, each with its value in column B of the same row. Leaving values blank is fine.

### Checkpoints tab (one row per checkpoint, Source to Thames Barrier)
- `actual` — **the one thing the crew must do on the day.** When you reach a checkpoint, type the time in that row, e.g. `12:58` (the site works out which day). This turns that checkpoint navy on the river and moves the yellow Tiger marker.
- `runners` (the "Principal Support runners" column) — shows as **"Main support runner is …"** under the checkpoint name.
- `crew` — optional new column. Add a column with `crew` in the header and it shows as **"Support crew is …"** on the same checkpoint.
- `eta` — optional. If you want to say "I'll be in Henley about 02:40" for one specific checkpoint, type `02:40` here. It overrides the forecast for that checkpoint only. Usually `current_pace` in Config is easier.
- `pace` — optional, per checkpoint, same format as `current_pace`, if one stretch will be slower than the rest.
- Don't change `id`, `name`, `miles` or `target` — the route is fixed.

### Photos tab — the photo carousel
Headers across row 1: `url`, `caption`. **One row per photo, and every row needs something in `url`** — a row with only a caption shows nothing, because there's no photo to show. `url` can be a normal Google Drive share link pasted straight in (`https://drive.google.com/file/d/FILE_ID/view?usp=drive_link` — the site converts it for you), a photo on GitHub (`img/photo-3.jpg`), or any web address ending .jpg/.png. Drive photos must be shared as **Anyone with the link can view**, or they'll show as gaps. If you'd rather not use the tab at all, just upload photos to the `img` folder on GitHub named `photo-1.jpg`, `photo-2.jpg`, … and they appear automatically.

### Sponsors tab (one row per marathon, 1–7)
- `price` — a number (`250` shows as £250).
- `status` — `available` or `taken`.
- `sponsor` — the name to show once taken, e.g. `The Salutation Inn`.
- `photo_url` — optional, a photo for that stretch of river (see photos below). If blank, the site looks for a file called `img/leg-1.jpg` (for marathon 1) etc. on GitHub.
- `caption` — optional caption on that photo.
- `note` — optional sentence under the photo: who is running that stretch, or what it means to you.
- `section_note` — a sentence or two describing that stretch of river. It appears on the marathon card in **two places**: the sponsor page and the river on the main page. If you leave it blank, a written-in default is used instead, so the cards never look empty.

The marathons are: 1 Source→Lechlade · 2 Lechlade→Oxford · 3 Oxford→Wallingford · 4 Wallingford→Reading · 5 Reading→Marlow · 6 Marlow→Shepperton · 7 Shepperton→Thames Barrier.

### Updates tab — your blog ("Notes from the towpath")
The five headers go **across row 1**, one per column: A1 `date`, B1 `title`, C1 `body`, D1 `photo_url`, E1 `link`. (Not down column A — the site reads row 1 as the column names.) Each post is then one row underneath: row 2, row 3, and so on, oldest at the top; the site shows the newest first.
- `date` — anything, e.g. `3 Oct`.
- `title` — short.
- `body` — as long as you like. For a new paragraph inside the cell press **Alt+Enter** (Ctrl+Enter on some setups; on the phone app, just press return). Web addresses turn into links.
- `photo_url` — optional, and it must be something a browser can open. Either a photo you've uploaded to the `img` folder on GitHub, written as `img/post-1.jpg`, or a full web address starting `https://`. A bare filename off your phone (`IMG_3430.HEIC`) won't work — the site has no idea where that file is, and browsers can't display HEIC at all. Convert iPhone photos to JPG first (on the phone: Settings → Camera → Formats → Most Compatible, or just email the photo to yourself and save the JPG).
- `link` — optional, e.g. an Instagram post.

Each post appears collapsed — just the date and the headline — and opens when someone clicks it. The three newest are listed, with an "Earlier posts" button for the rest. The section is hidden until the first post exists.

---

## Part 2 — GitHub (photos and fixed wording)

You'll have had an email inviting you to `gxjim/tigertakesonthesite`. Accept it, then go to **github.com/gxjim/tigertakesonthesite**. You'll see a list of files. The ones that matter:

- `index.html` — all the fixed words on the main page (headline, your story, the press paragraph, footer).
- `sponsor.html` — the "Sponsor a marathon" page. Prices and availability come from the sheet; the words around them are in this file.
- `img/` — a folder with the photos.
- `config.js` — a couple of settings (contact email, refresh rate).
- `styles.css` and `app.js` — design and behaviour. **Leave these alone.**

**Upload everything you want to change in one go.** Each commit makes Netlify republish the site, and the hosting plan only allows so many of those per month — five files committed separately costs five times as much as five files committed together.

Every change on GitHub is made with a "commit" — that's just GitHub's word for "save". After you commit, Netlify republishes the site automatically; give it one to two minutes, then refresh **tigertakesonthethames.com** (hard refresh: Ctrl+Shift+R on Windows, Cmd+Shift+R on Mac).

### Changing words (index.html)
1. Click `index.html` in the file list.
2. Click the **pencil icon** (top right of the file, "Edit this file").
3. Find the sentence you want to change (Ctrl+F / Cmd+F to search for a word in it).
4. Change only the words **between** the angle-bracket tags. For example, in
   `<p class="lede">Tom "Tiger" Spearman, 31, is running the entire Thames Path…</p>`
   you can change anything between `>` and `</p>`, but don't delete the `<p class="lede">` or `</p>` parts.
5. Click the green **Commit changes…** button (top right), then **Commit changes** again in the box that pops up. Done.

If something goes wrong (page looks broken, or a yellow box says the settings file has an error), tell Jamie — GitHub keeps every previous version and it's a two-click restore: on the file's page click **History**, open the last good version, and use the **⋯ → Revert** or copy its contents back.

Where things are in `index.html`, top to bottom: the headline and intro (`class="hero"`), the six big numbers (`class="numbers"`), the route intro (`class="journey-head"`), your story (`class="why"` — the quote is in `<blockquote class="pull">`, the paragraphs below it), the "Follow along" and "Press and contact" boxes near the bottom, and the footer.

### Changing or adding photos (img folder)
Photos have fixed names and the page picks them up by name:

| file name | where it appears | shape |
|---|---|---|
| `img/hero.jpg` | big photo at the top | portrait (taller than wide), about 1280×1600 px |
| `img/story.jpg` | next to your story | portrait or 4:3, about 1200 px on the long side |
| `img/leg-1.jpg` … `img/leg-7.jpg` | one per marathon, on the river | landscape, about 1600×900 px |
| `img/post-1.jpg`, `img/post-2.jpg` … | for blog posts (referenced from the Updates tab) | landscape |
| `img/og.jpg` | the preview image when the link is shared on WhatsApp | exactly 1200×630 px |

Before uploading, make the photo web-sized: under **400 KB** and no more than about 1600 px on the long side. A phone photo straight from the camera is 3–8 MB and will make the page slow. Easiest tools: on a Mac, Preview → Tools → Adjust Size; on Windows, Photos → Resize; or the free site **squoosh.app** (drag photo in, download). Save as JPG.

To upload:
1. On the repository page, click the **`img`** folder so you are *inside* it (the page address ends in `/tree/main/img`). This step matters — files dropped on the front page end up in the wrong place and won't show.
2. Click **Add file → Upload files**.
3. Drag the photo in. To **replace** an existing photo, give it exactly the same file name (e.g. `hero.jpg`) — GitHub overwrites the old one.
4. Click **Commit changes**.

### Settings (config.js)
Click `config.js` → pencil icon. The lines you might touch:
- `komootEmbed` → **don't put the Komoot code here**; put it in the sheet (Config → `komoot_embed`). The embed code contains quote marks, and a stray quote in this file stops the whole site loading (this happened once — the page went blank apart from the headings). If you ever must edit this file, change only text between the existing quotes/backticks, and check the site a minute later.
- `youtubeId: "-kX5uTaqBJs"` → the bit after `v=` in a YouTube link; this is the video on the "Why" section.
- `contactEmail: "tom.spearman@pm.me"` → where the "email Tom" links go.
Commit as above.

---

## Part 3 — Race weekend cheat sheet (for whoever is with Tom)

1. Saturday ~04:50: paste the Garmin LiveTrack link into Config → `livetrack_url`.
2. At every checkpoint: type the arrival time into Checkpoints → `actual` for that row.
3. When Tom's pace changes noticeably: update Config → `current_pace` (minutes per km). Optional one-liner in `pace_note`.
4. Every hour or two: glance at the JustGiving page and update Config → `total_override`.
5. If the LiveTrack session dies and restarts, paste the new link into `livetrack_url`.
6. When Tom reaches the Thames Barrier, type the time into the last row's `actual` — the site switches to its finished state by itself.

Nothing else needs touching. If the sheet is ever unreachable, the site keeps showing the planned route rather than breaking.

---

## Part 4 — Things to avoid
- Don't rename or move files or tabs, and don't change the header row of any sheet tab (the site finds data by those names — e.g. renaming `runners` breaks the "who's running" line, although the site now tolerates anything containing the word "runner").
- Don't upload huge photos.
- Don't edit `styles.css` or `app.js` unless Jamie or an assistant is guiding you through a specific change.
- Don't put anything private in the sheet — it's readable by anyone with the link (that's how the site reads it).

## If you're asking an AI assistant for help
Tell it: "The site is a static HTML/CSS/JS site on Netlify, deployed from the GitHub repo gxjim/tigertakesonthesite, reading a Google Sheet through a Netlify function. I want to [change X]." Then paste the relevant bit of this document. It will know what to do.
