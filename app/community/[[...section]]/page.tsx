import {notFound} from 'next/navigation';
import {currentUser} from '../../../lib/auth';
import {sql} from '../../../lib/db';
import {binderForClient} from '../../../lib/card-image-reference.mjs';
import BinderApp from '../../../components/binder-app';
import CommunityApp from '../../../components/community-app';
import type {Binder} from '../../../lib/types';
import {z} from 'zod';
export const dynamic='force-dynamic';
export default async function Community({params}:{params:Promise<{section?:string[]}>}){
 const {section=[]}=await params;if(section.length>1)notFound();const part=section[0]||'explore',session=await currentUser(),user=session?{id:session.id,name:session.name,email:session.email}:null;
 if(['explore','liked','subscribed','updates','notifications'].includes(part))return <CommunityApp key={part} user={user} view={part as 'explore'|'liked'|'subscribed'|'updates'|'notifications'}/>;
 if(!z.string().uuid().safeParse(part).success)notFound();
 const [row]=await sql()`SELECT b.id,b.name,b.game,b.color,b.bio,b.theme,b.background_color AS "backgroundColor",b.cover_card_id AS "coverCardId",b.visibility,b.public_name AS "publicName",NULL AS "shareToken",
  COALESCE((SELECT json_agg(json_build_object('id',c.id,'name',c.name,'image',c.image,'rarity',c.rarity,'favorite',c.favorite,'deck',c.deck,'cardNumber',c.card_number) ORDER BY c.position,c.created_at,c.id) FROM cards c WHERE c.binder_id=b.id),'[]') AS cards,
  (SELECT count(*)::int FROM binder_reactions r WHERE r.binder_id=b.id AND r.liked) AS likes,
  EXISTS(SELECT 1 FROM binder_reactions r WHERE r.binder_id=b.id AND r.user_id=${user?.id||null} AND r.liked) AS liked,
  EXISTS(SELECT 1 FROM binder_reactions r WHERE r.binder_id=b.id AND r.user_id=${user?.id||null} AND r.subscribed_at IS NOT NULL) AS subscribed,(b.user_id=${user?.id||null}) IS TRUE AS "isOwner"
 FROM binders b WHERE b.id=${part}::uuid AND b.visibility='public'`;
 if(!row)notFound();const {publicName,likes,liked,subscribed,isOwner,...binder}=row;
 return <BinderApp user={user} shared={binderForClient(binder as Binder)} publicView={{id:part,publicName,likes,liked,subscribed,isOwner}}/>;
}
