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

## Links in the story

In the NURF scene, four words link out (each opens in a new tab):

- **NURF** → IGMH's National Uro-Renal Fertility Centre page
- **ADL** → MFDA publications
- **CAPD** → National Kidney Foundation: peritoneal dialysis
- **Aasandha** → aasandha.mv

They're in `index.html` (class `xlink`). The story text normally ignores taps so you can grab the character, so these links only become clickable while their scene is on screen (`#film.nurf-live`, set in `script.js`).

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
| 3.7 | COVID | puts the mask on two-handed, as a person really does: holds it by both loops at his waist, lifts it to his face, hooks both loops over his ears, pinches the nose bridge, pulls it under his chin, lowers his hands |
| 5.1 | NABH | a clipboard is tossed in on an arc; he reaches, catches it and holds it to his chest; "(NABH)" appears on the sign letter by letter |
| 7.1 | Maldives | plane flies in; he pilots with one hand and waves with the other |
| 8.95 | NURF Pharmacy, IGMH | crouches, leaps out of the cockpit (the plane flies on), drops in as IGMH rises and lands on his feet, sits back into his chair (it rocks under him), starts typing |
| 11.6 | Responsibilities | he works at his laptop (typing in natural bursts) and swivels with the chair, right through to the end; the seven duties appear one by one and stay until the Connect page |
| 15.2 | Connect | everything lifts away, the social-link orbit draws in |

Between moments he is never frozen: idle, piloting and sitting loops keep running.

## The 3D avatar

`assets/js/hero3d.js` (three.js, vendored in `assets/vendor/three/`) renders Nisham's avatar into the illustrated scenes.

