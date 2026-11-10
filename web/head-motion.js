// Normalized display motion. Each half of Y bows the side limit inward;
// cardinal and corner endpoints remain reachable. This never edits keyforms.
const clamp = value => Math.max(-1, Math.min(1, value));
export const headSideLimit = y => 1 - 2 * Math.abs(y) * (1 - Math.abs(y));
export function constrainHeadPoint(point) {
  const y = clamp(point.y), limit = headSideLimit(y);
  return { x: Math.max(-limit, Math.min(limit, point.x)), y };
}
export function followHeadPointer(pointer, current, previous) {
  const desired = { x: clamp(pointer.x), y: clamp(pointer.y) };
  if (Math.abs(desired.x) <= headSideLimit(desired.y)) return desired;
  const side = Math.sign(desired.x);
  if (!previous || Math.sign(current.x) !== side || Math.abs(Math.abs(current.x) - headSideLimit(current.y)) > 1e-5)
    return constrainHeadPoint(desired);
  // Project pointer travel onto the boundary tangent. Pushing further into
  // the excluded region still slides along the curve in the travel direction.
  const slope = side * Math.sign(current.y) * (4 * Math.abs(current.y) - 2);
  const travel = ((pointer.x - previous.x) * slope + pointer.y - previous.y) / (1 + slope * slope);
  const y = clamp(current.y + travel);
  return { x: side * headSideLimit(y), y };
}
export function headPreviewAngles(point, axes) {
  const scale = (value, axis) => value * (value < 0 ? -axis.min : axis.max);
  let x = scale(point.x, axes.x), y = scale(point.y, axes.y);
  if (!axes.plane && x && y) {
    if (Math.abs(point.x) >= Math.abs(point.y)) y = 0;
    else x = 0;
  }
  return { x: x || 0, y: y || 0 };
}
