import { NextResponse } from "next/server";

async function sendTelegram(method, body) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify(body)
  });
}

function analyze(text){
  const t=(text||"").toLowerCase();
  const blocked=["otp","transfer uang","biaya pendaftaran","captcha","password","pin"];
  if(blocked.some(x=>t.includes(x))) return {action:"SKIP",score:0,reasons:["Terdeteksi kata berisiko: OTP/CAPTCHA/credential"]};
  if(/(?:bayar|transfer).{0,30}(?:pendaftaran|lamaran|administrasi|biaya)/.test(t))
    return {action:"SKIP",score:0,reasons:["Lowongan meminta pembayaran/biaya lamaran"]};

  let score=0,reasons=[];

  // Candidate profile: SMK Teknik Elektronika Industri + warehouse/operations experience.
  if(t.includes("operator produksi")){
    score+=45;
    reasons.push("Posisi Operator Produksi cocok");
    score+=20;
    reasons.push("Latar SMK Teknik Elektronika Industri relevan");
    score+=20;
    reasons.push("Pengalaman kerja operasional/warehouse relevan");
  } else if(/operator|helper|warehouse|teknisi/.test(t)){
    score+=35;
    reasons.push("Posisi terkait pengalaman operator/helper/warehouse/teknisi");
    score+=20;
    reasons.push("Latar SMK Teknik Elektronika Industri relevan");
  }

  if(/produksi|warehouse|gudang|shift|sop|maintenance|elektronik/.test(t)){
    score+=10;
    reasons.push("Lingkungan/tugas kerja relevan");
  }

  if(/@|google\.com\/forms|docs\.google\.com\/forms/.test(t)){
    score+=5;
    reasons.push("Metode lamaran terdeteksi");
  }

  score=Math.min(score,100);
  return {action:score>=80?"APPLY":score>=70?"REVIEW":"SKIP",score,reasons};
}

export async function POST(req){
  const secret=process.env.TELEGRAM_WEBHOOK_SECRET;
  if(secret && req.headers.get("x-telegram-bot-api-secret-token")!==secret) return NextResponse.json({error:"Unauthorized"},{status:401});
  const update=await req.json().catch(()=>null);
  const msg=update?.message||update?.channel_post;
  const text=msg?.text||msg?.caption;
  if(!text) return NextResponse.json({ok:true,ignored:true});
  const r=analyze(text);
  if(msg?.chat?.id) await sendTelegram("sendMessage",{chat_id:msg.chat.id,text:`🤖 ${r.action}\n\nMatch: ${r.score}%\n\n${r.reasons.map(x=>"• "+x).join("\n")}`,disable_web_page_preview:true});
  return NextResponse.json({ok:true,result:r});
}