import { NextResponse } from "next/server";

async function sendTelegram(body) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  await fetch("https://api.telegram.org/bot" + token + "/sendMessage", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

function extractEmails(text) {
  return [...new Set(
    (text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [])
      .map(x => x.toLowerCase())
  )];
}

function extractForms(text) {
  return [...new Set(
    (text.match(/https?:\/\/(?:docs\.google\.com\/forms|forms\.gle)\/[^\s)]+/gi) || [])
  )];
}

function extractCompany(text) {
  const lines = (text || "").split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  const line = lines.find(x => /\bPT\.?\s+/i.test(x));
  if (!line) return "Tidak terdeteksi";
  return line
    .replace(/^[•*\-]+\s*/, "")
    .replace(/\s+#\w.*$/, "")
    .trim();
}

function extractPosition(text) {
  const lines = (text || "").split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  const matches = lines.filter(x => /operator|helper|warehouse|produksi|packing|pengemasan|teknisi|staff|crew/i.test(x));
  return matches.slice(0, 5).join(" | ") || "Tidak terdeteksi";
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

  const chatId = msg?.chat?.id;
  const company = extractCompany(text);
  const emails = extractEmails(text);
  const forms = extractForms(text);
  const positions = extractPosition(text);

  const emailText = emails.length ? emails.map(x => "• " + x).join("\n") : "Tidak ada email ditemukan";
  const formText = forms.length ? forms.map(x => "• " + x).join("\n") : "Tidak ada Google Form";

  if (chatId) {
    await sendTelegram({
      chat_id: chatId,
      text:
        "📋 DATA LOWONGAN\n\n" +
        "🏢 PT: " + company + "\n" +
        "💼 Posisi: " + positions + "\n\n" +
        "📧 Email / From:\n" + emailText + "\n\n" +
        "📝 Google Form:\n" + formText
    });
  }

  return NextResponse.json({
    ok: true,
    company,
    positions,
    emails,
    forms
  });
}
