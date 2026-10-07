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

  const emailText = emails.length ? emails.map(x => "• " + x).join("\n") : "Tidak ada email ditemukan";
  const formText = forms.length ? forms.map(x => "• " + x).join("\n") : "Tidak ada Google Form";

  let reply =
    "📋 DATA LOWONGAN\n\n" +
    "🏢 PT: " + company + "\n" +
    "💼 Posisi: " + (positions.length ? positions.join(" | ") : "Tidak terdeteksi") + "\n\n" +
    "📧 Email / From:\n" + emailText + "\n\n" +
    "📝 Google Form:\n" + formText;

  if (emails.length) {
    reply +=
      "\n\n━━━━━━━━━━━━━━━━━━━━\n" +
      "✉️ COVER LETTER — SIAP COPY\n" +
      "━━━━━━━━━━━━━━━━━━━━\n\n" +
      "Subject: Lamaran Kerja – " + position + " – Muhammad Iqbal Ramadhan\n\n" +
      makeEmail(company, position) +
      "\n\n📎 Lampiran: Cv_Muhammad_Iqbal_Ramadhan.pdf";
  }

  if (forms.length) {
    reply +=
      "\n\n━━━━━━━━━━━━━━━━━━━━\n" +
      "📝 DATA GOOGLE FORM — SIAP COPY\n" +
      "━━━━━━━━━━━━━━━━━━━━\n" +
      "Nama: Muhammad Iqbal Ramadhan\n" +
      "Tanggal lahir: 08 November 2004\n" +
      "Email: ikbalramadhan506@gmail.com\n" +
      "No. HP: 088971323962\n" +
      "Pendidikan: SMK Teknik Elektronika Industri – SMKN 1 Panyingkiran (2020–2023)\n" +
      "Pengalaman: Helper Warehouse – PT Kaldu Sari Nabati Plant Majalengka; Crew Store – PT Alfaria Trijaya Tbk; Helper – PT Tiki Jalur Nugraha Ekakurir\n" +
      "CV: Cv_Muhammad_Iqbal_Ramadhan.pdf";
  }

  if (chatId) await sendTelegram({ chat_id: chatId, text: reply });

  return NextResponse.json({ ok: true, company, positions, emails, forms });
}
