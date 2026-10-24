/** Solve the seeded alpha component's discrete Laplace field. Measured texels
 * are Dirichlet constraints; alpha holes are no-flux edges. Sparse Jacobi-PCG
 * converges across large occlusions without a fixed number of local sweeps.
 * This portable kernel is also used by AstraLayering's surface preview. */
export function harmonicFill(data, width, visited, hidden) {
  const count = hidden.length;
  if (!count) return;
  const index = new Int32Array(visited.length).fill(-1);
  for (let i = 0; i < count; i++) index[hidden[i]] = i;
  const adjacent = new Int32Array(count * 4).fill(-1), degree = new Uint8Array(count);
  const boundary = new Float64Array(count * 4);
  for (let i = 0; i < count; i++) {
    const p = hidden[i], x = p % width;
    for (let dir = 0; dir < 4; dir++) {
      const q = p + (dir === 0 ? -1 : dir === 1 ? 1 : dir === 2 ? -width : width);
      if (dir === 0 && x === 0 || dir === 1 && x === width - 1 || q < 0 || q >= visited.length || !visited[q]) continue;
      degree[i]++;
      if (index[q] >= 0) adjacent[i * 4 + dir] = index[q];
      else for (let c = 0; c < 4; c++) boundary[i * 4 + c] += data[q * 4 + c];
    }
  }
  const values = new Float64Array(count), residual = new Float64Array(count), direction = new Float64Array(count), product = new Float64Array(count);
  const multiply = (input, output) => {
    for (let i = 0; i < count; i++) {
      let sum = degree[i] * input[i];
      for (let dir = 0; dir < 4; dir++) { const j = adjacent[i * 4 + dir]; if (j >= 0) sum -= input[j]; }
      output[i] = sum;
    }
  };
  const limit = Math.min(1600, Math.max(96, Math.ceil(Math.sqrt(count) * 4)));
  for (let c = 0; c < 4; c++) {
    for (let i = 0; i < count; i++) values[i] = data[hidden[i] * 4 + c];
    multiply(values, product);
    let rho = 0, error = 0;
    for (let i = 0; i < count; i++) {
      residual[i] = boundary[i * 4 + c] - product[i];
      direction[i] = residual[i] / degree[i];
      rho += residual[i] * direction[i]; error = Math.max(error, Math.abs(residual[i]));
    }
    for (let iteration = 0; iteration < limit && error > .0125; iteration++) {
      multiply(direction, product);
      let denominator = 0;
      for (let i = 0; i < count; i++) denominator += direction[i] * product[i];
      if (!(denominator > 1e-20)) break;
      const alpha = rho / denominator;
      let nextRho = 0; error = 0;
      for (let i = 0; i < count; i++) {
        values[i] += alpha * direction[i]; residual[i] -= alpha * product[i];
        nextRho += residual[i] * residual[i] / degree[i]; error = Math.max(error, Math.abs(residual[i]));
      }
      const beta = nextRho / rho;
      for (let i = 0; i < count; i++) direction[i] = residual[i] / degree[i] + beta * direction[i];
      rho = nextRho;
    }
    for (let i = 0; i < count; i++) data[hidden[i] * 4 + c] = Math.max(0, Math.min(255, Math.round(values[i])));
  }
}
