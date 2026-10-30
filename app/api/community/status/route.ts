import {account,failure} from '../../../../lib/api';
import {sql} from '../../../../lib/db';
export const dynamic='force-dynamic';
export async function GET(){try{const user=await account();const [row]=await sql()`SELECT count(*)::int AS unread FROM binder_reactions r JOIN binders b ON b.id=r.binder_id WHERE r.user_id=${user.id} AND r.subscribed_at IS NOT NULL AND b.visibility='public' AND EXISTS(SELECT 1 FROM cards c WHERE c.binder_id=b.id AND c.created_at>GREATEST(r.seen_at,r.subscribed_at,b.published_at))`;return Response.json(row,{headers:{'Cache-Control':'private, no-store'}});}catch(e){return failure(e);}}
