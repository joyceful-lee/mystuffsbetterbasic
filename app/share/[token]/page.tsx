import { notFound } from 'next/navigation';
import { sql } from '../../../lib/db';
import BinderApp from '../../../components/binder-app';
import type { Binder } from '../../../lib/types';
import {binderForClient} from '../../../lib/card-image-reference.mjs';
export const dynamic='force-dynamic';
export default async function Share({params}:{params:Promise<{token:string}>}) {
 const {token}=await params;if(!/^[a-f0-9]{64}$/.test(token))notFound();
 const [binder]=await sql()`SELECT b.id,b.name,b.game,b.color,b.bio,b.background_color AS "backgroundColor",b.theme,b.cover_card_id AS "coverCardId",NULL AS "shareToken",COALESCE((SELECT json_agg(json_build_object('id',c.id,'name',c.name,'image',c.image,'rarity',c.rarity,'favorite',c.favorite,'deck',c.deck,'cardNumber',c.card_number) ORDER BY c.position,c.created_at,c.id) FROM cards c WHERE c.binder_id=b.id),'[]') AS cards FROM binders b WHERE share_token=${token}`;
 if(!binder)notFound();return <BinderApp user={null} shared={binderForClient(binder as Binder,token)}/>;
}
