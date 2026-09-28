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

## Live site

With GitHub Pages enabled on `main`, the site is served at https://sajjadnisham.github.io/portfolio/. The link-preview tags in `index.html` already point there. Update them if you move to a custom domain.

## Updating the site

Every CSS, JS and image link in `index.html` carries a `?v=` version tag. Browsers cache GitHub Pages files, so bump that tag on every change (find and replace all), or visitors may get the new page with old files.

## Social links

The links are in `index.html`, in the `SOCIAL LINKS` block of the Connect scene: Instagram, X, LinkedIn, Gmail, WhatsApp (+960 923 9234) and Facebook.

## How the animation works

There are two timelines in `script.js`:

- **`tl` (scroll-linked):** scenes, backgrounds, camera framing and text follow the scroll position. Scrolling back up reverses them. Timeline units are "beats", and each beat is 0.75 viewport heights of scroll (`BEAT`).
- **`act` (free-running):** the character's acting. When the scroll reaches a scene, he plays that moment at natural speed, and plays it backwards when you scroll up. So he moves freely instead of stuttering with your finger.

| Scroll beat | Scene | What he does |
| --- | --- | --- |
| 0 | Intro | "I am Nisham Sajjad," types in word by word |
| 0.1 | Portrait | close-up slides in, 8-years line draws in |
| 1.75 | Mission Hospital | turns away, walks into the hospital as a rim-lit silhouette with his legs stepping, turns round, settles |
| 3.7 | COVID | leans to his pocket, the mask arcs up onto his face, small nod |
| 5.1 | NABH | a file is tossed in on an arc, he catches it; "(NABH)" letter reveal + shine |
| 7.1 | Maldives | plane flies in with parallax clouds and a spinning propeller |
| 8.95 | NURF Pharmacy, IGMH | crouches, jumps out, the plane flies on, he falls as IGMH rises, lands in his chair (squash, rebound, the chair rocks), leans back |
| 11.6 | Responsibilities | chair swivels with him, the duties ticker scrolls |
| 15.2 | Connect | everything lifts away, the social-link orbit draws in |

Between moments he is never frozen: he breathes and shifts his weight, and the plane bobs.

## Artwork

All images live in `assets/img/`. The storyboard pages were flat images, so `tools/extract_assets.py` cut them into layers:

- **Stage layers** keep the storyboard's **941×1672 canvas** so they stack exactly: `portrait`, `hospital`, `hospital-blur`, `char-stand`, `char-mask`, `char-clipboard`, `igmh`, `chair`, `sitter`, `desk`.
- **Free layers**: `plane-empty`, `pilot`, `mask-item`, `cloud-1..3`, `nabh-word`, `avatar`. The clipboard he catches is an inline SVG.
- `tools/extract_rig.py` cuts the standing character into a puppet (upper body + two legs with hip joints) for the walk.
- `tools/extract_sprites.py` (second pass) makes the portrait with coat, the mask, the pilot and empty plane, and splits chair / character / laptop. `plane.webp` and `seated.webp` are its inputs and aren't loaded by the page.
- The backgrounds had the character and baked-in text painted out, which is why the building plates are clean.

**Swapping art:** if the illustrator delivers real separate layers (e.g. an empty chair, or a character without the laptop), export them on the same 941×1672 canvas with the same file names and they drop straight in. To re-cut from a new storyboard PDF:

```bash
pip install pymupdf pillow opencv-python-headless "rembg[cpu]" torch simple-lama-inpainting
python tools/extract_assets.py path/to/portfolio.pdf
python tools/extract_sprites.py path/to/portfolio.pdf
python tools/extract_rig.py
```

**For fully hand-animated acting** (a real walk cycle seen from behind, his hand lifting the mask, a full-body jump), ask the illustrator for short frame sequences of those poses. Each beat in `script.js` is commented, so frames can be swapped in there.

## Layout

- **Mobile (≤768px)** follows the storyboard pages exactly: text on top, scene below, full `100svh` stage.
- **Tablet portrait**: same as mobile with more padding.
- **Desktop (≥1200px, or wide landscape)**: text in the left column, scene on the right with a soft blurred fill behind it and a dark gradient for readability. The plane crosses the full width.

## Accessibility & performance

- Only `transform` / `opacity` are animated, except the short blur-to-sharp on text lines.
- `prefers-reduced-motion` turns the film into simple cross-fades: no movement, no smooth scrolling, no looping animations.
- Every scene image is preloaded behind a small "N" loading screen. The whole set is about 0.7 MB of WebP.
- Social icons are real links with labels and at least 54px tap targets. They lift and glow on hover and keyboard focus.
