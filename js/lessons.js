// Lesson content: teaching steps + exercise levels.
import { LETTERS, SIZES, MIDDLE_C, TREBLE, keysOfLetter, nameOf, isWhite, letterOf, midiOf, FINGER_NAMES } from "./music.js";
import { Keyboard } from "./keyboard.js";
import { onNote, connectMidi, onMidiStatus, midiStatusText } from "./input.js";
import { drawStaff, drawNote, svgEl, el, yOf, drawMeasure, colorChord } from "./staff.js";
import { schedule, audio, stopClicks } from "./metronome.js";
import { store, save } from "./store.js";
import { pick, difficulty } from "./engine.js";
import { handsSvg, handWords } from "./hands.js";

// ---------- step visual helpers ----------
function kbVisual(host, { lo = 48, hi = 72, labels = "none", mark = null, info = true } = {}) {
  const box = document.createElement("div");
  host.appendChild(box);
  const kb = new Keyboard(box, { lo, hi, labels, fit: hi - lo <= 36 ? true : null });
  if (mark) mark(kb);
  const line = document.createElement("div");
  line.className = "pressedline muted";
  line.textContent = info ? "Tap a key (or play your piano) to see its name." : "";
  host.appendChild(line);
  const off = onNote(m => {
    if (info) line.innerHTML = `You played <b>${nameOf(m)}</b>`;
    kb.flash(m, "ok", 350);
  });
  return { kb, cleanup: () => { off(); kb.destroy(); } };
}


function staffVisual(host, notes, { clef = true, numbers = false, width = 360 } = {}) {
  const svg = svgEl(`0 40 ${width} 172`);
  drawStaff(svg, { x1: 6, x2: width - 6, clef });
  if (numbers) for (let i = 0; i < 5; i++) el("text", { x: width - 14, y: yOf(i * 2) + 4, "font-size": 10, fill: "#7a746b", "text-anchor": "middle" }, svg).textContent = i + 1;
  const x0 = clef ? 92 : 50, dx = Math.min(36, (width - x0 - 30) / Math.max(1, notes.length - 1));
  notes.forEach((key, i) => {
    const n = TREBLE.find(t => t.key === key), x = x0 + i * dx;
    const c = n.letter === "B" ? "#3d5a80" : "#1d1b18";
    drawNote(svg, n.step, x, { color: c, stem: false });
    el("text", { x, y: 182, "text-anchor": "middle", "font-size": 13, "font-weight": 700, fill: c }, svg).textContent = key;
  });
  const card = document.createElement("div");
  card.className = "card staff";
  card.appendChild(svg);
  host.appendChild(card);
  return {};
}

