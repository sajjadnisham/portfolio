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
- **NABH** → nabh.co

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
| 1.75 | Pharmacy (Thalassery Mission Hospital) | walks across the floor to the pharmacy door, reaches for the handle and pushes it open, walks in, and reappears behind the counter window, turning to us |
| 3.7 | COVID | puts the mask on two-handed, as a person really does: holds it by both loops at his waist, lifts it to his face, hooks both loops over his ears, pinches the nose bridge, pulls it under his chin, lowers his hands |
| 5.1 | NABH | a clipboard is tossed in on an arc; he catches it, holds it to his chest and sits down inside with it; "NABH" in the sentence links to nabh.co |
| 7.1 | Maldives | plane flies in; he pilots with one hand and waves with the other |
| 8.95 | NURF Pharmacy | crouches and leaps out of the cockpit (the plane flies on), crashes through the ceiling inside the Oncology Department, seen through its open glass door (a jagged hole, falling debris, dust), lands on his feet in the department, walks out through its door and into the NURF Pharmacy and sits down behind the counter at his laptop |
| 11.6 | Responsibilities | he works at his laptop (typing in natural bursts) and swivels with the chair, right through to the end; the nine duties (including Managed Oncology Pharmacy and Following Up Chemotherapy Medicine) appear one by one and stay until the Connect page |
| 15.2 | Connect | everything lifts away, the social-link orbit draws in |

Between moments he is never frozen: idle, piloting and sitting loops keep running.

## The 3D avatar

`assets/js/hero3d.js` (three.js, vendored in `assets/vendor/three/`) renders Nisham's avatar into the illustrated scenes.