- **Character:** a glossy toy-brick minifigure of Nisham in the classic palette, modelled in code (`assets/js/minifig.js`): bright yellow face, hands, arms and torso; a rounded cylinder head with a printed-style face (dot eyes, thick brows, dark beard and moustache, white grin) and a moulded curly hair piece; a full white clinical coat over the yellow body: white torso and sleeves, collar, lapels, buttons, a breast pocket with a red pen, an ID badge, hip pockets, and a skirt that wraps all the way round to the knees, following his thighs as he walks and sits; navy legs and black feet. Colours are in `COL` at the top of the file. The earlier soft cartoon is still in `assets/js/cartoon.js`; switch with `STYLE` in `hero3d.js`.
- **Skeleton:** `assets/3d/nisham.glb` (0.46 MB) is the animated skeleton from the Avaturn avatar, stripped of its textures and extra meshes by `tools/make_skeleton.py`.
- **Moves:** Mixamo clips (idle, turn-and-walk, walk, pilot, wave, jump, Landing, Stand To Sit, Type To Sit, Stand Up) (`tools/source/3d/*.fbx`) baked into `assets/3d/moves.json` by `node tools/bake-moves.js` (needs a static server on port 8765 and Playwright).
- **One renderer, three places:** its canvas moves into the hospital scene, the cockpit, or between the office chair and the desk. The painted layers around it still cover him correctly (behind the desk and laptop, legs hidden in the fuselage).
- **Matched perspective:** each painting gets a camera tuned to its horizon and eye height, so he stands on the painted road at the right size wherever he walks.
- **Choreography:** his acting is tweened on the shared `act` timeline (the `S3D` object in `script.js`), so it stays in sync with the props and plays backwards when scrolling up. Scrolling past several scenes at once jumps straight to the latest moment, and scrolling back rewinds quickly, so props from one scene never linger on another page.
- **Face:** natural random blinks (the eyelids roll down), and a smile that curves the mouth and lifts the brows: after landing, on his mark, at the keyboard, and for goodbye. Under the surgical mask the nose, mouth and moustache are hidden so nothing pokes through.
- **Hands:** the mask and the clipboard use an anatomical two-bone IK solver: the elbow is treated as a hinge, and the upper arm twists so the elbow only ever bends the natural way. Each hand follows one smooth spline path (centripetal Catmull-Rom) through waypoints that move with his body, and the elbow direction blends continuously, so the reach flows like a real one (`handsHospital`).
- **He reacts to you:** his head (with a little neck and chest) turns to follow the cursor, or your finger on a phone, as if you were just in front of the screen. Drag sideways, with the mouse or a finger, to spin him around; he keeps the momentum, then turns back to his scene. Vertical swipes still scroll. With a mouse, the painted backgrounds drift slightly against the cursor. All of this stands down while his hands are busy, and is off with reduced motion (`lookAtPointer`, `spinStep` in `hero3d.js`).
- **He's physical:** press on him and pull, and he leans toward your pointer or finger and stretches; let go and he wobbles back like jelly. A quick tap squashes him and he bounces back with a smile. His head lags a little behind sudden moves (landings, turns). The springs run on a fixed 60 Hz step split into 4 substeps, so the motion is identical at any frame rate (`respond`, `physics` in `hero3d.js`). A finger on him holds him instead of scrolling; anywhere else, swipes scroll and sideways drags spin him.
- **Fallback:** without WebGL, or if the 3D files fail to load within 15 s, the illustrated 2D character plays instead.
- **Tuning:** placements are in `hero3d.js` (`MARK`, `P0` (where he lands), `SEAT`, `COCKPIT`, `MASK_FIT`). Timings are in the `S3D` block of `script.js`.
- **Mask:** sized to the cartoon head and, once on, it turns with his head.
- **Smoothness:**
  - When a fast scroll jumps his acting ahead, his pose and position blend into the new moment over ~0.35 s instead of snapping.
  - Blends between moves are eased.
  - The walk loop starts at the phase whose legs match the end of the turn (`WA_PHASE` in `script.js`).
  - A two-stage pose filter (critically damped, ~30 ms per stage) eases every bone toward its target, so both the pose and its speed change smoothly; this removes pops at blends, loop seams and IK changes (`smoothPose`).
  - Each scene's acting eases in from standstill, and rewinds ease in and out.
  - Every bone is re-posed from the clips each frame before IK, look-at and smoothing are applied (`freshPose`). three.js's mixer skips bones whose animated value didn't change, which let last frame's edits feed back and jitter.
  - `window.__hero3d.step(dt)` advances the pose without the render loop, for frame-by-frame motion analysis.
  - The cartoon draws in about 25 calls instead of ~75: every non-moving rigid part (fingers, shoes, hair, beard, coat details…) is baked into one skinned mesh per material, each vertex fully on its bone. Only the live face pieces (lids, brows, mouth) stay separate. This helps phones hold a steady frame rate.
  - Clip playback never changes speed mid-move: the plane leap eases into one steady pace, the office landing eases into motion, and the clipboard catch is a soft give rather than a twitch (found by measuring jerk frame by frame).
  - The head's follow-through uses filtered body acceleration, so it never jitters.
  - Shaders are compiled at load, so switching scenes doesn't hitch.
  - Animation steps use a lightly smoothed frame time that stays locked to real time, so irregular phone frame timing (e.g. 12 / 21 ms pairs) doesn't make motion stutter.
  - Rendering is capped at 1.5×, and drops once to 1× on devices that can't hold about 45 fps (it never flips back and forth).
  - Phones skip the costly blur-to-sharp text effect.
- **Changing the look:** edit `assets/js/cartoon.js` (the `COL` colours, the coat profile, the head size `HEAD_K`). To use a rigged 3D model from another tool instead, it needs a Mixamo-style humanoid skeleton.
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
- **Short landscape screens** (≤560px tall): a smaller Connect orbit and tighter spacing so everything fits.
- **Desktop (≥1200px, or any landscape screen ≥560px wide, including phones turned sideways)**: text in the left column, scene on the right with a soft blurred fill behind it and a dark gradient for readability. The plane crosses the full width.

## Accessibility & performance

- Only `transform` / `opacity` are animated, except the short blur-to-sharp on text lines.
- `prefers-reduced-motion` turns the film into simple cross-fades: no movement, no smooth scrolling, no looping animations.
- Every scene image is preloaded behind a plain loading line. The whole set is about 0.7 MB of WebP.
- Social icons are real links with labels and at least 54px tap targets. They lift and glow on hover and keyboard focus.
