import {z} from 'zod';
import {account,ApiError,failure,jsonBody} from '../../../../../lib/api';
import {sql} from '../../../../../lib/db';
import {reactionInput} from '../../../../../lib/community';
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
 try{const user=await account(request),id=z.string().uuid().parse((await params).id),data=reactionInput.parse(await jsonBody(request)),db=sql();let rows;
  if(data.kind==='like')rows=await db`INSERT INTO binder_reactions(binder_id,user_id,liked) SELECT b.id,${user.id},${data.enabled} FROM binders b WHERE b.id=${id} AND b.visibility='public' AND b.user_id<>${user.id} ON CONFLICT(binder_id,user_id) DO UPDATE SET liked=EXCLUDED.liked RETURNING liked,subscribed_at IS NOT NULL AS subscribed`;
  else rows=await db`INSERT INTO binder_reactions(binder_id,user_id,subscribed_at) SELECT b.id,${user.id},CASE WHEN ${data.enabled} THEN now() ELSE NULL END FROM binders b WHERE b.id=${id} AND b.visibility='public' AND b.user_id<>${user.id} ON CONFLICT(binder_id,user_id) DO UPDATE SET subscribed_at=CASE WHEN ${data.enabled} THEN COALESCE(binder_reactions.subscribed_at,EXCLUDED.subscribed_at) ELSE NULL END,seen_at=CASE WHEN ${data.enabled} AND binder_reactions.subscribed_at IS NULL THEN now() ELSE binder_reactions.seen_at END RETURNING liked,subscribed_at IS NOT NULL AS subscribed`;
  if(!rows.length)throw new ApiError('This binder is unavailable or belongs to you.',404);
  const [{likes}]=await db`SELECT count(*)::int AS likes FROM binder_reactions WHERE binder_id=${id} AND liked`;
  return Response.json({...rows[0],likes});
 }catch(e){return failure(e);}
}
