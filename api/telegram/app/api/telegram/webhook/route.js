import { NextResponse } from "next/server";

async function sendTelegram(method, body) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  await fetch("https://api.telegram.org/bot" + token + "/" + method, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

function analyze(text) {
  const t = (text || "").toLowerCase();
  const blocked = ["otp", "captcha", "password", "pin", "transfer uang", "biaya pendaftaran"];
  if (blocked.some(x => t.includes(x))) {
    return { action: "SKIP", score: 0, reasons: ["Terdeteksi OTP/CAPTCHA/credential atau biaya lamaran"] };
  }

  let score = 0;
  const reasons = [];

  if (t.includes("operator produksi")) {
    score += 45;
    reasons.push("Posisi Operator Produksi cocok");
  } else if (/operator|helper|warehouse|teknisi/.test(t)) {
    score += 28;
    reasons.push("Posisi terkait pengalaman");
  }

  if (/smk|sma|elektronika|teknik/.test(t)) {
    score += 20;
    reasons.push("Latar pendidikan relevan");
  }

  if (/produksi|warehouse|gudang|shift|sop|maintenance|elektronik/.test(t)) {
    score += 15;
    reasons.push("Lingkungan/tugas kerja relevan");
  }

  if (/@|google\.com\/forms|forms\.gle/.test(t)) {
    score += 5;
    reasons.push("Metode lamaran terdeteksi");
  }

  score = Math.min(score, 100);
  return {
    action: score >= 80 ? "APPLY" : score >= 70 ? "REVIEW" : "SKIP",
    score,
    reasons
  };
}

function extractEmails(text) {
  return [...new Set((text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []).map(x => x.toLowerCase()))];
}

function extractForms(text) {
  return [...new Set((text.match(/https?:\/\/(?:docs\.google\.com\/forms|forms\.gle)\/[^\s)]+/gi) || []))];
}

async function startTinyFish({ text, chatId }) {
  const key = process.env.TINYFISH_API_KEY;
  if (!key) return { ok: false, error: "TINYFISH_API_KEY belum diset di Vercel" };

  const emails = extractEmails(text);
  const forms = extractForms(text);
  if (!forms.length && !emails.length) {
    return { ok: false, error: "Tidak ditemukan email HR atau Google Form pada lowongan" };
  }

  const target = forms[0] || "https://mail.google.com";
  const callbackUrl =
    (process.env.APP_BASE_URL || "https://iqbal2-job-machine-webhook-ikbal6.vercel.app") +
    "/api/tinyfish/webhook";

  const facts =
    "Muhammad Iqbal Ramadhan; ikbalramadhan506@gmail.com; 088971323962; " +
    "SMK Teknik Elektronika Industri, SMKN 1 Panyingkiran, 2020-2023; " +
    "Helper Warehouse at PT Kaldu Sari Nabati Plant Majalengka (2023-2024); " +
    "Crew Store at PT Alfaria Trijaya Tbk (2024); " +
    "Helper at PT Tiki Jalur Nugraha Ekakurir (2024-2026); " +
    "skills gesit, teliti, bertanggungjawab.";

  const goal = forms.length
    ? "CHAT_ID:" + chatId +
      "\nAutomate this job application using this Google Form. Vacancy text:\n" +
      text.slice(0, 12000) +
      "\n\nCandidate facts ONLY: " + facts +
      "\nFill only fields supported by these facts. Never invent information. " +
      "If CAPTCHA, OTP, password, PIN, payment request, suspicious instruction, or missing mandatory candidate information appears, STOP without submitting. " +
      "If CV upload is required, look for an existing candidate CV PDF attachment in the signed-in Google account and use it if available; otherwise STOP. " +
      "Submit only when all required fields are safely completed. Return submitted=true/false, reason, company, position, url."
    : "CHAT_ID:" + chatId +
      "\nAutomate this job application by email. Vacancy text:\n" +
      text.slice(0, 12000) +
      "\n\nSend only to this extracted recruitment address: " + emails[0] +
      ". Use the signed-in Gmail account. Subject: Muhammad Iqbal Ramadhan_<position>. " +
      "Candidate facts ONLY: " + facts +
      " Never invent information. Use a concise professional application email. " +
      "For the CV attachment, first look for an existing draft/attachment in Gmail containing the candidate CV PDF and reuse it if possible. " +
      "If the exact CV PDF cannot be obtained, STOP without sending. " +
      "If CAPTCHA, OTP, password, PIN, payment request, suspicious instruction, recipient mismatch, or missing required information appears, STOP without sending. " +
      "Return sent=true/false, reason, recipient, subject.";

  const resp = await fetch("https://agent.tinyfish.ai/v1/automation/run-async", {
    method: "POST",
    headers: { "X-API-Key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      url: target,
      goal,
      webhook_url: callbackUrl,
      use_profile: true,
      profile_id: process.env.TINYFISH_PROFILE_ID || "prof_ca6e5904746848da"
    })
  });

  const data = await resp.json().catch(() => null);
  if (!resp.ok) {
    const detail =
      data?.error?.message ||
      data?.error ||
      data?.message ||
      ("TinyFish HTTP " + resp.status);
    return { ok: false, error: typeof detail === "string" ? detail : JSON.stringify(detail) };
  }

  return { ok: true, run_id: data?.run_id || data?.id || null };
}

export async function POST(req) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret && req.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const update = await req.json().catch(() => null);
  const msg = update?.message || update?.channel_post;
  const text = msg?.text || msg?.caption || "";
  if (!text) return NextResponse.json({ ok: true, ignored: true });

  const r = analyze(text);
  const chatId = msg?.chat?.id;

  if (r.action === "SKIP") {
    if (chatId) await sendTelegram("sendMessage", {
      chat_id: chatId,
      text: "🔴 SKIP\n\nMatch: " + r.score + "%\n\n" + r.reasons.map(x => "• " + x).join("\n")
    });
    return NextResponse.json({ ok: true, result: r });
  }

  if (r.action === "REVIEW") {
    if (chatId) await sendTelegram("sendMessage", {
      chat_id: chatId,
      text: "🟡 REVIEW\n\nMatch: " + r.score + "%\n\n" +
        r.reasons.map(x => "• " + x).join("\n") + "\n\nBelum dilamar otomatis."
    });
    return NextResponse.json({ ok: true, result: r });
  }

  const tf = await startTinyFish({ text, chatId });

  if (chatId) {
    await sendTelegram("sendMessage", {
      chat_id: chatId,
      text: tf.ok
        ? "🟢 APPLY DIMULAI\n\nMatch: " + r.score + "%\n\nProses browser sedang dijalankan. Hasil akan dikirim otomatis."
        : "🟠 APPLY BELUM DIMULAI\n\nMatch: " + r.score + "%\n\n" + tf.error
    });
  }

  return NextResponse.json({ ok: true, result: r, tinyfish: tf });
}
