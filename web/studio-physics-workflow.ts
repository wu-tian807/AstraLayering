// The workbench projects recorded artifacts; simulation and review remain skill-owned.
import { join } from 'node:path';
import { lstat } from 'node:fs/promises';
import { jsonFile, safePath } from './files.ts';
import { configHash, simulationHash, evidenceVersion } from '../.agents/skills/live2d-maker/shared/physics-evidence/store.ts';
import { renderFingerprint } from '../.agents/skills/live2d-maker/shared/character-render/render-frames.ts';
import { groupAssemblies } from '../.agents/skills/live2d-maker/shared/physics-core/assemblies.js';

const list = (value: any): any[] => Array.isArray(value) ? value : [];
const evidenceRoot = 'physics/step03/evidence';
const urlFor = (name: string, dir: string, path: string, hash: string) =>
  './studio-physics-artifact?' + new URLSearchParams({ name, dir, path, hash });
const readableArtifact = (path: unknown): path is string => typeof path === 'string'
  && /\.(png|svg)$/.test(path) && !path.split(/[\\/]/).some(part => part === '..' || part.startsWith('.'));

async function readRecords(directory: string, artifactsOnly = false) {
  const paths = artifactsOnly ? ['step03/evidence/manifest.json', 'step03/evidence/frames.json']
    : ['physics.json', 'manual-review.json', 'run.json', 'step01/analysis.json', 'step01/coverage.json',
    'step02/coverage.json', 'step02/assemblies.json', 'step02/tuning.json', 'step02/result.json', 'step02/initialization.json', 'step03/findings.json',
    'step03/feedback.json', 'step03/evidence/manifest.json', 'step03/evidence/frames.json'];
  const records = await Promise.all(paths.map(path => jsonFile(directory, 'physics/' + path)));
  return Object.fromEntries(paths.map((path, i) => [path, records[i]]));
}

