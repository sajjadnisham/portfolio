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
     5.1  S5  NABH                  catches the file, "(NABH)" reveal
     7.1  S6  Flight to Maldives
     8.95 S7  NURF Pharmacy, IGMH   jumps out of the plane, falls into his chair
    11.6  S8  Responsibilities      chair swivel; the duties appear and stay
    16.0  S9  Connect with me
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
  // blur-to-sharp text is costly to repaint on phones; keep it for larger screens
  const BLUR = !RM && matchMedia('(min-width: 769px)').matches;
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
       B2 = IGMH with room for the responsibilities list
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
  const items = $$('.ticker li');

  const setA = $('.set-a');
  const bgHosp = $('.bg-hosp');
  const word = $('.nabh-word');

  const walk = $$('.walk');             // back-view walk frames
  const hero = $('.hero');              // acting: walk scale / bob / sway / turn
  const poseStand = $('.pose-stand');
  const legL = $('.leg-l');
  const legR = $('.leg-r');
  const upper = $('.hero-upper');
  const maskf = $$('.maskf');           // puts the mask on by hand, 4 frames
  const clip = $('.ch-clip');
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
  if (BLUR) hidden.filter = 'blur(6px)';
  gsap.set($$('.copy .ln'), hidden);
  gsap.set($$('.intro-h .w'), hidden);
  gsap.set(lines(mald), { y: 60 * M });
  gsap.set($$('.rule'), { scaleX: 0 });

  gsap.set([bgHosp, portraitWrap, ambA, ambB, fx, shade], { opacity: 0 });
  gsap.set(word, { clipPath: 'inset(0% 100% 0% 0%)' });
  gsap.set(portraitWrap, { xPercent: 25 * M, scale: 1 + 0.08 * M, transformOrigin: '86% 57%' });
  gsap.set(portrait, { transformOrigin: '86% 57%' });                       // face centre
  // Where the figure stands in each frame (canvas px): feet centre, feet line, height.
  // From tools/walk-frames.json; HERO is the page-3 standing pose.
  const WALK = [
    { cx: 771, feet: 1621, h: 953 },   // 1 standing close, back to us
    { cx: 754, feet: 1580, h: 783 },   // 2 walking away
    { cx: 697, feet: 1562, h: 639 },   // 3
    { cx: 683, feet: 1509, h: 558 },   // 4 furthest
    { cx: 704, feet: 1550, h: 615 },   // 5 looking back over his shoulder
  ];
  const HERO = { cx: 713, feet: 1613, h: 748 };
  const origin = (f) => `${f.cx / 9.41}% ${f.feet / 16.72}%`;
  // transform that makes figure `a` stand exactly where figure `b` stands
  const place = (a, b) => ({ scale: b.h / a.h, xPercent: (b.cx - a.cx) / 9.41, yPercent: (b.feet - a.feet) / 16.72 });
  walk.forEach((el, i) => gsap.set(el, { opacity: 0, transformOrigin: origin(WALK[i]) }));
  gsap.set(walk[4], place(WALK[4], WALK[3]));                               // looks back from the far spot
  gsap.set(hero, { opacity: 0, transformOrigin: origin(HERO) });
  gsap.set(legL, { transformOrigin: '70.67% 77.15%' });                     // hips (665,1290)
  gsap.set(legR, { transformOrigin: '79.17% 77.15%' });                     //      (745,1290)
  gsap.set(upper, { transformOrigin: '75% 78%' });                          // waist
  // Mask-on frames (tools/mask-frames.json) and the page-5 clipboard pose, all
  // placed on his page-3 mark. The mask frames share one scale so his posture
  // differences (leaning into the pocket) survive.
  const MASKF = [
    { cx: 726, feet: 1575, h: 829 },   // 1 pulls the mask from his pocket
    { cx: 702, feet: 1601, h: 883 },   // 2 lifts it
    { cx: 714, feet: 1595, h: 878 },   // 3 hooks the ear loops
    { cx: 701, feet: 1611, h: 894 },   // 4 hands down, mask on
  ];
  const CLIP = { cx: 714, feet: 1593, h: 732 };
  maskf.forEach((el, i) => gsap.set(el, {
    opacity: 0, transformOrigin: origin(MASKF[i]),
    scale: HERO.h / 885, xPercent: (HERO.cx - MASKF[i].cx) / 9.41, yPercent: (HERO.feet - MASKF[i].feet) / 16.72,
  }));
  gsap.set(clip, { opacity: 0, transformOrigin: origin(CLIP), ...place(CLIP, HERO) });
  gsap.set(files, { opacity: 0 });
  gsap.set(setA, { transformOrigin: '75% 60%' });
  gsap.set(cam, { yPercent: 100 });                                        // IGMH waits below
  gsap.set([chair, sitterRig], { transformOrigin: '50% 59%', transformPerspective: 900 });
  gsap.set(sitterRig, { opacity: 0 });
  gsap.set(sitter, { '--sf': RM ? '0%' : '9%' });
  gsap.set(pilot, { transformOrigin: '33% 100%' });
  gsap.set(ticker, { opacity: 0, y: 20 * M });
  gsap.set(items, { opacity: 0, x: -14 * M });
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

  /* --- S3 · turns away, walks into the hospital, looks back, returns --- */
  if (RM) {
    act.to(portrait, { opacity: 0, duration: 0.3 }, 0);
    act.to(hero, { opacity: 1, duration: 0.3 }, 0.3);
  } else {
    // turns his back to us: the close-up squashes edge-on, the back view opens out
    act.to(portrait, { scaleX: 0.04, xPercent: -2, filter: 'brightness(0.3)', duration: 0.3, ease: 'power2.in' }, 0);
    act.set(portrait, { opacity: 0 }, 0.3);
    act.set(walk[0], { opacity: 1, scaleX: 0.08 }, 0.3);
    act.to(walk[0], { scaleX: 1, duration: 0.24, ease: 'power2.out' }, 0.3);

    // walks away: each drawn frame glides toward the next frame's spot, then hands over
    let t = 0.8;
    const FD = 0.5;
    for (let i = 0; i < 3; i++) {
      act.to(walk[i], { ...place(WALK[i], WALK[i + 1]), duration: FD, ease: 'none' }, t);
      act.to(walk[i], { y: -5, duration: FD / 2, yoyo: true, repeat: 1, ease: 'sine.inOut' }, t);   // step bob
      act.set(walk[i], { opacity: 0 }, t + FD);
      act.set(walk[i + 1], { opacity: 1 }, t + FD);
      t += FD;
    }
    // stops, then looks back over his shoulder
    act.to(walk[3], { y: 2, duration: 0.12, yoyo: true, repeat: 1, ease: 'sine.inOut' }, t);
    act.set(walk[3], { opacity: 0 }, t + 0.3);
    act.set(walk[4], { opacity: 1 }, t + 0.3);
    t += 1.1;

    // turns round to face us…
    const far = place(HERO, WALK[3]);
    act.to(walk[4], { scaleX: 0.05 * WALK[3].h / WALK[4].h, duration: 0.15, ease: 'power2.in' }, t);
    act.set(walk[4], { opacity: 0 }, t + 0.15);
    act.set(hero, { opacity: 1, scaleX: far.scale * 0.05, scaleY: far.scale, xPercent: far.xPercent, yPercent: far.yPercent }, t + 0.15);
    act.to(hero, { scaleX: far.scale, duration: 0.24, ease: 'back.out(1.8)' }, t + 0.15);
    t += 0.55;

    // …and walks back toward us onto his mark (the puppet rig: legs swing from the hips)
    const STEP = 0.46, STEPS = 3;
    act.to(hero, { scaleX: 1, scaleY: 1, xPercent: 0, yPercent: 0, duration: STEP * STEPS, ease: 'power1.in' }, t);
    for (let i = 0; i < STEPS; i++) {
      const at = t + i * STEP;
      const lead = i % 2 ? legR : legL;       // leg swinging forward
      const back = i % 2 ? legL : legR;
      const s = i % 2 ? -1 : 1;
      act.to(lead, { rotation: 9 * s, duration: STEP, ease: 'sine.inOut' }, at);
      act.to(back, { rotation: -7 * s, duration: STEP, ease: 'sine.inOut' }, at);
      // the swinging leg lifts and bends a little mid-stride
      act.to(lead, { yPercent: -0.9, scaleY: 0.965, duration: STEP / 2, yoyo: true, repeat: 1, ease: 'sine.out' }, at);
      // body rises over the planted leg, dips at each footfall; weight shifts side to side
      act.to(hero, { y: -6, duration: STEP / 2, yoyo: true, repeat: 1, ease: 'sine.inOut' }, at);
      act.to(hero, { rotation: 1.1 * s, duration: STEP, ease: 'sine.inOut' }, at);
      act.to(upper, { rotation: -0.9 * s, duration: STEP, ease: 'sine.inOut' }, at);   // shoulders counter-swing
    }
    const stop = t + STEP * STEPS;
    act.to([legL, legR, hero, upper], { rotation: 0, duration: 0.3, ease: 'sine.out' }, stop);
    act.to(hero, { y: 4, duration: 0.12, yoyo: true, repeat: 1, ease: 'sine.inOut' }, stop);              // settles
    act.to(legL, { rotation: -3, duration: 0.2, yoyo: true, repeat: 1, ease: 'sine.inOut' }, stop + 0.3); // shifts his stance
  }
  act.addLabel('hosp', Math.max(act.duration() + 0.15, 8.1));

  /* --- S4 · takes the mask out of his pocket and puts it on (drawn frames) --- */
  const poses = [poseStand, ...maskf];
  const HOLD = [0.1, 0.6, 0.55, 0.75];      // when each mask frame comes in (after the previous one)
  let mt = 0;
  maskf.forEach((el, i) => {
    mt += HOLD[i];
    act.to(el, { opacity: 1, duration: 0.09, ease: 'none' }, `hosp+=${mt}`);
    act.set(poses[i], { opacity: 0 }, `hosp+=${mt + 0.09}`);
    act.to(hero, { y: 3, duration: 0.1, yoyo: true, repeat: 1, ease: 'sine.inOut' }, `hosp+=${mt}`);   // weight follows the arms
  });
  act.addLabel('mask', `hosp+=${Math.max(mt + 0.55, 3.2)}`);

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
  act.set([maskf[3], files], { opacity: 0 }, 'mask+=0.9');
  act.addLabel('files', 'mask+=1.5');

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
  // (2D only; with the 3D avatar the chair rocks when he sits down, from S3D.bump in hero3d.js)
  const rock = { v: 0 };
  const rockChair = () => { if (!document.documentElement.classList.contains('has-3d')) gsap.set(chair, { yPercent: 0.7 * rock.v, rotation: -1.2 * rock.v }); };
  act.to(rock, { v: M, duration: 0.07, ease: 'power1.out', onUpdate: rockChair }, `${J}+=${L}`);
  act.to(rock, { v: 0, duration: 0.9, ease: 'elastic.out(1, 0.35)', onUpdate: rockChair }, `${J}+=${L + 0.07}`);
  act.to(sitterRig, { rotation: -1.4 * M, duration: 0.3, ease: 'sine.out' }, `${J}+=${L + 0.4}`);        // leans back
  act.to(sitterRig, { rotation: 0, duration: 0.5, ease: 'sine.inOut' }, `${J}+=${L + 0.7}`);
  act.addLabel('desk', `${J}+=4.9`);   // the 3D landing, sitting down and settling at the keyboard take ~4.9 s
  act.addLabel('bye', 'desk+=2.1');   // stands up and waves goodbye before the Connect page

  /* ---------------------------------------------------------
     3D acting (assets/js/hero3d.js renders it). These tweens only move
     numbers in S3D; the module turns them into his pose every frame.
     Timings: turn-and-walk clip 2.7 s (1.5 m), walk 1.44 m/s.
     --------------------------------------------------------- */
  // The walk loop starts at the phase whose legs match the end of the turn
  // (found by comparing leg rotations), so the hand-over doesn't skip a step.
  const WA_PHASE = 0.813;
  // seconds of walking toward the hospital: one cycle shorter than before, so the
  // legs hand over to the turn at the same phase (hero3d.js fine-tunes the stride)
  const WALK_T = 1.79;
  const S3D = {
    tLandH: 0, wLandH: 1, gyH: 1.8,                                                   // intro: falls from the sky
    wIdle: 0, tTW: 0, wTW: 0, tWA: WA_PHASE, waStart: WA_PHASE + 0.25, waEnd: WA_PHASE + WALK_T,   // hospital walk
    wWA: 0, tTB: 0, wTB: 0, drift: 0, recoil: 0,
    mp: 0, lp: 0, wR: 0, wL: 0, ms: 0, mc: 0,                                          // mask
    cp: 0, cw: 0, wC: 0,                                                               // clipboard
    tJ: 0.35, wJ: 0, gyP: 0,                                                           // jump from the plane
    tLand: 0, wLand: 1, gyD: 1.4, tSTS: 0, wSTS: 0, wType: 0, bump: 0,                 // land, sit, type
    tUp: 0.6, wUp: 0, wBye: 0,                                                         // stand up, wave goodbye
    smile: 0,                                                                          // face (see face.js)
  };
  const x3 = (vars, at) => act.to(S3D, { ease: 'none', ...vars }, at);
  // S3 · turns and walks away, stops, turns back, walks onto his mark
  // (eased blends between moves; the walk is counted as travel from 2.7 s,
  //  when the turn clip's own travel ends)
  x3({ wIdle: 0, wTW: 1, duration: 0.5, ease: 'sine.inOut' }, 0);
  x3({ tTW: 2.7, duration: 2.7 }, 0);
  x3({ wTW: 0, wWA: 1, duration: 0.25, ease: 'sine.inOut' }, 2.45);
  x3({ tWA: WA_PHASE + WALK_T, duration: WALK_T }, 2.45);
  x3({ drift: 1, duration: WALK_T, ease: 'sine.inOut' }, 2.45);
  x3({ wWA: 0, wTB: 1, duration: 0.45, ease: 'sine.inOut' }, 2.45 + WALK_T - 0.27);
  x3({ tTB: 2.7, duration: 2.7 }, 2.45 + WALK_T - 0.27);
  x3({ wTB: 0, wIdle: 1, duration: 0.6, ease: 'sine.inOut' }, 2.45 + WALK_T + 2.13);
  // S4 · mask: hand to pocket, mask out, up to his face, loops over the ears, hands down
  // (mp/lp are positions along each hand's path, see handsHospital in hero3d.js:
  //  mp 0 rest · 1 pocket · 2 chin · 3 cheek · 4 ear · 5 jaw · 6 in front · 7 rest;
  //  lp 0 rest · 1 in front · 2 chest · 3 cheek · 4 ear · 5 jaw · 6 in front · 7 rest.)
  // One flowing reach per hand: accelerate out, ease into the target, no stop-start.
  x3({ wR: 1, duration: 0.2, ease: 'sine.inOut' }, 'hosp');
  x3({ mp: 1, duration: 0.6, ease: 'sine.inOut' }, 'hosp');                   // into the pocket
  x3({ ms: 1, duration: 0.15 }, 'hosp+=0.5');                                   // grips the mask
  x3({ mp: 4, duration: 1.3, ease: 'power1.inOut' }, 'hosp+=0.72');            // up, onto the face, loop over the ear
  x3({ mc: 1, duration: 0.55, ease: 'sine.inOut' }, 'hosp+=1.2');              // the mask settles on his face
  x3({ wL: 1, duration: 0.25, ease: 'sine.inOut' }, 'hosp+=0.95');
  x3({ lp: 4, duration: 1.0, ease: 'sine.inOut' }, 'hosp+=0.98');              // other hand to the other ear
  x3({ mp: 7, duration: 0.9, ease: 'sine.inOut' }, 'hosp+=2.12');             // hands run down the jaw and drop
  x3({ lp: 7, duration: 0.9, ease: 'sine.inOut' }, 'hosp+=2.04');
  x3({ wR: 0, wL: 0, duration: 0.2, ease: 'sine.inOut' }, 'hosp+=3.0');
  // S5 · clipboard tossed in, caught with a little recoil, brought to his chest
  act.set(S3D, { cw: 1 }, 'mask');
  x3({ cp: 1, duration: 0.75 }, 'mask');
  x3({ wC: 1, duration: 0.37, ease: 'sine.out' }, 'mask+=0.35');
  x3({ recoil: -0.04, duration: 0.07, ease: 'power1.out' }, 'mask+=0.75');
  x3({ recoil: 0, duration: 0.28, ease: 'power2.out' }, 'mask+=0.82');
  x3({ cp: 2, duration: 0.5, ease: 'power2.inOut' }, 'mask+=0.8');
  // S7 · crouch in the cockpit, leap out of frame; fall from above into his chair
  x3({ wJ: 1, tJ: 0.85, duration: 0.25, ease: 'sine.in' }, 'files');
  x3({ tJ: 1.6, duration: 0.5 }, 'files+=0.25');
  x3({ gyP: 4.2, duration: 0.45, ease: 'power1.in' }, 'files+=0.3');
  // drops in from above (the Landing clip's own fall), lands on his feet in front of the chair…
  x3({ gyD: 0, duration: 0.3, ease: 'power2.in' }, 'files+=0.95');
  x3({ tLand: 1.4, duration: 1.4 }, 'files+=0.95');
  // …sits back into it (the chair takes his weight), then settles at the keyboard
  x3({ wLand: 0, wSTS: 1, duration: 0.3, ease: 'sine.inOut' }, 'files+=2.2');
  x3({ tSTS: 2.23, duration: 2.23 }, 'files+=2.2');
  x3({ bump: 1, duration: 0.08, ease: 'power1.out' }, 'files+=3.62');
  x3({ bump: 0, duration: 0.9, ease: 'elastic.out(1, 0.35)' }, 'files+=3.7');
  x3({ wSTS: 0, wType: 1, duration: 0.5, ease: 'sine.inOut' }, 'files+=4.2');
  // S8→S9 · stands up and waves goodbye with a smile
  x3({ wType: 0, wUp: 1, duration: 0.35, ease: 'sine.inOut' }, 'desk');
  x3({ tUp: 2.3, duration: 1.7 }, 'desk');
  x3({ wUp: 0, wBye: 1, duration: 0.45, ease: 'sine.inOut' }, 'desk+=1.55');

  /* Face (face.js): a gentle smile when he faces us, neutral while he walks and works */
  const face = (vars, at, duration = 0.5) => x3({ ...vars, duration, ease: 'sine.inOut' }, at);
  face({ smile: 0 }, 0.3, 0.6);                                        // sets off toward the hospital
  face({ smile: 0.45 }, 2.45 + WALK_T + 2.2);                          // turns back to us on his mark
  face({ smile: 0 }, 'hosp', 0.3);
  face({ smile: 0.35 }, 'files+=4.2', 0.6);                            // at the keyboard
  face({ smile: 1 }, 'desk+=1.4');                                     // goodbye

  /* --- S1 · the opening: he falls out of the sky and lands in front of us --- */
  // Everything above moves later by INTRO; the fall plays when scrolling starts (CUES).
  const INTRO = 2.7;
  act.shiftChildren(INTRO, true);
  act.addLabel('start', 0);
  act.addLabel('landed', INTRO);
  x3({ gyH: 0, duration: 0.75, ease: 'power2.in' }, 0);             // gravity: accelerates all the way down
  x3({ tLandH: 0.33, duration: 0.75, ease: 'power1.in' }, 0);       // the clip's own drop, stretched to match
  x3({ tLandH: 2.1, duration: 1.8 }, 0.75);                          // impact, deep knee bend, rises
  x3({ wLandH: 0, wIdle: 1, duration: 0.55, ease: 'sine.inOut' }, 2.05);
  face({ smile: 0.8 }, 1.4, 0.7);                                     // lands, looks up and smiles

  // scroll beat at which each acting label is reached
  // the fall from the sky starts with the first bit of scrolling
  const CUES = [[0.06, 'landed'], [1.75, 'hosp'], [3.7, 'mask'], [5.1, 'files'], [8.95, 'desk'], [14.8, 'bye']];
  let cue = 'start';
  let introReady = false;
  let prevCue = 'start';
  let playing = null;
  function direct(t) {
    let want = 'start';
    for (const [at, name] of CUES) if (t >= at) want = name;
    if (!introReady) want = 'start';                 // the fall waits for the loading screen
    if (want === cue) return;
    cue = want;
    const to = act.labels[want];
    if (RM) { act.seek(to); return; }
    const order = ['start', ...CUES.map((c) => c[1])];
    const iTo = order.indexOf(want), iFrom = order.indexOf(prevCue);
    prevCue = want;
    if (playing) playing.kill();
    // Skipping ahead past whole scenes: jump to the start of the target moment
    // and play just that one, so a fast scroll never shows an earlier scene's
    // props (the plane, the clipboard…) lingering over a later page.
    const base = act.labels[order[iTo - 1]] ?? 0;          // where the target moment starts
    if (iTo - iFrom > 1 && act.time() < base) act.seek(base);
    const now = act.time();
    if (to < now) {
      // scrolling back up: a quick rewind
      playing = act.tweenTo(to, { duration: Math.min((now - to) / 2.5, 1.2), ease: 'none' });
    } else if (now < base - 0.05) {
      // still finishing the previous moment: fast-forward the rest, then play this one
      playing = gsap.timeline()
        .add(act.tweenTo(base, { duration: Math.min((base - now) / 3, 1), ease: 'none' }))
        .add(act.tweenTo(to, { duration: to - base, ease: 'none' }));
    } else {
      playing = act.tweenTo(to, { duration: to - now, ease: 'none' });   // natural speed
    }
  }

  /* =========================================================
     SCROLL — scenes, framing and copy
     ========================================================= */
  const tl = gsap.timeline({ defaults: { ease: 'power2.out', duration: 0.5 } });

  // fade + slide up + blur-to-sharp, line by line
  function reveal(targets, at, extra = {}) {
    const to = { opacity: 1, y: 0, duration: 0.45, stagger: 0.12, ease: 'power2.out', ...extra };
    if (BLUR) to.filter = 'blur(0px)';
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
  tl.to(journey, { y: () => (G.desk ? 0 : -G.vh * 0.05), duration: 0.6, ease: 'power2.inOut' }, 5.2);
  // "(NABH)" appears one character at a time (6 glyphs → 6 steps)
  tl.to(word, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.6, ease: 'steps(6)' }, 5.95);
  reveal(lines($('.nabh', journey)), 6.2);

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

  // each responsibility slides in and stays, until the Connect page takes over
  const T0 = 11.95, TSTEP = 0.42;
  items.forEach((li, i) => {
    tl.to(li, { opacity: 1, x: 0, duration: 0.35, ease: 'power2.out' }, T0 + i * TSTEP);
  });

  // the swivel chair turns with him
  tl.to([chair, sitterRig], { rotationY: 14 * M, duration: 0.7, ease: 'sine.inOut' }, 12.0);
  tl.to([chair, sitterRig], { rotationY: -14 * M, duration: 1.2, ease: 'sine.inOut' }, 12.7);
  tl.to([chair, sitterRig], { rotationY: 0, duration: 0.8, ease: 'sine.inOut' }, 13.9);

  /* S9 · Connect with me */
  tl.fromTo(stage, stageAt('B2'), {
    x: () => G.B2.x, y: () => G.B2.y - G.vh * 1.15 * M,
    duration: 0.8, ease: 'power2.in', immediateRender: false,
  }, 16.0);
  tl.to(stage, { opacity: 0, duration: 0.4 }, 16.4);
  tl.to(nurf, { y: () => nurfUp() - G.vh * 1.1 * M, opacity: 0, duration: 0.8, ease: 'power2.in' }, 16.0);
  tl.to([ambB, shade], { opacity: 0, duration: 0.6 }, 16.0);

  tl.to(avatar, { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(1.6)' }, 16.6);
  tl.fromTo(ringDraw, { strokeDashoffset: 100 }, { strokeDashoffset: 0, duration: 0.7, ease: 'power1.inOut' }, 16.9);
  tl.to(icons, { opacity: 1, scale: 1, duration: 0.35, ease: 'back.out(3)', stagger: 0.12 }, 17.3);
  tl.to(label, { opacity: 1, duration: 0.4 }, 17.8);
  tl.to(foot, { opacity: 1, duration: 0.4 }, 17.9);
  tl.to({}, { duration: 0.4 }, 18.0); // hold on the last frame

  /* ---------- Scroll wiring ---------- */
  ScrollTrigger.create({
    animation: tl,
    trigger: film,
    start: 'top top',
    end: () => '+=' + Math.round(tl.duration() * G.vh * BEAT),
    pin: true,
    scrub: RM ? true : 1.4,
    anticipatePin: 1,
    invalidateOnRefresh: true,
    // cue the acting from where the scroll is heading, not the lagging scrub
    onUpdate: (self) => direct(self.progress * tl.duration()),
  });

  // hand the timelines to the 3D avatar module (assets/js/hero3d.js)
  window.__story = {
    S3D, tl, act, G,
    version: document.documentElement.dataset.v || '',
    el: { hostH: $('.host-h'), hostP: $('.host-p'), hostD: $('.host-d'), portraitWrap, chair },
  };

  // re-measure the acting's position-based moves after a resize
  ScrollTrigger.addEventListener('refresh', () => {
    const t = act.time();
    act.seek(0).invalidate().seek(t);
  });

  let lenis = null;
  if (!RM && window.Lenis) {
    lenis = new Lenis({ lerp: 0.07, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }


  /* ---------- Preloader ---------- */
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);
  if (lenis) lenis.stop();

  const loader = $('#loader');
  const bar = $('.loader-bar span');
  const imgs = $$('img').filter((i) => !loader.contains(i));
  let done = 0;
  const total = imgs.length + 2; // + fonts + the 3D avatar
  const tick = () => { done++; bar.style.transform = `scaleX(${done / total})`; if (done >= total) start(); };
  imgs.forEach((img) => {
    if (img.complete && img.naturalWidth) tick();
    else {
      img.addEventListener('load', tick, { once: true });
      img.addEventListener('error', tick, { once: true });
    }
  });
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(tick);
  // the 3D avatar reports in (true = ready, false = stay 2D); never wait more than 15 s
  new Promise((res) => {
    window.__hero3dDone = res;
    setTimeout(() => res(false), 15000);
  }).then(tick);

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
      if (BLUR) to.filter = 'blur(0px)';
      gsap.to($$('.intro-h .w'), to);
      introReady = true;                         // (he falls in once the visitor starts scrolling)
    }, 250);
  }
  // never trap the visitor behind the loader
  setTimeout(start, 8000);
})();
