Tiger Took On The Thames — book page (Fable build)
===================================================

HOW TO PUT IT LIVE
  Upload the whole `book` folder to the root of gxjim/tigertakesonthesite
  via the GitHub web UI — EVERYTHING IN ONE COMMIT (index.html + 33 images).
  Each production deploy costs 15 of your 300 monthly Netlify credits, so
  uploading file by file would burn over 500 credits for one change.

  Result: tigertakesonthethames.com/book

WHILE IT IS STILL A SURPRISE
  - index.html contains <meta name="robots" content="noindex, nofollow">.
    Delete that line when the book goes public.
  - Do NOT link to it from the site navigation until Tom has seen it.

WHAT CHANGED FROM THE FILE FABLE PRODUCED
  1. The 33 photographs were inline base64 data URIs, making index.html
     6.81 MB. They are now ordinary files in img/, and index.html is 82 KB.
     Same images, same page, but the browser caches them, the page renders
     progressively, and the HTML can be hand-edited.
  2. The <title> lost its "(preview)" suffix.
  3. Added a colophon under the nav linking back to tigertakesonthethames.com.
     Delete the .colophon CSS block and the <p class="colophon"> to remove it.
  Nothing else was touched. The design, copy, structure and behaviour are
  exactly as Fable built them.

WHAT IS IN HERE
  index.html      82 KB — all CSS and JS inline
  img/            33 photographs, 4.7 MB total, none over 195 KB
  33 pages, including six guest-book pages and a gallery.

EXTERNAL REQUESTS
  Google Fonts only (Lora + Work Sans), which the rest of the site already
  loads. Nothing else.

TESTED
  All 33 pages at 320px, 430px and 1280px: every image loads, no horizontal
  overflow, no console errors.

A WARNING WORTH KEEPING
  Never add loading="lazy" to the images. Pages are swapped by script rather
  than scrolled to, so a lazily-loaded image is never requested and the page
  renders with holes.
