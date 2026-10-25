import type {Binder,Card} from './types';
export function isBlobImage(value:string):boolean;
export function cardImagePath(id:string,shareToken?:string):string;
export function cardForClient(card:Card,shareToken?:string):Card;
export function binderForClient(binder:Binder,shareToken?:string):Binder;
