'use client';
import {useState} from 'react';
import Link from 'next/link';
import type {Binder} from '../lib/types';
export default function BinderPublishing({binder,blocked,onChange}:{binder:Binder;blocked:boolean;onChange:(data:{visibility:'private'|'public';shareToken:string|null})=>void}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[copied,setCopied]=useState(false),[choice,setChoice]=useState<'private'|'public'>(binder.visibility||'private');
 async function save(){if(busy||blocked)return;setBusy(true);setError('');try{const r=await fetch(`/api/binders/${binder.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({visibility:choice})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Visibility could not be saved.');onChange(d);setCopied(false);}catch(e){setError(e instanceof Error?e.message:'Please try again.');}finally{setBusy(false);}}
 const isPublic=binder.visibility==='public',link=typeof window!=='undefined'?`${window.location.origin}/community/${binder.id}`:'';
 return <div className="publishing-settings"><fieldset disabled={busy||blocked}><legend>Who can view this binder?</legend><label><input type="radio" name="binder-visibility" value="private" checked={choice==='private'} onChange={()=>setChoice('private')}/><span><strong>Private</strong><small>Only you can view it. Choosing Private also turns off existing viewing links.</small></span></label><label><input type="radio" name="binder-visibility" value="public" checked={choice==='public'} onChange={()=>setChoice('public')}/><span><strong>Public</strong><small>Anyone can find it in Explore binders, view its cards, like it, or subscribe.</small></span></label></fieldset>
 {choice==='public'&&<p>Your collector name, binder bio, card pictures, deck names, and card numbers will be visible to everyone. Your email stays private.</p>}
 {!isPublic&&binder.shareToken&&<p>This binder currently has an older view-only link. Saving Private will revoke that link and keep the binder to yourself.</p>}
 <button className="button primary wide" disabled={busy||blocked||(choice===(binder.visibility||'private')&&!binder.shareToken)} onClick={()=>void save()}>{busy?'Saving visibility…':choice==='public'?'Make this binder public':'Keep this binder private'}</button>
 {isPublic&&<div className="public-share-link"><p>This binder is listed in <Link href="/community">Explore binders</Link>. Subscribers will see new-card updates in the app.</p><label className="link-field">Public binder link<input value={link} readOnly onFocus={e=>e.target.select()}/></label><div className="guest-save-buttons"><Link className="button secondary" href={`/community/${binder.id}`}>View public binder</Link><button className="button secondary" onClick={async()=>{try{await navigator.clipboard.writeText(link);setCopied(true);}catch{setError('Select and copy the link above.');}}}>{copied?'Copied':'Copy link'}</button></div></div>}
 {error&&<p className="form-error" role="alert">{error}</p>}
 </div>;
}
