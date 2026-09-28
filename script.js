/* =========================================================
   Nisham Sajjad — scroll-story
   One pinned viewport + one scroll-scrubbed GSAP timeline.
   Timeline units are "beats"; each beat = 0.75 viewport of scroll.

   Scene map (beat → what happens)
     0.0  S1  Intro                 "I am Nisham Sajjad,"
     0.1  S2  Portrait + experience
     1.7  S3  Mission Hospital      turns away, walks into the hospital, turns back
     3.7  S4  COVID mask            pulls the mask from his pocket onto his face
     5.1  S5  NABH                  catches the files, "(NABH)" letter reveal + shine
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
  const setB = $('.set-b');
  const bgHosp = $('.bg-hosp');
  const bgBlur = $('.bg-blur');
  const word = $('.nabh-word');
  const shine = $('.sign-glow span');
  const stand = $('.ch-stand');
  const masked = $('.ch-mask');
  const clip = $('.ch-clip');
  const maskItem = $('.mask-item');
  const files = $('.files');
  const igmh = $('.bg-igmh');
  const chair = $('.chair');
  const sitter = $('.sitter');
  const portrait = $('.portrait');

  const flight = $('.flight');
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

  gsap.set([bgHosp, bgBlur, stand, masked, clip, igmh, portrait, ambA, ambB, fx, shade], { opacity: 0 });
  gsap.set(word, { clipPath: 'inset(0% 100% 0% 0%)' });
  gsap.set(portrait, { xPercent: 25 * M, scale: 1 + 0.08 * M, transformOrigin: '86% 57%' });   // face centre
  // Walk-back pivot: chosen so that at scale 2.2 his head sits where the
  // portrait's head was, and at scale 1 he stands on his mark.
  gsap.set(stand, { transformOrigin: '69% 54.6%', scaleX: RM ? 1 : 0.09, scaleY: 1 + 1.2 * M });
  if (!RM) gsap.set(stand, { filter: 'brightness(0.06) drop-shadow(0 0 2px rgba(255,255,255,.6))' }); // from behind: rim-lit silhouette
  gsap.set([masked, clip], { transformOrigin: '79% 96%' });   // feet
  gsap.set(maskItem, { opacity: 0, xPercent: 70 * M, yPercent: 390 * M, rotation: 40 * M, scale: 1 - 0.3 * M });
  gsap.set(setA, { transformOrigin: '75% 60%' });
  gsap.set(setB, { opacity: 0 });
  gsap.set([chair, sitter], { transformOrigin: '50% 59%', transformPerspective: 900 });
  gsap.set(sitter, { opacity: 0, '--sf': RM ? '0%' : '9%' });
  gsap.set(pilot, { transformOrigin: '33% 100%' });
  gsap.set(ticker, { opacity: 0, y: 20 * M });
  gsap.set(items, { opacity: 0.25 });
  gsap.set(items[0], { opacity: 1 });
  gsap.set([avatar, ...icons], { opacity: 0, scale: 0 });
  gsap.set([label, foot], { opacity: 0 });

  /* ---------- Helpers ---------- */
  const tl = gsap.timeline({ defaults: { ease: 'power2.out', duration: 0.5 } });

  // fade + slide up + blur-to-sharp, line by line
  function reveal(targets, at, extra = {}) {
    const to = { opacity: 1, y: 0, duration: 0.45, stagger: 0.12, ease: 'power2.out', ...extra };
    if (!RM) to.filter = 'blur(0px)';
    tl.to(targets, to, at);
  }
  const drawRule = (el, at) => tl.to(el, { scaleX: 1, duration: 0.35, ease: 'power2.inOut' }, at);
  const stageAt = (key) => ({ x: () => G[key].x, y: () => G[key].y });

  // Where the falling pilot must be (and how big) to hand over to the seated
  // character: his head lines up with the sitter's head at the crossfade.
  const drop = () => (G.desk ? 20 : 33);   // how far above the chair the sitter appears (% of stage)
  function handover() {
    const pw = pilot.offsetWidth, ph = pilot.offsetHeight;
    const ox = flight.offsetLeft + pilot.offsetLeft + pw * 0.33;       // transform origin
    const oy = flight.offsetTop + pilot.offsetTop + ph;
    const k = (G.w * 95 / 941) / (pw * 0.45);                            // head width ratio
    const headX = G.B.x + G.w * 0.494;
    const headTop = G.B.y + G.h * (0.411 - drop() / 100);                // sitter at its drop height
    return { x: headX - ox, y: headTop - oy + k * ph, k };
  }

  /* ===================== S1 · Intro ===================== */
  tl.fromTo(stage, stageAt('A'), { ...stageAt('A'), duration: 0.001 }, 0);

  /* ============ S2 · Portrait + experience ============== */
  tl.to($('.intro-h'), { y: () => -G.vh * (G.desk ? 0.03 : 0.065) * M, duration: 0.8, ease: 'power2.inOut' }, 0.1);
  tl.to(portrait, { opacity: 1, xPercent: 0, scale: 1, duration: 1, ease: 'power3.out' }, 0.2);
  reveal(lines($('.b', intro)), 0.7);
  drawRule($('.rule', intro), 1.15);

  /* ============ S3 · Turns, walks into the hospital, turns back == */
  tl.to(intro, { opacity: 0, y: -40 * M, duration: 0.4, ease: 'power2.in' }, 1.7);
  if (RM) {
    tl.to(portrait, { opacity: 0, duration: 0.3 }, 1.8);
    tl.to(stand, { opacity: 1, duration: 0.4 }, 2.1);
  } else {
    // 1 · he turns away (portrait squashes edge-on and falls into shadow)
    tl.to(portrait, { scaleX: 0.04, xPercent: -2, filter: 'brightness(0.3)', duration: 0.3, ease: 'power2.in' }, 1.75);
    tl.set(portrait, { opacity: 0 }, 2.05);
    // …and completes the turn: we now see his back, close to camera
    tl.set(stand, { opacity: 1 }, 2.05);
    tl.to(stand, { scaleX: 2.2, duration: 0.2, ease: 'power2.out' }, 2.05);
    // 2 · walks away into the scene: shrinks toward his mark with a step bob + sway
    tl.to(stand, { scaleX: 1, scaleY: 1, duration: 0.85, ease: 'power1.inOut' }, 2.25);
    tl.to(stand, { yPercent: -0.8, duration: 0.07, yoyo: true, repeat: 11, ease: 'sine.out' }, 2.25);
    tl.to(stand, { rotation: 1.2, duration: 0.14, yoyo: true, repeat: 5, ease: 'sine.inOut' }, 2.25);
    // 3 · turns round to face us and steps into the light
    tl.to(stand, { scaleX: 0.05, duration: 0.1, ease: 'power2.in' }, 3.12);
    tl.set(stand, { filter: 'none' }, 3.22);
    tl.to(stand, { scaleX: 1, duration: 0.16, ease: 'back.out(2)' }, 3.22);
    tl.to(stand, { yPercent: 0.35, duration: 0.08, yoyo: true, repeat: 1, ease: 'sine.inOut' }, 3.38);
  }
  tl.fromTo(bgHosp, { scale: 1 + 0.1 * M }, { scale: 1, duration: 1.1 }, 2.1);
  tl.to(bgHosp, { opacity: 1, duration: 0.9 }, 2.1);
  tl.to([fx, ambA, shade], { opacity: 1, duration: 0.8 }, 2.1);
  reveal(lines($('.h', journey)), 3.2);

  /* ============ S4 · Puts the mask on ================== */
  // leans into the pocket, pulls the mask out and up onto his face
  tl.to(stand, { rotation: -1.4 * M, duration: 0.15, ease: 'power1.out' }, 3.7);
  tl.to(maskItem, { opacity: 1, duration: 0.08 }, 3.8);
  tl.to(maskItem, { xPercent: 0, rotation: 0, scale: 1, duration: 0.45, ease: 'power1.inOut' }, 3.85);
  tl.to(maskItem, { yPercent: 0, duration: 0.45, ease: 'back.out(1.3)' }, 3.85);
  tl.to(stand, { rotation: 0, duration: 0.25, ease: 'power1.inOut' }, 4.0);
  // mask pressed on: swap to the masked pose, small nod
  tl.to(masked, { opacity: 1, duration: 0.06 }, 4.28);
  tl.to(maskItem, { opacity: 0, duration: 0.06 }, 4.32);
  tl.set(stand, { opacity: 0 }, 4.34);
  tl.to(masked, { yPercent: 0.3 * M, duration: 0.08, yoyo: true, repeat: 1, ease: 'sine.inOut' }, 4.32);
  reveal(lines($('.covid', journey)), 4.4);
  drawRule($('.rule', journey), 4.85);

  /* ============ S5 · Catches the files · NABH =========== */
  // the file is tossed in from the right on an arc…
  tl.fromTo(files,
    { opacity: RM ? 0 : 1, x: () => (G.vw - G.A.x) - G.w * 0.834 + 20, rotation: -220 * M },
    { opacity: 1, x: 0, rotation: 16, duration: 0.5, ease: 'power1.out' }, 5.15);
  tl.fromTo(files, { y: () => -G.h * 0.12 * M }, { y: 0, duration: 0.5, ease: 'power2.in' }, 5.15);
  // …he catches it: small recoil, then the page-5 pose with the clipboard
  tl.to(masked, { xPercent: 0.7 * M, rotation: 0.8 * M, duration: 0.06, ease: 'power1.out' }, 5.64);
  tl.to(masked, { xPercent: 0, rotation: 0, duration: 0.18, ease: 'power2.out' }, 5.7);
  tl.to(clip, { opacity: 1, duration: 0.14 }, 5.72);
  tl.set([masked, files], { opacity: 0 }, 5.86);
  tl.to(bgBlur, { opacity: 1, duration: 0.6 }, 5.2);
  tl.to(journey, { y: () => (G.desk ? 0 : -G.vh * 0.05), duration: 0.6, ease: 'power2.inOut' }, 5.2);
  // "(NABH)" appears one character at a time (6 glyphs → 6 steps)
  tl.to(word, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.6, ease: 'steps(6)' }, 5.95);
  reveal(lines($('.nabh', journey)), 6.2);
  tl.fromTo(shine, { xPercent: -120 }, { xPercent: 380, duration: 0.7, ease: 'power1.inOut' }, 6.45);

  /* ============ S6 · Flight to the Maldives ============= */
  tl.to(setA, { opacity: 0, scale: 1 + 0.06 * M, duration: 0.6, ease: 'power2.in' }, 7.1);
  tl.to(journey, { opacity: 0, duration: 0.5, ease: 'power2.in' }, 7.1);
  tl.to([fx, ambA, shade], { opacity: 0, duration: 0.5 }, 7.1);

  tl.fromTo(craft,
    { opacity: 0, xPercent: -200 * M, yPercent: 30 * M, rotation: 10 * M },
    { opacity: 1, xPercent: 0, yPercent: 0, rotation: 0, duration: 1, ease: 'power3.out' }, 7.5);
  tl.fromTo(c1, { opacity: 0, xPercent: 200 * M }, { opacity: 1, xPercent: 0, duration: 1.1 }, 7.45);
  tl.fromTo(c2, { opacity: 0, xPercent: 320 * M }, { opacity: 1, xPercent: 0, duration: 1.2 }, 7.5);
  tl.fromTo(c3, { opacity: 0, xPercent: 380 * M }, { opacity: 1, xPercent: 0, duration: 1.3 }, 7.55);
  reveal(lines(mald), 8.1, { ease: 'power3.out' }); // rises from further down (see initial states)
  tl.to(craft, { yPercent: -4 * M, rotation: -2 * M, duration: 0.25, yoyo: true, repeat: 1, ease: 'sine.inOut' }, 8.45);
  tl.to(mald, { opacity: 0, y: -30 * M, duration: 0.35, ease: 'power2.in' }, 8.95);

  /* ============ S7 · Jumps out, falls into the chair at IGMH ==== */
  // anticipation: crouches in the seat
  tl.to(pilot, { yPercent: 10 * M, scaleY: 1 - 0.12 * M, scaleX: 1 + 0.06 * M, duration: 0.12, ease: 'power2.in' }, 8.95);
  // launch: stretches up and out, the plane flies on without him
  tl.to(pilot, {
    yPercent: () => (G.desk ? -55 : -85) * M, scaleY: 1 + 0.12 * M, scaleX: 1 - 0.06 * M, rotation: -12 * M, '--pf': RM ? '100%' : '72%',
    duration: 0.3, ease: 'power2.out',
  }, 9.07);
  tl.to(plane, { xPercent: 180 * M, yPercent: -120 * M, rotation: -14 * M, duration: 0.8, ease: 'power2.in' }, 9.1);
  tl.to(plane, { opacity: 0, duration: 0.2 }, 9.7);
  tl.to([c1, c2, c3], { yPercent: -600 * M, opacity: 0, duration: 0.8, ease: 'power1.in', stagger: 0.04 }, 9.2);
  // apex → gravity: falls, arms flailing, drifting over the chair
  tl.to(pilot, {
    x: () => handover().x * M, y: () => handover().y * M, yPercent: 0,
    scale: () => (RM ? 1 : handover().k), rotation: 10 * M,
    duration: 0.55, ease: 'power2.in',
  }, 9.37);
  tl.to(pilot, { rotation: -6 * M, duration: 0.18, yoyo: true, repeat: 1, ease: 'sine.inOut' }, 9.45);
  // the camera drops with him: IGMH rises into view
  tl.fromTo(stage, { x: () => G.B.x, y: () => G.B.y + G.vh * M }, { ...stageAt('B'), duration: 0.7, ease: 'power2.out', immediateRender: false }, 9.3);
  tl.set(setB, { opacity: 1 }, 9.3);
  tl.to(igmh, { opacity: 1, duration: 0.5 }, 9.3);
  tl.to([ambB, shade], { opacity: 1, duration: 0.8 }, 9.3);
  // hand-over to the seated figure, still falling behind the desk
  tl.fromTo(sitter, { yPercent: () => -drop() * M }, { yPercent: 0, '--sf': '0%', duration: 0.3, ease: 'power2.in', immediateRender: false }, 9.88);
  tl.to(sitter, { opacity: 1, duration: 0.06 }, 9.88);
  tl.to(pilot, { opacity: 0, duration: 0.08 }, 9.9);
  // landing: squash, chair takes the weight and rocks, small rebound, settles back
  tl.to(sitter, { scaleY: 1 - 0.07 * M, scaleX: 1 + 0.035 * M, duration: 0.06, ease: 'power1.out' }, 10.18);
  tl.to(sitter, { scaleY: 1, scaleX: 1, yPercent: -1.6 * M, duration: 0.12, ease: 'power2.out' }, 10.24);
  tl.to(sitter, { yPercent: 0, duration: 0.12, ease: 'power2.in' }, 10.36);
  tl.to(chair, { yPercent: 0.7 * M, rotation: -1.2 * M, duration: 0.06, ease: 'power1.out' }, 10.18);
  tl.to(chair, { yPercent: 0, rotation: 0, duration: 0.5, ease: 'elastic.out(1, 0.35)' }, 10.24);
  tl.to(sitter, { rotation: -1.2 * M, duration: 0.18, ease: 'sine.out' }, 10.48);
  tl.to(sitter, { rotation: 0, duration: 0.3, ease: 'sine.inOut' }, 10.66);
  reveal(lines($('.nurf-h')), 10.6);

  /* ============ S8 · Chair swivel + responsibilities ==== */
  tl.fromTo(stage, stageAt('B'), { ...stageAt('B2'), duration: 0.5, ease: 'power2.inOut', immediateRender: false }, 11.6);
  const nurfUp = () => -G.vh * (G.desk ? 0.04 : 0.15);
  tl.to(nurf, { y: nurfUp, duration: 0.5, ease: 'power2.inOut' }, 11.6);
  tl.to(ticker, { opacity: 1, y: 0, duration: 0.4 }, 11.8);

  const rowH = () => items[0].offsetHeight;
  const T0 = 12.0, STEP = 0.42;
  items.forEach((li, i) => {
    if (!i) return;
    const at = T0 + i * STEP;
    tl.to(tickerList, { y: () => -i * rowH(), duration: 0.28, ease: 'power2.inOut' }, at);
    tl.to(li, { opacity: 1, duration: 0.28 }, at);
    tl.to(items[i - 1], { opacity: 0.25, duration: 0.28 }, at);
  });

  // the swivel chair turns with him
  tl.to([chair, sitter], { rotationY: 14 * M, duration: 0.7, ease: 'sine.inOut' }, 12.0);
  tl.to([chair, sitter], { rotationY: -14 * M, duration: 1.2, ease: 'sine.inOut' }, 12.7);
  tl.to([chair, sitter], { rotationY: 0, duration: 0.8, ease: 'sine.inOut' }, 13.9);

  /* ============ S9 · Connect with me ==================== */
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
  const st = ScrollTrigger.create({
    animation: tl,
    trigger: film,
    start: 'top top',
    end: () => '+=' + Math.round(tl.duration() * G.vh * BEAT),
    pin: true,
    scrub: RM ? true : 1.2,
    anticipatePin: 1,
    invalidateOnRefresh: true,
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
