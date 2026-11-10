// Compatibility entrypoint; scanning and process control are shared with FFmpeg.
import { createSoftwareScan, defaultPlan as softwarePlan, scan as softwareScan, softwareName, type ScanMessage, type ScanPlan } from './software-scan.ts';
export type { SoftwareScanState as KritaScanState } from './software-scan.ts';
export const kritaName = (name: string) => softwareName('krita', name);
export const defaultPlan = () => softwarePlan('krita');
export const scan = (plan: ScanPlan, send: (message: ScanMessage) => void) => softwareScan('krita', plan, send);
export const createKritaScan = (plan = defaultPlan) => createSoftwareScan('krita', plan);
