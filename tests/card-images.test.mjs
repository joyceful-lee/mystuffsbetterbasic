import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isBlobImage,cardImagePath,cardForClient,binderForClient} from '../lib/card-image-reference.mjs';
const image='https://store.private.blob.vercel-storage.com/cards/example.png';
test('private Blob URLs are converted to authenticated card endpoints',()=>{
 const card={id:'card',image,name:'My card'};
 assert.equal(cardForClient(card).image,'/api/cards/card/image');assert.equal(card.image,image);
 assert.equal(binderForClient({id:'binder',cards:[card]}).cards[0].image,cardImagePath('card'));
});
test('shared image URLs carry only the binder capability and preserve old data images',()=>{
 assert.equal(cardForClient({id:'card',image},'token').image,'/api/cards/card/image?share=token');
 for(const original of ['','data:image/png;base64,abcd','/cards/charizard.png'])assert.equal(cardForClient({id:'card',image:original},'token').image,original);
});
test('image references reject lookalike hosts, credentials, and non-HTTPS URLs',()=>{
 assert.ok(isBlobImage(image));
 for(const invalid of ['https://blob.vercel-storage.com.evil.example/image','http://store.blob.vercel-storage.com/image','https://user:secret@store.blob.vercel-storage.com/image','data:image/png;base64,a','/api/cards/card/image'])assert.equal(isBlobImage(invalid),false);
});
