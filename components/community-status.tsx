'use client';
import {createContext,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import Link from 'next/link';
import {Bell,X} from 'lucide-react';
type Activity={id:string;kind:'like'|'subscribe';actorName:string;createdAt:string;readAt:string|null};
type Status={unread:number;activityUnread:number;latestActivity:Activity|null};
const StatusContext=createContext<Status>({unread:0,activityUnread:0,latestActivity:null});
export const useCommunityStatus=()=>useContext(StatusContext);
export function CommunityStatusProvider({signedIn,children}:{signedIn:boolean;children:ReactNode}){
 const [status,setStatus]=useState<Status>({unread:0,activityUnread:0,latestActivity:null}),[notice,setNotice]=useState<Activity|null>(null);
 const previous=useRef<Activity|null|undefined>(undefined);
 useEffect(()=>{if(!signedIn)return;const abort=new AbortController();let fetching=false;const refresh=async()=>{if(document.visibilityState==='hidden'||fetching)return;fetching=true;try{const r=await fetch('/api/community/status',{cache:'no-store',signal:abort.signal});if(!r.ok)return;const d:Status=await r.json();if(abort.signal.aborted)return;const last=previous.current,next=d.latestActivity;if(last!==undefined&&next&&!next.readAt&&(!last||new Date(next.createdAt)>new Date(last.createdAt)))setNotice(next);previous.current=next;setStatus(d);}catch{}finally{fetching=false;}};void refresh();const timer=setInterval(()=>void refresh(),20000);window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);window.addEventListener('binder-updates-changed',refresh);return()=>{abort.abort();clearInterval(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);window.removeEventListener('binder-updates-changed',refresh);};},[signedIn]);
 useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(null),8000);return()=>clearTimeout(timer);},[notice]);
 return <StatusContext.Provider value={status}>{children}{notice&&<div className="activity-toast" role="status"><Bell size={20}/><Link href="/community/notifications">{notice.actorName} {notice.kind==='like'?'liked':'subscribed to'} your binder.</Link><button className="icon-button" aria-label="Dismiss notification" onClick={()=>setNotice(null)}><X size={16}/></button></div>}</StatusContext.Provider>;
}
export function NotificationBell({signedIn}:{signedIn:boolean}){const {activityUnread}=useCommunityStatus();return signedIn?<Link className="notification-bell icon-button" href="/community/notifications" aria-label={`Notifications${activityUnread?`, ${activityUnread} unread`:''}`}><Bell size={20}/>{activityUnread>0&&<span className="notification-badge">{activityUnread>99?'99+':activityUnread}</span>}</Link>:null;}
