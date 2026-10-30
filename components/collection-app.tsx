'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownWideNarrow, ArrowRight, BookOpen, Check, ChevronDown, ChevronRight, CircleHelp, Cloud, Grid2X2, Heart, ImagePlus, Layers, LayoutGrid, Link2, List, LogOut, Pencil, Plus, Search, ShieldCheck, SlidersHorizontal, Trash2, X } from 'lucide-react';
import type { Binder, Card, User } from '../lib/types';
import { GUEST_KEY, readGuest, writeGuest, migrateGuest } from '../lib/guest-state.mjs';
import {restoreGuestCopies} from '../lib/guest-backup.mjs';
import GuestSavePanel, {downloadGuestBackup} from './guest-save-panel';
import { allCards, allFavorites, coverCard, reorderItems } from '../lib/collection.mjs';
import { appearanceStyle, binderAppearanceStyle, coverPaletteFor } from '../lib/appearance.mjs';
import { binderThemes, games, GUEST_CARD_LIMIT, GUEST_IMAGE_DATA_LIMIT, isRarityForGame, paletteFor, raritiesFor, rarityRank } from '../lib/binder-config.mjs';
import { MAX_IMAGE_EDGE, sourceImageError, UPLOAD_ACCEPT, UPLOAD_GUIDELINES } from '../lib/upload-guidelines.mjs';
import { authClient } from '../lib/auth-client';
import Modal from './modal';
import AuthForm from './auth-form';
import ColorPicker from './color-picker';
import OrderingList from './ordering-list';
import CardPicture from './card-picture';
import { DisplayModeSwitch } from './display-mode';
import CommunityNav from './community-nav';
import BinderPublishing from './binder-publishing';
import {PublicBinderBar} from './binder-social';
import type {SocialBinder} from './binder-social';

const sampleNames=['Charizard V','Pikachu VMAX','Umbreon VMAX','Sylveon VMAX','Glaceon VMAX','Dragonite V','Gengar VMAX','Mew VMAX'];
const sampleFiles=['charizard','pikachu','umbreon','sylveon','glaceon','dragonite','gengar','mew'];
const showcase:Binder={id:'showcase',name:'Kanto & beyond',game:'Pokémon',color:'lime',backgroundColor:'black',theme:'classic',coverCardId:null,bio:'These example cards show how a binder looks once you have added your own.',shareToken:null,cards:sampleNames.map((name,i)=>({id:`sample-${i}`,name,deck:'',cardNumber:'',image:`/cards/${sampleFiles[i]}.png`,rarity:i===2||i===6?'Secret rare':'Ultra rare',favorite:i===2||i===3}))};
const SAMPLE_HIDDEN_KEY='mystuffsbetter.sample-hidden';
const emptyBinder:Binder={id:'empty',name:'Your cards',game:'Other',color:'blue',backgroundColor:'ivory',theme:'pastel',bio:'Create a binder to start your collection.',coverCardId:null,shareToken:null,cards:[]};

type Dialog='binder'|'card'|'details'|'order-binders'|'order-cards'|'share'|'signup'|'login'|'help'|null;
type CardEntry={card:Card;binder:Binder};
async function api(path:string,method='GET',body?:unknown) {
 const response=await fetch(path,{method,headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined});
 const data=await response.json().catch(()=>({error:'We couldn’t connect, so please try again.'}));
 if(!response.ok)throw new Error(data.error||'Something went wrong while saving, so please try again.');return data;
}
async function picture(file:File,maxDataLength=330000):Promise<string> {
 const error=sourceImageError(file);if(error)throw new Error(error);
 let bitmap:ImageBitmap;
 try{bitmap=await createImageBitmap(file);}catch{throw new Error('This picture could not be opened. Choose a valid JPG, PNG, WebP, or GIF file.');}
 try {
  for(const size of [MAX_IMAGE_EDGE,650,500,380]) {
   const scale=Math.min(1,size/Math.max(bitmap.width,bitmap.height));
   const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
   const context=canvas.getContext('2d')!;context.fillStyle='#ffffff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(bitmap,0,0,canvas.width,canvas.height);
   for(const quality of [.85,.7,.55,.4]){const data=canvas.toDataURL('image/jpeg',quality);if(data.length<=maxDataLength)return data;}
  }
 }finally{bitmap.close();}
 throw new Error('Try a smaller crop so this picture can fit in your binder.');
}

