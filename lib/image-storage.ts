import { put, del } from '@vercel/blob';
import { ApiError } from './api';
import { validImage } from './validation';
import { cardImagePath, isBlobImage } from './card-image-reference.mjs';
export async function saveCardImage(image:string,userId:string,existing?:{id:string;image:string}){
 if(!image)return '';
 if(existing&&image===cardImagePath(existing.id)&&isBlobImage(existing.image))return existing.image;
 if(!validImage(image))throw new ApiError('Choose a valid JPG, PNG, WebP, or GIF picture.');
 const configured=!!(process.env.BLOB_READ_WRITE_TOKEN||process.env.BLOB_STORE_ID);
 if(!configured){if(process.env.VERCEL==='1')throw new ApiError('Picture storage is unavailable. Please try again later.',503);return image;}
 const comma=image.indexOf(','),type=image.slice(5,image.indexOf(';')),extension=type.split('/')[1];
 const blob=await put(`cards/${encodeURIComponent(userId)}/${crypto.randomUUID()}.${extension}`,Buffer.from(image.slice(comma+1),'base64'),{access:'private',contentType:type,addRandomSuffix:true});
 return blob.url;
}
export async function removeCardImages(images:string[]){
 const urls=images.filter(isBlobImage);if(!urls.length)return;
 try{await del(urls);}catch{console.error('Private image cleanup failed; unreferenced files remain inaccessible through the app.');}
}
