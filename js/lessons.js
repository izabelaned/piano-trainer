// Lesson content: teaching steps + exercise levels.
import { LETTERS, SOLF, SIZES, MIDDLE_C, TREBLE, keysOfLetter, ordinal, nameOf, isWhite, letterOf, midiOf, FINGER_NAMES } from "./music.js";
import { Keyboard } from "./keyboard.js";
import { onNote, connectMidi, onMidiStatus, midiStatusText } from "./input.js";
import { drawStaff, drawNote, svgEl, el, yOf } from "./staff.js";
import { store, save } from "./store.js";
import { pick } from "./engine.js";

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
    if (info) line.innerHTML = `You played <b>${nameOf(m)}</b>${letterOf(m) ? " · " + SOLF[letterOf(m)] : ""}`;
    kb.flash(m, "ok", 350);
  });
  return { kb, cleanup: () => { off(); kb.destroy(); } };
}

const namesTable = () => `<table class="names">
  <tr><th>English</th>${LETTERS.map(L => `<td>${L}</td>`).join("")}</tr>
  <tr><th>Български</th>${LETTERS.map(L => `<td>${SOLF[L]}</td>`).join("")}</tr></table>`;

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
    el("text", { x, y: 200, "text-anchor": "middle", "font-size": 12, fill: "#7a746b" }, svg).textContent = SOLF[n.letter];
  });
  const card = document.createElement("div");
  card.className = "card staff";
  card.appendChild(svg);
  host.appendChild(card);
  return {};
}

function handsSvg() {
  const finger = (x, h, n, w = 22) => `<rect x="${x}" y="${100 - h}" width="${w}" height="${h}" rx="11" fill="#f3d9c4" stroke="#b98d6c"/>
    <text x="${x + w / 2}" y="${100 - h + 18}" text-anchor="middle" font-size="14" font-weight="700" fill="#1d1b18">${n}</text>`;
  const palm = x => `<rect x="${x}" y="92" width="128" height="60" rx="24" fill="#f3d9c4" stroke="#b98d6c"/>`;
  // left hand (palm down): pinky on the left, thumb on the right
  const L = palm(14) + finger(14, 50, 5) + finger(40, 70, 4) + finger(66, 78, 3) + finger(92, 70, 2) + finger(128, 36, 1, 24);
  const R = palm(218) + finger(206, 36, 1, 24) + finger(244, 70, 2) + finger(270, 78, 3) + finger(296, 70, 4) + finger(322, 50, 5);
  return `<svg viewBox="0 0 360 170" class="hands">${L}${R}
    <text x="78" y="168" text-anchor="middle" font-size="12" fill="#7a746b">Left hand (LH)</text>
    <text x="282" y="168" text-anchor="middle" font-size="12" fill="#7a746b">Right hand (RH)</text></svg>`;
}

