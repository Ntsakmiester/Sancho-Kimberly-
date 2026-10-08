import { requireRole, audit } from '../../../../../lib/auth';
import { bodyOf } from '../../../../../lib/authflow';
import { addDashboardKeys, removeDashboardKey, keyMetadata, encryptionReady } from '../../../../../lib/ai/keys';
import { invalidateAiConfig } from '../../../../../lib/ai/settings';
export const dynamic = 'force-dynamic';
export async function GET(req) {
 const g=await requireRole(req,'owner');if(!g.user)return Response.json({error:'Forbidden.'},{status:g.status||403});
 return Response.json({keys:await keyMetadata(),encryption_ready:encryptionReady()},{headers:{'Cache-Control':'no-store'}});
}
export async function POST(req) {
 const g=await requireRole(req,'owner');if(!g.user)return Response.json({error:'Forbidden.'},{status:g.status||403});
 const origin=req.headers.get('origin');if(origin && new URL(origin).host!==req.headers.get('host'))return Response.json({error:'Invalid request origin.'},{status:403});
 try{
 const b=await bodyOf(req);
 if(b.action==='add')await addDashboardKeys(b.provider,b.value);
 else if(b.action==='remove' && Number.isInteger(Number(b.id)) && Number(b.id)>0)await removeDashboardKey(Number(b.id));
 else return Response.json({error:'Invalid key action.'},{status:400});
 invalidateAiConfig();await audit('AI_KEYS_CHANGED',{accountId:g.user.id,role:'owner',entity:'ai_provider_keys',newValue:{action:b.action,provider:b.provider||null}});
 return Response.json({ok:true});
 }catch(e){return Response.json({error:e.message||'Could not update keys.'},{status:400});}
}
