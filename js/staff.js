// Treble staff drawing in SVG.
const NS = "http://www.w3.org/2000/svg";
export const SP = 12, BOTTOM = 124;
export const yOf = s => BOTTOM - s * SP / 2;
// The font draws clefs on the bottom staff line as baseline, with 1 staff space = 250 font units.
const CLEF_SCALE = (SP) / 250;

export function el(tag, attrs, parent) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  parent.appendChild(e);
  return e;
}

export function drawStaff(svg, { x1 = 10, x2 = 290, clef = true } = {}) {
  for (let i = 0; i < 5; i++) {
    const y = yOf(i * 2);
    el("line", { x1, x2, y1: y, y2: y, stroke: "#1d1b18", "stroke-width": 1.2, class: "staffline", "data-i": i }, svg);
  }
  // Clefs are drawn as outlines (from the Noto Music font, SIL Open Font License),
  // so they look the same on every device even if the web font doesn't load.
  if (clef === "bass") {
    el("path", { d: BASS_CLEF, class: "clef", fill: "#1d1b18", transform: `translate(${x1 + 4} ${yOf(0) - SP / 2}) scale(${CLEF_SCALE} ${-CLEF_SCALE})` }, svg);
  } else if (clef) {
    el("path", { d: TREBLE_CLEF, class: "clef", fill: "#1d1b18", transform: `translate(${x1 + 2} ${yOf(0)}) scale(${CLEF_SCALE} ${-CLEF_SCALE})` }, svg);
  }
}

// Draw one note at staff step `step`, x position `x`. Returns the group.
export function drawNote(svg, step, x, { color = "#1d1b18", stem = true } = {}) {
  const g = el("g", {}, svg);
  for (let s = -2; s >= step; s -= 2) el("line", { x1: x - 14, x2: x + 14, y1: yOf(s), y2: yOf(s), stroke: "#1d1b18", "stroke-width": 1.2 }, g);
  for (let s = 10; s <= step; s += 2) el("line", { x1: x - 14, x2: x + 14, y1: yOf(s), y2: yOf(s), stroke: "#1d1b18", "stroke-width": 1.2 }, g);
  const y = yOf(step);
  el("ellipse", { cx: x, cy: y, rx: 7.6, ry: 5.4, fill: color, transform: `rotate(-20 ${x} ${y})` }, g);
  if (stem) {
    if (step < 4) el("line", { x1: x + 6.8, x2: x + 6.8, y1: y - 1, y2: y - 36, stroke: color, "stroke-width": 1.5 }, g);
    else el("line", { x1: x - 6.8, x2: x - 6.8, y1: y + 1, y2: y + 36, stroke: color, "stroke-width": 1.5 }, g);
  }
  return g;
}

export function svgEl(viewBox, cls = "") {
  const s = document.createElementNS(NS, "svg");
  s.setAttribute("viewBox", viewBox);
  if (cls) s.setAttribute("class", cls);
  return s;
}

// Chord / single note with classes so it can be recoloured later.
export function drawChord(svg, steps, x, { color = "#1d1b18", stem = true, finger = null } = {}) {
  const g = el("g", { class: "chord" }, svg);
  const lo = Math.min(...steps), hi = Math.max(...steps);
  for (let s = -2; s >= lo; s -= 2) el("line", { x1: x - 14, x2: x + 14, y1: yOf(s), y2: yOf(s), stroke: "#1d1b18", "stroke-width": 1.2 }, g);
  for (let s = 10; s <= hi; s += 2) el("line", { x1: x - 14, x2: x + 14, y1: yOf(s), y2: yOf(s), stroke: "#1d1b18", "stroke-width": 1.2 }, g);
  steps.forEach(s => el("ellipse", { class: "head", cx: x, cy: yOf(s), rx: 7.6, ry: 5.4, fill: color, transform: `rotate(-20 ${x} ${yOf(s)})` }, g));
  const up = (lo + hi) / 2 < 4;
  if (stem) {
    if (up) el("line", { class: "stem", x1: x + 6.8, x2: x + 6.8, y1: yOf(lo) - 1, y2: yOf(hi) - 36, stroke: color, "stroke-width": 1.5 }, g);
    else el("line", { class: "stem", x1: x - 6.8, x2: x - 6.8, y1: yOf(hi) + 1, y2: yOf(lo) + 36, stroke: color, "stroke-width": 1.5 }, g);
  }
  if (finger != null) {
    const fs = (Array.isArray(finger) ? [...finger] : [finger]).sort((a, b) => a - b);   // lowest finger at the bottom
    const y = Math.min(stem && up ? yOf(hi) - 44 : yOf(hi) - 14, 62);
    fs.forEach((f, i) => {
      const t = el("text", { x, y: y - i * 13, "text-anchor": "middle", "font-size": 13, "font-weight": 700, fill: "#3d5a80", class: "finger" }, g);
      t.textContent = f;
    });
  }
  return g;
}

export function colorChord(g, color) {
  g.querySelectorAll(".head").forEach(e => e.setAttribute("fill", color));
  g.querySelectorAll(".stem").forEach(e => e.setAttribute("stroke", color));
}

export function drawTimeSig(svg, x) {
  [[6, "4"], [2, "4"]].forEach(([s, n]) => {
    const t = el("text", { x, y: yOf(s) + 8, "text-anchor": "middle", "font-size": 25, "font-weight": 800, fill: "#1d1b18", "font-family": "Georgia,serif" }, svg);
    t.textContent = n;
  });
}

