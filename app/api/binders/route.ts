import { account, failure, jsonBody } from '../../../lib/api';
import { sql } from '../../../lib/db';
import { binderInput } from '../../../lib/validation';
import {binderForClient} from '../../../lib/card-image-reference.mjs';
import type {Binder} from '../../../lib/types';
export const dynamic = 'force-dynamic';
export async function GET() {
 try {
  const user = await account(); const db = sql();
  const binders = await db`SELECT b.id,b.name,b.game,b.color,b.bio,b.background_color AS "backgroundColor",b.theme,b.cover_card_id AS "coverCardId",b.share_token AS "shareToken", COALESCE((SELECT json_agg(json_build_object('id',c.id,'name',c.name,'image',c.image,'rarity',c.rarity,'favorite',c.favorite,'deck',c.deck,'cardNumber',c.card_number) ORDER BY c.position,c.created_at,c.id) FROM cards c WHERE c.binder_id=b.id),'[]') AS cards FROM binders b WHERE user_id=${user.id} ORDER BY position,created_at,id`;
  return Response.json({binders:binders.map(binder=>binderForClient(binder as Binder))},{headers:{'Cache-Control':'private, no-store'}});
 } catch(e) { return failure(e); }
}
export async function POST(request: Request) {
 try {
  const user=await account(request); const data=binderInput.parse(await jsonBody(request));
  const [binder]=await sql()`INSERT INTO binders(user_id,name,game,color,bio,background_color,theme,position) SELECT ${user.id},${data.name},${data.game},${data.color},${data.bio},${data.backgroundColor},${data.theme},COALESCE(MAX(position),-1)+1 FROM binders WHERE user_id=${user.id} RETURNING id,name,game,color,bio,background_color AS "backgroundColor",theme,cover_card_id AS "coverCardId",share_token AS "shareToken"`;
  return Response.json({binder:{...binder,cards:[]}},{status:201});
 } catch(e) { return failure(e); }
}
