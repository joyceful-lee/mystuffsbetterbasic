'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {Bell,BookOpen,Globe,Heart} from 'lucide-react';
export default function CommunityNav({signedIn,compact=false,active=''}:{signedIn:boolean;compact?:boolean;active?:string}){
 const [unread,setUnread]=useState(0);
 useEffect(()=>{if(!signedIn)return;let cancelled=false;const refresh=async()=>{if(document.visibilityState==='hidden')return;try{const r=await fetch('/api/community/status',{cache:'no-store'});if(r.ok){const d=await r.json();if(!cancelled)setUnread(d.unread);}}catch{}};void refresh();const timer=setInterval(()=>void refresh(),45000);window.addEventListener('focus',refresh);window.addEventListener('binder-updates-changed',refresh);return()=>{cancelled=true;clearInterval(timer);window.removeEventListener('focus',refresh);window.removeEventListener('binder-updates-changed',refresh);};},[signedIn]);
 const links=[{id:'explore',href:'/community',label:'Explore binders',Icon:Globe},{id:'liked',href:'/community/liked',label:'Liked binders',Icon:Heart},{id:'subscribed',href:'/community/subscribed',label:'Subscriptions',Icon:BookOpen},{id:'updates',href:'/community/updates',label:'Binder updates',Icon:Bell}];
 return <nav className={compact?'community-side-links':'community-nav'} aria-label="Binder community">{links.map(({id,href,label,Icon})=><Link key={id} href={href} prefetch={false} aria-current={active===id?'page':undefined} className={compact?'nav-link':''}><Icon size={17}/>{label}{id==='updates'&&unread>0&&<span className="nav-count" aria-label={`${unread} binders have new cards`}>{unread}</span>}</Link>)}</nav>;
}
