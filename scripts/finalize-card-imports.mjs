// Maintenance only: finalize explicitly queued, byte-verified card image imports.
// No source credentials or user identifiers belong in this file.
import {neon} from '@neondatabase/serverless';
import {put,get,del} from '@vercel/blob';
import {createHash} from 'node:crypto';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
if(!process.env.DATABASE_URL){console.log('No database configured; card image import skipped.');process.exit(0);}
const db=neon(process.env.DATABASE_URL);
try{
 const [table]=await db`SELECT to_regclass('public.card_image_imports') IS NOT NULL AS available`;
 if(!table.available){console.log('No card image imports queued.');process.exit(0);}
 const rows=await db`SELECT j.card_id,j.job_id,j.sha256,c.image FROM card_image_imports j JOIN cards c ON c.id=j.card_id WHERE j.completed_at IS NULL ORDER BY j.card_id LIMIT 50`;
 if(rows.length&&!(process.env.BLOB_READ_WRITE_TOKEN||process.env.BLOB_STORE_ID))throw new Error('Blob is required to finalize queued imports.');
 let count=0;
 for(const row of rows){
  const match=/^data:image\/(jpeg|png|webp|gif);base64,([A-Za-z0-9+/]+={0,2})$/.exec(row.image);
  // Respect edits made by the account owner after the import was queued.
  if(!match){await db`UPDATE card_image_imports SET completed_at=now(),status='superseded' WHERE card_id=${row.card_id}`;continue;}
  const bytes=Buffer.from(match[2],'base64');if(hash(bytes)!==row.sha256)throw new Error('Import source bytes changed.');
  const uploaded=await put(`cards/imports/${row.job_id}/${row.card_id}.${match[1]}`,bytes,{access:'private',contentType:`image/${match[1]}`,addRandomSuffix:true});
  try{
   const stored=await get(uploaded.url,{access:'private',useCache:false});if(!stored||stored.statusCode!==200)throw new Error('Imported image could not be read back.');
   const verified=Buffer.from(await new Response(stored.stream).arrayBuffer());if(hash(verified)!==row.sha256)throw new Error('Imported image verification failed.');
   const [updated]=await db.transaction([
    db`UPDATE cards SET image=${uploaded.url} WHERE id=${row.card_id} AND image=${row.image} RETURNING id`,
    db`UPDATE card_image_imports j SET completed_at=now(),status=CASE WHEN c.image=${uploaded.url} THEN 'verified' ELSE 'superseded' END,verified_bytes=CASE WHEN c.image=${uploaded.url} THEN ${verified.length} ELSE NULL END FROM cards c WHERE j.card_id=${row.card_id} AND c.id=j.card_id RETURNING status`
   ]);
   if(!updated.length)await del(uploaded.url);else count++;
  }catch{await del(uploaded.url).catch(()=>{});throw new Error('Queued image verification failed.');}
 }
 const [{remaining}]=await db`SELECT count(*)::int AS remaining FROM card_image_imports WHERE completed_at IS NULL`;
 if(remaining)throw new Error('Some queued images remain unfinished.');
 console.log(`Verified ${count} imported pictures in private Blob storage.`);
}catch{console.error('Card image import failed. Existing card data and queued source images have been preserved for retry.');process.exitCode=1;}
