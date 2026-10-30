import {z} from 'zod';
import {account,failure} from '../../../lib/api';
import {sql} from '../../../lib/db';
export const dynamic='force-dynamic';
const query=z.object({page:z.coerce.number().int().min(0).max(10000).default(0),filter:z.enum(['all','unread']).default('all')});
export async function GET(request:Request){try{
 const user=await account(),{page,filter}=query.parse(Object.fromEntries(new URL(request.url).searchParams)),db=sql();
 const [clock]=await db`SELECT clock_timestamp()::text AS "asOf"`;const asOf=new Date(clock.asOf).toISOString();
 const rows=await db`SELECT n.id,n.kind,n.actor_name AS "actorName",n.binder_id AS "binderId",b.name AS "binderName",b.game,n.created_at AS "createdAt",n.read_at AS "readAt" FROM binder_notifications n JOIN binders b ON b.id=n.binder_id AND b.user_id=n.recipient_id WHERE n.recipient_id=${user.id} AND n.created_at<=${asOf}::timestamptz AND (${filter}='all' OR n.read_at IS NULL) ORDER BY n.created_at DESC,n.id DESC LIMIT 21 OFFSET ${page*20}`;
 return Response.json({notifications:rows.slice(0,20),hasMore:rows.length>20,asOf},{headers:{'Cache-Control':'private, no-store'}});
}catch(e){return failure(e);}}
