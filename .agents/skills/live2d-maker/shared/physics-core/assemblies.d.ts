export type AssemblyGroup={id:string;componentIds:string[];roots:string[];links:{parent:string;child:string;supportId:string;at:[number,number]}[];layerUuids:string[];enabledComponentIds:string[]};
export function groupAssemblies(config:any):AssemblyGroup[];
