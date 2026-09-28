# Nisham Sajjad — Scroll-Story Portfolio

A single-page, scroll-driven portfolio that tells Nisham's career story as a short animated film, built from the 8-page storyboard.

Plain HTML, CSS and JS. GSAP + ScrollTrigger handle the scrubbed, pinned timeline and Lenis handles smooth scrolling. All libraries are vendored in `assets/vendor/`, so there's no build step and no CDN dependency.

## Run locally

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

Any static server works. Opening `index.html` straight from disk also works in most browsers.

## Deploy

Upload the folder as-is to Netlify, Vercel, or GitHub Pages. For GitHub Pages, go to Settings → Pages → Deploy from branch → `/ (root)`.

## Social links

The links are in `index.html`, in the `SOCIAL LINKS` block of the Connect scene: Instagram, X, LinkedIn, Gmail, WhatsApp (+960 923 9234) and Facebook. Once the site is deployed, change the `og:image` meta tag to an absolute URL so link previews show the image.

## The story (one pinned timeline)

| Beat | Scene |
| --- | --- |
| 0 | **Intro**: "I am Nisham Sajjad," types in word by word |
| 0.1 | **Portrait**: close-up slides in from the right, 8-years line and divider draw in |
| 1.7 | **Mission Hospital**: portrait shrinks into the full-body character, hospital fades in (grain + vignette) |
| 3.4 | **COVID**: surgical mask slides up onto his face |
| 5.0 | **NABH**: clipboard pose, "(NABH)" appears letter by letter with a shine sweep across the sign |
| 7.0 | **Maldives**: hospital fades to black, plane flies in with parallax clouds and a spinning propeller, then exits top right |
| 9.6 | **NURF Pharmacy, IGMH**: IGMH fades in, desk slides up, character drops into the chair with a bounce |
| 11.6 | **Responsibilities**: chair swivels, ticker scrolls through the 7 duties |
| 15.2 | **Connect**: everything lifts away, round portrait, orbit draws, six social icons pop in |

The beats are timeline units in `script.js`. Each beat is 0.75 viewport heights of scroll, set by the `BEAT` constant. Change `BEAT` to make the whole film faster or slower. The dots on the right jump between chapters.

## Artwork

All images live in `assets/img/`. The storyboard pages were flat images, so `tools/extract_assets.py` cut them into layers:

- **Stage layers** keep the storyboard's **941×1672 canvas** so they stack exactly: `portrait`, `hospital`, `hospital-blur`, `char-stand`, `char-mask`, `char-clipboard`, `igmh`, `desk`, `seated`.
- **Free layers**: `plane`, `cloud-1..3`, `nabh-word`, `avatar`.
- The backgrounds had the character and baked-in text painted out, which is why the building plates are clean.

**Swapping art:** if the illustrator delivers real separate layers (e.g. an empty chair, or a character without the laptop), export them on the same 941×1672 canvas with the same file names and they drop straight in. To re-cut from a new storyboard PDF:

```bash
pip install pymupdf pillow opencv-python-headless "rembg[cpu]" torch simple-lama-inpainting
python tools/extract_assets.py path/to/portfolio.pdf
```

## Layout

- **Mobile (≤768px)** follows the storyboard pages exactly: text on top, scene below, full `100svh` stage.
- **Tablet portrait**: same as mobile with more padding.
- **Desktop (≥1200px, or wide landscape)**: text in the left column, scene on the right with a soft blurred fill behind it and a dark gradient for readability. The plane crosses the full width.

## Accessibility & performance

- Only `transform` / `opacity` are animated, except the short blur-to-sharp on text lines.
- `prefers-reduced-motion` turns the film into simple cross-fades: no movement, no smooth scrolling, no looping animations.
- Every scene image is preloaded behind a small "N" loading screen. The whole set is about 0.7 MB of WebP.
- Social icons are real links with labels and at least 54px tap targets. They lift and glow on hover and keyboard focus.