// ---------- Lesson 1 exercise generators ----------
const rnd = n => Math.floor(Math.random() * n);
const shuffle = a => a.map(x => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map(p => p[1]);
const letterLabel = k => k;

function namesTask(ctx, k, finger, hand) {
  const L = pick(ctx.es, LETTERS, ctx.prev);
  const all = keysOfLetter(L, ctx.lo, ctx.hi);
  const ks = hand ? handKeys(all, hand) : all;
  // shown in mixed order (never simply low to high), so you have to read each one
  let chosen = shuffle(ks).slice(0, Math.min(k, ks.length));
  for (let t = 0; t < 10 && chosen.length > 1 && chosen.every((m, i) => i === 0 || m > chosen[i - 1]); t++) chosen = shuffle(chosen);
  const names = chosen.map(nameOf);
  const list = names.length > 1 ? names.slice(0, -1).join(", ") + " and " + names[names.length - 1] : names[0];
  return {
    item: L,
    prompt: `Play <b>${list}</b>`,
    sub: "Any order. The C labels show each octave — middle C is C4.",
    hand, finger,
    targets: chosen.map(m => ({ m, label: nameOf(m) })),
  };
}

// Right hand plays middle C and above, left hand middle C and below.
function handKeys(ks, hand) {
  const r = ks.filter(m => (hand === "R" ? m >= MIDDLE_C : m <= MIDDLE_C));
  return r.length ? r : ks;
}

function handTask(ctx, hand) {
  const L = pick(ctx.es, LETTERS, ctx.prev);
  const opts = handKeys(keysOfLetter(L, ctx.lo, ctx.hi), hand);
  const m = opts[rnd(opts.length)], f = 1 + rnd(5);
  return {
    item: L,
    prompt: `Play <b>${nameOf(m)}</b>`,
    hand, finger: f,
    targets: [{ m, label: nameOf(m) }],
  };
}

function mixTask(ctx) {
  const letters = shuffle(LETTERS).slice(0, 3);
  let hand = Math.random() < 0.5 ? "L" : "R";
  const targets = letters.map(L => {
    const opts = handKeys(keysOfLetter(L, ctx.lo, ctx.hi), hand);
    const m = opts[rnd(opts.length)], f = 1 + rnd(5);
    const t = { m, item: L, label: nameOf(m), hand, finger: f };
    hand = hand === "L" ? "R" : "L";
    return t;
  });
  return { item: letters.join(""), ordered: true, prompt: "Play in order:", sub: "Hands alternate — follow the highlighted finger.", targets };
}

function noteRange(lo, hi) {
  const out = [];
  for (let m = Math.max(lo, 36); m <= Math.min(hi, 96); m++) if (isWhite(m)) out.push(nameOf(m));
  return out;
}

// ---------- Lessons ----------
export const LESSONS = [
  {
    id: "1",
    title: "The keyboard",
    blurb: "Find any key by its name (F3, C4…), finger numbers.",
    steps: [
      {
        title: "White keys and black keys",
        html: `<p>A piano has <b>white keys</b> and <b>black keys</b>.</p>
               <p>The black keys come in <b>groups of 2</b> and <b>groups of 3</b>. This pattern repeats along the whole keyboard — it's your map. Every key is found by where it sits next to these groups.</p>
               <p class="muted">The groups of 2 are highlighted below.</p>`,
        visual: h => kbVisual(h, { mark: kb => { for (let m = 48; m <= 72; m++) if ([1, 3].includes(m % 12)) kb.set(m, "hint"); } }),
      },
      {
        title: "Find C",
        html: `<p><b>C</b> is the white key just to the <b>left of every group of 2 black keys</b>.</p>
               <p>Find C first — every other key is easy to find from there.</p>`,
        visual: h => kbVisual(h, { mark: kb => [48, 60, 72].forEach(m => kb.set(m, "target")) }),
      },
      {
        title: "The musical alphabet",
        html: `<p>The white keys use only 7 letters: <b>C D E F G A B</b>. After B it starts again with C.</p>
               <div class="alphabet">C D E F G A B <span class="muted">→ C D E …</span></div>`,
        visual: h => kbVisual(h, { labels: "all" }),
      },
      {
        title: "Low and high, not left and right",
        html: `<p>On a piano we don't say left and right. We say <b>low</b> and <b>high</b>.</p>
               <p>Keys to the left sound <b>lower</b>, keys to the right sound <b>higher</b>. Moving right is going <b>up</b> the keyboard; moving left is going <b>down</b>.</p>
               <p>The ends of the keyboard are the <b>bottom</b> (lowest keys, far left) and the <b>top</b> (highest keys, far right) — e.g. "the bottom note", "top C".</p>
               <div class="lowhigh"><span>← lower · down</span><span>up · higher →</span></div>`,
        visual: h => kbVisual(h, { labels: "c" }),
      },
      {
        title: "Octaves and middle C",
        html: `<p>From one C to the next C is an <b>octave</b>. Each octave has a number, and the number goes up at every C: … B3, <b>C4</b>, D4 …</p>
               <p><b>Middle C = C4</b>. It's the C closest to the middle of the keyboard, usually right under the brand name. The B just below it is B3.</p>
               <p class="muted">On 88-key pianos the lowest key is A0 and the highest is C8.</p>`,
        visual: h => kbVisual(h, { lo: 48, hi: 72, labels: "allOct", mark: kb => kb.set(MIDDLE_C, "target") }),
      },
      {
        title: "Your keyboard",
        html: `<p>Note names are the same on every piano: <b>middle C is always C4</b>. A smaller keyboard simply has fewer keys at both ends — a 61-key keyboard goes from <b>C2 to C7</b>, a full 88-key piano from <b>A0 to C8</b>.</p>
               <p>Pick your size so the keyboard on screen looks exactly like yours.</p>
               <div class="seg sizes"></div>
               <p class="muted sizeinfo"></p>`,
        visual: (h, root) => {
          let v = null;
          const render = () => {
            if (v) v.cleanup();
            const [lo, hi] = SIZES[store.settings.size];
            v = kbVisual(h, { lo, hi, labels: "c", mark: kb => { kb.set(MIDDLE_C, "target"); setTimeout(() => kb.scrollTo(MIDDLE_C), 0); } });
            root.querySelector(".sizeinfo").innerHTML = `Lowest key: <b>${nameOf(lo)}</b> · highest: <b>${nameOf(hi)}</b> · middle C is marked.`;
            const seg = root.querySelector(".sizes"); seg.innerHTML = "";
            Object.keys(SIZES).forEach(n => {
              const b = document.createElement("button"); b.textContent = n;
              b.className = +n === store.settings.size ? "on" : "";
              b.onclick = () => { store.settings.size = +n; save(); h.innerHTML = ""; render(); };
              seg.appendChild(b);
            });
          };
          render();
          return { cleanup: () => v && v.cleanup() };
        },
      },
      {
        title: "Finger numbers",
        html: `<p>Each finger has a number, the same on both hands: <b>1 = thumb, 2 = index, 3 = middle, 4 = ring, 5 = pinky</b>.</p>
               <p>Both hands count from the thumb. So on the keyboard the left hand reads 5 4 3 2 1 from left to right, and the right hand reads 1 2 3 4 5.</p>
               <p class="muted">In the exercises the finger to use is highlighted on a picture like this one.</p>`,
        visual: h => { h.innerHTML = `<div class="card">${handsSvg()}</div>`; return {}; },
      },
      {
        title: "Connect your piano (optional)",
        html: `<p>You can tap the keys on screen, or play your real piano.</p>
               <p>To use your digital piano: connect its <b>USB to Host</b> port to your phone or laptop (on a phone you need an OTG adapter), open this app in <b>Chrome</b>, and press the button. The app will hear every key you press.</p>
               <button class="primary ghost" data-act="midi">🎹 Connect piano (MIDI)</button>
               <p class="muted midistatus"></p>
               <p class="muted">The app can check <i>which key</i> you played, but not which finger — that part is on your honour.</p>
               <p class="muted"><b>Piano shortcuts:</b> once connected, press 3 black keys together instead of tapping buttons — the low F♯ G♯ A♯ group for “Next”, the low C♯ D♯ pair for “Another round”, the top F♯ G♯ A♯ group for “Back”, the top C♯ D♯ pair to restart a round. Each button shows its chord.</p>`,
        visual: (h, root) => {
          const st = root.querySelector(".midistatus");
          const show = () => st.textContent = midiStatusText();
          show();
          root.querySelector('[data-act="midi"]').onclick = connectMidi;
          const off = onMidiStatus(show);
          const v = kbVisual(h, { labels: "c" });
          return { cleanup: () => { off(); v.cleanup(); } };
        },
      },
    ],
    levels: [
      { id: "1.1", title: "Find them all", desc: "Play 3 different keys with the same letter.", tasks: 10,
        make: ctx => { const L = pick(ctx.es, LETTERS, ctx.prev); const n = Math.min(3, keysOfLetter(L, ctx.lo, ctx.hi).length);
          return { item: L, any: { letter: L, count: n }, prompt: `Play <b>${n} different ${L}</b> keys`, sub: "Any order, any finger." }; },
        itemKeys: () => LETTERS, label: letterLabel },
      { id: "1.2", title: "Octave names", desc: "Play F5, F3, F6… — the C labels guide you.", tasks: 10,
        make: ctx => namesTask(ctx, 3), itemKeys: () => LETTERS, label: letterLabel },
      { id: "1.3", title: "Index finger only", desc: "Same, always with RH 2.", tasks: 10,
        make: ctx => namesTask(ctx, 2, 2, "R"), itemKeys: () => LETTERS, label: letterLabel },
      { id: "1.4", title: "Right hand, every finger", desc: "One key, a given RH finger.", tasks: 10,
        make: ctx => handTask(ctx, "R"), itemKeys: () => LETTERS, label: letterLabel },
      { id: "1.5", title: "Left hand, every finger", desc: "One key, a given LH finger.", tasks: 10,
        make: ctx => handTask(ctx, "L"), itemKeys: () => LETTERS, label: letterLabel },
      { id: "1.6", title: "Mix it up", desc: "3 keys in order, alternating hands and fingers.", tasks: 6,
        make: mixTask, itemKeys: () => LETTERS, label: letterLabel },
      { id: "1.7", title: "No labels", desc: "Find F4, C5, A3… on a bare keyboard.", tasks: 10, labels: "none",
        make: ctx => {
          const keys = noteRange(ctx.lo, ctx.hi);
          const k = pick(ctx.es, keys, ctx.prev);
          const L = k[0], oct = +k.slice(1), m = midiOf(L, oct);
          const hand = m < MIDDLE_C ? "L" : "R", f = 1 + rnd(5);
          return { item: k, prompt: `Play <b>${k}</b>`, hand, finger: f, targets: [{ m, label: k }] };
        },
        itemKeys: (lo, hi) => noteRange(lo, hi), label: k => k },
    ],
  },
  {
    id: "2",
    title: "Reading notes",
    blurb: "The staff, the treble clef, and every note from B3 to B5.",
    steps: [
      {
        title: "The staff",
        html: `<p>Music is written on a <b>staff</b>: <b>5 lines</b> and the <b>4 spaces</b> between them.</p>
               <p>Lines and spaces are always counted <b>from the bottom up</b>: line 1 is the lowest line.</p>`,
        visual: h => staffVisual(h, [], { clef: false, numbers: true }),
      },
      {
        title: "Lines and spaces",
        html: `<p>A note sits either <b>on a line</b> (the line goes through it) or <b>in a space</b> (between two lines).</p>
               <p>Every step up — line, space, line, space — is the <b>next letter</b> of the alphabet. Higher on the staff = higher on the keyboard.</p>`,
        visual: h => staffVisual(h, ["E4", "F4", "G4", "A4", "B4", "C5", "D5"], { clef: false }),
      },
      {
        title: "The treble clef",
        html: `<p>The sign at the start is a <b>clef</b>. It tells you which note is which. This one is the <b>treble clef</b>, also called the <b>G clef</b>.</p>
               <p>Its curl wraps around <b>line 2</b>, and that line is <b>G4</b> — the G just above middle C. Everything else is counted from there.</p>
               <p class="muted">The treble clef is used for higher notes, which you usually play with the right hand.</p>`,
        visual: h => staffVisual(h, ["G4"]),
      },
      {
        title: "Line notes: E G B D F",
        html: `<p>The 5 lines, bottom to top, are <b>E G B D F</b>.</p>
               <p>Remember it as <i>"<b>E</b>very <b>G</b>ood <b>B</b>oy <b>D</b>oes <b>F</b>ine"</i>.</p>`,
        visual: h => staffVisual(h, ["E4", "G4", "B4", "D5", "F5"]),
      },
      {
        title: "Space notes: F A C E",
        html: `<p>The 4 spaces, bottom to top, spell <b>F A C E</b> — like the word <i>"face"</i>.</p>`,
        visual: h => staffVisual(h, ["F4", "A4", "C5", "E5"]),
      },
      {
        title: "Ledger lines",
        html: `<p>Notes can go beyond the staff. Then we draw short extra lines just for them: <b>ledger lines</b>.</p>
               <p><b>Middle C (C4)</b> sits on one ledger line below the staff, and <b>B3</b> hangs just under it. <b>D4</b> sits right under the bottom line.</p>
               <p>Above: <b>G5</b> sits on top of the staff, <b>A5</b> is on a ledger line, and <b>B5</b> sits on top of it.</p>`,
        visual: h => staffVisual(h, ["B3", "C4", "D4", "G5", "A5", "B5"]),
      },
      {
        title: "The full map: B3 → B5",
        html: `<p>Here are all 15 notes you'll practise, step by step. The three <b>B</b>s (blue) are your landmarks: <b>B3</b> below the staff, <b>B4 on the middle line</b>, <b>B5</b> above the staff.</p>`,
        visual: h => { staffVisual(h, TREBLE.slice(0, 7).map(n => n.key)); staffVisual(h, TREBLE.slice(7).map(n => n.key)); return {}; },
      },
    ],
    levels: [
      { id: "2.1", type: "notes", title: "Line notes", desc: "E G B D F only.", pass: { maxMs: 1000 }, keys: ["E4", "G4", "B4", "D5", "F5"] },
      { id: "2.2", type: "notes", title: "Space notes", desc: "F A C E only.", pass: { maxMs: 1000 }, keys: ["F4", "A4", "C5", "E5"] },
      { id: "2.3", type: "notes", title: "The whole staff", desc: "E4 to F5, lines and spaces.", keys: TREBLE.filter(n => n.step >= 0 && n.step <= 8).map(n => n.key) },
      { id: "2.4", type: "notes", title: "With ledger lines", desc: "Full range B3 to B5.", keys: TREBLE.map(n => n.key) },
      { id: "2.5", type: "notes", optional: true, title: "60-second challenge", desc: "How many can you name in a minute? Pass: 25.", keys: TREBLE.map(n => n.key), timed: true },
    ],
  },
  {
    id: "3",
    title: "Notes on the keyboard",
    blurb: "See a note on the staff, find it on the keyboard — any finger.",
    steps: [
      {
        title: "One note, one key",
        html: `<p>Every note on the staff is <b>exactly one key</b> on the piano. Middle C on its little ledger line is <b>C4</b> — the middle C on your keyboard.</p>
               <p><b>Try it:</b> play any white key from B3 to B5 and watch where it appears on the staff.</p>`,
        visual: h => staffAndKb(h, { notes: ["C4"], interactive: true, mark: [60] }),
      },
      {
        title: "Higher on the staff = further right",
        html: `<p>The same letter appears in many places. <b>C4</b> and <b>C5</b> are both C, one octave apart.</p>
               <p>The higher a note sits on the staff, the further <b>up</b> (right) the key is on the keyboard.</p>`,
        visual: h => staffAndKb(h, { notes: ["C4", "C5"], mark: [60, 72] }),
      },
      {
        title: "Your landmarks",
        html: `<p>Don't count lines every time. Use landmarks and step from them:</p>
               <ul class="ins"><li><b>C4</b> — middle C, one ledger line below</li><li><b>G4</b> — line 2, where the clef curls</li>
               <li><b>B4</b> — the middle line</li><li><b>B3</b> and <b>B5</b> — just outside the staff</li></ul>`,
        visual: h => staffAndKb(h, { notes: ["B3", "C4", "G4", "B4", "B5"], mark: [59, 60, 67, 71, 83] }),
      },
    ],
    levels: [
      { id: "3.1", type: "staff", title: "Line notes", desc: "E G B D F — find each one on the keyboard, any finger.", tasks: 12,
        make: ctx => plainTask(ctx, LINE_KEYS), itemKeys: () => LINE_KEYS },
      { id: "3.2", type: "staff", title: "Space notes", desc: "F A C E — any finger.", tasks: 12,
        make: ctx => plainTask(ctx, SPACE_KEYS), itemKeys: () => SPACE_KEYS },
      { id: "3.3", type: "staff", title: "The whole staff", desc: "E4 to F5, lines and spaces — any finger.", tasks: 12,
        make: ctx => plainTask(ctx, STAFF_KEYS), itemKeys: () => STAFF_KEYS },
      { id: "3.4", type: "staff", title: "With ledger lines", desc: "C4 to B5 — any finger.", tasks: 12,
        make: ctx => plainTask(ctx, KEYS), itemKeys: () => KEYS },
      { id: "3.5", type: "staff", timed: true, optional: true, pass: { minScore: 20 }, title: "60-second challenge",
        desc: "How many notes can you find in a minute? Optional. Pass: 20.", make: ctx => plainTask(ctx, KEYS), itemKeys: () => KEYS },
    ],
  },
  {
    id: "4",
    title: "Fingering",
    blurb: "Finger numbers on the staff, hand positions, moving the hand, double notes.",
    steps: [
      {
        title: "Finger numbers on the staff",
        html: `<p>Sheet music often has a small <b>number above a note</b>. It tells you <b>which finger</b> to use: 1 = thumb … 5 = pinky, the same numbers you learned in Lesson 1.</p>
               <p>From now on the finger matters, not just the key.</p>`,
        visual: h => staffAndKb(h, { elems: [{ keys: ["E4"], finger: 3 }], mark: [64] }),
      },
      {
        title: "Right-hand position",
        html: `<p>Put your <b>right thumb (1) on middle C</b>. Fingers 2, 3, 4, 5 rest on D, E, F, G. This is the <b>C position</b> — one finger per key.</p>
               <p>Move the whole hand up so the thumb sits on G4 and you're in the <b>G position</b> (G A B C D).</p>
               <p class="muted">In sheet music, small numbers above the notes tell you which finger to use.</p>`,
        visual: h => staffAndKb(h, { elems: ["C4", "D4", "E4", "F4", "G4"].map((k, i) => ({ keys: [k], finger: i + 1 })), mark: [60, 62, 64, 65, 67] }),
      },
      {
        title: "Moving the hand",
        html: `<p>When a melody leaves your five keys, the hand moves — and a <b>new finger number</b> shows where it lands. Notes without a number stay in the same position.</p>
               <p>Move as little as possible: going <b>up</b>, the <b>pinky</b> reaches the new note; going <b>down</b>, the <b>thumb</b> does. When the hand moves, the new position lights up on the keyboard.</p>`,
        visual: h => staffAndKb(h, { elems: [{ keys: ["C4"], finger: 1 }, { keys: ["E4"] }, { keys: ["A4"], finger: 5 }, { keys: ["G4"] }], mark: [64, 65, 67, 69, 62] }),
      },
      {
        title: "Two notes at once",
        html: `<p>When two notes are stacked on <b>one stem</b>, play them <b>together</b>, at the same moment.</p>
               <p>Use two fingers of the right hand — for example <b>C4 + E4</b> with fingers <b>1 and 3</b>, or <b>C4 + G4</b> with <b>1 and 5</b>.</p>`,
        visual: h => staffAndKb(h, { elems: [{ keys: ["C4", "E4"] }, { keys: ["D4", "F4"] }, { keys: ["C4", "G4"] }], mark: [60, 64] }),
      },
    ],
    levels: [
      { id: "4.1", type: "staff", title: "With fingering", desc: "One note at a time, the finger number written above it.", tasks: 12,
        make: ctx => singleTask(ctx, true), itemKeys: () => KEYS },
      { id: "4.2", type: "staff", title: "Five-finger positions", desc: "4 notes in C or G position, fingers written above.", tasks: 6,
        make: ctx => phraseTask(ctx, ["C4", "G4"]), itemKeys: () => KEYS },
      { id: "4.3", type: "staff", title: "Read ahead", desc: "4 notes with steps and leaps; fingers written only where the hand moves.", tasks: 6,
        make: ctx => leapTask(ctx), itemKeys: () => KEYS },
      { id: "4.4", type: "staff", title: "Double notes", desc: "Two notes together, one chord at a time.", tasks: 10, pass: { maxMs: 3000 },
        make: ctx => dyadTask(ctx, 1), itemKeys: () => DYADS },
    ],
  },
  {
    id: "5",
    title: "Playing in time",
    blurb: "The beat, bars in 4/4, and playing with a metronome — slow first, then a bit faster.",
    steps: [
      {
        title: "The beat",
        html: `<p>Music has a steady pulse called the <b>beat</b> — what you tap your foot to.</p>
               <p>A <b>metronome</b> clicks the beat for you. Its speed is in <b>bpm</b> (beats per minute): 50 bpm is calm, a bit more than one second per click.</p>
               <button class="primary ghost" data-act="hear">▶ Hear 50 bpm</button>`,
        visual: (h, root) => beatDemo(h, root, { bpm: 50, timeSig: false }),
      },
      {
        title: "Bars and 4/4",
        html: `<p>Music is split into <b>bars</b> (measures), separated by bar lines. <b>4/4</b> at the start means <b>4 beats in every bar</b>.</p>
               <p>A filled note with a stem is a <b>quarter note</b>: it lasts one beat. So a bar of 4/4 holds 4 quarter notes — count them “1, 2, 3, 4”.</p>
               <button class="primary ghost" data-act="hear">▶ Hear it</button>`,
        visual: (h, root) => beatDemo(h, root, { bpm: 50, timeSig: true }),
      },
      {
        title: "Count in, then play",
        html: `<p>Every bar starts with <b>4 clicks to count in</b>. Then play <b>one note on each click</b>.</p>
               <ul class="ins"><li>During the count-in the <b>hand position lights up</b> on the keyboard — put your hand there.</li>
               <li>Keep your eyes <b>one note ahead</b> of your fingers.</li>
               <li>Missed a note? <b>Don't stop</b> — catch the next click.</li>
               <li><b>Slow and correct</b> beats fast and wrong. Speed comes later on its own.</li></ul>`,
        visual: h => staffAndKb(h, { elems: ["C4", "E4", "D4", "F4"].map(k => ({ keys: [k], finger: KEYS.indexOf(k) + 1 })), timeSig: true, mark: [60, 62, 64, 65, 67] }),
      },
      {
        title: "Two notes in time",
        html: `<p>Double notes work the same way: <b>both notes together, on the click</b>.</p>
               <p class="muted">Start this only once single notes in time feel calm.</p>`,
        visual: h => staffAndKb(h, { elems: [{ keys: ["C4", "E4"], finger: [1, 3] }, { keys: ["D4", "F4"], finger: [2, 4] }, { keys: ["E4", "G4"], finger: [3, 5] }, { keys: ["C4", "E4"], finger: [1, 3] }], timeSig: true, mark: [] }),
      },
    ],
    levels: [
      { id: "5.1", type: "staff", tempo: true, bpm: 50, title: "Keep the beat", desc: "One note per bar, played 4 times on the clicks. 50 bpm.", tasks: 7,
        make: ctx => repeatTask(ctx), itemKeys: () => KEYS },
      { id: "5.2", type: "staff", tempo: true, bpm: 50, title: "Steps in time", desc: "4 notes in a five-finger position. 50 bpm.", tasks: 7,
        make: ctx => phraseTask(ctx, ["C4", "D4", "E4", "F4", "G4", "A4"]), itemKeys: () => KEYS },
      { id: "5.3", type: "staff", tempo: true, bpm: 66, title: "A bit faster", desc: "Same as 5.2 at 66 bpm.", tasks: 7,
        make: ctx => phraseTask(ctx, ["C4", "D4", "E4", "F4", "G4", "A4"]), itemKeys: () => KEYS },
      { id: "5.4", type: "staff", tempo: true, bpm: 50, title: "Double notes in time", desc: "4 double notes per bar. 50 bpm.", tasks: 7, pass: { maxMs: 200 },
        make: ctx => dyadTask(ctx, 4), itemKeys: () => DYADS },
    ],
  },
];

// ---------- Lesson 3 helpers ----------
// Right hand only, so the range starts at middle C (B3 belongs to the left hand).
const KEYS = TREBLE.filter(n => n.key !== "B3").map(n => n.key);   // C4 … B5
const DYADS = [];
KEYS.forEach((k, i) => [2, 3, 4].forEach(d => { if (KEYS[i + d]) DYADS.push(k + "+" + KEYS[i + d]); }));
const MAX_THUMB = KEYS.length - 5;
const LINE_KEYS = ["E4", "G4", "B4", "D5", "F5"];
const SPACE_KEYS = ["F4", "A4", "C5", "E5"];
const STAFF_KEYS = ["E4", "F4", "G4", "A4", "B4", "C5", "D5", "E5", "F5"];

// 3.1–3.4: just find the note on the keyboard — no hand position, no fingering.
function plainTask(ctx, keys) {
  const k = pick(ctx.es, keys, ctx.prev);
  return { elems: [{ keys: [k], item: k }], sub: "Find it on the keyboard — any finger." };
}                                    // thumb can go up to F5

// How likely each melodic interval is (in steps). Mostly steps and small skips, like real tunes.
const STEP_W = { 0: 0.15, 1: 3, 2: 2.2, 3: 1.2, 4: 0.8 };
const LEAP_W = { 0: 0.1, 1: 2.5, 2: 2.4, 3: 1.8, 4: 1.4, 5: 1, 6: 0.6, 7: 0.5 };
const diff = (ctx, k) => Math.pow(difficulty(ctx.es, k), 1.5);

function weighted(items, weights) {
  let r = Math.random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < items.length; i++) { r -= weights[i]; if (r <= 0) return items[i]; }
  return items[items.length - 1];
}

