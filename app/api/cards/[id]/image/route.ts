import { z } from 'zod';
import { get } from '@vercel/blob';
import { currentUser } from '../../../../../lib/auth';
import { sql } from '../../../../../lib/db';
import { failure } from '../../../../../lib/api';
import { isBlobImage } from '../../../../../lib/card-image-reference.mjs';
export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const id=z.string().uuid().parse((await params).id),share=new URL(request.url).searchParams.get('share');
  const [row]=await sql()`SELECT c.image,b.user_id,b.share_token FROM cards c JOIN binders b ON b.id=c.binder_id WHERE c.id=${id}`;
  if(!row||!isBlobImage(row.image))return new Response('Not found',{status:404});
  const shared=!!share&&/^[a-f0-9]{64}$/.test(share)&&row.share_token===share;
  if(!shared){const user=await currentUser();if(!user||user.id!==row.user_id)return new Response('Not found',{status:404});}
  const image=await get(row.image,{access:'private'});
  if(!image||image.statusCode!==200)return new Response('Not found',{status:404});
  return new Response(image.stream,{headers:{'Content-Type':image.blob.contentType||'application/octet-stream','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }catch(e){return failure(e);}
}
