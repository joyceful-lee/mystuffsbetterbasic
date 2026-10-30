import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
const base=process.env.TEST_URL||'http://localhost:3001',stamp=Date.now(),created=[];
const picture='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aQ5kAAAAASUVORK5CYII=';
function client(){const jar=new Map();return async(path,method='GET',body,origin=true)=>{const headers={cookie:[...jar].map(([k,v])=>`${k}=${v}`).join('; ')};if(origin)headers.origin=base;if(body)headers['content-type']='application/json';const r=await fetch(base+path,{method,headers,body:body?JSON.stringify(body):undefined,redirect:'manual'});for(const line of r.headers.getSetCookie()){const [name,...parts]=line.split(';')[0].split('=');jar.set(name,parts.join('='));}let data;const raw=await r.text();try{data=JSON.parse(raw);}catch{data=raw;}return {status:r.status,data};};}
const owner=client(),follower=client(),other=client(),anon=client();
const check=(r,status)=>{assert.equal(r.status,status,JSON.stringify(r.data));return r.data;};
const list=async(request,view='explore',extra='')=>check(await request(`/api/community?view=${view}&q=${stamp}${extra}`),200).binders;
try{
 for(const [i,request] of [owner,follower,other].entries())check(await request('/api/auth/sign-up/email','POST',{email:`community-qa-${stamp}-${i}@example.com`,name:`Collector QA ${i}`,password:randomBytes(24).toString('hex')}),200);
 const binder=check(await owner('/api/binders','POST',{name:`Community QA ${stamp}`,game:'Riftbound',color:'blue',backgroundColor:'chalk',theme:'pastel',bio:'Testing public binder discovery.'}),201).binder,id=binder.id;created.push(id);
 assert.equal(binder.visibility,'private');assert.equal((await list(anon)).length,0);check(await anon(`/community/${id}`),404);
 check(await follower(`/api/binders/${id}`,'PATCH',{visibility:'public'}),404);
 check(await anon(`/api/community/${id}/reaction`,'PATCH',{kind:'like',enabled:true}),401);
 check(await owner(`/api/community/${id}/reaction`,'PATCH',{kind:'like',enabled:true}),404);
 check(await anon('/api/community?view=liked'),401);check(await anon('/api/community?game=not-a-game'),400);
 const old=check(await owner('/api/cards','POST',{binderId:id,name:'Original card',image:picture,rarity:'Rare'}),201).card;
 const legacy=check(await owner(`/api/binders/${id}`,'PATCH',{shared:true}),200).shareToken;
 check(await owner(`/api/binders/${id}`,'PATCH',{visibility:'public'}),200);
 const publicRows=await list(anon);assert.equal(publicRows.length,1);assert.equal(publicRows[0].id,id);assert.equal(publicRows[0].publicName,'Collector QA 0');assert.equal(publicRows[0].cardCount,1);assert.ok(!JSON.stringify(publicRows).includes('@example.com'));assert.ok(!JSON.stringify(publicRows).includes('user_id'));assert.equal((await list(anon,'explore','&game=Magic')).length,0);
 const publicPage=check(await anon(`/community/${id}`),200);assert.ok(!publicPage.includes(`community-qa-${stamp}-0@example.com`));if(new URL(base).hostname!=='localhost')assert.match(old.image,/^\/api\/cards\//);if(old.image.startsWith('/api/'))check(await anon(old.image),200);
 check(await follower(`/api/community/${id}/reaction`,'PATCH',{kind:'like',enabled:true},false),403);
 for(let i=0;i<2;i++){const reaction=check(await follower(`/api/community/${id}/reaction`,'PATCH',{kind:'like',enabled:true}),200);assert.equal(reaction.likes,1);}
 check(await anon('/api/notifications'),401);
 let notices=check(await owner('/api/notifications'),200);assert.equal(notices.notifications.length,1);assert.equal(notices.notifications[0].kind,'like');assert.equal(notices.notifications[0].actorName,'Collector QA 1');assert.ok(!JSON.stringify(notices).includes('@example.com'));assert.equal(check(await owner('/api/community/status'),200).activityUnread,1);
 const likeNotice=notices.notifications[0].id;
 check(await follower('/api/notifications/read','POST',{id:likeNotice}),404);check(await owner('/api/notifications/read','POST',{id:likeNotice},false),403);
 check(await owner('/api/notifications/read','POST',{id:likeNotice}),200);check(await follower(`/api/community/${id}/reaction`,'PATCH',{kind:'like',enabled:true}),200);assert.equal(check(await owner('/api/community/status'),200).activityUnread,0);
 check(await follower(`/api/community/${id}/reaction`,'PATCH',{kind:'like',enabled:false}),200);check(await follower(`/api/community/${id}/reaction`,'PATCH',{kind:'like',enabled:true}),200);assert.equal(check(await owner('/api/community/status'),200).activityUnread,1);assert.equal(check(await owner('/api/notifications'),200).notifications.length,1);
 assert.equal(check(await follower('/api/notifications'),200).notifications.length,0);
 assert.equal((await list(follower,'liked')).length,1);assert.equal((await list(other,'liked')).length,0);
 check(await follower(`/api/community/${id}/reaction`,'PATCH',{kind:'subscribe',enabled:true}),200);assert.equal((await list(follower,'subscribed')).length,1);assert.equal((await list(follower,'updates')).length,0);
 notices=check(await owner('/api/notifications'),200);assert.equal(notices.notifications.length,2);assert.ok(notices.notifications.some(n=>n.kind==='subscribe'));assert.equal(check(await owner('/api/community/status'),200).activityUnread,2);
 check(await owner('/api/notifications/read','POST',{allThrough:notices.asOf}),200);assert.equal(check(await owner('/api/community/status'),200).activityUnread,0);
 check(await other(`/api/community/${id}/reaction`,'PATCH',{kind:'like',enabled:true}),200);check(await owner('/api/notifications/read','POST',{allThrough:notices.asOf}),200);assert.equal(check(await owner('/api/community/status'),200).activityUnread,1,'Mark all read must preserve activity arriving after the list was opened');
 assert.equal(check(await owner('/api/notifications?filter=unread'),200).notifications.length,1);
 check(await other(`/api/community/${id}/reaction`,'PATCH',{kind:'like',enabled:false}),200);
 check(await owner('/api/cards','POST',{binderId:id,name:'New card one',image:'',rarity:'Epic'}),201);
 let updates=await list(follower,'updates');assert.equal(updates.length,1);assert.equal(updates[0].newCards,1);assert.equal(check(await follower('/api/community/status'),200).unread,1);assert.equal((await list(other,'updates')).length,0);
 check(await other(`/api/community/${id}/seen`,'POST',{asOf:updates[0].asOf}),404);
 check(await owner('/api/cards','POST',{binderId:id,name:'Arrived after opening updates',image:'',rarity:'Rare'}),201);
 check(await follower(`/api/community/${id}/seen`,'POST',{asOf:updates[0].asOf}),200);updates=await list(follower,'updates');assert.equal(updates[0].newCards,1,'Mark seen must not swallow a card added after the list was opened');
 check(await follower(`/api/community/${id}/seen`,'POST',{asOf:updates[0].asOf}),200);assert.equal((await list(follower,'updates')).length,0);
 check(await owner(`/api/cards/${old.id}`,'PATCH',{favorite:true}),200);assert.equal((await list(follower,'updates')).length,0);
 check(await owner('/api/cards','POST',{binderId:id,name:'New card two',image:'',rarity:'Common'}),201);updates=await list(follower,'updates');assert.equal(updates[0].newCards,1);
 check(await owner(`/api/binders/${id}`,'PATCH',{visibility:'private'}),200);assert.equal((await list(anon)).length,0);assert.equal((await list(follower,'liked')).length,0);assert.equal((await list(follower,'subscribed')).length,0);assert.equal((await list(follower,'updates')).length,0);check(await anon(`/community/${id}`),404);check(await anon(`/share/${legacy}`),404);if(old.image.startsWith('/api/')){check(await anon(old.image),404);check(await owner(old.image),200);}
 check(await follower(`/api/community/${id}/reaction`,'PATCH',{kind:'like',enabled:true}),404);
 check(await owner('/api/cards','POST',{binderId:id,name:'Added privately',image:'',rarity:'Rare'}),201);check(await owner(`/api/binders/${id}`,'PATCH',{visibility:'public'}),200);assert.equal((await list(follower,'updates')).length,0,'Private additions must not become subscription updates');
 check(await follower(`/api/community/${id}/reaction`,'PATCH',{kind:'subscribe',enabled:false}),200);check(await owner('/api/cards','POST',{binderId:id,name:'After unsubscribe',image:'',rarity:'Rare'}),201);assert.equal((await list(follower,'updates')).length,0);
 check(await follower(`/api/community/${id}/reaction`,'PATCH',{kind:'subscribe',enabled:true}),200);assert.equal((await list(follower,'updates')).length,0);check(await follower(`/api/community/${id}/reaction`,'PATCH',{kind:'like',enabled:false}),200);assert.equal((await list(follower,'liked')).length,0);
 console.log('PASS owner notification isolation, authenticated actor names, read/unread state, duplicate suppression, reactivation, mark-all cutoff; public discovery/filtering, private defaults, owner isolation, independent/idempotent likes and subscriptions, new-card updates, seen state, unsubscribe, public/private image access, legacy-link revocation and republishing privacy');
}finally{for(const id of created)check(await owner(`/api/binders/${id}`,'DELETE'),200);assert.equal(check(await owner('/api/notifications'),200).notifications.length,0);}