// Pick a hand position (thumb index), leaning toward positions that hold your hard notes.
function choosePos(ctx, options, near) {
  const w = options.map(p => {
    let d = 0; for (let j = p; j < p + 5; j++) d += diff(ctx, KEYS[j]);
    const move = near == null ? 1 : [1, 1.4, 1.1, 0.7, 0.4][Math.min(4, Math.abs(p - near))];
    return d * move;
  });
  return weighted(options, w);
}

// Next note inside the current position: mostly steps/skips, hard notes a bit more often.
function nextInPos(ctx, p, last) {
  const cand = [0, 1, 2, 3, 4].map(f => p + f);
  const w = cand.map(j => (last == null ? 1 : STEP_W[Math.min(4, Math.abs(j - last))]) * diff(ctx, KEYS[j]));
  return weighted(cand, w);
}

// 3.1 / 3.2: one note per task, but consecutive tasks form a flowing line in one hand position.
// The hand moves now and then — the task says so.
function singleTask(ctx, fingering) {
  const st = ctx.state;
  let moved = false;
  if (st.p == null) { st.p = choosePos(ctx, range(0, MAX_THUMB)); moved = true; st.n = 0; }
  else if (st.n >= 4 && Math.random() < 0.3) {
    st.p = choosePos(ctx, range(0, MAX_THUMB).filter(p => p !== st.p), st.p); moved = true; st.n = 0; st.last = null;
  }
  const j = nextInPos(ctx, st.p, st.last);
  st.last = j; st.n++;
  const k = KEYS[j], f = j - st.p + 1;
  const where = `Hand position: thumb on <b>${KEYS[st.p]}</b>`;
  return {
    pos: { thumb: st.p, moved },
    elems: [{ keys: [k], item: k, finger: fingering ? f : null }],
    sub: (moved ? `<span class="handline">↔ ${where}</span>` : `<span class="muted">${where}</span>`) +
         (fingering ? ` · <b>${handWords("R", f)}</b>` : ""),
  };
}

