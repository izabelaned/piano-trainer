// Music helpers: MIDI numbers, note names, keyboard sizes.
export const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const WHITE_PCS = [0, 2, 4, 5, 7, 9, 11];
const SHARP_NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];

export const MIDDLE_C = 60;
export const isWhite = m => WHITE_PCS.includes(m % 12);
export const octaveOf = m => Math.floor(m / 12) - 1;
export const letterOf = m => (isWhite(m) ? LETTERS[WHITE_PCS.indexOf(m % 12)] : null);
export const nameOf = m => SHARP_NAMES[m % 12] + octaveOf(m);
export const midiOf = (letter, octave) => 12 * (octave + 1) + PC[letter];

// Lowest and highest MIDI note for common keyboard sizes.
export const SIZES = {
  25: [48, 72],   // C3–C5
  37: [48, 84],   // C3–C6
  49: [36, 84],   // C2–C6
  61: [36, 96],   // C2–C7
  76: [28, 103],  // E1–G7
  88: [21, 108],  // A0–C8
};

// All MIDI numbers of a given letter on a keyboard, lowest first.
export function keysOfLetter(letter, lo, hi) {
  const out = [];
  for (let m = lo; m <= hi; m++) if (letterOf(m) === letter) out.push(m);
  return out;
}

export const ordinal = n => n + (n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th");

export const FINGER_NAMES = { 1: "thumb", 2: "index", 3: "middle", 4: "ring", 5: "pinky" };

// Treble-clef notes B3..B5 with their staff step (diatonic steps above E4).
export const TREBLE = [];
(function () {
  let li = 6, oct = 3;
  for (let s = -3; s <= 11; s++) {
    TREBLE.push({ letter: LETTERS[li], octave: oct, step: s, key: LETTERS[li] + oct });
    if (++li === 7) { li = 0; oct++; }
  }
})();
export const TREBLE_BY_KEY = Object.fromEntries(TREBLE.map(n => [n.key, n]));

// Bass-clef notes D2..D4 with their staff step (diatonic steps above G2, the bottom line).
export const BASS = [];
(function () {
  let li = 1, oct = 2;                         // start at D2
  for (let s = -3; s <= 11; s++) {
    BASS.push({ letter: LETTERS[li], octave: oct, step: s, key: LETTERS[li] + oct });
    if (++li === 7) { li = 0; oct++; }
  }
})();
export const BASS_BY_KEY = Object.fromEntries(BASS.map(n => [n.key, n]));
export const byClef = clef => (clef === "bass" ? BASS_BY_KEY : TREBLE_BY_KEY);
