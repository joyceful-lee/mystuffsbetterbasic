import type {Binder} from './types';
export const MAX_BACKUP_BYTES:number;
export function parseGuestBackup(raw:string):Binder[];
export function restoreGuestCopies(current:Binder[],incoming:Binder[],newId?:()=>string):Binder[];
export function guestSaveInfo(raw:string|null):{savedAt:string|null;bytes:number};