// 3.3 / 3.5: a 4-note phrase in one five-finger position.
function phraseTask(ctx, starts) {
  const options = starts.map(k => KEYS.indexOf(k));
  const p = choosePos(ctx, options);
  const moved = ctx.state.p !== p; ctx.state.p = p;
  const elems = []; let last = null;
  for (let i = 0; i < 4; i++) {
    const j = nextInPos(ctx, p, last); last = j;
    elems.push({ keys: [KEYS[j]], item: KEYS[j], finger: j - p + 1 });
  }
  return { pos: { thumb: p, moved }, elems, sub: `Thumb on <b>${KEYS[p]}</b> · fingers 1–5 on ${KEYS.slice(p, p + 5).join(" ")}` };
}

// 3.4: steps and leaps across the whole range, continuing from the previous phrase.
// Like real sheet music, a finger number is written only where the hand has to move
// (and on the first note); in between you stay in the same five-finger position.
function leapTask(ctx) {
  const st = ctx.state;
  const elems = [];
  let leaps = 0, lastMove = 0;      // lastMove: signed interval of the previous note
  for (let i = 0; i < 4; i++) {
    const cand = range(0, KEYS.length - 1);
    const w = cand.map(j => {
      if (st.last == null) return diff(ctx, KEYS[j]);
      const d = j - st.last, a = Math.abs(d);
      let wt = LEAP_W[a] || 0.1;
      if (a > 2 && leaps >= 1) wt = 0;                        // at most one leap per phrase
      if (Math.abs(lastMove) > 2) {                           // after a leap: a step or small skip…
        wt = a <= 2 && a > 0 ? wt * (Math.sign(d) !== Math.sign(lastMove) ? 3 : 1) : 0;   // …preferably back
      }
      return wt * diff(ctx, KEYS[j]);
    });
    const j = weighted(cand, w);
    if (st.last != null) { lastMove = j - st.last; if (Math.abs(lastMove) > 2) leaps++; }
    let moved = false;
    if (st.p == null || j < st.p || j > st.p + 4) {
      // move the hand as little as possible: going up, the pinky reaches the new note;
      // going down, the thumb reaches it
      if (st.p == null) st.p = Math.max(0, Math.min(j - 2, MAX_THUMB));   // start with the note under the middle finger
      else if (j > st.p + 4) st.p = Math.min(j - 4, MAX_THUMB);
      else st.p = Math.max(j, 0);
      moved = true;
    }
    st.last = j;
    const f = j - st.p + 1;
    elems.push({ keys: [KEYS[j]], item: KEYS[j], finger: moved || i === 0 ? f : null });
  }
  return { elems, sub: "A finger number appears only where your hand moves — stay in that position until the next number." };
}