// ---------- Lesson 1 exercise generators ----------
const handTxt = (h, f) => `${h === "R" ? "Right hand" : "Left hand"} · finger ${f} (${FINGER_NAMES[f]})`;
const handShort = (h, f) => `${h}H ${f}`;
const rnd = n => Math.floor(Math.random() * n);
const shuffle = a => a.map(x => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map(p => p[1]);
const letterLabel = k => (store.settings.solf ? SOLF[k] + " (" + k + ")" : k);

function ordinalTask(ctx, k, extraSub) {
  const L = pick(ctx.es, LETTERS, ctx.prev);
  const ks = keysOfLetter(L, ctx.lo, ctx.hi);
  const n = Math.min(k, ks.length);
  const ords = shuffle(ks.map((_, i) => i + 1)).slice(0, n).sort((a, b) => a - b);
  const names = ords.map(o => ordinal(o));
  const list = names.length > 1 ? names.slice(0, -1).join(", ") + " and " + names[names.length - 1] : names[0];
  return {
    item: L,
    prompt: `Play the <b>${list} ${L}</b>`,
    sub: `Count ${L}'s from the lowest key of your keyboard. Any order.` + (extraSub ? `<div class="handline">${extraSub}</div>` : ""),
    targets: ords.map(o => ({ m: ks[o - 1], label: `${ordinal(o)} ${L}` })),
  };
}

function handTask(ctx, hand) {
  const L = pick(ctx.es, LETTERS, ctx.prev);
  const ks = keysOfLetter(L, ctx.lo, ctx.hi);
  let idx = ks.map((m, i) => i).filter(i => hand === "R" ? ks[i] >= MIDDLE_C - 5 : ks[i] <= MIDDLE_C + 7);
  if (!idx.length) idx = ks.map((_, i) => i);
  const i = idx[rnd(idx.length)], f = 1 + rnd(5);
  return {
    item: L,
    prompt: `Play the <b>${ordinal(i + 1)} ${L}</b>`,
    sub: `<div class="handline">${handTxt(hand, f)}</div>`,
    targets: [{ m: ks[i], label: `${ordinal(i + 1)} ${L}` }],
  };
}

function mixTask(ctx) {
  const letters = shuffle(LETTERS).slice(0, 3);
  let hand = Math.random() < 0.5 ? "L" : "R";
  const targets = letters.map(L => {
    const ks = keysOfLetter(L, ctx.lo, ctx.hi);
    let idx = ks.map((_, i) => i).filter(i => hand === "R" ? ks[i] >= MIDDLE_C - 5 : ks[i] <= MIDDLE_C + 7);
    if (!idx.length) idx = ks.map((_, i) => i);
    const i = idx[rnd(idx.length)], f = 1 + rnd(5);
    const t = { m: ks[i], item: L, label: `${ordinal(i + 1)} ${L} · ${handShort(hand, f)}` };
    hand = hand === "L" ? "R" : "L";
    return t;
  });
  return { item: letters.join(""), ordered: true, prompt: "Play in order:", sub: "Hands alternate. Count from the lowest key.", targets };
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
    blurb: "Find any key, count from the bottom, finger numbers.",
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
               ${namesTable()}
               <p class="muted">The English letters start from A = Ла. That's why C is До.</p>`,
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
        html: `<p>How many keys does your piano have? The exercises say things like <i>"play the 3rd F"</i>, counting from the lowest key — so this must match your real piano.</p>
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
               <p class="muted">Exercises write it short: <b>RH 2</b> = right hand, index finger; <b>LH 5</b> = left hand, pinky.</p>`,
        visual: h => { h.innerHTML = `<div class="card">${handsSvg()}</div>`; return {}; },
      },
      {
        title: "Connect your piano (optional)",
        html: `<p>You can tap the keys on screen, or play your real piano.</p>
               <p>To use your digital piano: connect its <b>USB to Host</b> port to your phone or laptop (on a phone you need an OTG adapter), open this app in <b>Chrome</b>, and press the button. The app will hear every key you press.</p>
               <button class="primary ghost" data-act="midi">🎹 Connect piano (MIDI)</button>
               <p class="muted midistatus"></p>
               <p class="muted">The app can check <i>which key</i> you played, but not which finger — that part is on your honour.</p>`,
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
      { id: "1.1", title: "Find them all", desc: "Play 3 different keys with the same letter.", tasks: 8,
        make: ctx => { const L = pick(ctx.es, LETTERS, ctx.prev); const n = Math.min(3, keysOfLetter(L, ctx.lo, ctx.hi).length);
          return { item: L, any: { letter: L, count: n }, prompt: `Play <b>${n} different ${L}</b> keys`, sub: "Any order, any finger." }; },
        itemKeys: () => LETTERS, label: letterLabel },
      { id: "1.2", title: "Count from the bottom", desc: "Play the 2nd, 3rd, 5th… of a letter.", tasks: 8,
        make: ctx => ordinalTask(ctx, 3), itemKeys: () => LETTERS, label: letterLabel },
      { id: "1.3", title: "Index finger only", desc: "Same, always with RH 2.", tasks: 8,
        make: ctx => ordinalTask(ctx, 2, handTxt("R", 2)), itemKeys: () => LETTERS, label: letterLabel },
      { id: "1.4", title: "Right hand, every finger", desc: "One key, a given RH finger.", tasks: 10,
        make: ctx => handTask(ctx, "R"), itemKeys: () => LETTERS, label: letterLabel },
      { id: "1.5", title: "Left hand, every finger", desc: "One key, a given LH finger.", tasks: 10,
        make: ctx => handTask(ctx, "L"), itemKeys: () => LETTERS, label: letterLabel },
      { id: "1.6", title: "Mix it up", desc: "3 keys in order, alternating hands and fingers.", tasks: 6,
        make: mixTask, itemKeys: () => LETTERS, label: letterLabel },
      { id: "1.7", title: "By note name", desc: "Play F4, C5, A3… with the right hand and finger.", tasks: 10,
        make: ctx => {
          const keys = noteRange(ctx.lo, ctx.hi);
          const k = pick(ctx.es, keys, ctx.prev);
          const L = k[0], oct = +k.slice(1), m = midiOf(L, oct);
          const hand = m < MIDDLE_C ? "L" : "R", f = 1 + rnd(5);
          return { item: k, prompt: `Play <b>${k}</b>`, sub: `<div class="handline">${handTxt(hand, f)}</div>`, targets: [{ m, label: k }] };
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
        html: `<p>The sign at the start is a <b>clef</b>. It tells you which note is which. This one is the <b>treble clef</b>, also called the <b>G clef</b> (ключ сол).</p>
               <p>Its curl wraps around <b>line 2</b>, and that line is <b>G4</b> — the G just above middle C. Everything else is counted from there.</p>
               <p class="muted">The treble clef is used for higher notes, which you usually play with the right hand.</p>`,
        visual: h => staffVisual(h, ["G4"]),
      },
      {
        title: "Line notes: E G B D F",
        html: `<p>The 5 lines, bottom to top, are <b>E G B D F</b> (Ми Сол Си Ре Фа).</p>
               <p>Remember it as <i>"<b>E</b>very <b>G</b>ood <b>B</b>oy <b>D</b>oes <b>F</b>ine"</i>.</p>`,
        visual: h => staffVisual(h, ["E4", "G4", "B4", "D5", "F5"]),
      },
      {
        title: "Space notes: F A C E",
        html: `<p>The 4 spaces, bottom to top, spell <b>F A C E</b> (Фа Ла До Ми) — like the word <i>"face"</i>.</p>`,
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
      { id: "2.1", type: "notes", title: "Line notes", desc: "E G B D F only.", keys: ["E4", "G4", "B4", "D5", "F5"] },
      { id: "2.2", type: "notes", title: "Space notes", desc: "F A C E only.", keys: ["F4", "A4", "C5", "E5"] },
      { id: "2.3", type: "notes", title: "The whole staff", desc: "E4 to F5, lines and spaces.", keys: TREBLE.filter(n => n.step >= 0 && n.step <= 8).map(n => n.key) },
      { id: "2.4", type: "notes", title: "With ledger lines", desc: "Full range B3 to B5.", keys: TREBLE.map(n => n.key) },
      { id: "2.5", type: "notes", title: "60-second challenge", desc: "How many can you name in a minute? Pass: 25.", keys: TREBLE.map(n => n.key), timed: true },
    ],
  },
  {
    id: "3",
    title: "Notes on the keyboard",
    blurb: "See a note, play it with the right hand. Coming next.",
    comingSoon: true,
    steps: [],
    levels: [],
  },
];
