import { extractPartMaps } from '../shared/character-render/part-maps.js';
import { buildMapSurface } from '../shared/character-render/surface-coverage.js';
self.onmessage = ({ data }) => {
  try {
    const { width, height, layers, normal, depth } = data;
    const maps = extractPartMaps(width, height, layers, normal, depth, layers.map(l => buildMapSurface([l])));
    const result = layers.map(l => ({ id:l.id, ...maps.get(l.id) }));
    self.postMessage({ maps:result }, result.flatMap(m => [m.data.buffer, m.confidence.buffer]));
  } catch (error) { self.postMessage({ error:error.message }); }
};