// 3.6 / 3.7: double notes that fit one hand position, with fingering, moving smoothly.
function dyadTask(ctx, count) {
  const st = ctx.state;
  let moved = false;
  if (st.p == null || (st.n >= 4 && Math.random() < 0.35)) {
    st.p = choosePos(ctx, range(0, MAX_THUMB), st.p); st.n = 0; st.last = null; moved = true;
  }
  const elems = [];
  for (let i = 0; i < count; i++) {
    const cand = [];
    for (let lo = st.p; lo <= st.p + 2; lo++) for (const d of [2, 3, 4]) if (lo + d <= st.p + 4) cand.push([lo, lo + d]);
    const w = cand.map(([a, b]) => (st.last == null ? 1 : [0.3, 3, 2, 1][Math.min(3, Math.abs(a - st.last))]) * diff(ctx, KEYS[a] + "+" + KEYS[b]));
    const [a, b] = weighted(cand, w);
    st.last = a; st.n++;
    elems.push({ keys: [KEYS[a], KEYS[b]], item: KEYS[a] + "+" + KEYS[b], finger: [a - st.p + 1, b - st.p + 1] });
  }
  return { pos: { thumb: st.p, moved }, elems, sub: `Thumb on <b>${KEYS[st.p]}</b> · both notes together, fingers written above` };
}

