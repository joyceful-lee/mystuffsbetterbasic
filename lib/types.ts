export type Card = { id: string; name: string; image: string; deck: string; cardNumber: string; rarity: string; favorite: boolean };
export type Binder = { id: string; name: string; game: string; color: string; backgroundColor: string; bio: string; theme: string; coverCardId: string | null; cards: Card[]; shareToken: string | null; visibility?:'private'|'public' };
export type PublicBinder = {id:string;name:string;game:string;color:string;backgroundColor:string;theme:string;bio:string;publicName:string;cardCount:number;coverImage:string;coverName:string;likes:number;liked:boolean;subscribed:boolean;isOwner:boolean;newCards:number;publishedAt:string;lastCardAt:string;asOf:string};
export type User = { id: string; name: string; email: string };
