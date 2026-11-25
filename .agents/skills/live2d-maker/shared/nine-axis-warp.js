// Bulk f64 warp evaluator. The synchronous scratch arena is private; no result
// keeps a view into it. Build the embedded module with scripts/build-warp.ts.
const binary = 'AGFzbQEAAAABOQZgAn98AXxgBXx8fHx8AXxgBn9/f3x8fwF8YAN/fHwCfHxgBH9/fHwCfHxgC39/f39/f39/f39/AAMHBgABAgMEBQUDAQAgBxACBm1lbW9yeQIAA3J1bgAFCoMGBiwAIAArAwBEAAAAAAAA4D8gAaIgACsDCCABIAArAxAgASAAKwMYoqCioKKgC10AIAFEAAAAAAAA4D8gBKIgAiAAoSAERAAAAAAAAABAIACiRAAAAAAAABRAIAGioUQAAAAAAAAQQCACoqAgA6EgBEQAAAAAAAAIQCABIAKhoiADoCAAoaKgoqCioAvWAQECfyAAKAIoBHwgACgCIEHAAGwhByAAKAIsIAIgB2wgAUHAAGxqIAVBIGxqaiEGIAYgAxAAIAYgB2ogAxAAIAYgB0ECbGogAxAAIAYgB0EDbGogAxAAIAQQAQUgACgCIEEDakEQbCEHIAAoAiwgAkEBaiAHbCABQQFqQRBsaiAFQQhsamohBiAGKwMARAAAAAAAAPA/IAOhoiAGKwMQIAOioEQAAAAAAADwPyAEoaIgBiAHaisDAEQAAAAAAADwPyADoaIgBiAHaisDECADoqAgBKKgCwuwAQMEfAJ/AnwgACgCILchAyAAKAIktyEERAAAAAAAAAAAIAMgASAAKwMAoSAAKwMQoyADoqSlIQVEAAAAAAAAAAAgBCACIAArAwihIAArAxijIASipKUhBiADRAAAAAAAAPA/oSAFnKSqIQcgBEQAAAAAAADwP6EgBpykqiEIIAUgB7ehIQkgBiAIt6EhCiABIAAgByAIIAkgCkEAEAKgIAIgACAHIAggCSAKQQEQAqALMgACQANAIAFBAEwNASAAKAIAIAIgAxADIQMhAiAAQQRqIQAgAUEBayEBDAALCyACIAMLuAEBBnwCQANAIAAgAk8NASADIAQgACoCALsgACoCBLsQBCEMIQsgBkEATiAIQQBOcQRAIAshDSAMIQ4gBSAGIAsgDBAEIRAhDyAHIAggDSAOEAQhDCELIA8gC6AgDaEhCyAQIAygIA6hIQwFIAUgBiALIAwQBCEMIQsgByAIIAsgDBAEIQwhCwsgCSAKIAsgDBAEIQwhCyABIAu2OAIAIAEgDLY4AgQgAEEIaiEAIAFBCGohAQwACwsL';
const { memory, run } = new WebAssembly.Instance(new WebAssembly.Module(Uint8Array.from(atob(binary), c => c.charCodeAt(0)))).exports;
let bytes, doubles, floats, words;
function reserve(size) {
  if (size > memory.buffer.byteLength) memory.grow(Math.ceil((size - memory.buffer.byteLength) / 65536));
  if (bytes?.buffer !== memory.buffer) {
    bytes = new Uint8Array(memory.buffer); doubles = new Float64Array(memory.buffer);
    floats = new Float32Array(memory.buffer); words = new Int32Array(memory.buffer);
  }
}
export function warpBatch(local, parents, axes, samples, out) {
  const chains = [[local], axes?.[0], axes?.[1], parents];
  const active = chains.map(chain => chain?.filter(w => !w[2]));
  const warps = [...new Set(active.flatMap(chain => chain ?? []))];
  let size = warps.length * 48 + active.reduce((n, chain) => n + (chain?.length ?? 0) * 4, 0);
  size = Math.ceil(size / 8) * 8;
  for (const w of warps) size += (w[4] ?? w[3]).byteLength;
  const input = size, output = input + samples.byteLength;
  reserve(output + out.byteLength);
  const addresses = new Map();
  let data = Math.ceil((warps.length * 48 + active.reduce((n, c) => n + (c?.length ?? 0) * 4, 0)) / 8) * 8;
  warps.forEach((warp, i) => {
    const node = warp[0], [x0, y0, x1, y1] = node.bbox, record = i * 48, values = warp[4] ?? warp[3];
    addresses.set(warp, record);
    doubles.set([x0, y0, x1 - x0, y1 - y0], record / 8);
    words.set([node.cols, node.rows, node.interpolation === 'smooth' ? 1 : 0, data], record / 4 + 8);
    doubles.set(values, data / 8); data += values.byteLength;
  });
  let list = warps.length * 48;
  const args = active.flatMap(chain => {
    const start = list;
    for (const w of chain ?? []) { words[list / 4] = addresses.get(w); list += 4; }
    return [start, chain?.length ?? -1];
  });
  floats.set(samples, input / 4);
  run(input, output, input + samples.byteLength, ...args);
  out.set(floats.subarray(output / 4, output / 4 + samples.length));
  return out;
}
