'use client';
import {useMemo,useState} from 'react';
import {Download,Upload,ChevronDown} from 'lucide-react';
import type {Binder} from '../lib/types';
import {guestSaveInfo,MAX_BACKUP_BYTES,parseGuestBackup} from '../lib/guest-backup.mjs';

export function downloadGuestBackup(raw:string){
 const url=URL.createObjectURL(new Blob([raw],{type:'application/json'}));
 const date=new Date(),day=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
 const link=document.createElement('a');link.href=url;link.download=`mystuffsbetter-backup-${day}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export default function GuestSavePanel({binders,raw,disabled,issue,onRestore,onAccount,onRetry}:{binders:Binder[];raw:string|null;disabled:boolean;issue:boolean;onRestore:(binders:Binder[],replaceDamaged:boolean)=>boolean;onAccount:()=>void;onRetry:()=>void}){
 const [preview,setPreview]=useState<Binder[]|null>(null),[error,setError]=useState(''),[reading,setReading]=useState(false),[replaceConfirmed,setReplaceConfirmed]=useState(false);
 const info=useMemo(()=>guestSaveInfo(raw),[raw]),total=binders.reduce((n,b)=>n+b.cards.length,0),noRoom=!issue&&!!preview&&binders.length+preview.length>6;
 return <section className="guest-save-panel" aria-label="Guest collection save">
  <div className="guest-save-heading"><div><h2>Your guest collection</h2><p>{issue?'Your browser save needs attention. Download a copy before trying to recover it.':!binders.length?'You can start collecting without an account. Your binders will stay in this browser.':`You have ${binders.length} of 6 binders and ${total} ${total===1?'card':'cards'} saved in this browser.`}</p></div><button className="button secondary" onClick={onAccount}>Create an account</button></div>
  <div className="guest-save-status" role="status">{issue?'Editing is paused to protect your save.':info.savedAt?`Last saved ${new Date(info.savedAt).toLocaleString([], {dateStyle:'medium',timeStyle:'short'})}.`:binders.length?'Your collection is saved on this browser.':'Your first binder will save here automatically.'} Each guest binder can hold 50 cards.</div>
  {info.bytes>=3*1024*1024&&<p className="guest-storage-warning">Your browser save is getting large. Download a backup or create an account before adding many more pictures.</p>}
  <details><summary>Back up or restore your collection<ChevronDown size={15}/></summary><div className="guest-save-tools">
   <p>A backup file includes your card pictures, favorites, covers, and binder order. Keep a copy if you use a shared computer or plan to clear browser data. Private browsing may remove your collection when the window closes.</p>
   <div className="guest-save-buttons"><button className="button secondary" disabled={!raw||reading} onClick={()=>raw&&downloadGuestBackup(raw)}><Download size={16}/>Download backup</button><label className={`button secondary ${disabled?'is-disabled':''}`}><Upload size={16}/>Choose backup<input type="file" accept="application/json,.json" aria-label="Choose a guest backup to restore" disabled={disabled||reading} onChange={async event=>{const file=event.target.files?.[0];event.target.value='';if(!file)return;setError('');setPreview(null);setReplaceConfirmed(false);setReading(true);try{if(file.size>MAX_BACKUP_BYTES)throw new Error('Choose a backup smaller than 20 MiB.');setPreview(parseGuestBackup(await file.text()));}catch(e){setError(e instanceof Error?e.message:'This backup could not be read.');}finally{setReading(false);}}}/></label>{issue&&<button className="button secondary" onClick={onRetry}>Try browser storage again</button>}</div>
   {reading&&<p role="status">Reading your backup…</p>}
   {preview&&<div className="guest-restore-preview"><h3>Check your backup</h3><p>{preview.length} {preview.length===1?'binder':'binders'} with {preview.reduce((n,b)=>n+b.cards.length,0)} cards. {issue?'Recovery replaces the browser save with these binders. Download your current browser copy first, even if it cannot be read.':'These will be added as new copies; your current binders will stay as they are.'}</p><ul>{preview.map(b=><li key={b.id}>{b.name}<span>{b.cards.length} cards</span></li>)}</ul>{issue&&<label className="guest-recovery-confirm"><input type="checkbox" checked={replaceConfirmed} onChange={event=>setReplaceConfirmed(event.target.checked)}/>I have kept a copy of my current save and want to replace it with this backup.</label>}{noRoom&&<p role="alert">There is room for 6 guest binders. Save your current collection to an account before adding this backup.</p>}<div className="guest-save-buttons"><button className="button primary" disabled={disabled||(issue&&!replaceConfirmed)||noRoom} onClick={()=>{if(onRestore(preview,issue&&replaceConfirmed))setPreview(null);}}>{issue?'Restore this backup':'Add backup binders'}</button><button className="button secondary" onClick={()=>setPreview(null)}>Cancel restore</button></div></div>}
   {error&&<p className="form-error" role="alert">{error}</p>}
   <p>Guest binders stay on this device and cannot be shared with a link yet. When you create an account or log in, they move into your account alongside any binders already there. Closing this page does not clear a normal browser save, but clearing site data can.</p>
  </div></details>
 </section>;
}