export const positionKeys = p => KEYS.slice(p, p + 5);

// 4.1: one note per bar, played on all 4 beats — pure timing, nothing else to think about.
function repeatTask(ctx) {
  const options = ["C4", "D4", "E4", "F4", "G4", "A4"].map(k => KEYS.indexOf(k));
  const p = choosePos(ctx, options);
  const moved = ctx.state.p !== p; ctx.state.p = p;
  const j = nextInPos(ctx, p, null), k = KEYS[j], f = j - p + 1;
  return { pos: { thumb: p, moved }, elems: [0, 1, 2, 3].map(i => ({ keys: [k], item: k, finger: i === 0 ? f : null })),
    sub: `Thumb on <b>${KEYS[p]}</b> · the same note 4 times` };
}

// Metronome demo for the Lesson 4 steps: clicks, and the beat lights up on the staff.
function beatDemo(h, root, { bpm, timeSig }) {
  const elems = ["C4", "D4", "E4", "F4"].map(k => ({ keys: [k] }));
  const { groups, cleanup } = staffAndKb(h, { elems, timeSig, mark: [] });
  let raf = null;
  root.querySelector('[data-act="hear"]').onclick = () => {
    audio(); stopClicks(); cancelAnimationFrame(raf);
    const { t0Perf, beatMs } = schedule(8, bpm);
    const tick = () => {
      const b = Math.floor((performance.now() - t0Perf) / beatMs) - 4;
      groups.forEach((g, i) => colorChord(g, i === b ? "#3d5a80" : "#1d1b18"));
      if (b < 4) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  };
  return { cleanup: () => { cancelAnimationFrame(raf); stopClicks(); cleanup(); } };
}

function range(a, b) { const r = []; for (let i = a; i <= b; i++) r.push(i); return r; }

function staffAndKb(h, { notes = null, elems = null, timeSig = false, mark = [], interactive = false }) {
  const card = document.createElement("div");
  card.className = "card staff";
  h.appendChild(card);
  let groups = [];
  const drawElems = list => {
    card.innerHTML = "";
    const svg = svgEl("0 0 300 180");
    card.appendChild(svg);
    groups = drawMeasure(svg, list.map(e => ({ steps: e.keys.map(k => TREBLE.find(t => t.key === k).step), finger: e.finger })), { timeSig });
  };
  drawElems(elems || notes.map(k => ({ keys: [k] })));
  const v = kbVisual(h, { lo: 57, hi: 84, labels: interactive ? "none" : "c", info: true,
    mark: kb => { mark.forEach(m => kb.set(m, "target")); } });
  let off = () => {};
  if (interactive) {
    off = onNote(m => {
      const k = nameOf(m);
      if (TREBLE.some(t => t.key === k)) drawElems([{ keys: [k] }]);
    });
  }
  return { groups, cleanup: () => { off(); v.cleanup(); } };
}
