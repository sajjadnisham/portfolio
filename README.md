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

| Scroll beat | Scene | What he does (3D) |
| --- | --- | --- |
| 0 | Intro | the page opens on "I am Nisham Sajjad," alone (typed in word by word); at the first scroll he drops out of the sky, lands in a deep knee bend, rises and smiles; the 8-years line follows |
| 1.75 | Mission Hospital | turns and walks toward the hospital, turns back and walks onto his mark |
| 3.7 | COVID | reaches into his pocket, lifts the mask to his face while the other hand comes up, hooks both loops over his ears, lowers his hands |
| 5.1 | NABH | a clipboard is tossed in on an arc; he reaches, catches it and holds it to his chest; "(NABH)" appears on the sign letter by letter |
| 7.1 | Maldives | plane flies in; he pilots with one hand and waves with the other |
| 8.95 | NURF Pharmacy, IGMH | crouches, leaps out of the cockpit (the plane flies on), drops in as IGMH rises and lands on his feet, sits back into his chair (it rocks under him), starts typing |
| 11.6 | Responsibilities | he types and swivels with the chair; the seven duties appear one by one and stay until the Connect page |
| 14.8 | Goodbye | waves goodbye with a smile: standing up on desktop, from his chair on phones (the phone layout has no room above his head) |
| 16.0 | Connect | everything lifts away, the social-link orbit draws in |

Between moments he is never frozen: idle, piloting and sitting loops keep running.

## The 3D avatar

`assets/js/hero3d.js` (three.js, vendored in `assets/vendor/three/`) renders Nisham's avatar into the illustrated scenes.

- **Avatar:** `assets/3d/nisham.glb`, made with Avaturn and optimised (WebP textures, quantised mesh, 1.9 MB). The original export is in `tools/source/3d/avatar.glb`.
- **Moves:** Mixamo clips (idle, turn-and-walk, walk, pilot, wave, jump, Landing, Stand To Sit, Type To Sit, Stand Up) (`tools/source/3d/*.fbx`) baked into `assets/3d/moves.json` by `node tools/bake-moves.js` (needs a static server on port 8765 and Playwright).
- **One renderer, three places:** its canvas moves into the hospital scene, the cockpit, or between the office chair and the desk. The painted layers around it still cover him correctly (behind the desk and laptop, legs hidden in the fuselage).
- **Matched perspective:** each painting gets a camera tuned to its horizon and eye height, so he stands on the painted road at the right size wherever he walks.
- **Choreography:** his acting is tweened on the shared `act` timeline (the `S3D` object in `script.js`), so it stays in sync with the props and plays backwards when scrolling up. Scrolling past several scenes at once jumps straight to the latest moment, and scrolling back rewinds quickly, so props from one scene never linger on another page.
- **Face:** the Avaturn export has no facial blendshapes, so `assets/js/face.js` builds two from the head mesh at load: **blink** (natural random blinks) and **smile** (after landing, on his mark, at the keyboard, and for goodbye). The feature positions at the top of `face.js` must be re-measured for a different avatar.
- **Hands:** the mask and the clipboard use an anatomical two-bone IK solver: the elbow is treated as a hinge, and the upper arm twists so the elbow only ever bends the natural way. Each hand follows one smooth spline path (centripetal Catmull-Rom) through waypoints that move with his body, and the elbow direction blends continuously, so the reach flows like a real one (`handsHospital`).
- **He reacts to you:** his head (with a little neck and chest) turns to follow the cursor, or your finger on a phone, as if you were just in front of the screen. Drag sideways, with the mouse or a finger, to spin him around; he keeps the momentum, then turns back to his scene. Vertical swipes still scroll. With a mouse, the painted backgrounds drift slightly against the cursor. All of this stands down while his hands are busy, and is off with reduced motion (`lookAtPointer`, `spinStep` in `hero3d.js`).
- **Fallback:** without WebGL, or if the 3D files fail to load within 15 s, the illustrated 2D character plays instead.
- **Tuning:** placements are in `hero3d.js` (`MARK`, `P0` (where he lands), `SEAT`, `COCKPIT`, `MASK_FIT`). Timings are in the `S3D` block of `script.js`.
- **Outfit:** `tools/make_coat.py` repaints the outfit texture into `assets/3d/coat.webp`: the white shirt is cleaned up and the blue jeans become charcoal trousers.
- **Smoothness:**
  - Blends between moves are eased.
  - The walk loop starts at the phase whose legs match the end of the turn (`WA_PHASE` in `script.js`).
  - A pose filter eases every bone toward its target (about 45 ms), which removes pops at blends, loop seams and IK changes (`smoothPose`).
  - Shaders are compiled at load, so switching scenes doesn't hitch.
  - Rendering is capped at 1.5×, and drops to 1× on devices that can't hold about 45 fps.
  - Phones skip the costly blur-to-sharp text effect.
