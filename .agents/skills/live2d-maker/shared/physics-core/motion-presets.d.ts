export const motionPresetVersion: string;
export const motionPresets: any[];
export function suggestedMotionPreset(component: any): string;
export function initializeMotionParameters(component: any, presetId?: string): any;
export function initializeConfigParameters(config: any, presets?: Record<string,string>): any;
