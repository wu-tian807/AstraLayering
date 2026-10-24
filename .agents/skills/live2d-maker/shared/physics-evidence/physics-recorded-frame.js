// Evidence rendering only: install a complete recorded display state without
// integrating it again. This is not a checkpoint for resuming the solver.
export function applyRecordedFrame(scene, frame) {
  const fail = reason => { throw Error('无效物理记录帧：' + reason); };
  if (!frame || !Number.isInteger(frame.step) || frame.step < 0 || frame.time !== frame.step / 120) fail('step/time');
  const vector = (value, keys, label) => {
    if (!value || !keys.every(k => Number.isFinite(value[k]))) fail(label);
    return Object.fromEntries(keys.map(k => [k, value[k]]));
  };
  const sourcePose = vector(frame.sourcePose, ['x', 'y', 'angle'], 'sourcePose');
  const airflow = vector(frame.airflow, ['x', 'y'], 'airflow');
  if (!frame.components || Object.keys(frame.components).length !== scene.bodies.size) fail('组件数量');
  const finiteArray = (value, length, label) => {
    if (!Array.isArray(value) || value.length !== length || !value.every(Number.isFinite)) fail(label);
    return new Float64Array(value);
  };
  const states = [];
  for (const [id, body] of scene.bodies) {
    const row = frame.components[id];
    if (!row) fail('缺少组件 ' + id);
    const positions = finiteArray(row.positions, body.positions.length, id + '/positions');
    const pose = finiteArray(row.pose, body.pose.length, id + '/pose');
    const velocity = finiteArray(row.velocity, body.velocity.length, id + '/velocity');
    if (!row.stats || !['valid', 'fallback', 'limited'].every(k => typeof row.stats[k] === 'boolean') ||
        Object.values(row.stats).some(v => typeof v === 'number' && !Number.isFinite(v))) fail(id + '/stats');
    states.push({ body, positions, pose, velocity, stats: { ...row.stats } });
  }
  // Validate and copy every component before touching the shared scene, so a
  // damaged late component cannot leave a partially updated render state.
  for (const { body, positions, pose, velocity, stats } of states) {
    body.positions.set(positions); body.pose.set(pose); body.velocity.set(velocity); body.stats = stats;
  }
  scene.sourcePose = sourcePose; scene.airflow = airflow; scene.stepNumber = frame.step;
}
