'use client';
import {useState} from 'react';
import Link from 'next/link';
import {Bell,Heart} from 'lucide-react';
import type {PublicBinder,User} from '../lib/types';
import Modal from './modal';
import AuthForm from './auth-form';
export type SocialBinder=Pick<PublicBinder,'id'|'likes'|'liked'|'subscribed'|'isOwner'>;
export function BinderSocialActions({binder,user,onChange}:{binder:SocialBinder;user:User|null;onChange:(data:{likes:number;liked:boolean;subscribed:boolean})=>void}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[login,setLogin]=useState(false);
 async function react(kind:'like'|'subscribe'){
  if(!user){setLogin(true);return;}if(busy)return;setBusy(true);setError('');
  try{const r=await fetch(`/api/community/${binder.id}/reaction`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind,enabled:kind==='like'?!binder.liked:!binder.subscribed})});const data=await r.json();if(!r.ok)throw new Error(data.error||'This could not be saved.');onChange(data);window.dispatchEvent(new Event('binder-updates-changed'));}catch(e){setError(e instanceof Error?e.message:'Please try again.');}finally{setBusy(false);}
 }
 return <div className="binder-social">{binder.isOwner?<><span>Your binder · {binder.likes} {binder.likes===1?'like':'likes'}</span><Link href={`/?binder=${binder.id}`}>Edit in My binders</Link></>:<><button className="button secondary" aria-pressed={binder.liked} disabled={busy} onClick={()=>void react('like')}><Heart size={16} fill={binder.liked?'currentColor':'none'}/>{binder.liked?'Liked':'Like'}<span>{binder.likes}</span></button><button className="button secondary" aria-pressed={binder.subscribed} disabled={busy} onClick={()=>void react('subscribe')}><Bell size={16}/>{binder.subscribed?'Subscribed':'Subscribe'}</button></>}{error&&<p role="alert" className="form-error">{error}</p>}{login&&<Modal title="Keep up with this binder" close={()=>setLogin(false)}><p className="muted">Log in to keep liked binders together and receive updates when a subscribed binder gets new cards.</p><AuthForm initial="sign-in"/></Modal>}</div>;
}
export function PublicBinderBar({initial,user,publicName}:{initial:SocialBinder;user:User|null;publicName:string}){
 const [binder,setBinder]=useState(initial);
 return <div className="public-binder-bar"><div><Link href="/community">Explore binders</Link><p>Collected by {publicName||'a collector'}. Subscribe for new-card updates in your Binder updates page.</p></div><BinderSocialActions binder={binder} user={user} onChange={data=>setBinder(current=>({...current,...data}))}/></div>;
}
