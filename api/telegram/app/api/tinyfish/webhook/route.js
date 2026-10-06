import { NextResponse } from "next/server";

async function sendTelegram(method, body){
  const token=process.env.TELEGRAM_BOT_TOKEN;
  if(!token) return;
  await fetch("https://api.telegram.org/bot"+token+"/"+method,{
    method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)
  });
}

export async function POST(req){
  const payload=await req.json().catch(()=>null);
  const data=payload?.data||payload||{};
  const status=payload?.status||data.status;
  const result=data.result||{};
  const goal=data.goal||"";
  const m=goal.match(/CHAT_ID:(-?\d+)/);
  const chatId=m?.[1];
  if(chatId){
    let message;
    if(status==="COMPLETED"){
      const success=result.sent===true || result.submitted===true;
      message=success
        ? "✅ LAMARAN TERKIRIM\n\n"+(result.recipient||result.company||"Lowongan")+"\n"+(result.subject||result.position||"")
        : "⚠️ AUTOMATION SELESAI, TIDAK TERKIRIM\n\n"+(result.reason||"Tidak ada bukti pengiriman.");
    }else{
      message="❌ APPLY GAGAL\n\nStatus: "+(status||"unknown")+"\n"+(result.reason||data.error||"Automation gagal.");
    }
    await sendTelegram("sendMessage",{chat_id:chatId,text:message});
  }
  return NextResponse.json({ok:true});
}