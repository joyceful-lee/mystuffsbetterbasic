import {z} from 'zod';
import {sql} from './db';
import {games} from './binder-config.mjs';
import {cardImagePath,isBlobImage} from './card-image-reference.mjs';
import type {PublicBinder} from './types';
export const communityQuery=z.object({view:z.enum(['explore','liked','subscribed','updates']).default('explore'),q:z.string().trim().max(80).default(''),game:z.string().refine(game=>game==='all'||games.includes(game)).default('all'),sort:z.enum(['updated','newest','popular']).default('updated'),page:z.coerce.number().int().min(0).max(10000).default(0)});
export const reactionInput=z.object({kind:z.enum(['like','subscribe']),enabled:z.boolean()}).strict();
export async function publicBinders(input:z.infer<typeof communityQuery>,userId:string|null){
 const db=sql();const [clock]=await db`SELECT clock_timestamp()::text AS "asOf"`;const asOf=new Date(clock.asOf).toISOString();
 const {view,q,game,sort,page}=input;
 const rows=await db`WITH catalog AS (
  SELECT b.id,b.name,b.game,b.color,b.background_color AS "backgroundColor",b.theme,b.bio,b.public_name AS "publicName",b.published_at AS "publishedAt",
   (SELECT count(*)::int FROM cards c WHERE c.binder_id=b.id) AS "cardCount",
   (SELECT max(c.created_at) FROM cards c WHERE c.binder_id=b.id) AS "lastCardAt",
   (SELECT count(*)::int FROM binder_reactions l WHERE l.binder_id=b.id AND l.liked) AS likes,
   COALESCE(r.liked,false) AS liked,(r.subscribed_at IS NOT NULL) AS subscribed,(b.user_id=${userId}) IS TRUE AS "isOwner",
   (SELECT count(*)::int FROM cards c WHERE c.binder_id=b.id AND r.subscribed_at IS NOT NULL AND c.created_at>GREATEST(r.seen_at,r.subscribed_at,b.published_at) AND c.created_at<=${asOf}::timestamptz) AS "newCards",
   cover.id AS "coverId",COALESCE(cover.image,'') AS "coverImage",COALESCE(cover.name,'') AS "coverName"
  FROM binders b LEFT JOIN binder_reactions r ON r.binder_id=b.id AND r.user_id=${userId}
  LEFT JOIN LATERAL (SELECT c.id,c.image,c.name FROM cards c WHERE c.binder_id=b.id ORDER BY (c.id=b.cover_card_id) DESC NULLS LAST,c.position,c.created_at,c.id LIMIT 1) cover ON true
  WHERE b.visibility='public' AND (${game}='all' OR b.game=${game})
   AND (${q}='' OR position(lower(${q}) IN lower(b.name||' '||b.bio||' '||b.public_name))>0)
 ) SELECT * FROM catalog WHERE ${view}='explore' OR (${view}='liked' AND liked) OR (${view}='subscribed' AND subscribed) OR (${view}='updates' AND subscribed AND "newCards">0)
 ORDER BY CASE WHEN ${sort}='popular' THEN likes END DESC,CASE WHEN ${sort}='newest' THEN "publishedAt" ELSE COALESCE("lastCardAt","publishedAt") END DESC,id DESC
 LIMIT 13 OFFSET ${page*12}`;
 return {binders:rows.slice(0,12).map(row=>{const {coverId,...summary}=row;return {...summary,coverImage:isBlobImage(row.coverImage)?cardImagePath(coverId):row.coverImage,asOf} as PublicBinder;}),hasMore:rows.length>12};
}
