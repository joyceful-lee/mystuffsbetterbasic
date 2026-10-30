import {GUEST_KEY,readGuest} from './guest-state.mjs';
import {games,binderColors,backgroundColors,binderThemes,GUEST_CARD_LIMIT} from './binder-config.mjs';
export const MAX_BACKUP_BYTES=20*1024*1024;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const text=(value,max)=>typeof value==='string'&&value.trim().length>0&&value.length<=max;
function safeImage(image){
 if(image==='')return true;
 const match=/^data:image\/(jpeg|png|webp|gif);base64,([A-Za-z0-9+/]+={0,2})$/.exec(image);
 if(!match||image.length>350000)return false;
 try{const bytes=atob(match[2]);if(bytes.length<12||bytes.length>250000)return false;return match[1]==='jpeg'?bytes.startsWith('\xff\xd8\xff'):match[1]==='png'?bytes.startsWith('\x89PNG\r\n\x1a\n'):match[1]==='gif'?/^GIF8[79]a/.test(bytes):bytes.startsWith('RIFF')&&bytes.slice(8,12)==='WEBP';}catch{return false;}
}
export function parseGuestBackup(raw){
 if(typeof raw!=='string'||new Blob([raw]).size>MAX_BACKUP_BYTES)throw new Error('Choose a MyStuffsBetter backup smaller than 20 MiB.');
 let binders;
 try{binders=readGuest({getItem:key=>key===GUEST_KEY?raw:null});}catch{throw new Error('This file is not a readable MyStuffsBetter guest backup. Your current collection has not changed.');}
 if(!binders.length||binders.length>6)throw new Error('A guest backup must contain between 1 and 6 binders.');
 const ids=new Set();
 return binders.map(binder=>{
  if(!uuid.test(binder.id)||ids.has(binder.id)||!text(binder.name,60)||!games.includes(binder.game)||!binderColors.includes(binder.color)||!backgroundColors.includes(binder.backgroundColor)||!Object.hasOwn(binderThemes,binder.theme)||binder.bio.length>180||binder.cards.length>GUEST_CARD_LIMIT)throw new Error('This backup has unsupported binder details or exceeds guest limits.');
  ids.add(binder.id);const cardIds=new Set();
  const cards=binder.cards.map(card=>{
   if(!uuid.test(card.id)||cardIds.has(card.id)||!text(card.name,100)||!text(card.rarity,60)||card.deck.length>100||card.cardNumber.length>40||!safeImage(card.image))throw new Error('This backup has a card or picture that cannot be restored safely.');
   cardIds.add(card.id);return {id:card.id,name:card.name,image:card.image,rarity:card.rarity,favorite:card.favorite,deck:card.deck,cardNumber:card.cardNumber};
  });
  if(binder.coverCardId&&!cardIds.has(binder.coverCardId))throw new Error('This backup refers to a missing cover card.');
  return {id:binder.id,name:binder.name,game:binder.game,color:binder.color,backgroundColor:binder.backgroundColor,theme:binder.theme,bio:binder.bio,coverCardId:binder.coverCardId,shareToken:null,cards};
 });
}
export function restoreGuestCopies(current,incoming,newId=()=>crypto.randomUUID()){
 if(current.length+incoming.length>6)throw new Error('There is room for 6 guest binders. Create an account for your current collection before restoring more.');
 const copies=incoming.map(binder=>{
  const ids=new Map(binder.cards.map(card=>[card.id,newId()]));
  return {...binder,id:newId(),shareToken:null,coverCardId:binder.coverCardId?ids.get(binder.coverCardId):null,cards:binder.cards.map(card=>({...card,id:ids.get(card.id)}))};
 });
 return [...current,...copies];
}
export function guestSaveInfo(raw){
 let savedAt=null;try{const value=JSON.parse(raw||'null');if(value?.savedAt&&Number.isFinite(Date.parse(value.savedAt)))savedAt=value.savedAt;}catch{}
 return {savedAt,bytes:raw?new Blob([raw]).size:0};
}
