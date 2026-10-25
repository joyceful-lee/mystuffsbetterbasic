import { z } from 'zod';
import { account, ApiError, failure, jsonBody } from '../../../../lib/api';
import { sql } from '../../../../lib/db';
import { isRarityForGame } from '../../../../lib/binder-config.mjs';
import { cardInput } from '../../../../lib/validation';
import {saveCardImage,removeCardImages} from '../../../../lib/image-storage';

type Context={params:Promise<{id:string}>};
export async function PATCH(request:Request,{params}:Context) {
 let uploaded='';
 try {const user=await account(request);const id=z.string().uuid().parse((await params).id);const body=await jsonBody(request);const db=sql();let rows;
  if(Object.keys(body).length===1&&'favorite' in body) {const favorite=z.boolean().parse(body.favorite);rows=await db`UPDATE cards SET favorite=${favorite} FROM binders b WHERE cards.id=${id} AND cards.binder_id=b.id AND b.user_id=${user.id} RETURNING cards.id`;}
  else {const data=cardInput.parse(body);const [binder]=await db`SELECT b.game,c.image FROM binders b JOIN cards c ON c.binder_id=b.id WHERE c.id=${id} AND b.user_id=${user.id}`;if(!binder)throw new ApiError('Card not found.',404);if(!isRarityForGame(binder.game,data.rarity))throw new ApiError('Choose a rarity for this binder’s card game.');const image=await saveCardImage(data.image,user.id,{id,image:binder.image});if(image!==binder.image)uploaded=image;rows=await db`UPDATE cards SET name=${data.name},image=${image},rarity=${data.rarity},favorite=${data.favorite},deck=${data.deck},card_number=${data.cardNumber} FROM binders b WHERE cards.id=${id} AND cards.binder_id=b.id AND b.user_id=${user.id} AND b.game=${binder.game} RETURNING cards.id`;if(rows.length&&image!==binder.image)await removeCardImages([binder.image]);}
  if(!rows.length)throw new ApiError('Card not found.',404);return Response.json({ok:true});
 }catch(e){await removeCardImages([uploaded]);return failure(e);}
}
export async function DELETE(request:Request,{params}:Context) {
 try {const user=await account(request);const id=z.string().uuid().parse((await params).id);const rows=await sql()`DELETE FROM cards USING binders b WHERE cards.id=${id} AND cards.binder_id=b.id AND b.user_id=${user.id} RETURNING cards.id,cards.image`;if(!rows.length)throw new ApiError('Card not found.',404);await removeCardImages(rows.map(row=>row.image));return Response.json({ok:true});}catch(e){return failure(e);}
}
