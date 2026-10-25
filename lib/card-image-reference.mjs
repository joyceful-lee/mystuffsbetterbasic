export function isBlobImage(value){
 try{const url=new URL(value);return url.protocol==='https:'&&url.hostname.endsWith('.blob.vercel-storage.com')&&!url.username&&!url.password;}catch{return false;}
}
export function cardImagePath(id,shareToken){return `/api/cards/${id}/image${shareToken?`?share=${encodeURIComponent(shareToken)}`:''}`;}
export function cardForClient(card,shareToken){return {...card,image:isBlobImage(card.image)?cardImagePath(card.id,shareToken):card.image};}
export function binderForClient(binder,shareToken){return {...binder,cards:binder.cards.map(card=>cardForClient(card,shareToken))};}
