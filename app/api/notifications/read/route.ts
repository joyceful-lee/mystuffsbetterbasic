import {z} from 'zod';
import {account,ApiError,failure,jsonBody} from '../../../../lib/api';
import {sql} from '../../../../lib/db';
const input=z.union([z.object({id:z.string().uuid()}).strict(),z.object({allThrough:z.string().datetime({offset:true})}).strict()]);
export async function POST(request:Request){try{
 const user=await account(request),data=input.parse(await jsonBody(request));
 if('id' in data){const rows=await sql()`UPDATE binder_notifications SET read_at=COALESCE(read_at,clock_timestamp()) WHERE id=${data.id} AND recipient_id=${user.id} RETURNING id`;if(!rows.length)throw new ApiError('Notification not found.',404);}
 else await sql()`UPDATE binder_notifications SET read_at=clock_timestamp() WHERE recipient_id=${user.id} AND read_at IS NULL AND created_at<=LEAST(${data.allThrough}::timestamptz,clock_timestamp())`;
 return Response.json({ok:true});
}catch(e){return failure(e);}}
