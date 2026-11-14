// Raster stages name layers with a depth number; assembly may add a namespace.
// `::region` and trailing ` | region` denote depth regions of one movable part.
export function layerPartName(label: string) {
  let name = label.trim();
  const stripDepth = () => { name = name.replace(/^[Dd]?\d+(?:\.\d+)?(?:\s*\|\s*|\s+)/, ''); };
  stripDepth();
  const prefix = name.match(/^(人物|衣服|衣装)\s*\|\s*/);
  const namespace = prefix ? prefix[1] === '人物' ? 'character:' : 'clothing:' : undefined;
  if (prefix) { name = name.slice(prefix[0].length); stripDepth(); }
  return { namespace, name: name.trim().replace(/\s+L\d+$/, '').split(/\s*\|\s*/).join('::') };
}
export function matchLayerPart(label: string, partIds: readonly string[]): string | null {
  const { namespace, name } = layerPartName(label);
  const length = (id: string) => id.length - id.indexOf(':');
  const candidates = partIds.filter(partId => {
    const id = partId.slice(partId.indexOf(':') + 1);
    return (!namespace || partId.startsWith(namespace)) &&
      (name === id || name.startsWith(id + '/') || name.startsWith(id + '::'));
  }).sort((a, b) => length(b) - length(a));
  return !candidates.length || candidates[1] && length(candidates[0]) === length(candidates[1]) ? null : candidates[0];
}