export default function BinderApp({user,shared,publicView}:{user:User|null;shared?:Binder;publicView?:SocialBinder&{publicName:string}}) {
 const [binders,setBinders]=useState<Binder[]>(shared?[shared]:[]);
 const [active,setActive]=useState(shared?.id||'showcase');
 const [sampleHidden,setSampleHidden]=useState(false);
 const [guestRaw,setGuestRaw]=useState<string|null>(null),[externalChange,setExternalChange]=useState(false);
 const [syncProgress,setSyncProgress]=useState({completed:0,total:0});
 const guestSnapshot=useRef<string|null>(null);
 const [view,setView]=useState<'binders'|'favorites'|'all-cards'>('binders');
 const [bindersExpanded,setBindersExpanded]=useState(true);
 const [ready,setReady]=useState(!!shared),[syncing,setSyncing]=useState(false),[syncError,setSyncError]=useState(''),[error,setError]=useState(''),[guestIssue,setGuestIssue]=useState(false);
 const [dialog,setDialog]=useState<Dialog>(null),[editBinder,setEditBinder]=useState<Binder|null>(null),[editCard,setEditCard]=useState<Card|null>(null);
 const [detailRef,setDetailRef]=useState<{binderId:string;cardId:string}|null>(null);
 const [confirm,setConfirm]=useState<{type:'binder'|'card';id:string;name:string}|null>(null);
 const [query,setQuery]=useState(''),[filter,setFilter]=useState('all'),[sort,setSort]=useState('custom'),[list,setList]=useState(false);
 const [binderQuery,setBinderQuery]=useState(''),[gameFilter,setGameFilter]=useState('all'),[binderSort,setBinderSort]=useState('custom');
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[upload,setUpload]=useState(''),[uploadBusy,setUploadBusy]=useState(false);
 const [binderGame,setBinderGame]=useState('Pokémon'),[coverColor,setCoverColor]=useState('pink'),[backgroundColor,setBackgroundColor]=useState(()=>coverPaletteFor('pastel','pink')[0]),[theme,setTheme]=useState('pastel');
 const loaded=useRef(false),noticeTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const binder=binders.find(item=>item.id===active)||(sampleHidden?emptyBinder:showcase);
 const demo=binder.id==='showcase',empty=binder.id==='empty',readonly=!!shared||demo||binder.id==='empty',guest=!user&&!shared,globalFavorites=view==='favorites',globalCards=view==='all-cards',collectionView=globalFavorites||globalCards;
 const favorites=useMemo(()=>allFavorites(binders),[binders]);
 const collectionCards=useMemo(()=>allCards(binders),[binders]);
 const total=binders.reduce((count,item)=>count+item.cards.length,0);
 const blocked=busy||syncing||!!syncError||guestIssue||externalChange||!ready;
 const detailBinder=detailRef?(binders.find(item=>item.id===detailRef.binderId)||(detailRef.binderId==='showcase'?showcase:null)):null;
 const detailCard=detailBinder?.cards.find(card=>card.id===detailRef?.cardId)||null;
 const detailOwned=!!detailBinder&&!shared&&detailBinder.id!=='showcase';
 const entries=useMemo(()=>{
  const result:CardEntry[]=globalFavorites?[...favorites]:globalCards?[...collectionCards]:binder.cards.filter(card=>filter!=='favorites'||card.favorite).map(card=>({card,binder}));
  const found=result.filter(entry=>entry.card.name.toLowerCase().includes(query.toLowerCase()));
  if(sort==='name')found.sort((a,b)=>a.card.name.localeCompare(b.card.name));
  if(sort==='rarity'&&!collectionView)found.sort((a,b)=>rarityRank(binder.game,b.card.rarity)-rarityRank(binder.game,a.card.rarity));
  return found;
 },[globalFavorites,globalCards,collectionView,favorites,collectionCards,binder,filter,query,sort]);
 const shelf=useMemo(()=>{
  const result=[...binders,...(sampleHidden||shared?[]:[showcase])].filter(item=>(gameFilter==='all'||item.game===gameFilter)&&`${item.name} ${item.bio}`.toLowerCase().includes(binderQuery.toLowerCase()));
  if(binderSort==='name')result.sort((a,b)=>a.name.localeCompare(b.name));
  return result;
 },[binders,sampleHidden,shared,gameFilter,binderQuery,binderSort]);
 const otherRarities=useMemo(()=>[...new Set([...raritiesFor('Other'),...binders.filter(item=>item.game==='Other').flatMap(item=>item.cards.map(card=>card.rarity))])],[binders]);

 function toast(message:string){setNotice(message);if(noticeTimer.current)clearTimeout(noticeTimer.current);noticeTimer.current=setTimeout(()=>setNotice(''),4200);}
 async function loadAccount(){
  setSyncing(true);setSyncError('');setSyncProgress({completed:0,total:0});
  try{
   let browserStorage:Storage|null=null;try{localStorage.getItem(GUEST_KEY);browserStorage=localStorage;}catch{setError('Browser storage is unavailable, so we could not check for a guest collection. Your account binders can still be used.');}
   setGuestRaw(browserStorage?.getItem(GUEST_KEY)||null);
   if(browserStorage?.getItem(SAMPLE_HIDDEN_KEY)==='true'){await api('/api/preferences','PATCH',{sampleHidden:true});browserStorage.removeItem(SAMPLE_HIDDEN_KEY);}
   const preferences=await api('/api/preferences');setSampleHidden(preferences.sampleHidden);
   const count=browserStorage?await migrateGuest(browserStorage,item=>api('/api/import','POST',item),setSyncProgress):0;
   setGuestRaw(null);const data=await api('/api/binders');setBinders(data.binders);const requested=new URL(window.location.href).searchParams.get('binder');setActive(data.binders.some((b:Binder)=>b.id===requested)?requested!:data.binders[0]?.id||(preferences.sampleHidden?'empty':'showcase'));if(count)toast('Your guest binders have been saved to your account.');
  }
  catch(e){try{setGuestRaw(localStorage.getItem(GUEST_KEY));}catch{}setSyncError(e instanceof Error?e.message:'Could not load your collection.');}
  finally{setSyncing(false);setReady(true);}
 }
 function loadGuest(){
  try{const raw=localStorage.getItem(GUEST_KEY);setGuestRaw(raw);guestSnapshot.current=raw;const saved=readGuest(localStorage),hidden=localStorage.getItem(SAMPLE_HIDDEN_KEY)==='true';const probe='mystuffsbetter.storage-check';localStorage.setItem(probe,'1');localStorage.removeItem(probe);setSampleHidden(hidden);setBinders(saved);setActive(current=>saved.some(b=>b.id===current)?current:saved[0]?.id||(hidden?'empty':'showcase'));setGuestIssue(false);setExternalChange(false);setError('');setDialog(null);setConfirm(null);setDetailRef(null);}
  catch(e){setGuestIssue(true);setError(e instanceof Error?e.message:'Browser storage is unavailable. Enable site storage or use another browser.');}
 }
 useEffect(()=>{
  if(loaded.current||shared)return;loaded.current=true;
  if(user){void loadAccount();return;}
  loadGuest();
  setReady(true);
 },[]);
 useEffect(()=>()=>{if(noticeTimer.current)clearTimeout(noticeTimer.current);},[]);
 useEffect(()=>{if(!guest)return;const changed=(event:StorageEvent)=>{if(event.storageArea===localStorage&&(event.key===GUEST_KEY||event.key===SAMPLE_HIDDEN_KEY||event.key===null))setExternalChange(true);};window.addEventListener('storage',changed);return()=>window.removeEventListener('storage',changed);},[guest]);
 function commit(next:Binder[]){if(guest){try{const raw=writeGuest(localStorage,next,guestSnapshot.current);guestSnapshot.current=raw;setGuestRaw(raw);}catch(e){if(e instanceof Error&&e.message.includes('another tab')){setExternalChange(true);throw e;}throw new Error('This change was not saved because browser storage is full or unavailable. Your earlier save is still here. Download a backup or create an account before trying again.');}}setBinders(next);}
 function restoreBackup(incoming:Binder[],replaceDamaged:boolean){if(busy||syncing||externalChange||!ready||(guestIssue&&!replaceDamaged))return false;try{const current=replaceDamaged?[]:binders,next=restoreGuestCopies(current,incoming);commit(next);setGuestIssue(false);setError('');setActive(next[current.length].id);setView('binders');toast('Your backup binders have been saved in this browser.');return true;}catch(e){setError(e instanceof Error?e.message:'The backup could not be saved. Your collection has not changed.');return false;}}
 function select(id:string){setActive(id);setView('binders');setQuery('');setFilter('all');setSort('custom');setError('');}
 function open(type:Dialog){
  setError('');setDialog(type);
  if(type==='card'){setEditCard(null);setUpload('');}
  if(type==='binder'){setEditBinder(null);setBinderGame('Pokémon');setTheme('pastel');setCoverColor('pink');setBackgroundColor(coverPaletteFor('pastel','pink')[0]);}
 }
 function editSettings(item:Binder){setError('');setEditBinder(item);setBinderGame(item.game);setTheme(item.theme||'classic');setCoverColor(item.color);const options=coverPaletteFor(item.theme||'classic',item.color);setBackgroundColor(options.includes(item.backgroundColor)?item.backgroundColor:options[0]);setDialog('binder');}
 function chooseTheme(value:string){setTheme(value);const colors=paletteFor(value);setCoverColor(colors[0]);setBackgroundColor(coverPaletteFor(value,colors[0])[0]);}
 function chooseSpine(value:string){setCoverColor(value);const options=coverPaletteFor(theme,value);if(!options.includes(backgroundColor))setBackgroundColor(options[0]);}
 function showDetails(entry:CardEntry){setDetailRef({binderId:entry.binder.id,cardId:entry.card.id});setError('');setDialog('details');}
 function editDetails(){if(!detailBinder||!detailCard)return;select(detailBinder.id);setEditCard(detailCard);setUpload(detailCard.image);setDialog('card');}
 function requestDelete(type:'binder'|'card',id:string,name:string){setDialog(null);setError('');setConfirm({type,id,name});}
 async function perform(action:()=>Promise<void>){if(busy||syncing||!ready||(guest&&(guestIssue||externalChange)))return;setBusy(true);setError('');try{await action();}catch(e){setError(e instanceof Error?e.message:'Please try again.');}finally{setBusy(false);}}
 async function submitBinder(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();const data=new FormData(event.currentTarget);
  const payload={name:String(data.get('name')).trim(),game:binderGame,color:coverColor,backgroundColor,bio:String(data.get('bio')).trim(),theme};
  await perform(async()=>{
   if(!payload.name)throw new Error('Give your binder a name first.');let next:Binder;
   if(editBinder){if(user)await api(`/api/binders/${editBinder.id}`,'PATCH',payload);next={...editBinder,...payload};commit(binders.map(item=>item.id===next.id?next:item));}
   else{if(guest&&binders.length>=6)throw new Error('Guest mode has room for 6 binders. Create an account to keep collecting.');next=user?(await api('/api/binders','POST',payload)).binder:{...payload,id:crypto.randomUUID(),cards:[],coverCardId:null,shareToken:null};commit([...binders,next]);}
   select(next.id);setBinderQuery('');setGameFilter('all');setDialog(null);toast(editBinder?'Your binder has been updated.':'Your new binder is ready for cards.');
  });
 }
 async function submitCard(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();const data=new FormData(event.currentTarget);
  await perform(async()=>{
   const name=String(data.get('name')).trim(),rarity=String(data.get('rarity')).trim();
   if(!name)throw new Error('Give your card a name first.');
   if(!isRarityForGame(binder.game,rarity))throw new Error('Choose a rarity for this binder’s card game.');
   if(guest&&!editCard&&binder.cards.length>=GUEST_CARD_LIMIT)throw new Error('Guest binders hold 50 cards. Create an account to add more.');
   const deck=String(data.get('deck')||'').trim(),cardNumber=String(data.get('cardNumber')||'').trim();
   const payload={name,rarity,deck,cardNumber,image:upload,favorite:editCard?.favorite||false};let card:Card;
   if(editCard){if(user)await api(`/api/cards/${editCard.id}`,'PATCH',payload);card={...editCard,...payload};}
   else card=user?(await api('/api/cards','POST',{...payload,binderId:binder.id})).card:{...payload,id:crypto.randomUUID()};
   commit(binders.map(item=>item.id===binder.id?{...item,cards:editCard?item.cards.map(value=>value.id===card.id?card:value):[...item.cards,card]}:item));
   setDialog(null);toast(editCard?'Your card has been updated.':'Your card has been added to the binder.');
  });
 }
 async function favorite(card:Card,binderId:string){await perform(async()=>{if(user)await api(`/api/cards/${card.id}`,'PATCH',{favorite:!card.favorite});commit(binders.map(item=>item.id===binderId?{...item,cards:item.cards.map(value=>value.id===card.id?{...value,favorite:!value.favorite}:value)}:item));});}
 async function remove(){if(!confirm)return;await perform(async()=>{
  if(confirm.type==='binder'&&confirm.id==='showcase'){if(user)await api('/api/preferences','PATCH',{sampleHidden:true});else localStorage.setItem(SAMPLE_HIDDEN_KEY,'true');setSampleHidden(true);setActive(binders[0]?.id||'empty');setView('binders');setQuery('');setFilter('all');setConfirm(null);setDetailRef(null);toast('The sample binder has been removed.');return;}
  if(user)await api(`/api/${confirm.type==='binder'?'binders':'cards'}/${confirm.id}`,'DELETE');
  const next=confirm.type==='binder'?binders.filter(item=>item.id!==confirm.id):binders.map(item=>({...item,coverCardId:item.coverCardId===confirm.id?null:item.coverCardId,cards:item.cards.filter(card=>card.id!==confirm.id)}));
  commit(next);if(confirm.type==='binder'&&active===confirm.id){setActive(next[0]?.id||(sampleHidden?'empty':'showcase'));setFilter('all');setQuery('');}setConfirm(null);setDetailRef(null);toast('Removed from your collection.');
 });}
 async function saveOrder(ids:string[],type:'binders'|'cards'){await perform(async()=>{
  const next=type==='binders'?reorderItems(binders,ids):binders.map(item=>item.id===binder.id?{...item,cards:reorderItems(item.cards,ids)}:item);
  if(user)await api('/api/order','POST',type==='binders'?{type,ids}:{type,ids,binderId:binder.id});
  commit(next);if(type==='binders')setBinderSort('custom');else setSort('custom');setDialog(null);toast('Your new order has been saved.');
 });}
 async function chooseCover(item:Binder,cardId:string|null){await perform(async()=>{if(user)await api(`/api/binders/${item.id}`,'PATCH',{coverCardId:cardId});commit(binders.map(value=>value.id===item.id?{...value,coverCardId:cardId}:value));toast(cardId?'This card is now the binder cover.':'The first card will be used as the binder cover.');});}
 const title=dialog==='binder'?(editBinder?'Edit binder':'Create a binder'):dialog==='card'?(editCard?'Edit your card':'Add a card'):dialog==='details'?(detailCard?.name||'Card details'):dialog==='order-binders'?'Arrange binders':dialog==='order-cards'?'Arrange cards':dialog==='share'?'Visibility & sharing':dialog==='signup'?'Create an account':dialog==='login'?'Log in':'How binders work';

 return <div className="app-shell">
 <aside className="sidebar">
  <a href="/" className="brand" aria-label="MyStuffsBetter home"><span className="brand-icon" aria-hidden="true"><svg viewBox="0 0 36 42" fill="none"><path d="M6 3h25v36H6zM3 9h6M3 21h6M3 33h6" stroke="currentColor" strokeWidth="2"/><path d="M13 10h11v8H13zM13 24h11v8H13z" fill="currentColor"/></svg></span><span>my stuffs<span className="brand-bottom">better</span></span></a>
  <div className="workspace-label">{shared?'Browsing':'Collection'}</div>
  <nav><button className={`nav-link ${!collectionView?'selected':''}`} onClick={()=>{if(shared){window.location.href='/';return;}setView('binders');setFilter('all');setQuery('');}}><LayoutGrid size={19}/>My binders{!shared&&<span className="nav-count">{binders.length}</span>}</button><button className={`nav-link ${globalFavorites?'selected':''}`} onClick={()=>{setView('favorites');setQuery('');setFilter('all');setSort('custom');}}><Heart size={19}/>{shared?'Binder favorites':'Favorites'}<span className="nav-count">{favorites.length}</span></button>{!shared&&<button className={`nav-link ${globalCards?'selected':''}`} onClick={()=>{setView('all-cards');setQuery('');setFilter('all');setSort('custom');}}><Layers size={19}/>See all cards<span className="nav-count">{total}</span></button>}</nav>
  <CommunityNav signedIn={!!user} compact/>
  <div className="sidebar-divider"/>
  <div className="sidebar-section-label binder-list-heading"><button className="binder-list-toggle" aria-expanded={bindersExpanded} aria-controls="sidebar-binders" onClick={()=>setBindersExpanded(!bindersExpanded)}>Open a binder<ChevronDown size={15} className={bindersExpanded?'expanded':''}/></button>{!shared&&<button className="icon-button" aria-label="Create binder" disabled={blocked} onClick={()=>open('binder')}><Plus size={16}/></button>}</div>
  <div id="sidebar-binders" className="binder-nav" hidden={!bindersExpanded}>{binders.map(item=><div className="binder-nav-row" key={item.id}><button className={`binder-nav-item ${active===item.id&&!collectionView?'active':''}`} onClick={()=>select(item.id)}><span className={`binder-dot ${item.color}`}/><span>{item.name}</span><span className="muted">{item.cards.length}</span></button>{!shared&&<button className="icon-button delete-binder" disabled={blocked} aria-label={`Delete ${item.name} binder`} onClick={()=>requestDelete('binder',item.id,item.name)}><Trash2 size={14}/></button>}</div>)}{!shared&&!sampleHidden&&<div className="binder-nav-row"><button className={`binder-nav-item ${demo&&!collectionView?'active':''}`} onClick={()=>select('showcase')}><BookOpen size={15}/><span>Sample binder</span></button><button className="icon-button delete-binder" disabled={blocked} aria-label="Delete sample binder" onClick={()=>requestDelete('binder','showcase',showcase.name)}><Trash2 size={14}/></button></div>}</div>
  {!shared&&<button className="new-binder-side" disabled={blocked} onClick={()=>open('binder')}><Plus size={16}/>New binder</button>}
  <div className="sidebar-bottom"><button className="help-button" onClick={()=>open('help')}><CircleHelp size={17}/>How binders work<ChevronRight size={15}/></button><div className="profile"><div className="avatar">{shared?<BookOpen size={17}/>:user?user.name.slice(0,1).toUpperCase():'G'}</div><div><strong>{shared?'Binder visitor':user?.name||'Guest collector'}</strong>{!user&&<small>{shared?'Viewing a shared binder':'Saved in this browser'}</small>}</div>{user&&<button className="icon-button" aria-label="Log out" onClick={()=>perform(async()=>{const result=await authClient.signOut();if(result.error)throw new Error('Could not log out. Try again.');location.href='/';})}><LogOut size={17}/></button>}</div></div>
 </aside>
 <div className="main-wrap">
  <header className="topbar"><div className="breadcrumb"><BookOpen size={17}/><span>{publicView?'Public binder':shared?'Shared binder':globalFavorites?'Favorites':globalCards?'All cards':'My binders'}</span>{!collectionView&&<><ChevronRight size={14}/><strong>{binder.name}</strong></>}</div><div className="topbar-right"><DisplayModeSwitch/>{(!user||shared)&&<><span className="live-dot"/><span className="top-status">{shared?'View only':'Guest mode'}</span></>}{!user&&!shared&&<button className="button login-button" onClick={()=>open('login')}>Log in<ArrowRight size={15}/></button>}</div></header>
  <main>
   {publicView&&<PublicBinderBar initial={publicView} user={user} publicName={publicView.publicName}/>}
   {guest&&<GuestSavePanel binders={binders} raw={guestRaw} disabled={busy||syncing||externalChange||!ready} issue={guestIssue} onRestore={restoreBackup} onAccount={()=>open('signup')} onRetry={loadGuest}/>}
   {guest&&externalChange&&<div className="error-banner" role="alert">Your collection changed in another tab. Review the latest save before editing; any open form will close.<button onClick={loadGuest}>Load latest save</button></div>}
   {syncing&&<div className="status-banner guest-transfer" role="status"><Cloud size={18}/><div>Moving your guest collection into your account. Keep this page open.{syncProgress.total>0&&<><progress aria-label="Guest collection upload" value={syncProgress.completed} max={syncProgress.total}/><span>{syncProgress.completed} of {syncProgress.total} batches saved</span></>}</div></div>}
   {syncError&&<div className="error-banner" role="alert">{syncError}<button onClick={()=>void loadAccount()}>Retry</button><span>Your browser copy stays here until the upload succeeds.</span>{guestRaw&&<button onClick={()=>downloadGuestBackup(guestRaw)}>Download guest backup</button>}</div>}
   {error&&!dialog&&!confirm&&<div className="error-banner" role="alert">{error}<button aria-label="Dismiss error" onClick={()=>setError('')}><X size={16}/></button></div>}
   {!shared&&!collectionView&&<section className="collection-desk" aria-labelledby="desk-title">
    <div className="desk-heading"><div><h1 id="desk-title">Collection desk</h1></div><button className="button primary" disabled={blocked} onClick={()=>open('binder')}><Plus size={18}/>Create a binder</button></div>
    <div className="shelf-heading"><h2>Your binders</h2><span>{binders.length} {binders.length===1?'binder':'binders'} containing {total} {total===1?'card':'cards'}</span></div>
    <div className="shelf-filters"><label className="search"><Search size={16}/><input value={binderQuery} onChange={event=>setBinderQuery(event.target.value)} placeholder="Find a binder…" aria-label="Find a binder"/></label><label>Game<select aria-label="Filter binders by game" value={gameFilter} onChange={event=>setGameFilter(event.target.value)}><option value="all">All games</option>{games.map(game=><option key={game}>{game}</option>)}</select></label><label>Order<select aria-label="Binder display order" value={binderSort} onChange={event=>setBinderSort(event.target.value)}><option value="custom">My order</option><option value="name">Name A–Z</option></select></label><button className="button desk-secondary" disabled={blocked||binders.length<2} onClick={()=>open('order-binders')}><SlidersHorizontal size={15}/>Arrange binders</button></div>
    <div className="binder-shelf" aria-label="Choose a binder">{shelf.map(item=>{const cover=coverCard(item);return <div className="shelf-item" key={item.id}><button className={`shelf-binder ${item.color} ${active===item.id?'is-open':''} ${item.id==='showcase'?'sample-cover':''}`} onClick={()=>select(item.id)} aria-pressed={active===item.id}><span className="binder-cover" style={appearanceStyle(item.theme||'classic',item.backgroundColor||'navy')}><span className="cover-spine" style={appearanceStyle(item.theme||'classic',item.color)} aria-hidden="true"/><span className="cover-topline">{item.id==='showcase'?'Sample binder':item.game}</span><span className="cover-window">{cover?.image?<img src={cover.image} alt=""/>:<span className="cover-monogram" aria-hidden="true">{item.name.slice(0,2).toUpperCase()}</span>}</span><span className="cover-name">{item.name}</span><span className="cover-bottomline">{item.cards.length} cards</span></span></button>{!shared&&<div className="shelf-item-actions">{item.id!=='showcase'&&<button disabled={blocked} onClick={()=>editSettings(item)} aria-label={`Edit ${item.name} binder`}><Pencil size={13}/>Edit</button>}<button disabled={blocked} onClick={()=>requestDelete('binder',item.id,item.name)} aria-label={`Delete ${item.name} from shelf`}><Trash2 size={13}/>Delete</button></div>}</div>;})}{!shelf.length&&<div className="shelf-no-results"><p>No binders match this search.</p><button className="text-button" onClick={()=>{setBinderQuery('');setGameFilter('all');}}>Clear binder filters</button></div>}<button className="shelf-new" disabled={blocked} onClick={()=>open('binder')}><Plus size={24}/><span>New binder</span></button></div>
   </section>}
   {!(empty&&!collectionView)&&<section className={`binder-section theme-${binder.backgroundColor||'navy'}`} style={binderAppearanceStyle(binder.theme||'classic',binder.backgroundColor||'navy',binder.color)} aria-label={globalFavorites?'Favorites from all binders':globalCards?'All cards from your binders':binder.name}>
    <div className="section-title-row"><div>{(collectionView||shared||demo)&&<div className="section-eyebrow">{collectionView?'Across your collection':publicView?'Public binder':shared?'Shared binder':'Sample binder'}</div>}<div className="binder-title">{collectionView?<h1 className="favorites-heading">{globalFavorites?'Favorites':'All cards'}</h1>:<h2>{binder.name}</h2>}{!collectionView&&<span className="game-tag">{binder.game}</span>}{user&&!shared&&!demo&&!empty&&!collectionView&&<span className="visibility-tag">{binder.visibility==='public'?'Public':binder.shareToken?'Link only':'Private'}</span>}</div><p className="binder-bio">{globalFavorites?`Your ${favorites.length} favorite ${favorites.length===1?'card is':'cards are'} gathered here from all your binders.`:globalCards?`${total} ${total===1?'card':'cards'} across ${binders.length} ${binders.length===1?'binder':'binders'}.`:binder.bio||(shared?'You can browse this collection, while only its owner can make changes.':`${binder.cards.length} ${binder.cards.length===1?'card is':'cards are'} saved in this binder${guest?' on this browser.':'.'}`)}</p></div>{!collectionView&&!readonly&&<div className="binder-actions"><button className="button secondary" disabled={blocked} onClick={()=>open('share')}><Link2 size={16}/>Visibility & sharing</button><button className="button primary" disabled={blocked} onClick={()=>open('card')}><Plus size={17}/>Add card</button><button className="icon-button border-button" aria-label="Edit binder" disabled={blocked} onClick={()=>editSettings(binder)}><Pencil size={17}/></button></div>}</div>
    <div className="binder-toolbar"><div className="filter-tabs">{collectionView?<span className="favorites-count">{globalFavorites?`${favorites.length} favorite ${favorites.length===1?'card':'cards'}`:`${total} ${total===1?'card':'cards'}`}</span>:<><button className={filter==='all'?'active':''} onClick={()=>setFilter('all')}>All cards<span>{binder.cards.length}</span></button><button className={filter==='favorites'?'active':''} onClick={()=>setFilter('favorites')}><Heart size={14}/>Binder favorites</button></>}</div><div className="tools"><label className="search"><Search size={16}/><input placeholder="Find a card…" aria-label="Find a card" value={query} onChange={event=>setQuery(event.target.value)}/>{query&&<button aria-label="Clear search" onClick={()=>setQuery('')}><X size={13}/></button>}</label><label className="sort-control"><ArrowDownWideNarrow size={16}/><select aria-label="Sort cards" value={sort} onChange={event=>setSort(event.target.value)}><option value="custom">My order</option><option value="name">Name A–Z</option>{!collectionView&&<option value="rarity">Rarity</option>}</select></label>{!collectionView&&!readonly&&<button className="icon-button border-button" disabled={blocked||binder.cards.length<2} aria-label="Arrange cards" title="Arrange cards" onClick={()=>open('order-cards')}><SlidersHorizontal size={16}/></button>}<div className="view-switch"><button className={!list?'active':''} aria-label="Grid view" aria-pressed={!list} onClick={()=>setList(false)}><Grid2X2 size={16}/></button><button className={list?'active':''} aria-label="List view" aria-pressed={list} onClick={()=>setList(true)}><List size={17}/></button></div></div></div>
    {!ready?<div className="empty-state"><span className="empty-symbol"><BookOpen size={36}/></span><h3>Opening your collection…</h3></div>:<div className={`card-grid ${list?'list-view':''}`}>
     {entries.map(entry=>{const {card,binder:source}=entry;const owned=!shared&&source.id!=='showcase';return <article className="collection-card" key={`${source.id}-${card.id}`}><div className="card-image-wrap"><button className="card-open" aria-label={`View details for ${card.name}`} onClick={()=>showDetails(entry)}><span className="card-slot">{String(source.cards.findIndex(value=>value.id===card.id)+1).padStart(2,'0')}</span><CardPicture card={card}/></button><button className={`card-heart ${card.favorite?'is-favorite':''}`} disabled={!owned||blocked} aria-label={`${card.favorite?'Unfavorite':'Favorite'} ${card.name}`} aria-pressed={card.favorite} onClick={()=>void favorite(card,source.id)}><Heart size={16} fill={card.favorite?'currentColor':'none'}/></button>{source.coverCardId===card.id&&<span className="cover-label">Cover</span>}</div><div className="card-caption"><div><h3><button className="card-title-button" onClick={()=>showDetails(entry)}>{card.name}</button></h3><p><span className={`rarity-dot ${card.rarity.toLowerCase().includes('secret')?'secret':''}`}/>{card.rarity}<span className="card-game">{source.game}</span></p>{(card.deck||card.cardNumber)&&<p className="card-metadata">{[card.deck,card.cardNumber&&`#${card.cardNumber}`].filter(Boolean).join(' · ')}</p>}{collectionView&&<button className="source-binder" onClick={()=>select(source.id)}><BookOpen size={12}/>{source.name}<ChevronRight size={12}/></button>}</div>{owned&&<div className="card-options"><button className="icon-button" aria-label={`Edit ${card.name}`} disabled={blocked} onClick={()=>{select(source.id);setEditCard(card);setUpload(card.image);setDialog('card');}}><Pencil size={14}/></button><button className="icon-button delete-card" aria-label={`Remove ${card.name}`} disabled={blocked} onClick={()=>requestDelete('card',card.id,card.name)}><Trash2 size={14}/></button></div>}</div></article>;})}
     {!entries.length&&<div className="empty-state"><span className="empty-symbol">{query?<Search size={36}/>:globalFavorites||filter==='favorites'?<Heart size={36}/>:<Layers size={36}/>}</span><h3>{query?'No cards found':globalCards?'Your cards go here':globalFavorites||filter==='favorites'?'Your favorites go here':'Ready for your first card?'}</h3><p>{query?'Try a different card name.':globalCards?'Add cards to any of your binders to see them together here.':globalFavorites?'Choose the heart on a card in any of your binders to find it here.':filter==='favorites'?'Choose the heart on a card to find it here later.':shared?'This collector hasn’t added any cards yet.':'Give your first card a name to start filling this binder. You can add a picture whenever you like.'}</p>{!collectionView&&!readonly&&filter==='all'&&!query&&<button className="button primary" disabled={blocked} onClick={()=>open('card')}><Plus size={17}/>Add your first card</button>}</div>}
     {!collectionView&&!readonly&&!!entries.length&&filter==='all'&&!query&&<button className="add-card-slot" aria-label="Add card" disabled={blocked} onClick={()=>open('card')}><span aria-hidden="true"><Plus size={27}/></span></button>}
    </div>}
    <div className="binder-foot">{(!user||collectionView||demo)&&<span><ShieldCheck size={14}/>{collectionView?'Sample cards are separate from your collection.':shared?'Shared with a view-only link':demo?'Sample cards are separate from your saved collection.':guest?'Your guest collection is saved only in this browser.':''}</span>}{!collectionView&&!shared&&!empty&&<button disabled={blocked} onClick={()=>requestDelete('binder',binder.id,binder.name)}>{demo?'Delete sample binder':'Delete binder'}</button>}</div>
   </section>}
   {empty&&!collectionView&&<div className="empty-state"><span className="empty-symbol"><BookOpen size={36}/></span><h3>Your collection starts here</h3><p>Create a binder for the cards you want to keep together.</p><button className="button primary" disabled={blocked} onClick={()=>open('binder')}><Plus size={17}/>Create a binder</button></div>}
  </main>
 </div>
 {notice&&<div className="toast" role="status"><Check size={17}/>{notice}</div>}
 {dialog&&<Modal title={title} className={dialog==='details'?'card-detail-modal':dialog.startsWith('order-')?'order-modal':''} close={()=>{if(!busy&&!uploadBusy){setDialog(null);setError('');}}}>
  {guest&&externalChange&&<div className="error-banner" role="alert">Another tab changed your collection, so saving is paused. Loading the latest save will close this form.<button onClick={loadGuest}>Load latest save</button></div>}
  {(dialog==='signup'||dialog==='login')&&<AuthForm initial={dialog==='login'?'sign-in':'sign-up'} guestSummary={guest?{binders:binders.length,cards:total}:undefined} onContinueGuest={guest?()=>setDialog(null):undefined}/>}
  {dialog==='binder'&&<form className="stack-form" onSubmit={submitBinder}>
   <p className="muted">Give this binder a name so you can find it when you add cards.</p>
   <label>Binder name<input name="name" required maxLength={60} defaultValue={editBinder?.name} placeholder="e.g. My Pokémon binder" autoFocus/></label>
   <label>Card game<select name="game" value={binderGame} onChange={event=>setBinderGame(event.target.value)}>{games.map(game=><option key={game}>{game}</option>)}</select></label>
   {editBinder&&binderGame!==editBinder.game&&<p className="small muted">Changing the game updates the rarity choices. Existing cards keep their labels until you edit them.</p>}
   <label>Binder detail / bio<textarea name="bio" rows={3} maxLength={180} defaultValue={editBinder?.bio||''} placeholder="e.g. My favorite pulls from packs I opened with friends."/><span className="field-hint">You can add up to 180 characters. This line is visible when you share your binder.</span></label>
   <label>Binder theme<select name="theme" value={theme} onChange={event=>chooseTheme(event.target.value)}>{Object.entries(binderThemes).map(([id,option])=><option key={id} value={id}>{option.label}</option>)}</select></label>
   <ColorPicker label="Binder spine color" name="color" colors={paletteFor(theme,coverColor)} value={coverColor} onChange={chooseSpine} theme={theme}/>
   <ColorPicker label="Binder cover and page color" name="backgroundColor" colors={coverPaletteFor(theme,coverColor)} value={backgroundColor} onChange={setBackgroundColor} background theme={theme}/>
   <div className={`binder-color-preview theme-${backgroundColor}`} style={binderAppearanceStyle(theme,backgroundColor,coverColor)} aria-label="Binder background preview"><span className={`preview-spine ${coverColor}`} style={appearanceStyle(theme,coverColor)}/><span>{binderGame} binder</span></div>
   {error&&<p className="form-error" role="alert">{error}</p>}<button className="button primary wide" disabled={busy}>{busy?'Saving…':editBinder?'Save changes':'Create binder'}<ArrowRight size={16}/></button>
   {guest&&<p className="small muted">Saved only in this browser until you create an account.</p>}
   {editBinder&&<button className="text-button danger" type="button" disabled={busy} onClick={()=>requestDelete('binder',editBinder.id,editBinder.name)}>Delete this binder</button>}
  </form>}
  {dialog==='card'&&<form className="stack-form" onSubmit={submitCard}>
   <label className={`upload-zone ${upload?'has-image':''}`}><input type="file" aria-label="Card picture" accept={UPLOAD_ACCEPT} disabled={busy||uploadBusy} onChange={async event=>{const file=event.target.files?.[0];if(!file)return;setUploadBusy(true);setError('');try{setUpload(await picture(file,guest?GUEST_IMAGE_DATA_LIMIT:330000));}catch(e){setError(e instanceof Error?e.message:'Could not open this picture.');}finally{setUploadBusy(false);}}}/>{upload?<><img src={upload} alt="Card preview"/><span><ImagePlus size={16}/>Change picture</span></>:<><ImagePlus size={28}/><strong>{uploadBusy?'Getting your picture ready…':'Add a picture (optional)'}</strong><span>JPG, PNG, WebP, or GIF · up to 10 MiB</span></>}</label>
   {upload&&<button className="text-button" type="button" disabled={busy||uploadBusy} onClick={()=>setUpload('')}>Remove picture</button>}
   <p className="small muted upload-guidelines">{UPLOAD_GUIDELINES}{guest?' Guest pictures are compressed further to leave room for your collection.':''}</p>
   <label>Card name<input name="name" required maxLength={100} defaultValue={editCard?.name} placeholder="e.g. Charizard VMAX"/></label>
   <label>Deck (optional)<input name="deck" maxLength={100} defaultValue={editCard?.deck||''} placeholder="e.g. My first deck"/></label>
   <label>Card number (optional)<input name="cardNumber" maxLength={40} defaultValue={editCard?.cardNumber||''} placeholder="e.g. 061/298"/></label>
   <label>Rarity{binder.game==='Other'?<><input name="rarity" required maxLength={60} list="other-rarities" defaultValue={editCard?.rarity||''} placeholder="e.g. Legendary, Event exclusive, or Rare"/><datalist id="other-rarities">{otherRarities.map(rarity=><option key={rarity} value={rarity}/>)}</datalist><span className="field-hint">Enter your own rarity, or choose a suggestion. You can use up to 60 characters.</span></>:<select name="rarity" required defaultValue={editCard?(isRarityForGame(binder.game,editCard.rarity)?editCard.rarity:''):raritiesFor(binder.game)[0]}>{editCard&&!isRarityForGame(binder.game,editCard.rarity)&&<option value="" disabled>Choose a {binder.game} rarity</option>}{raritiesFor(binder.game).map(rarity=><option key={rarity}>{rarity}</option>)}</select>}</label>
   {error&&<p className="form-error" role="alert">{error}</p>}<button className="button primary wide" disabled={busy||uploadBusy}>{busy?'Saving your card…':editCard?'Save changes':'Add to binder'}<Plus size={17}/></button><p className="small muted">{guest?'Each guest binder can hold 50 cards before you need an account to add more.':'Your picture and card details will be saved to your account.'}</p>
  </form>}
  {dialog==='details'&&detailBinder&&detailCard&&<div className="card-detail-content"><div className={`detail-picture theme-${detailBinder.backgroundColor||'navy'}`} style={binderAppearanceStyle(detailBinder.theme||'classic',detailBinder.backgroundColor||'navy',detailBinder.color)}><CardPicture card={detailCard}/></div><div className="detail-information"><dl><div><dt>Binder</dt><dd>{detailBinder.name}</dd></div><div><dt>Card game</dt><dd>{detailBinder.game}</dd></div><div><dt>Rarity</dt><dd>{detailCard.rarity}</dd></div><div><dt>Deck</dt><dd>{detailCard.deck||'-'}</dd></div><div><dt>Card number</dt><dd>{detailCard.cardNumber||'-'}</dd></div><div><dt>Position</dt><dd>{detailBinder.cards.findIndex(card=>card.id===detailCard.id)+1} of {detailBinder.cards.length}</dd></div><div><dt>Favorite</dt><dd>{detailCard.favorite?'Yes':'No'}</dd></div><div><dt>Binder cover</dt><dd>{coverCard(detailBinder)?.id===detailCard.id?'This card':'-'}</dd></div></dl>{detailOwned&&<div className="detail-actions"><button className="button secondary" disabled={blocked} onClick={()=>void favorite(detailCard,detailBinder.id)}><Heart size={16} fill={detailCard.favorite?'currentColor':'none'}/>{detailCard.favorite?'Remove favorite':'Add to favorites'}</button><button className="button primary" disabled={blocked} onClick={editDetails}><Pencil size={16}/>Edit card</button><button className="button secondary" disabled={blocked||detailBinder.coverCardId===detailCard.id} onClick={()=>void chooseCover(detailBinder,detailCard.id)}><ImagePlus size={16}/>{detailBinder.coverCardId===detailCard.id?'Selected cover':'Use as binder cover'}</button>{detailBinder.coverCardId&&<button className="text-button" disabled={blocked} onClick={()=>void chooseCover(detailBinder,null)}>Use the first card as the cover automatically</button>}<button className="text-button danger" disabled={blocked} onClick={()=>requestDelete('card',detailCard.id,detailCard.name)}>Delete this card</button></div>}{!shared&&<button className="text-button" onClick={()=>{select(detailBinder.id);setDialog(null);}}>Open this binder</button>}{error&&<p className="form-error" role="alert">{error}</p>}</div></div>}
  {dialog==='order-binders'&&<><OrderingList items={binders.map(item=>({id:item.id,name:item.name,image:coverCard(item)?.image}))} busy={busy} onSave={ids=>void saveOrder(ids,'binders')}/>{error&&<p className="form-error" role="alert">{error}</p>}</>}
  {dialog==='order-cards'&&<><OrderingList items={binder.cards.map(card=>({id:card.id,name:card.name,image:card.image}))} busy={busy} onSave={ids=>void saveOrder(ids,'cards')}/>{error&&<p className="form-error" role="alert">{error}</p>}</>}
  {dialog==='share'&&(guest?<div className="share-content"><h3>Create an account to publish or share</h3><p>Guest binders stay private in this browser. Creating an account moves this collection online so you can choose who sees it.</p><button className="button primary wide" onClick={()=>open('signup')}>Save my collection<ArrowRight size={16}/></button></div>:<BinderPublishing key={binder.id} binder={binder} blocked={blocked} onChange={data=>{commit(binders.map(item=>item.id===binder.id?{...item,...data}:item));toast(data.visibility==='public'?'Your binder is now in Explore binders.':'Your binder is private and viewing links are turned off.');}}/>)}

  {dialog==='help'&&<div className="help-content"><p>Create a binder and give it a name, game, and theme. You can filter the binder shelf by game or search for a binder by its name or bio.</p><p>Enter a card’s name and rarity, and optionally add a picture, deck, and card number. For Other games, you can enter a custom rarity. Clicking a card opens its details, where you can choose it as the binder cover.</p><p>The Favorites button in the sidebar gathers favorites from all your binders. The smaller favorites tab inside a binder shows only that binder’s favorites.</p><p>Choose Arrange binders or Arrange cards to change their saved order. You can drag rows, choose positions, or use the arrow buttons before saving.</p><p>{UPLOAD_GUIDELINES}</p><p className="help-note">Guests can keep up to 6 binders with 50 cards each, subject to the browser’s available storage. Clearing browser data can erase them, so create an account when you want to save them online. Your guest binders, chosen covers, themes, and order will move to your account after you sign in.</p></div>}
 </Modal>}
 {confirm&&<Modal title={confirm.id==='showcase'?'Remove the sample binder?':confirm.type==='binder'?'Delete this binder?':'Remove this card?'} close={()=>{if(!busy)setConfirm(null);}}><p className="muted">{confirm.id==='showcase'?'The example binder will be removed from your collection view.':confirm.type==='binder'?`“${confirm.name}” and all its cards will be removed, and its share link will stop working.`:`“${confirm.name}” will be removed from your binder and favorites.`}{confirm.id!=='showcase'&&' You will not be able to recover it after removal.'}</p>{error&&<p className="form-error" role="alert">{error}</p>}<div className="confirm-actions"><button className="button secondary" disabled={busy} onClick={()=>setConfirm(null)}>Keep it</button><button className="button destructive" disabled={busy} onClick={()=>void remove()}>{busy?'Removing…':'Yes, remove it'}</button></div></Modal>}
 </div>;
}
