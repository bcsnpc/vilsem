export interface Connector { connect(source:any):Promise<any>; query(connection:any,dax:string,maxRows?:number):Promise<any[]>; schema(connection:any):Promise<any>; }
export function createConnector(options?:any):Connector;
export function createAuth(options?:any):any;
export function bridge(payload:any):Promise<any>;
export function connect(source:any):Promise<any>;
export function query(connection:any,dax:string,maxRows?:number):Promise<any[]>;
export function schema(connection:any):Promise<any>;
