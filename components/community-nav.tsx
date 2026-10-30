'use client';
import Link from 'next/link';
import {Bell,BookOpen,Globe,Heart} from 'lucide-react';
import {useCommunityStatus} from './community-status';
export default function CommunityNav({compact=false,active=''}:{signedIn:boolean;compact?:boolean;active?:string}){
 const {unread,activityUnread}=useCommunityStatus();
 const links=[{id:'explore',href:'/community',label:'Explore binders',Icon:Globe,count:0},{id:'liked',href:'/community/liked',label:'Liked binders',Icon:Heart,count:0},{id:'subscribed',href:'/community/subscribed',label:'Subscriptions',Icon:BookOpen,count:0},{id:'updates',href:'/community/updates',label:'Binder updates',Icon:BookOpen,count:unread},{id:'notifications',href:'/community/notifications',label:'Notifications',Icon:Bell,count:activityUnread}];
 return <nav className={compact?'community-side-links':'community-nav'} aria-label="Binder community">{links.map(({id,href,label,Icon,count})=><Link key={id} href={href} prefetch={false} aria-current={active===id?'page':undefined} className={compact?`nav-link ${active===id?'selected':''}`:''}><Icon size={17}/>{label}{count>0&&<span className="nav-count" aria-label={`${count} unread ${label.toLowerCase()}`}>{count}</span>}</Link>)}</nav>;
}
