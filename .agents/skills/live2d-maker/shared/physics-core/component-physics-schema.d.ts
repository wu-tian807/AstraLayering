export const componentSchemaVersion: number;
export const componentPhysicsVersion: string;
export const reviewCriteria: string[];
export const reviewTests: string[];
export function componentDefaults(kind: string): any;
export function validatePoint(value: any, canvas: any): void;
export function validateComponent(value: any, canvas: any, authoringRequired?: boolean): any;
export function validatePhysicsConfig(value: any, options?: { requireReview?: boolean }): any;
