import { IMPORT_BATCH_SIZE } from './binder-config.mjs';
export const GUEST_KEY = 'mystuffsbetter.guest.v1';
export function readGuest(storage) {
  const raw = storage.getItem(GUEST_KEY);
  if (!raw) return [];
  const value = JSON.parse(raw);
  if (value.version !== 1 || !Array.isArray(value.binders) || !value.binders.every(b => b && typeof b.id === 'string' && typeof b.name === 'string' && typeof b.game === 'string' && typeof b.color === 'string' && Array.isArray(b.cards) && b.cards.every(c => c && typeof c.id === 'string' && typeof c.name === 'string' && typeof c.image === 'string' && typeof c.rarity === 'string' && typeof c.favorite === 'boolean'))) throw new Error('Your guest save could not be read. It is still in this browser.');
  return value.binders.map(binder => ({...binder, cards: binder.cards.map(card=>({...card, deck: typeof card.deck === 'string' ? card.deck : '', cardNumber: typeof card.cardNumber === 'string' ? card.cardNumber : ''})), backgroundColor: typeof binder.backgroundColor === 'string' ? binder.backgroundColor : 'navy', bio: typeof binder.bio === 'string' ? binder.bio : '', theme: typeof binder.theme === 'string' ? binder.theme : 'classic', coverCardId: typeof binder.coverCardId === 'string' ? binder.coverCardId : null}));
}
export function writeGuest(storage, binders, expectedRaw) {
  if (expectedRaw !== undefined && storage.getItem(GUEST_KEY) !== expectedRaw) throw new Error('Your collection changed in another tab. Close this form and try again with the latest save.');
  const raw=JSON.stringify({version:1,savedAt:new Date().toISOString(),binders});
  storage.setItem(GUEST_KEY, raw);
  return raw;
}
export async function migrateGuest(storage, upload, onProgress=()=>{}) {
  const snapshot=storage.getItem(GUEST_KEY);
  const binders = readGuest(storage);
  const total=binders.reduce((count,binder)=>count+Math.max(1,Math.ceil(binder.cards.length/IMPORT_BATCH_SIZE)),0);let completed=0;
  onProgress({completed,total});
  for (const binder of binders) {
    // Keep each request below the deployment body limit, even for older large images.
    for (let offset = 0; offset < Math.max(1, binder.cards.length); offset += IMPORT_BATCH_SIZE) {
      await upload({...binder, cards: binder.cards.slice(offset, offset + IMPORT_BATCH_SIZE).map((card,index)=>({...card,position:offset+index}))});
      onProgress({completed:++completed,total});
    }
  }
  if(storage.getItem(GUEST_KEY)!==snapshot)throw new Error('Your guest collection changed in another tab during the upload. Your browser copy is still here. Close the other tab, then retry.');
  if (binders.length) storage.removeItem(GUEST_KEY);
  return binders.length;
}