async function currentEvidence(records: any, config: any, directory: string) {
  const manifest = records['step03/evidence/manifest.json'];
  const digest = config ? configHash(config) : null;
  const configMatches = !!digest && manifest?.configHash === digest;
  const solverMatches = configMatches && manifest?.version === evidenceVersion && manifest?.simulationHash === await simulationHash();
  let renderMatches = false;
  // Only producer-owned preview/source directories can validate rendered evidence.
  if (solverMatches && manifest.renderDirectory) {
    const source = join(directory, manifest.renderSource === 'assembled' ? 'physics/source' : 'physics/preview');
    const declared = join(directory, evidenceRoot, manifest.renderDirectory);
    if (declared === source) {
      try { renderMatches = manifest.renderHash === await renderFingerprint(await safePath(directory, manifest.renderSource === 'assembled' ? 'physics/source' : 'physics/preview')); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    }
  }
  return { configHash: digest, configMatches, solverMatches: !!solverMatches, renderMatches,
    evidenceMatchesCurrent: !!solverMatches && renderMatches };
}

export async function studioPhysicsWorkflow(directory: string, name: string, dir: string, configPath?: string) {
  const records = await readRecords(directory);
  const formal = records['physics.json'];
  const config = configPath ? await jsonFile(directory, configPath) : formal;
  if (!config && !records['step01/analysis.json']) return null;
  const provenance = await currentEvidence(records, config, directory);
  const manifest = records['step03/evidence/manifest.json'];
  const findings = records['step03/findings.json'];
  const manualReview = records['manual-review.json'];
  const manual = manualReview?.configHash === provenance.configHash
    || config?.review?.workflowAccepted === false && config?.review?.authoring?.startsWith('manual-');
  const tuning = records['step02/tuning.json'];
  const calibrationMatches = !!tuning && tuning.configHash === provenance.configHash && tuning.solverHash === await simulationHash();
  const markers = await Promise.all(['step01', 'step02', 'step03'].map(async stage => {
    try { return (await lstat(await safePath(directory, 'physics/' + stage + '/.completed'))).isFile(); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false; throw error; }
  }));
  // Candidate selection can finish while the author rejects the actual motion.
  // A matching record is still a failed B delivery; it cannot advance to C.
  const authorResult = records['step02/result.json'];
  const authorFailed = !markers[1] && calibrationMatches
    && ['blocked', 'failed'].includes(authorResult?.status);
  const workflowAccepted = !manual && configPath !== 'physics/physics.draft.json' && provenance.evidenceMatchesCurrent
    && markers[2] && findings?.configHash === provenance.configHash && config?.review?.status === 'accepted';
  const indexed = list(records['step03/evidence/frames.json']).filter(frame =>
    provenance.evidenceMatchesCurrent && frame.configHash === provenance.configHash && frame.renderHash === manifest.renderHash);
  const allowed = new Set(indexed.map(frame => frame.path));
  const image = (ref: any) => {
    const path = typeof ref === 'string' ? ref : ref?.path;
    return { path, ...(allowed.has(path) && readableArtifact(path)
      ? { url: urlFor(name, dir, path, provenance.configHash!) } : {}) };
  };
  const findingsCurrent = findings?.configHash === provenance.configHash && provenance.evidenceMatchesCurrent;
  const findingImage = (ref: any) => findingsCurrent ? image(ref) : { path: typeof ref === 'string' ? ref : ref?.path };
  const linkedFindings = findings ? { ...findings, current: findingsCurrent, components: list(findings.components).map(component => ({ ...component,
    criteria: Object.fromEntries(Object.entries(component.criteria || {}).map(([key, value]: any) =>
      [key, { ...value, images: list(value.images).map(findingImage) }])) })) } : null;
  const feedback = records['step03/feedback.json'];
  const linkedFeedback = feedback ? { ...feedback, items: list(feedback.items).map(item => ({ ...item,
    images: list(item.images).map(ref => feedback.configHash === provenance.configHash ? image(ref) : { path: typeof ref === 'string' ? ref : ref?.path }) })) } : null;
  return {
    version: 1, source: manual ? 'manual' : 'workflow', profile: config?.profile || records['run.json']?.sourceInput?.profile,
    provenance: { ...provenance, manualReview: manualReview?.configHash === provenance.configHash ? manualReview : null, workflowAccepted },
    stages: [
      { id: 'analysis', status: markers[0] ? 'completed' : records['step01/analysis.json'] ? 'draft' : 'pending' },
      { id: 'calibration', status: authorFailed ? 'failed' : calibrationMatches && tuning.status === 'calibrated' && markers[1] ? 'completed'
        : tuning && !calibrationMatches ? 'stale' : tuning ? 'draft' : 'pending',
        reason: authorFailed ? '候选已选定，运动或画面预检未通过。' : !tuning ? '当前版本尚无装配标定记录。' : !calibrationMatches ? '配置或求解器已变化，标定记录需要更新。' : '' },
      { id: 'review', status: workflowAccepted ? 'accepted' : authorFailed && !manifest && !markers[2] ? 'not-started'
        : manifest && !provenance.evidenceMatchesCurrent ? 'stale' : markers[2] ? 'draft' : 'pending',
        reason: authorFailed && !manifest && !markers[2] ? '制作标定未通过，独立复核尚未启动。'
          : manifest && !provenance.evidenceMatchesCurrent ? '配置、求解器或渲染输入已变化，旧证据需要更新。' : '' },
    ],
    coverage: records['step02/coverage.json'] || records['step01/coverage.json'] || null,
    assemblies: records['step02/assemblies.json']?.configHash === provenance.configHash ? records['step02/assemblies.json']
      : config ? { version: 1, configHash: provenance.configHash, source: 'current-config', groups: groupAssemblies(config) } : null,
    // The panel compares this generation's measured candidates. Archived
    // generations remain in the producer artifact, not every browser response.
    tuning: tuning ? { ...tuning, groups: list(tuning.groups).map(({ history, ...group }) => group) } : null,
    initialization: records['step02/initialization.json'] || null,
    findings: linkedFindings, feedback: linkedFeedback,
    evidence: manifest ? { ...manifest, runs: list(manifest.runs).map(run => ({ ...run,
      ...(provenance.evidenceMatchesCurrent && readableArtifact(run.plot)
        ? { plotUrl: urlFor(name, dir, run.plot, provenance.configHash!) } : {}) })),
      frames: indexed.map(frame => ({ ...frame, ...image(frame) })) } : null,
  };
}

export async function studioPhysicsArtifact(directory: string, configPath: string | undefined, path: string, hash: string) {
  if (!readableArtifact(path)) throw Error('未登记的物理证据类型');
  const records = await readRecords(directory, true);
  const config = await jsonFile(directory, configPath || 'physics/physics.json');
  const provenance = await currentEvidence(records, config, directory);
  if (!provenance.evidenceMatchesCurrent || provenance.configHash !== hash) throw Error('物理证据已过期，请重新复核');
  const manifest = records['step03/evidence/manifest.json'];
  const plot = list(manifest.runs).some(run => run.plot === path);
  const frame = list(records['step03/evidence/frames.json']).some(frame => frame.path === path
    && frame.configHash === hash && frame.renderHash === manifest.renderHash);
  if (!plot && !frame) throw Error('未登记的物理证据');
  return safePath(await safePath(directory, evidenceRoot), path);
}