- **Character:** Nisham in an animated-feature (Disney-like) style, modelled in code (`assets/js/disney.js`): a big friendly head with a mop of wavy, curly black hair (spiral locks, one curl falling on the forehead), big glossy eyes with two highlights, a round button nose, thick dark arched brows, rosy cheeks, beard and moustache and a soft smile; a white lab coat with a pen in the pocket, dark trousers and shoes. The earlier looks are kept: `labtoon.js` (TV-cartoon scientist), `minifig.js` (toy brick) and `cartoon.js` (soft cartoon); switch with `STYLE` in `hero3d.js`.
- **Skeleton:** `assets/3d/nisham.glb` (0.46 MB) is the animated skeleton from the Avaturn avatar, stripped of its textures and extra meshes by `tools/make_skeleton.py`.
- **Moves:** Mixamo clips (idle, turn-and-walk, walk, pilot, wave, jump, Landing, Stand To Sit, Type To Sit, Stand Up) (`tools/source/3d/*.fbx`) baked into `assets/3d/moves.json` by `node tools/bake-moves.js` (needs a static server on port 8765 and Playwright).
- **One renderer, three places:** its canvas moves into the hospital scene, the cockpit, or between the office chair and the desk. The painted layers around it still cover him correctly (behind the desk and laptop, legs hidden in the fuselage).
- **Matched perspective:** each painting gets a camera tuned to its horizon and eye height, so he stands on the painted road at the right size wherever he walks.
- **Choreography:** his acting is tweened on the shared `act` timeline (the `S3D` object in `script.js`), so it stays in sync with the props and plays backwards when scrolling up. Scrolling past several scenes at once jumps straight to the latest moment, and scrolling back rewinds quickly, so props from one scene never linger on another page.
- **Face:** natural random blinks (the eyelids roll down), and a smile that curves the mouth and lifts the brows: after landing, on his mark, at the keyboard, and for goodbye. Under the surgical mask the nose, mouth and moustache are hidden so nothing pokes through.
- **Hands:** the mask and the clipboard use an anatomical two-bone IK solver: the elbow is treated as a hinge, and the upper arm twists so the elbow only ever bends the natural way. Each hand follows one smooth spline path (centripetal Catmull-Rom) through waypoints that move with his body, and the elbow direction blends continuously, so the reach flows like a real one (`handsHospital`).
- **He reacts to you:** his head (with a little neck and chest) turns to follow the cursor, or your finger on a phone, as if you were just in front of the screen. Drag sideways, with the mouse or a finger, to spin him around (he glides after your finger, ~70 ms, instead of following each uneven touch event); he keeps the momentum, then turns back to his scene. Vertical swipes still scroll. With a mouse, the painted backgrounds drift slightly against the cursor. All of this stands down while his hands are busy, and is off with reduced motion (`lookAtPointer`, `spinStep` in `hero3d.js`).
- **He's physical:** press on him and pull, and he leans toward your pointer or finger and stretches; let go and he wobbles back like jelly. A quick tap squashes him and he bounces back with a smile. His head lags a little behind sudden moves (landings, turns). The springs run on a fixed 60 Hz step split into 4 substeps, so the motion is identical at any frame rate (`respond`, `physics` in `hero3d.js`). A finger on him holds him instead of scrolling; anywhere else, swipes scroll and sideways drags spin him.
- **Fallback:** without WebGL, or if the 3D files fail to load within 15 s, the illustrated 2D character plays instead.
- **Tuning:** placements are in `hero3d.js` (`MARK`, `P0` (where he lands), `SEAT`, `COCKPIT`, `MASK_FIT`). Timings are in the `S3D` block of `script.js`.
- **Mask:** sized to the cartoon head and, once on, it turns with his head.
- **Smoothness:**
  - When a fast scroll jumps his acting ahead, his pose and position blend into the new moment over ~0.35 s instead of snapping.
  - Blends between moves are eased.
  - The walk loop starts at the phase whose legs match the end of the turn (`WA_PHASE` in `script.js`).
  - A three-stage pose filter (critically damped, ~21 ms per stage) eases every bone toward its target. The pose, its speed and its acceleration all change continuously, so nothing jolts at blends, loop seams or IK changes (`smoothPose`).
  - His walking heading is averaged over ±0.4 m of the path (`headingAt`), so he turns into bends at a continuous rate instead of twitching where the spline passes a control point.
  - The clipboard catch is soft: his reach blends in and out, the board arrives at 60% of its flight speed, and it's carried to his chest with an even ease.
  - **Scroll-driven acting never lurches.** One driver plays the acting toward the moment the scroll asks for (`drive` in `script.js`), and its pace only changes gradually (bounded acceleration, 2.6× per second):
    - natural speed (1×) for the moment you're on;
    - at most 1.6× when you've scrolled on before he finished the previous moment (it used to snap to 3×);
    - up to 2.2× when rewinding, braking smoothly into the target.
    
    In a simulated visitor's scroll pattern, the acting's top speed fell from 6.6× to 1.65×.
  - Every bone is re-posed from the clips each frame before IK, look-at and smoothing are applied (`freshPose`). three.js's mixer skips bones whose animated value didn't change, which let last frame's edits feed back and jitter.
  - `window.__hero3d.step(dt)` advances the pose without the render loop, for frame-by-frame motion analysis.
  - The cartoon draws in about 25 calls instead of ~75: every non-moving rigid part (fingers, shoes, hair, beard, coat details…) is baked into one skinned mesh per material, each vertex fully on its bone. Only the live face pieces (lids, brows, mouth) stay separate. This helps phones hold a steady frame rate.
  - Clip playback never changes speed mid-move: the plane leap eases into one steady pace, the office landing eases into motion, and the clipboard catch is a soft give rather than a twitch (found by measuring jerk frame by frame).
  - The head's follow-through uses filtered body acceleration, so it never jitters.
  - Shaders are compiled at load, so switching scenes doesn't hitch.
  - Animation steps use a lightly smoothed frame time that stays locked to real time, so irregular phone frame timing (e.g. 12 / 21 ms pairs) doesn't make motion stutter.
  - Rendering is capped at 1.5×, and drops once to 1× on devices that can't hold about 45 fps (it never flips back and forth).
  - Phones skip the costly blur-to-sharp text effect.
- **Changing the look:** edit `assets/js/disney.js` (the `COL` colours, the coat profile, the head size `HEAD_K`). To use a rigged 3D model from another tool instead, it needs a Mixamo-style humanoid skeleton.
- **Final round photo:** `tools/make_avatar.py` crops `tools/source/photo.webp` (cyan backdrop kept) into `assets/img/avatar.webp`.

## The pharmacy scene

The hospital scene is the Thalassery Mission Hospital pharmacy photo (`tools/source/pharmacy-photo.jpg`), built by `tools/make_pharmacy.py` into three layers on the 941×1672 canvas:

- `pharmacy.webp`: the photo with the staff removed (LaMa inpainting), the wall extended and fading to dark at the top so the story text stays readable, and a perspective tile floor drawn with the same camera the 3D figure uses (eye 1.57 m, wall 6 m away, calibrated from the 1 m counter). The doorway shows a dim corridor.
- `pharmacy-door.webp`: the door leaf. It swings open in CSS (`rotationY`, hinged on its left edge) as he pushes it.
- `pharmacy-front.webp`: the same wall with the window glass and doorway cut out. `hero3d.js` shows it only while he's inside, so the counter hides his legs and the steel posts pass in front of him.

Once he's at the counter window, the whole scene eases in about 28% (20% on desktop) toward it (`.pzoom` in `index.html`, tweened in `script.js`), and plays back out when scrolling up. A small translucent arrow on the left hints to scroll down until the Connect page.

