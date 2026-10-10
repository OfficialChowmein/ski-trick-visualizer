// Trick catalogue. Everything else (phases, airtime, rates) is computed from these numbers.
//
// spin    degrees of rotation around the vertical axis (positive = counter-clockwise seen from above)
// flips   number of full inversions (positive = backward / heels over head, negative = forward)
// axis    flip axis angle in degrees: 0 = lateral axis (straight back/front flip),
//         90 = forward axis (cartwheel). Corks sit in between.
// family  which body-shape sequence to use (see poses.js)
// switchIn  rider approaches backward

export const CATEGORIES = ['Spins', 'Flips', 'Corks', 'Specialty', 'Switch'];

export const TRICKS = [
  { id: '180', name: '180', cat: 'Spins', spin: 180, flips: 0, axis: 0, family: 'spin', grab: false },
  { id: '360', name: '360', cat: 'Spins', spin: 360, flips: 0, axis: 0, family: 'spin', grab: false },
  { id: '540', name: '540', cat: 'Spins', spin: 540, flips: 0, axis: 0, family: 'spin', grab: true },
  { id: '720', name: '720', cat: 'Spins', spin: 720, flips: 0, axis: 0, family: 'spin', grab: true },
  { id: '900', name: '900', cat: 'Spins', spin: 900, flips: 0, axis: 0, family: 'spin', grab: true },
  { id: '1080', name: '1080', cat: 'Spins', spin: 1080, flips: 0, axis: 0, family: 'spin', grab: true },

  { id: 'backflip', name: 'Backflip', cat: 'Flips', spin: 0, flips: 1, axis: 0, family: 'flip', grab: false },
  { id: 'frontflip', name: 'Frontflip', cat: 'Flips', spin: 0, flips: -1, axis: 0, family: 'flip', grab: false },
  { id: 'dubflip', name: 'Double backflip', cat: 'Flips', spin: 0, flips: 2, axis: 0, family: 'flip', grab: false },
  { id: 'lincoln', name: 'Lincoln loop', cat: 'Flips', spin: 0, flips: 1, axis: 90, family: 'flip', grab: false },

  { id: 'cork540', name: 'Cork 540', cat: 'Corks', spin: 540, flips: 1, axis: 45, family: 'cork', grab: true },
  { id: 'cork720', name: 'Cork 720', cat: 'Corks', spin: 720, flips: 1, axis: 45, family: 'cork', grab: true },
  { id: 'cork900', name: 'Cork 900', cat: 'Corks', spin: 900, flips: 1, axis: 45, family: 'cork', grab: true },
  { id: 'dc1080', name: 'Dub cork 1080', cat: 'Corks', spin: 1080, flips: 2, axis: 45, family: 'cork', grab: true },
  { id: 'dc1260', name: 'Dub cork 1260', cat: 'Corks', spin: 1260, flips: 2, axis: 45, family: 'cork', grab: true },
  { id: 'dc1620', name: 'Dub cork 1620', cat: 'Corks', spin: 1620, flips: 2, axis: 45, family: 'cork', grab: true },
  { id: 'tc1620', name: 'Triple cork 1620', cat: 'Corks', spin: 1620, flips: 3, axis: 45, family: 'cork', grab: true },

  { id: 'misty540', name: 'Misty 540', cat: 'Specialty', spin: 540, flips: -1, axis: 30, family: 'cork', grab: true },
  { id: 'misty720', name: 'Misty 720', cat: 'Specialty', spin: 720, flips: -1, axis: 30, family: 'cork', grab: true },
  { id: 'rodeo540', name: 'Rodeo 540', cat: 'Specialty', spin: 540, flips: 1, axis: 25, family: 'cork', grab: true },
  { id: 'rodeo720', name: 'Rodeo 720', cat: 'Specialty', spin: 720, flips: 1, axis: 25, family: 'cork', grab: true },
  { id: 'bio900', name: 'Bio 900', cat: 'Specialty', spin: 900, flips: 1, axis: 65, family: 'cork', grab: true },

  { id: 'sw540', name: 'Switch 540', cat: 'Switch', spin: 540, flips: 0, axis: 0, family: 'spin', grab: true, switchIn: true },
  { id: 'sw900', name: 'Switch 900', cat: 'Switch', spin: 900, flips: 0, axis: 0, family: 'spin', grab: true, switchIn: true },
  { id: 'swdc1080', name: 'Switch dub cork 1080', cat: 'Switch', spin: 1080, flips: 2, axis: 45, family: 'cork', grab: true, switchIn: true },
  { id: 'swdc1260', name: 'Switch dub cork 1260', cat: 'Switch', spin: 1260, flips: 2, axis: 45, family: 'cork', grab: true, switchIn: true },
];

// Plain-language decoding of the name, shown under the title.
export function explain(t) {
  const parts = [];
  if (t.switchIn) parts.push('Takes off skiing backward (switch).');
  if (t.spin) parts.push(`${t.spin}° of spin = ${t.spin / 360} turn${t.spin === 360 ? '' : 's'} around the vertical.`);
  const n = Math.abs(t.flips);
  if (n) {
    const dir = t.flips > 0 ? 'backward' : 'forward';
    const kind = t.axis === 0 ? `straight ${dir} flip` : t.axis >= 80 ? 'sideways cartwheel' : `off-axis ${dir} flip (axis tilted ${t.axis}°)`;
    parts.push(`${n} ${kind}${n > 1 ? 's' : ''}: upside down ${n} time${n > 1 ? 's' : ''}.`);
  }
  const lands = ((t.spin / 180) % 2 === 1) !== !!t.switchIn ? 'Lands switch.' : 'Lands forward.';
  parts.push(lands);
  return parts.join(' ');
}