export function drawBar(svg, x, final = false) {
  el("line", { x1: x, x2: x, y1: yOf(0), y2: yOf(8), stroke: "#1d1b18", "stroke-width": 1.2 }, svg);
  if (final) el("line", { x1: x + 4, x2: x + 4, y1: yOf(0), y2: yOf(8), stroke: "#1d1b18", "stroke-width": 3.5 }, svg);
}

// A bar of notes/chords. elems: [{ steps:[...], finger }]. Returns chord groups.
export function drawMeasure(svg, elems, { timeSig = false, width = 300, clef = true } = {}) {
  drawStaff(svg, { x1: 6, x2: width - 6, clef });
  const x0 = timeSig ? 100 : 82;
  if (timeSig) drawTimeSig(svg, 66);
  if (elems.length === 1) return [drawChord(svg, elems[0].steps, (x0 + width) / 2 + 10, { finger: elems[0].finger })];
  const end = width - 26, dx = (end - x0) / elems.length;
  const groups = elems.map((e, i) => drawChord(svg, e.steps, x0 + dx * (i + 0.45), { finger: e.finger }));
  // in 4/4 every 4 notes make a bar
  if (timeSig) for (let i = 4; i < elems.length; i += 4) drawBar(svg, x0 + dx * (i - 0.08));
  drawBar(svg, width - 12, true);
  return groups;
}

// Glyph outlines (font units, 1000 per em) from Noto Music — Copyright 2022 The Noto Project Authors,
// SIL Open Font License 1.1.
const TREBLE_CLEF = "M314 801Q300 854 291.0 906.0Q282 958 282 1012Q282 1059 288.5 1100.5Q295 1142 307 1177Q320 1217 341.0 1252.5Q362 1288 385.5 1311.0Q409 1334 427 1334Q451 1334 493 1249Q514 1206 524.0 1156.0Q534 1106 534 1049Q534 978 515.0 907.5Q496 837 459.5 775.0Q423 713 372 666L407 498Q422 500 432.0 501.0Q442 502 447 502Q508 502 556.0 467.5Q604 433 632.5 377.0Q661 321 661 254Q661 177 621.5 115.5Q582 54 503 25Q508 8 532 -117Q538 -147 541.0 -164.5Q544 -182 545.0 -195.0Q546 -208 546 -225Q546 -275 521.5 -314.5Q497 -354 455.5 -376.0Q414 -398 363 -398Q311 -398 271.0 -378.5Q231 -359 208.0 -324.5Q185 -290 185 -245Q185 -197 211.5 -165.0Q238 -133 287 -133Q329 -133 355.5 -163.5Q382 -194 382 -236Q382 -272 357.0 -299.0Q332 -326 292 -326H282Q308 -365 364 -365Q433 -365 472.0 -320.0Q511 -275 511 -205Q511 -188 507.0 -159.5Q503 -131 493 -91Q483 -51 477.5 -25.0Q472 1 470 12Q436 2 390 2Q304 2 222 52Q142 102 96.0 184.0Q50 266 50 361Q50 451 91 530Q132 609 192.5 675.0Q253 741 314 801ZM341 826Q364 838 390.0 870.5Q416 903 440.0 945.0Q464 987 479.0 1029.5Q494 1072 494 1106Q494 1142 483.0 1163.0Q472 1184 445 1184Q421 1184 398.5 1162.0Q376 1140 358.5 1103.5Q341 1067 331.0 1022.0Q321 977 321 930Q321 898 327.5 872.0Q334 846 341 826ZM398 379Q371 373 347.0 353.5Q323 334 308.5 306.5Q294 279 294 248Q294 223 307.0 196.5Q320 170 339 154Q352 142 365 136Q380 129 380 123Q380 120 370 117Q332 126 301.5 151.0Q271 176 253.5 211.5Q236 247 236 287Q236 330 253.5 370.0Q271 410 302.5 442.0Q334 474 374 490L345 641Q229 547 174.5 456.5Q120 366 120 277Q120 212 154.0 156.0Q188 100 247.0 65.5Q306 31 380 31Q400 31 420.5 35.0Q441 39 464 45ZM495 55Q593 97 593 227Q593 270 571.0 305.5Q549 341 512.0 362.0Q475 383 429 383Z";
const BASS_CLEF = "M50 123Q216 231 288 301Q336 348 373.0 408.5Q410 469 431.5 536.0Q453 603 453 669Q453 728 435.0 773.5Q417 819 383.0 845.0Q349 871 302 871Q284 871 264.5 867.0Q245 863 224 855Q181 839 158.0 813.5Q135 788 135 765Q135 756 143.0 752.0Q151 748 158 748Q168 748 183 752Q190 754 196.5 755.0Q203 756 210 756Q248 756 272.0 733.5Q296 711 296 674Q296 638 266.0 612.0Q236 586 195 586Q146 586 111.0 617.0Q76 648 76 697Q76 756 109.0 802.0Q142 848 198.5 874.0Q255 900 324 900Q400 900 460.0 867.0Q520 834 555.5 776.5Q591 719 591 646Q591 551 538 464Q511 419 476.5 379.0Q442 339 389.0 297.5Q336 256 256.0 208.0Q176 160 57 101ZM687 809Q710 809 726.0 793.0Q742 777 742 754Q742 731 726.0 715.5Q710 700 687 700Q664 700 648.0 715.5Q632 731 632 754Q632 777 648.0 793.0Q664 809 687 809ZM687 589Q710 589 726.0 573.0Q742 557 742 534Q742 511 726.0 495.5Q710 480 687 480Q664 480 648.0 495.5Q632 511 632 534Q632 557 648.0 573.0Q664 589 687 589Z";
