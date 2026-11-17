// Two hands seen from above (palms down), fingers numbered 1 (thumb) to 5 (pinky).
// Optionally one finger is highlighted, e.g. { hand: "L", finger: 4 }.
import { FINGER_NAMES } from "./music.js";

const ORD = { 1: "1st", 2: "2nd", 3: "3rd", 4: "4th", 5: "5th" };

export function handsSvg(sel = null) {
  const skin = "#f3d9c4", line = "#b98d6c", hot = "#3d5a80";
  const finger = (hand, x, h, n, w = 22) => {
    const on = sel && sel.hand === hand && sel.finger === n;
    return `<rect x="${x}" y="${100 - h}" width="${w}" height="${h}" rx="11" fill="${on ? hot : skin}" stroke="${on ? hot : line}"/>
      <text x="${x + w / 2}" y="${100 - h + 18}" text-anchor="middle" font-size="14" font-weight="700" fill="${on ? "#fff" : "#1d1b18"}">${n}</text>`;
  };
  const palm = x => `<rect x="${x}" y="92" width="128" height="60" rx="24" fill="${skin}" stroke="${line}"/>`;
  const dim = hand => (sel && sel.hand !== hand ? ' opacity="0.35"' : "");
  // left hand: pinky on the left, thumb on the right; right hand mirrored
  const L = `<g${dim("L")}>` + palm(14) + finger("L", 14, 50, 5) + finger("L", 40, 70, 4) + finger("L", 66, 78, 3) + finger("L", 92, 70, 2) + finger("L", 128, 36, 1, 24) + "</g>";
  const R = `<g${dim("R")}>` + palm(218) + finger("R", 206, 36, 1, 24) + finger("R", 244, 70, 2) + finger("R", 270, 78, 3) + finger("R", 296, 70, 4) + finger("R", 322, 50, 5) + "</g>";
  const lab = (x, hand, txt) => `<text x="${x}" y="168" text-anchor="middle" font-size="12" font-weight="${sel && sel.hand === hand ? 700 : 400}" fill="${sel && sel.hand === hand ? hot : "#7a746b"}">${txt}</text>`;
  return `<svg viewBox="0 0 360 172" class="hands">${L}${R}${lab(78, "L", "Left hand (LH)")}${lab(282, "R", "Right hand (RH)")}</svg>`;
}

export function handWords(hand, finger) {
  return `${hand === "R" ? "Right hand" : "Left hand"} · ${ORD[finger]} finger (${FINGER_NAMES[finger]})`;
}
