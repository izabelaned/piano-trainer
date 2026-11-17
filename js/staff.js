// Treble staff drawing in SVG.
const NS = "http://www.w3.org/2000/svg";
export const SP = 12, BOTTOM = 124;
export const yOf = s => BOTTOM - s * SP / 2;

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
  if (clef) {
    const t = el("text", { x: x1 + 4, y: yOf(2) + 13, "font-size": 70, class: "clef",
      "font-family": "'Noto Music','Bravura','Segoe UI Symbol','Apple Symbols',serif", fill: "#1d1b18" }, svg);
    t.textContent = "\u{1D11E}";
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
export function drawMeasure(svg, elems, { timeSig = false, width = 300 } = {}) {
  drawStaff(svg, { x1: 6, x2: width - 6 });
  const x0 = timeSig ? 100 : 82;
  if (timeSig) drawTimeSig(svg, 66);
  if (elems.length === 1) return [drawChord(svg, elems[0].steps, (x0 + width) / 2 + 10, { finger: elems[0].finger })];
  const end = width - 26, dx = (end - x0) / elems.length;
  const groups = elems.map((e, i) => drawChord(svg, e.steps, x0 + dx * (i + 0.45), { finger: e.finger }));
  drawBar(svg, width - 12, true);
  return groups;
}
