import { z } from 'zod';
import { account, ApiError, failure, jsonBody } from '../../../../lib/api';
import { sql } from '../../../../lib/db';
import { binderInput } from '../../../../lib/validation';
import {removeCardImages} from '../../../../lib/image-storage';

type Context={params:Promise<{id:string}>};
export async function PATCH(request:Request,{params}:Context) {
 try { const user=await account(request);const id=z.string().uuid().parse((await params).id);const body=await jsonBody(request);const db=sql();
  let rows;
  if ('coverCardId' in body) {const cover=z.string().uuid().nullable().parse(body.coverCardId);rows=await db`UPDATE binders b SET cover_card_id=${cover} WHERE b.id=${id} AND b.user_id=${user.id} AND (${cover}::uuid IS NULL OR EXISTS(SELECT 1 FROM cards c WHERE c.id=${cover}::uuid AND c.binder_id=b.id)) RETURNING cover_card_id AS "coverCardId"`;}
  else if ('shared' in body) { const shared=z.boolean().parse(body.shared);rows=await db`UPDATE binders SET share_token=${shared?crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-',''):null} WHERE id=${id} AND user_id=${user.id} RETURNING share_token AS "shareToken"`; }
  else {const data=binderInput.parse(body);rows=await db`UPDATE binders SET name=${data.name},game=${data.game},color=${data.color},bio=${data.bio},background_color=${data.backgroundColor},theme=${data.theme} WHERE id=${id} AND user_id=${user.id} RETURNING id,name,game,color,bio,background_color AS "backgroundColor",theme,cover_card_id AS "coverCardId"`;}
  if (!rows.length) throw new ApiError('Binder not found.',404);return Response.json(rows[0]);
 }catch(e){return failure(e);}
}
export async function DELETE(request:Request,{params}:Context) {
 try {const user=await account(request);const id=z.string().uuid().parse((await params).id);const images=await sql()`SELECT c.image FROM cards c JOIN binders b ON b.id=c.binder_id WHERE b.id=${id} AND b.user_id=${user.id}`;const rows=await sql()`DELETE FROM binders WHERE id=${id} AND user_id=${user.id} RETURNING id`;if(!rows.length)throw new ApiError('Binder not found.',404);await removeCardImages(images.map(row=>row.image));return Response.json({ok:true});}catch(e){return failure(e);}
}
