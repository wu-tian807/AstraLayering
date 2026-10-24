export const settlingVersion: string;
export function recoveryBudgetSteps(config:any):number;
export function recoveryState(body:any,peak:number,visibleTravel?:number):{travel:number;internalSpeed:number;tolerance:number;quiet:boolean};
export function recoveryProofValid(recovery:any,durationSteps:number):boolean;
