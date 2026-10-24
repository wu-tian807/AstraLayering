// A spatially uniform air input with several slow gust frequencies. It is fed
// into the solver as acceleration; no part receives a scripted displacement.
export function airflowAt(time, strength = .2, direction = 0) {
  const gust = .55 + .28 * Math.sin(time * 1.3) + .17 * Math.sin(time * 2.17 + .8);
  const side = .12 * Math.sin(time * .91 + .4), c = Math.cos(direction), s = Math.sin(direction);
  return { x: strength * (gust * c - side * s), y: strength * (gust * s + side * c) };
}
