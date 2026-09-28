/* =========================================================
   Nisham Sajjad — scroll-story

   Two timelines:
   1. `tl`  (scroll-scrubbed) — scenes, backgrounds, camera framing, text.
            Units are "beats"; each beat = 0.75 viewport of scroll.
   2. `act` (time-based)      — the character's acting: walking, putting the
            mask on, catching the file, jumping out of the plane. When the
            scroll reaches a scene, `act` plays to that scene's label at
            natural speed (and back again when scrolling up), so his
            movement flows freely instead of stuttering with the finger.

   Scene map (scroll beat → what happens)
     0.0  S1  Intro                 "I am Nisham Sajjad,"
     0.1  S2  Portrait + experience
     1.75 S3  Mission Hospital      turns away, walks into the hospital, turns back
     3.7  S4  COVID mask            pulls the mask from his pocket onto his face
     5.1  S5  NABH                  catches the file, "(NABH)" reveal + shine
     7.1  S6  Flight to Maldives
     8.95 S7  NURF Pharmacy, IGMH   jumps out of the plane, falls into his chair
    11.6  S8  Responsibilities      chair swivel + ticker
    15.2  S9  Connect with me
   ========================================================= */
(() => {
  'use strict';

  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });

  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // keep in sync with the desktop media query in styles.css
  const DESKTOP_Q = matchMedia('(min-width: 1200px), (min-width: 900px) and (min-aspect-ratio: 13/10)');
  const RATIO = 941 / 1672;        // storyboard canvas
  const M = RM ? 0 : 1;            // motion multiplier: reduced motion → fades only
  const BEAT = 0.75;               // viewport heights of scroll per timeline unit

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const film = $('#film');
  const stage = $('.stage');

  /* ---------------------------------------------------------
     Stage geometry. The stage holds 941×1672 layers; we size
     and place it per layout:
       A  = Mission Hospital framing
       B  = IGMH desk framing
       B2 = IGMH with room for the responsibilities ticker
     --------------------------------------------------------- */
  const G = {};
  function measure() {
    const vw = film.clientWidth;
    const vh = film.clientHeight;
    const desk = DESKTOP_Q.matches;
    let h, w;
    if (desk) {
      h = vh * 1.5;
      w = h * RATIO;
      if (w > vw * 0.62) { w = vw * 0.62; h = w / RATIO; }
      const gap = Math.max(0, (vw * 0.6 - w) * 0.5);
      G.A = { x: vw - w - gap, y: vh * 0.95 - h * 0.957 };
      G.B = { x: vw * 0.68 - w * 0.47, y: vh * 0.56 - h * 0.51 };
      G.B2 = G.B;
    } else {
      h = vh;
      w = h * RATIO;
      if (w < vw) { w = vw; h = w / RATIO; }
      G.A = { x: Math.min(0, vw - w), y: vh - h };
      G.B = { x: (vw - w) / 2, y: vh - h };
      G.B2 = { x: G.B.x, y: G.B.y - vh * 0.15 };
    }
    Object.assign(G, { vw, vh, w, h, desk });
    stage.style.width = w + 'px';
    stage.style.height = h + 'px';
  }
  measure();
  ScrollTrigger.addEventListener('refreshInit', measure);

  /* ---------- Elements ---------- */
  const intro = $('.c-intro');
  const journey = $('.c-journey');
  const mald = $('.c-maldives');
  const nurf = $('.c-nurf');
  const ticker = $('.ticker');
  const tickerList = $('.ticker ul');
  const items = $$('.ticker li');

  const setA = $('.set-a');
  const bgHosp = $('.bg-hosp');
  const bgBlur = $('.bg-blur');
  const word = $('.nabh-word');
  const shine = $('.sign-glow span');

  const hero = $('.hero');              // acting: walk scale / bob / sway / turn
  const poseStand = $('.pose-stand');
  const legL = $('.leg-l');
  const legR = $('.leg-r');
  const upper = $('.hero-upper');
  const masked = $('.ch-mask');
  const clip = $('.ch-clip');
  const maskItem = $('.mask-item');
  const files = $('.files');

  const cam = $('.cam');
  const chair = $('.chair');
  const sitterRig = $('.sitter-rig');
  const sitter = $('.sitter');
  const portraitWrap = $('.portrait-wrap');
  const portrait = $('.portrait');

  const flight = $('.flight');
  const cloudset = $('.cloudset');
  const craft = $('.craft');
  const plane = $('.plane');
  const pilot = $('.pilot');
  const [c1, c2, c3] = $$('.cloud');

  const fx = $('.fx');
  const shade = $('.shade');
  const ambA = $('.amb-a');
  const ambB = $('.amb-b');

  const avatar = $('.avatar');
  const ringDraw = $('.ring-draw');
  const icons = $$('.ico');
  const label = $('.connect-label');
  const foot = $('.foot');

  const lines = (el) => $$('.ln', el);

  /* ---------- Initial states ---------- */
  const hidden = { opacity: 0, y: 30 * M };
  if (!RM) hidden.filter = 'blur(6px)';
  gsap.set($$('.copy .ln'), hidden);
  gsap.set($$('.intro-h .w'), hidden);
  gsap.set(lines(mald), { y: 60 * M });
  gsap.set($$('.rule'), { scaleX: 0 });

  gsap.set([bgHosp, bgBlur, portraitWrap, ambA, ambB, fx, shade], { opacity: 0 });
  gsap.set(word, { clipPath: 'inset(0% 100% 0% 0%)' });
  gsap.set(portraitWrap, { xPercent: 25 * M, scale: 1 + 0.08 * M, transformOrigin: '86% 57%' });
  gsap.set(portrait, { transformOrigin: '86% 57%' });                       // face centre
  // Walk-back pivot: at scale 2.2 his head sits where the portrait's head
  // was; at scale 1 he stands on his mark.
  gsap.set(hero, { opacity: 0, transformOrigin: '69% 54.6%', scaleX: RM ? 1 : 0.09, scaleY: 1 + 1.2 * M });
  if (!RM) gsap.set(hero, { filter: 'brightness(0.06) drop-shadow(0 0 2px rgba(255,255,255,.6))' });
  gsap.set(legL, { transformOrigin: '70.67% 77.15%' });                     // hips (665,1290)
  gsap.set(legR, { transformOrigin: '79.17% 77.15%' });                     //      (745,1290)
  gsap.set(upper, { transformOrigin: '75% 78%' });                          // waist
  gsap.set([masked, clip], { opacity: 0 });
  gsap.set(maskItem, { opacity: 0, xPercent: 70 * M, yPercent: 390 * M, rotation: 40 * M, scale: 1 - 0.3 * M });
  gsap.set(files, { opacity: 0 });
  gsap.set(setA, { transformOrigin: '75% 60%' });
  gsap.set(cam, { yPercent: 100 });                                        // IGMH waits below
  gsap.set([chair, sitterRig], { transformOrigin: '50% 59%', transformPerspective: 900 });
  gsap.set(sitterRig, { opacity: 0 });
  gsap.set(sitter, { '--sf': RM ? '0%' : '9%' });
  gsap.set(pilot, { transformOrigin: '33% 100%' });
  gsap.set(ticker, { opacity: 0, y: 20 * M });
  gsap.set(items, { opacity: 0.25 });
  gsap.set(items[0], { opacity: 1 });
  gsap.set([avatar, ...icons], { opacity: 0, scale: 0 });
  gsap.set([label, foot], { opacity: 0 });

  /* =========================================================
     ACTING — the character's own, time-based performance
     ========================================================= */
  const act = gsap.timeline({ paused: true, defaults: { ease: 'power2.out' } });

  // falling pilot → seated character hand-over: line their heads up
  const drop = () => (G.desk ? 20 : 33);   // sitter appears this far above the chair (% of stage)
  function handover() {
    const pw = pilot.offsetWidth, ph = pilot.offsetHeight;
    const ox = flight.offsetLeft + pilot.offsetLeft + pw * 0.33;   // pilot transform origin
    const oy = flight.offsetTop + pilot.offsetTop + ph;
    const k = (G.w * 95 / 941) / (pw * 0.45);                        // head-size ratio
    const headX = G.B.x + G.w * 0.494;
    const headTop = G.B.y + G.h * (0.411 - drop() / 100);
    return { x: headX - ox, y: headTop - oy + k * ph, k };
  }

  act.addLabel('start', 0);

  /* --- S3 · turns away, walks into the hospital, turns back --- */
  if (RM) {
    act.to(portrait, { opacity: 0, duration: 0.3 }, 0);
    act.to(hero, { opacity: 1, duration: 0.3 }, 0.3);
  } else {
    // turns his back to us: the close-up squashes edge-on and falls into shadow
    act.to(portrait, { scaleX: 0.04, xPercent: -2, filter: 'brightness(0.3)', duration: 0.35, ease: 'power2.in' }, 0);
    act.set(portrait, { opacity: 0 }, 0.35);
    act.set(hero, { opacity: 1 }, 0.35);
    act.to(hero, { scaleX: 2.2, duration: 0.25, ease: 'power2.out' }, 0.35);

    // walks away: perspective shrink (fast near camera, slower far away)
    const W0 = 0.6, STEP = 0.46, STEPS = 4;
    act.to(hero, { scaleX: 1, scaleY: 1, duration: STEP * STEPS, ease: 'power1.out' }, W0);
    for (let i = 0; i < STEPS; i++) {
      const t = W0 + i * STEP;
      const lead = i % 2 ? legR : legL;       // leg swinging forward
      const back = i % 2 ? legL : legR;
      const s = i % 2 ? -1 : 1;
      act.to(lead, { rotation: 9 * s, duration: STEP, ease: 'sine.inOut' }, t);
      act.to(back, { rotation: -7 * s, duration: STEP, ease: 'sine.inOut' }, t);
      // the swinging leg lifts and bends a little mid-stride
      act.to(lead, { yPercent: -0.9, scaleY: 0.965, duration: STEP / 2, yoyo: true, repeat: 1, ease: 'sine.out' }, t);
      // body rises over the planted leg, dips at each footfall; weight shifts side to side
      act.to(hero, { yPercent: -0.8, duration: STEP / 2, yoyo: true, repeat: 1, ease: 'sine.inOut' }, t);
      act.to(hero, { rotation: 1.1 * s, duration: STEP, ease: 'sine.inOut' }, t);
      act.to(upper, { rotation: -0.9 * s, duration: STEP, ease: 'sine.inOut' }, t);   // shoulders counter-swing
    }
    const stop = W0 + STEP * STEPS;
    act.to([legL, legR, hero, upper], { rotation: 0, duration: 0.3, ease: 'sine.out' }, stop);

    // turns round to face us and steps into the light
    act.to(hero, { scaleX: 0.05, duration: 0.14, ease: 'power2.in' }, stop + 0.25);
    act.set(hero, { filter: 'none' }, stop + 0.39);
    act.to(hero, { scaleX: 1, duration: 0.24, ease: 'back.out(1.8)' }, stop + 0.39);
    act.to(hero, { yPercent: 0.4, duration: 0.12, yoyo: true, repeat: 1, ease: 'sine.inOut' }, stop + 0.6);
    act.to(legL, { rotation: -3, duration: 0.2, yoyo: true, repeat: 1, ease: 'sine.inOut' }, stop + 0.62); // shifts his stance
  }
  act.addLabel('hosp', '+=0.15');

  /* --- S4 · takes the mask out of his pocket and puts it on --- */
  act.to(upper, { rotation: 2.2 * M, duration: 0.3, ease: 'power2.out' }, 'hosp');          // leans to the pocket
  act.to(maskItem, { opacity: 1, duration: 0.1 }, 'hosp+=0.18');
  act.to(maskItem, { xPercent: 0, rotation: 0, scale: 1, duration: 0.6, ease: 'power1.inOut' }, 'hosp+=0.25');
  act.to(maskItem, { yPercent: 0, duration: 0.6, ease: 'back.out(1.2)' }, 'hosp+=0.25');
  act.to(upper, { rotation: -1.2 * M, duration: 0.35, ease: 'sine.inOut' }, 'hosp+=0.35');    // straightens, chin up
  act.to(masked, { opacity: 1, duration: 0.1 }, 'hosp+=0.84');
  act.to(maskItem, { opacity: 0, duration: 0.1 }, 'hosp+=0.9');
  act.set(poseStand, { opacity: 0 }, 'hosp+=0.95');
  act.to(upper, { rotation: 0, duration: 0.2 }, 'hosp+=0.95');
  act.to(hero, { yPercent: 0.35 * M, duration: 0.13, yoyo: true, repeat: 1, ease: 'sine.inOut' }, 'hosp+=0.9'); // nod
  act.addLabel('mask', 'hosp+=1.35');

  /* --- S5 · a file is tossed in; he catches it --- */
  act.set(files, { opacity: 1 }, 'mask');
  act.fromTo(files,
    { x: () => (G.vw - G.A.x) - G.w * 0.834 + 20, rotation: -240 * M },
    { x: 0, rotation: 16, duration: 0.75, ease: 'none' }, 'mask');
  // thrown up, then gravity brings it down into his hand
  act.fromTo(files, { y: () => -G.h * 0.05 * M }, { y: () => -G.h * 0.14 * M, duration: 0.3, ease: 'power2.out' }, 'mask');
  act.to(files, { y: 0, duration: 0.45, ease: 'power2.in' }, 'mask+=0.3');
  act.to(hero, { xPercent: 0.7 * M, rotation: 0.8 * M, duration: 0.08, ease: 'power1.out' }, 'mask+=0.73'); // catch recoil
  act.to(hero, { xPercent: 0, rotation: 0, duration: 0.3, ease: 'power2.out' }, 'mask+=0.81');
  act.to(clip, { opacity: 1, duration: 0.15 }, 'mask+=0.74');
  act.set([masked, files], { opacity: 0 }, 'mask+=0.9');
  act.addLabel('files', 'mask+=1.2');

  /* --- S7 · jumps out of the plane and falls into his chair --- */
  const J = 'files';
  // anticipation: crouches into the seat
  act.to(pilot, { yPercent: 10 * M, scaleY: 1 - 0.12 * M, scaleX: 1 + 0.06 * M, duration: 0.22, ease: 'power2.in' }, J);
  // take-off: stretches up and out; the plane flies on without him
  act.to(pilot, {
    yPercent: () => (G.desk ? -55 : -85) * M, scaleY: 1 + 0.1 * M, scaleX: 1 - 0.05 * M, rotation: -12 * M,
    '--pf': RM ? '100%' : '72%', duration: 0.38, ease: 'power2.out',
  }, `${J}+=0.22`);
  act.to(plane, { xPercent: 180 * M, yPercent: -120 * M, rotation: -14 * M, duration: 1.0, ease: 'power2.in' }, `${J}+=0.25`);
  act.to(plane, { opacity: 0, duration: 0.2 }, `${J}+=1.1`);
  // the camera follows him down: clouds rush up, IGMH rises into view
  act.to(cloudset, { yPercent: -260 * M, opacity: 0, duration: 0.9, ease: 'power1.in' }, `${J}+=0.4`);
  act.to(cam, { yPercent: 0, duration: 1.0, ease: 'power2.out' }, `${J}+=0.45`);
  // apex, then gravity: accelerates down, tipping forward as he drops toward the chair
  act.to(pilot, {
    x: () => handover().x * M, y: () => handover().y * M, yPercent: 0,
    scale: () => (RM ? 1 : handover().k), rotation: 14 * M,
    duration: 0.75, ease: 'power2.in',
  }, `${J}+=0.62`);
  act.to(pilot, { rotation: 4 * M, duration: 0.2, yoyo: true, repeat: 1, ease: 'sine.inOut' }, `${J}+=0.8`); // arms flail
  // hand-over to the seated figure, still falling behind the desk
  act.to(sitterRig, { opacity: 1, duration: 0.08 }, `${J}+=1.3`);
  act.to(pilot, { opacity: 0, duration: 0.1 }, `${J}+=1.34`);
  act.fromTo(sitterRig, { yPercent: () => -drop() * M }, { yPercent: 0, duration: 0.36, ease: 'power2.in' }, `${J}+=1.3`);
  act.to(sitter, { '--sf': '0%', duration: 0.36, ease: 'power2.in' }, `${J}+=1.3`);
  // landing: squash, the chair takes his weight and rocks, rebound, settle back
  const L = 1.66;
  act.to(sitterRig, { scaleY: 1 - 0.07 * M, scaleX: 1 + 0.035 * M, duration: 0.07, ease: 'power1.out' }, `${J}+=${L}`);
  act.to(sitterRig, { scaleY: 1, scaleX: 1, yPercent: -1.6 * M, duration: 0.15, ease: 'power2.out' }, `${J}+=${L + 0.07}`);
  act.to(sitterRig, { yPercent: 0, duration: 0.15, ease: 'power2.in' }, `${J}+=${L + 0.22}`);
  act.to(chair, { yPercent: 0.7 * M, rotation: -1.2 * M, duration: 0.07, ease: 'power1.out' }, `${J}+=${L}`);
  act.to(chair, { yPercent: 0, rotation: 0, duration: 0.9, ease: 'elastic.out(1, 0.35)' }, `${J}+=${L + 0.07}`);
  act.to(sitterRig, { rotation: -1.4 * M, duration: 0.3, ease: 'sine.out' }, `${J}+=${L + 0.4}`);        // leans back
  act.to(sitterRig, { rotation: 0, duration: 0.5, ease: 'sine.inOut' }, `${J}+=${L + 0.7}`);
  act.addLabel('desk', `${J}+=${L + 1.25}`);

  // scroll beat at which each acting label is reached
  const CUES = [[1.75, 'hosp'], [3.7, 'mask'], [5.1, 'files'], [8.95, 'desk']];
  let cue = 'start';
  let playing = null;
  function direct(t) {
    let want = 'start';
    for (const [at, name] of CUES) if (t >= at) want = name;
    if (want === cue) return;
    cue = want;
    const to = act.labels[want];
    if (RM) { act.seek(to); return; }
    const dist = Math.abs(to - act.time());
    const back = to < act.time();
    if (playing) playing.kill();
    // natural speed; faster when rewinding or skipping several scenes
    const dur = Math.min(dist, 3.2) / (back ? 1.8 : 1);
    playing = act.tweenTo(to, { duration: dur, ease: 'none' });
  }

  /* =========================================================
     SCROLL — scenes, framing and copy
     ========================================================= */
  const tl = gsap.timeline({ defaults: { ease: 'power2.out', duration: 0.5 } });

  // fade + slide up + blur-to-sharp, line by line
  function reveal(targets, at, extra = {}) {
    const to = { opacity: 1, y: 0, duration: 0.45, stagger: 0.12, ease: 'power2.out', ...extra };
    if (!RM) to.filter = 'blur(0px)';
    tl.to(targets, to, at);
  }
  const drawRule = (el, at) => tl.to(el, { scaleX: 1, duration: 0.35, ease: 'power2.inOut' }, at);
  const stageAt = (key) => ({ x: () => G[key].x, y: () => G[key].y });

  /* S1 · Intro */
  tl.fromTo(stage, stageAt('A'), { ...stageAt('A'), duration: 0.001 }, 0);

  /* S2 · Portrait + experience */
  tl.to($('.intro-h'), { y: () => -G.vh * (G.desk ? 0.03 : 0.065) * M, duration: 0.8, ease: 'power2.inOut' }, 0.1);
  tl.to(portraitWrap, { opacity: 1, xPercent: 0, scale: 1, duration: 1, ease: 'power3.out' }, 0.2);
  reveal(lines($('.b', intro)), 0.7);
  drawRule($('.rule', intro), 1.15);

  /* S3 · Mission Hospital */
  tl.to(intro, { opacity: 0, y: -40 * M, duration: 0.4, ease: 'power2.in' }, 1.7);
  tl.fromTo(bgHosp, { scale: 1 + 0.1 * M }, { scale: 1, duration: 1.1 }, 1.9);
  tl.to(bgHosp, { opacity: 1, duration: 0.9 }, 1.9);
  tl.to([fx, ambA, shade], { opacity: 1, duration: 0.8 }, 1.9);
  reveal(lines($('.h', journey)), 3.0);

  /* S4 · COVID */
  reveal(lines($('.covid', journey)), 4.2);
  drawRule($('.rule', journey), 4.65);

  /* S5 · NABH */
  tl.to(bgBlur, { opacity: 1, duration: 0.6 }, 5.2);
  tl.to(journey, { y: () => (G.desk ? 0 : -G.vh * 0.05), duration: 0.6, ease: 'power2.inOut' }, 5.2);
  // "(NABH)" appears one character at a time (6 glyphs → 6 steps)
  tl.to(word, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.6, ease: 'steps(6)' }, 5.95);
  reveal(lines($('.nabh', journey)), 6.2);
  tl.fromTo(shine, { xPercent: -120 }, { xPercent: 380, duration: 0.7, ease: 'power1.inOut' }, 6.45);

  /* S6 · Flight to the Maldives */
  tl.to(setA, { opacity: 0, scale: 1 + 0.06 * M, duration: 0.6, ease: 'power2.in' }, 7.1);
  tl.to(journey, { opacity: 0, duration: 0.5, ease: 'power2.in' }, 7.1);
  tl.to([fx, ambA, shade], { opacity: 0, duration: 0.5 }, 7.1);
  tl.fromTo(stage, stageAt('A'), { ...stageAt('B'), duration: 0.1, immediateRender: false }, 7.7);
  tl.fromTo(craft,
    { opacity: 0, xPercent: -200 * M, yPercent: 30 * M, rotation: 10 * M },
    { opacity: 1, xPercent: 0, yPercent: 0, rotation: 0, duration: 1, ease: 'power3.out' }, 7.5);
  tl.fromTo(c1, { opacity: 0, xPercent: 200 * M }, { opacity: 1, xPercent: 0, duration: 1.1 }, 7.45);
  tl.fromTo(c2, { opacity: 0, xPercent: 320 * M }, { opacity: 1, xPercent: 0, duration: 1.2 }, 7.5);
  tl.fromTo(c3, { opacity: 0, xPercent: 380 * M }, { opacity: 1, xPercent: 0, duration: 1.3 }, 7.55);
  reveal(lines(mald), 7.95, { ease: 'power3.out' }); // rises from further down (see initial states)
  tl.to(mald, { opacity: 0, y: -30 * M, duration: 0.3, ease: 'power2.in' }, 8.6);

  /* S7 · NURF Pharmacy, IGMH (the jump itself is acting) */
  tl.to([ambB, shade], { opacity: 1, duration: 0.8 }, 9.1);
  reveal(lines($('.nurf-h')), 10.4);

  /* S8 · Chair swivel + responsibilities */
  tl.fromTo(stage, stageAt('B'), { ...stageAt('B2'), duration: 0.5, ease: 'power2.inOut', immediateRender: false }, 11.6);
  const nurfUp = () => -G.vh * (G.desk ? 0.04 : 0.15);
  tl.to(nurf, { y: nurfUp, duration: 0.5, ease: 'power2.inOut' }, 11.6);
  tl.to(ticker, { opacity: 1, y: 0, duration: 0.4 }, 11.8);

  const rowH = () => items[0].offsetHeight;
  const T0 = 12.0, TSTEP = 0.42;
  items.forEach((li, i) => {
    if (!i) return;
    const at = T0 + i * TSTEP;
    tl.to(tickerList, { y: () => -i * rowH(), duration: 0.28, ease: 'power2.inOut' }, at);
    tl.to(li, { opacity: 1, duration: 0.28 }, at);
    tl.to(items[i - 1], { opacity: 0.25, duration: 0.28 }, at);
  });

  // the swivel chair turns with him
  tl.to([chair, sitterRig], { rotationY: 14 * M, duration: 0.7, ease: 'sine.inOut' }, 12.0);
  tl.to([chair, sitterRig], { rotationY: -14 * M, duration: 1.2, ease: 'sine.inOut' }, 12.7);
  tl.to([chair, sitterRig], { rotationY: 0, duration: 0.8, ease: 'sine.inOut' }, 13.9);

  /* S9 · Connect with me */
  tl.fromTo(stage, stageAt('B2'), {
    x: () => G.B2.x, y: () => G.B2.y - G.vh * 1.15 * M,
    duration: 0.8, ease: 'power2.in', immediateRender: false,
  }, 15.2);
  tl.to(stage, { opacity: 0, duration: 0.4 }, 15.6);
  tl.to(nurf, { y: () => nurfUp() - G.vh * 1.1 * M, opacity: 0, duration: 0.8, ease: 'power2.in' }, 15.2);
  tl.to([ambB, shade], { opacity: 0, duration: 0.6 }, 15.2);

  tl.to(avatar, { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(1.6)' }, 15.8);
  tl.fromTo(ringDraw, { strokeDashoffset: 100 }, { strokeDashoffset: 0, duration: 0.7, ease: 'power1.inOut' }, 16.1);
  tl.to(icons, { opacity: 1, scale: 1, duration: 0.35, ease: 'back.out(3)', stagger: 0.12 }, 16.5);
  tl.to(label, { opacity: 1, duration: 0.4 }, 17.0);
  tl.to(foot, { opacity: 1, duration: 0.4 }, 17.1);
  tl.to({}, { duration: 0.4 }, 17.2); // hold on the last frame

  /* ---------- Scroll wiring ---------- */
  ScrollTrigger.create({
    animation: tl,
    trigger: film,
    start: 'top top',
    end: () => '+=' + Math.round(tl.duration() * G.vh * BEAT),
    pin: true,
    scrub: RM ? true : 1.2,
    anticipatePin: 1,
    invalidateOnRefresh: true,
    // cue the acting from where the scroll is heading, not the lagging scrub
    onUpdate: (self) => direct(self.progress * tl.duration()),
  });

  // re-measure the acting's position-based moves after a resize
  ScrollTrigger.addEventListener('refresh', () => {
    const t = act.time();
    act.seek(0).invalidate().seek(t);
  });

  let lenis = null;
  if (!RM && window.Lenis) {
    lenis = new Lenis({ lerp: 0.075, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  const scrollToY = (y) => (lenis ? lenis.scrollTo(y, { duration: 1.6 }) : window.scrollTo({ top: y, behavior: RM ? 'auto' : 'smooth' }));

  $('.logo').addEventListener('click', (e) => { e.preventDefault(); scrollToY(0); });

  /* ---------- Preloader ---------- */
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);
  if (lenis) lenis.stop();

  const loader = $('#loader');
  const bar = $('.loader-bar span');
  const imgs = $$('img').filter((i) => !loader.contains(i));
  let done = 0;
  const total = imgs.length + 1; // + fonts
  const tick = () => { done++; bar.style.transform = `scaleX(${done / total})`; if (done >= total) start(); };
  imgs.forEach((img) => {
    if (img.complete && img.naturalWidth) tick();
    else {
      img.addEventListener('load', tick, { once: true });
      img.addEventListener('error', tick, { once: true });
    }
  });
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(tick);

  let started = false;
  function start() {
    if (started) return;
    started = true;
    ScrollTrigger.refresh();
    setTimeout(() => {
      loader.classList.add('done');
      if (lenis) lenis.start();
      // S1: the name types in word by word
      const to = { opacity: 1, y: 0, duration: 0.6, stagger: 0.18, ease: 'power2.out', delay: 0.3 };
      if (!RM) to.filter = 'blur(0px)';
      gsap.to($$('.intro-h .w'), to);
    }, 250);
  }
  // never trap the visitor behind the loader
  setTimeout(start, 8000);
})();