**Playing inside:** once he's at the window, between scripted moments, visitors can:
- **tap a shelf:** he walks over (accelerating, braking to a stop, turning at a limited rate, feet locked to the floor), turns, reaches up, takes the medicine kept there and turns back to show a card: what it's used for, the usual adult dose and a pharmacist's tip. There are eight medicines (paracetamol, amoxicillin, metformin, amlodipine, omeprazole, cetirizine, salbutamol, EPO); edit `MEDS` in `hero3d.js`. "Put it back" returns it to the shelf.
- **drag him:** he's picked up and hangs from the pointer on a spring, swinging as you move. Let go and he falls under gravity (with a little air drag; the walls bounce him back), squashes on impact and gets up.
- If he was sitting, he stands up first. Scrolling to the next moment hands him back to the story with a short blend.
- **The same play works in the NURF Pharmacy** once he's at his laptop. There the shelves hold eight nephrology and urology medicines (`MEDS_NURF` in `hero3d.js`): tamsulosin, finasteride, solifenacin, potassium citrate, EPO, sevelamer, calcitriol and tacrolimus. After he puts one back (or after he's dropped), he walks back to his place at the counter, sits down and goes back to typing. Each pharmacy is described once in `ZONES` (camera, shelf wall, where he can walk, its medicines).

## The office scene

The NURF Pharmacy scene is a photo of an Oncology Department corridor with the pharmacy counter (`tools/source/oncology-photo.jpg`), built by `tools/make_oncology.py` on the 941×1672 canvas:

- `oncology.webp`: the photo with all the people removed (the customer, the three pharmacists, and the patient and staff member inside the department) (LaMa inpainting), the boards re-lettered in perspective ("ONCOLOGY Department", "NURF PHARMACY"), the ceiling and floor extended, and the top fading to dark for the story text.
- `oncology-front.webp`: the same scene with the doorway and the pharmacy window cut out (monitors, sign and sanitiser kept). `hero3d.js` shows it once he's walked past the doorway, so the wall and the counter pass in front of him.
- **Crash (real physics):** he drops through the ceiling of the department's room behind its open door. Everything is a pure function of the time since the `crash` label, so it scrubs both ways (`crashFx` in `hero3d.js`). The rigid pieces are simulated once at load (240 Hz steps, recorded at 60 Hz).
  - **His fall:** free fall from the leap, the ceiling boards take about 40% of his speed as they break, then free fall again to the floor. `script.js` uses the same numbers for the tween's ease and the `crash` label. He still carries the leap's forward speed (1.5 m/s toward us), so he drifts forward as he falls and skids to a stop as he lands on the department floor (`driftZ`).
  - **Boards and gypsum crumbs:** gravity, air drag and spin. They bounce with restitution and tip over the corner that hits first, slide with Coulomb friction, then settle flat (a piece balanced on its edge topples). They're thrown forward with him, so they land on the department's floor in view through the door, and each casts a soft contact shadow that darkens as it nears the floor.
  - **Torn flaps:** they stay hinged to the hole and swing down as damped, non-linear pendulums.
  - **Dust:** powder pours out of the hole and drifts down at its low terminal speed. A cloud billows under the hole and settles, and puffs kick up where he and the big pieces hit the floor.
  - **Impacts:** the scene shakes briefly at the ceiling and at the floor (not with reduced motion).
- **Walk:** a centripetal Catmull-Rom path from where he lands inside the department (12 m back), out through its doorway, behind the pillar, to the counter (`curveD`). His pace eases in and out with no jolt (the acceleration itself ramps, `paceD`), and the walk cycle is locked to the distance covered so his feet don't slide.

## Artwork

**LEGO buildings:** the Mission Hospital and IGMH backgrounds are toy-brick mosaics made by `tools/make_lego.py` from the original paintings (kept in `tools/source/*-painted.webp`): every 8×8 px block becomes one plastic brick with a bevel and a raised stud, with a little of the painting's line work kept so signs stay readable. Re-run it after changing `TILE` (brick size) or `DETAIL`.

All images live in `assets/img/`. The storyboard pages were flat images, so `tools/extract_assets.py` cut them into layers:

- **Stage layers** keep the storyboard's **941×1672 canvas** so they stack exactly: `portrait`, `hospital`, `char-stand`, `char-mask`, `char-clipboard`, `igmh`, `chair`, `sitter`, `desk`.
- **Free layers**: `plane-empty`, `pilot`, `mask-item`, `cloud-1..3`, `avatar`. The clipboard he catches is an inline SVG.
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
