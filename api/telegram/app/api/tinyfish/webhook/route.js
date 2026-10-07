import { NextResponse } from "next/server";

async function sendTelegram(body){
  const token=process.env.TELEGRAM_BOT_TOKEN;
  if(!token) return;
  await fetch("https://api.telegram.org/bot"+token+"/sendMessage",{
    method:"POST",
    headers:{"content-type":"application/json"},
    body:JSON.stringify(body)
  });
}

export async function POST(req){
  const payload=await req.json().catch(()=>null);
  const data=payload?.data||payload||{};
  const status=payload?.status||data.status;
  const result=data?.result||{};
  const goal=data?.goal||"";
  const m=goal.match(/CHAT_ID:(-?\d+)/);
  const chatId=m?.[1];

  if(chatId && status==="COMPLETED"){
    const company=result.company || "Tidak terdeteksi";
    const email=result.email || "Tidak ditemukan";
    await sendTelegram({
      chat_id:chatId,
      text:"📸 HASIL LOWONGAN\n\n🏢 PT/Perusahaan: "+company+"\n📧 Email/From: "+email
    });
  } else if(chatId && (status==="FAILED" || status==="CANCELLED")){
    await sendTelegram({
      chat_id:chatId,
      text:"⚠️ Foto belum bisa dibaca. Kirim ulang foto lowongan yang lebih jelas."
    });
  }
  return NextResponse.json({ok:true});
}