- **Changing the outfit:** export a new avatar from Avaturn, then run `gltf-transform webp`, `quantize` and `prune` on it, and save it as `assets/3d/nisham.glb`.
- **Final round photo:** `tools/make_avatar.py` crops `tools/source/photo.webp` (cyan backdrop kept) into `assets/img/avatar.webp`.

## Artwork

All images live in `assets/img/`. The storyboard pages were flat images, so `tools/extract_assets.py` cut them into layers:

- **Stage layers** keep the storyboard's **941×1672 canvas** so they stack exactly: `portrait`, `hospital`, `char-stand`, `char-mask`, `char-clipboard`, `igmh`, `chair`, `sitter`, `desk`.
- **"(NABH)"** on the sign is a crisp SVG (`nabh-word.svg`) skewed to the sign's slant.
- **Free layers**: `plane-empty`, `pilot`, `mask-item`, `cloud-1..3`, `avatar`. The clipboard he catches is an inline SVG, and "(NABH)" on the sign is a crisp SVG (`nabh-word.svg`) skewed to the sign's slant.
- `tools/extract_walk.py` cuts the five back-view walk frames (`tools/source/walk-*.jpg`) into `walk-1..5.webp`, aligned to the stage.
- `tools/extract_mask.py` cuts the four mask-on frames (`tools/source/mask-*.jpg`) into `mask-1..4.webp` and tints the light-blue mask white to match the page-5 pose.
- `tools/extract_rig.py` cuts the standing character into a puppet (upper body + two legs with hip joints) for the walk.
- `tools/extract_sprites.py` (second pass) makes the portrait with coat, the mask, the pilot and empty plane, and splits chair / character / laptop. `plane.webp` and `seated.webp` are its inputs and aren't loaded by the page.
- The backgrounds had the character and baked-in text painted out, which is why the building plates are clean.

**Swapping art:** if the illustrator delivers real separate layers (e.g. an empty chair, or a character without the laptop), export them on the same 941×1672 canvas with the same file names and they drop straight in. To re-cut from a new storyboard PDF:

```bash
pip install pymupdf pillow opencv-python-headless "rembg[cpu]" torch simple-lama-inpainting
python tools/extract_assets.py path/to/portfolio.pdf
python tools/extract_sprites.py path/to/portfolio.pdf
python tools/extract_rig.py
python tools/extract_walk.py
cd tools && python extract_mask.py
```

**For fully hand-animated acting** (a real walk cycle seen from behind, his hand lifting the mask, a full-body jump), ask the illustrator for short frame sequences of those poses. Each beat in `script.js` is commented, so frames can be swapped in there.

## Layout

- **Mobile (≤768px)** follows the storyboard pages exactly: text on top, scene below, full `100svh` stage.
- **Tablet portrait**: same as mobile with more padding.
- **Desktop (≥1200px, or wide landscape)**: text in the left column, scene on the right with a soft blurred fill behind it and a dark gradient for readability. The plane crosses the full width.

## Accessibility & performance

- Only `transform` / `opacity` are animated, except the short blur-to-sharp on text lines.
- `prefers-reduced-motion` turns the film into simple cross-fades: no movement, no smooth scrolling, no looping animations.
- Every scene image is preloaded behind a plain loading line. The whole set is about 0.7 MB of WebP.
- Social icons are real links with labels and at least 54px tap targets. They lift and glow on hover and keyboard focus.
