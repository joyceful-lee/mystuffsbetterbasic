import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
const base=process.env.TEST_URL||'http://localhost:3001';
const picture='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aQ5kAAAAASUVORK5CYII=';
function client(){const jar=new Map();return async(path,method='GET',body)=>{const headers={origin:base,cookie:[...jar].map(([k,v])=>`${k}=${v}`).join('; ')};if(body)headers['content-type']='application/json';const r=await fetch(base+path,{method,headers,body:body?JSON.stringify(body):undefined,redirect:'manual'});for(const line of r.headers.getSetCookie()){const [name,...parts]=line.split(';')[0].split('=');jar.set(name,parts.join('='));}const bytes=Buffer.from(await r.arrayBuffer());let data;try{data=JSON.parse(bytes.toString());}catch{data=bytes.toString();}return {status:r.status,data,bytes,type:r.headers.get('content-type')};};}
const owner=client(),other=client(),anon=client(),binders=[];
try{
 for(const [i,request] of [owner,other].entries()){const r=await request('/api/auth/sign-up/email','POST',{email:`msb-blob-qa-${Date.now()}-${i}@example.com`,name:'Blob upload QA',password:randomBytes(24).toString('hex')});assert.equal(r.status,200,JSON.stringify(r.data));}
 const created=await owner('/api/binders','POST',{name:'Blob upload QA',game:'Other',color:'blue'});assert.equal(created.status,201,JSON.stringify(created.data));const id=created.data.binder.id;binders.push(id);
 const added=await owner('/api/cards','POST',{binderId:id,name:'Blob pixel',image:picture,rarity:'Rare'});assert.equal(added.status,201,JSON.stringify(added.data));const card=added.data.card;
 assert.equal(card.image,`/api/cards/${card.id}/image`,'Upload must use Blob, not a database data URL');
 const ownImage=await owner(card.image);assert.equal(ownImage.status,200);assert.match(ownImage.type,/image\/png/);assert.deepEqual(ownImage.bytes,Buffer.from(picture.split(',')[1],'base64'));
 assert.equal((await anon(card.image)).status,404);assert.equal((await other(card.image)).status,404);
 assert.equal((await owner(`/api/cards/${card.id}`,'PATCH',{name:'Renamed pixel',image:card.image,rarity:'Rare'})).status,200);
 const link=await owner(`/api/binders/${id}`,'PATCH',{shared:true});assert.equal(link.status,200);const shared=`${card.image}?share=${link.data.shareToken}`;assert.equal((await anon(shared)).status,200);
 const page=await anon(`/share/${link.data.shareToken}`);assert.equal(page.status,200);assert.ok(page.data.includes(encodeURIComponent(link.data.shareToken)));
 assert.equal((await owner(`/api/binders/${id}`,'PATCH',{shared:false})).status,200);assert.equal((await anon(shared)).status,404);
 const guest={id:randomUUID(),name:'Blob guest import QA',game:'Other',color:'blue',cards:[{id:randomUUID(),name:'Guest pixel',image:picture,rarity:'Rare',favorite:false}]};
 const imported=await owner('/api/import','POST',guest);assert.equal(imported.status,200,JSON.stringify(imported.data));binders.push(imported.data.id);assert.equal((await owner('/api/import','POST',guest)).status,200);
 const list=await owner('/api/binders');const saved=list.data.binders.find(b=>b.id===imported.data.id);assert.equal(saved.cards.length,1);assert.match(saved.cards[0].image,/^\/api\/cards\//);assert.equal((await owner(saved.cards[0].image)).status,200);
 assert.equal((await owner(`/api/cards/${card.id}`,'PATCH',{name:'Replaced pixel',image:picture,rarity:'Rare'})).status,200);assert.equal((await owner(card.image)).status,200);
 assert.equal((await owner(`/api/cards/${card.id}`,'DELETE')).status,200);assert.equal((await owner(card.image)).status,404);
 console.log('PASS private Blob upload/download, owner isolation, unchanged-image editing, sharing/revocation, retry-safe guest import, replacement and deletion');
}finally{for(const id of binders){const result=await owner(`/api/binders/${id}`,'DELETE');assert.equal(result.status,200,'QA binder cleanup failed');}}
