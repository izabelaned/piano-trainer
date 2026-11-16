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
