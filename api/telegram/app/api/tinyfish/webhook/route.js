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

  if(chatId && status==="COMPLETED" && result?.cover_letter){
    const message =
      "📸 LOWONGAN DARI FOTO\n\n" +
      "🏢 PT: " + (result.company || "Tidak terdeteksi") + "\n" +
      "💼 Posisi: " + (result.position || "Tidak terdeteksi") + "\n" +
      "📍 Lokasi: " + (result.location || "Tidak terdeteksi") + "\n" +
      (result.email ? "📧 Email: " + result.email + "\n" : "") +
      (result.application_url ? "🔗 Link: " + result.application_url + "\n" : "") +
      "\n📄 COVER LETTER SIAP PAKAI\n\n" +
      result.cover_letter;
    await sendTelegram({chat_id:chatId,text:message});
  } else if(chatId && status!=="COMPLETED"){
    await sendTelegram({
      chat_id:chatId,
      text:"⚠️ Foto lowongan belum berhasil diproses. Coba kirim ulang foto yang lebih jelas."
    });
  }

  return NextResponse.json({ok:true});
}