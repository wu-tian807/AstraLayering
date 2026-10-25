export function meshCoverage(rest:ArrayLike<number>,indices:Uint32Array,bounds:any,rgba:Uint8Array):any;
export function refineControlGeometry(control:any,levels:number):any;
export function conditionTriangles(triangles: number[][][], constraints?: number[][][]): number[][][];
export function cross(a: number[], b: number[], c: number[]): number;
export function gridControlGeometry(authoring: any, supports: any[]): {rest: number[]; indices: number[]; sample(point: number[]): number[]};
