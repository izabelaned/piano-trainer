// Two hands seen from above (palms down), fingers only, drawn as rounded tubes.
// Fingers are numbered 1 (thumb) to 5 (pinky); one finger can be highlighted, e.g. { hand: "L", finger: 4 }.
import { FINGER_NAMES } from "./music.js";

const ORD = { 1: "1st", 2: "2nd", 3: "3rd", 4: "4th", 5: "5th" };
const SKIN = "#e8ddd0", HOT = "#3d5a80", NUM = "#8a8176";

// Right hand, fingers pointing up. [finger, base x, base y, length, angle in degrees]
const FINGERS = [
  [1, 34, 112, 44, -32],
  [2, 52, 92, 70, -7],
  [3, 75, 88, 78, 0],
  [4, 98, 91, 72, 6],
  [5, 119, 98, 56, 13],
];
const W = 19;

function hand(side, sel) {
  const active = sel && sel.hand === side;
  const dim = sel && !active;
  let fingers = "", nums = "";
  FINGERS.forEach(([n, x, y, len, ang]) => {
    const on = active && sel.finger === n;
    fingers += `<rect x="${x - W / 2}" y="${y - len}" width="${W}" height="${len}" rx="${W / 2}"
      transform="rotate(${ang} ${x} ${y})" fill="${on ? HOT : SKIN}"/>`;
    // number near the fingertip, kept upright even on the mirrored hand
    const rad = ang * Math.PI / 180;
    const tx = x + Math.sin(rad) * (len - 12), ty = y - Math.cos(rad) * (len - 12);
    nums += `<text x="${side === "L" ? 145 - tx : tx}" y="${ty + 5}" text-anchor="middle" font-size="13" font-weight="700"
      fill="${on ? "#fff" : NUM}">${n}</text>`;
  });
  const shape = `<g${side === "L" ? ' transform="translate(145 0) scale(-1 1)"' : ""}>${fingers}</g>`;
  const label = `<text x="72.5" y="142" text-anchor="middle" font-size="12" font-weight="${active ? 700 : 400}" fill="${active ? HOT : NUM}">${side === "L" ? "Left hand" : "Right hand"}</text>`;
  return `<g transform="translate(${side === "L" ? 20 : 195} 0)" opacity="${dim ? 0.35 : 1}">${shape}${nums}${label}</g>`;
}

export function handsSvg(sel = null) {
  return `<svg viewBox="0 6 360 142" class="hands">${hand("L", sel)}${hand("R", sel)}</svg>`;
}

export function handWords(hand, finger) {
  return `${hand === "R" ? "Right hand" : "Left hand"} · ${ORD[finger]} finger (${FINGER_NAMES[finger]})`;
}
