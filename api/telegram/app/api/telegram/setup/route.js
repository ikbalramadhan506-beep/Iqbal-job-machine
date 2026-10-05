import { NextResponse } from "next/server";
export const dynamic="force-dynamic";
export async function GET(req){
  const token=process.env.TELEGRAM_BOT_TOKEN;
  if(!token) return NextResponse.json({ok:false,error:"TELEGRAM_BOT_TOKEN belum diset di Vercel"},{status:500});
  const webhookUrl=`${new URL(req.url).origin}/api/telegram/webhook`;
  const secret=process.env.TELEGRAM_WEBHOOK_SECRET;
  const body={url:webhookUrl,drop_pending_updates:false,allowed_updates:["message","channel_post"]};
  if(secret) body.secret_token=secret;
  const response=await fetch(`https://api.telegram.org/bot${token}/setWebhook`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body),cache:"no-store"});
  const telegram=await response.json().catch(()=>null);
  return NextResponse.json({ok:Boolean(telegram?.ok),webhook_url:webhookUrl,telegram:telegram?{ok:telegram.ok,description:telegram.description,result:telegram.result}:{ok:false,description:"Telegram tidak mengembalikan JSON"}},{status:telegram?.ok?200:502});
}