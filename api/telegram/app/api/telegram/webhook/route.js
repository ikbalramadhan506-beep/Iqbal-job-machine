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
  return [...new Set((text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []).map(x => x.toLowerCase()))];
}

function extractForms(text) {
  return [...new Set((text.match(/https?:\/\/(?:docs\.google\.com\/forms|forms\.gle)\/[^\s)]+/gi) || []))];
}

function extractCompany(text) {
  const lines = (text || "").split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  const line = lines.find(x => /\bPT\.?\s+/i.test(x));
  return line ? line.replace(/^[•*\-]+\s*/, "").replace(/\s+#\w.*$/, "").trim() : "Tidak terdeteksi";
}

function extractPositions(text) {
  const lines = (text || "").split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  const matches = lines.filter(x => /operator|helper|warehouse|produksi|packing|pengemasan|teknisi|staff|crew/i.test(x));
  return matches.slice(0, 5);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function makeEmail(company, position) {
  return (
    "Yth. Tim HRD " + company + ",\n\n" +
    "Dengan hormat,\n\n" +
    "Perkenalkan, saya Muhammad Iqbal Ramadhan. Melalui email ini, saya ingin mengajukan lamaran untuk posisi " + position + " di " + company + ".\n\n" +
    "Saya merupakan lulusan SMK Teknik Elektronika Industri dari SMKN 1 Panyingkiran (2020–2023). Saya memiliki pengalaman kerja sebagai Helper Warehouse di PT Kaldu Sari Nabati Plant Majalengka, Crew Store di PT Alfaria Trijaya Tbk, serta Helper di PT Tiki Jalur Nugraha Ekakurir. Dari pengalaman tersebut, saya terbiasa bekerja secara teliti dan bertanggung jawab, mengikuti SOP, bekerja dalam tim maupun sistem shift, serta beradaptasi dengan lingkungan kerja yang dinamis.\n\n" +
    "Saya memiliki ketertarikan untuk berkembang di bidang operasional dan siap mempelajari hal-hal baru sesuai kebutuhan perusahaan. Saya berharap dapat diberikan kesempatan untuk mengikuti proses seleksi dan menjelaskan kualifikasi saya lebih lanjut.\n\n" +
    "Sebagai bahan pertimbangan, saya melampirkan CV.\n\n" +
    "Terima kasih atas waktu dan perhatian Bapak/Ibu. Saya menantikan kesempatan untuk dapat mengikuti proses seleksi di " + company + ".\n\n" +
    "Hormat saya,\n\n" +
    "Muhammad Iqbal Ramadhan\n" +
    "088971323962\n" +
    "ikbalramadhan506@gmail.com"
  );
}

function makeCandidateBlocks() {
  return [
    ["👤 NAMA", "Muhammad Iqbal Ramadhan"],
    ["🎂 TANGGAL LAHIR", "08 November 2004"],
    ["📧 EMAIL", "ikbalramadhan506@gmail.com"],
    ["📱 NO. HP", "088971323962"],
    ["📍 ALAMAT", "Belum tersedia di data CV"],
    ["🎓 PENDIDIKAN", "SMK Teknik Elektronika Industri – SMKN 1 Panyingkiran (2020–2023)"],
    ["💼 PENGALAMAN KERJA", "1. Helper Warehouse – PT Kaldu Sari Nabati Plant Majalengka (2023–2024)\n2. Crew Store – PT Alfaria Trijaya Tbk (2024)\n3. Helper – PT Tiki Jalur Nugraha Ekakurir (2024–2026)"],
    ["🛠️ KEAHLIAN", "Gesit, Teliti, Bertanggung jawab"],
    ["⚙️ BIDANG PENDIDIKAN", "Instalasi, maintenance, perbaikan perangkat elektronik, sistem kontrol otomatis, dan dasar otomasi industri"],
    ["📎 CV", "Cv_Muhammad_Iqbal_Ramadhan.pdf"]
  ];
}

function addBlock(title, value) {
  return "\n\n<b>" + escapeHtml(title) + "</b>\n<pre>" + escapeHtml(value) + "</pre>";
}

export async function POST(req) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret && req.headers.get("x-telegram-bot-api-secret-token") !== secret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const update = await req.json().catch(() => null);
  const msg = update?.message || update?.channel_post;
  const text = msg?.text || msg?.caption || "";
  if (!text) return NextResponse.json({ ok: true, ignored: true });

  const chatId = msg?.chat?.id;
  const company = extractCompany(text);
  const emails = extractEmails(text);
  const forms = extractForms(text);
  const positions = extractPositions(text);
  const position = positions[0] || "posisi yang tersedia";

  let reply =
    "<b>📋 DATA LOWONGAN</b>\n\n" +
    "<b>🏢 PT / PERUSAHAAN</b>\n<pre>" + escapeHtml(company) + "</pre>" +
    "\n\n<b>💼 POSISI</b>\n<pre>" + escapeHtml(positions.length ? positions.join(" | ") : "Tidak terdeteksi") + "</pre>" +
    "\n\n<b>📧 EMAIL / FROM</b>\n<pre>" + escapeHtml(emails.length ? emails.join("\n") : "Tidak ada email ditemukan") + "</pre>" +
    "\n\n<b>📝 GOOGLE FORM</b>\n<pre>" + escapeHtml(forms.length ? forms.join("\n") : "Tidak ada Google Form") + "</pre>";

  let replyMarkup = null;

  if (emails.length) {
    const subject = "Lamaran Kerja – " + position + " – Muhammad Iqbal Ramadhan";
    const coverLetter = makeEmail(company, position);
    reply += addBlock("✉️ SUBJECT", subject);
    reply += addBlock("📝 COVER LETTER", coverLetter);
    reply += "\n\n📎 <b>LAMPIRAN</b>\n<pre>Cv_Muhammad_Iqbal_Ramadhan.pdf</pre>";
    if (subject.length <= 256) {
      replyMarkup = { inline_keyboard: [[{ text: "📋 Copy Subject", copy_text: { text: subject } }]] };
    }
  }

  if (forms.length || emails.length) {
    for (const [title, value] of makeCandidateBlocks()) {
      reply += addBlock(title, value);
    }
  }

  if (chatId) {
    const payload = { chat_id: chatId, text: reply, parse_mode: "HTML" };
    if (replyMarkup) payload.reply_markup = replyMarkup;
    await sendTelegram(payload);
  }

  return NextResponse.json({ ok: true, company, positions, emails, forms });
}
