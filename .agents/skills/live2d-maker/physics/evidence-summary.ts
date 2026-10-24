// The model reads diagnostics; complete measured curves remain producer artifacts.
// Do not project full trajectories into every simulate/index tool response.
export function summarizeEvidence(manifest: any, test?: string) {
  return { ...manifest, runs: manifest.runs.filter((run: any) => !test || run.test === test).map((run: any) => {
    const { curves, events, frameSteps, ...record } = run;
    return { ...record, frameCount: frameSteps.length, eventCount: events.length, curveCount: curves?.length ?? 0,
      ...(test ? { windows: [...new Set(events.map((event: any) => event.component))].map(component => {
        const fallback = events.find((event: any) => event.component === component && event.type === 'fallback');
        const peak = events.find((event: any) => event.component === component && event.type === 'peak');
        return { component, firstFallback: fallback?.step, peak: peak?.step, peakTravel: peak?.travel };
      }) } : {}) };
  }) };
}
