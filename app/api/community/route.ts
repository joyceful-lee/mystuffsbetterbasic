import {currentUser} from '../../../lib/auth';
import {ApiError,failure} from '../../../lib/api';
import {communityQuery,publicBinders} from '../../../lib/community';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{const input=communityQuery.parse(Object.fromEntries(new URL(request.url).searchParams)),user=await currentUser();if(input.view!=='explore'&&!user)throw new ApiError('Log in to see your liked binders, subscriptions, and updates.',401);return Response.json(await publicBinders(input,user?.id||null),{headers:{'Cache-Control':'private, no-store'}});}catch(e){return failure(e);}}
