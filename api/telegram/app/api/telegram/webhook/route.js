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

async function sendPhotoToTinyFish(msg, chatId) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const tinyfishKey = process.env.TINYFISH_API_KEY;
  if (!token || !tinyfishKey || !msg?.photo?.length) return false;

  const photo = msg.photo[msg.photo.length - 1];
  const fileResp = await fetch("https://api.telegram.org/bot" + token + "/getFile?file_id=" + encodeURIComponent(photo.file_id));
  const fileData = await fileResp.json();
  const filePath = fileData?.result?.file_path;
  if (!filePath) return false;

  const imageUrl = "https://api.telegram.org/file/bot" + token + "/" + filePath;
  const webhookBase = process.env.APP_BASE_URL || "https://iqbal2-job-machine-webhook-ikbal6.vercel.app";
  const webhookUrl = webhookBase + "/api/tinyfish/webhook";

  const goal =
    "Read the job vacancy in the image carefully. Extract the company name, job position, location if visible, application email if visible, and application URL if visible. " +
    "CHAT_ID:" + chatId + " Then write a concise professional Indonesian cover letter specifically for that vacancy. " +
    "Use ONLY these verified candidate facts: Muhammad Iqbal Ramadhan; born 08 November 2004; SMK Teknik Elektronika Industri, SMKN 1 Panyingkiran, 2020-2023; " +
    "worked as Helper Warehouse at PT Kaldu Sari Nabati Plant Majalengka (2023-2024), Crew Store at PT Alfaria Trijaya Tbk (2024), and Helper at PT Tiki Jalur Nugraha Ekakurir (2024-2026); " +
    "skills/strengths: disciplined, detail-oriented, responsible, teamwork, shift work, follows SOP, willing to learn and adapt. " +
    "Do NOT invent degrees, certifications, machinery experience, production experience, years of experience, achievements, or other facts not listed above. " +
    "If a detail is not visible in the image, return an empty string rather than guessing. " +
    "Return JSON with keys: company, position, location, email, application_url, cover_letter.";

  const response = await fetch("https://agent.tinyfish.ai/v1/automation/run-async", {
    method: "POST",
    headers: {
      "X-API-Key": tinyfishKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      url: imageUrl,
      goal,
      webhook_url: webhookUrl,
      browser_profile: "lite",
      output_schema: {
        type: "object",
        properties: {
          company: { type: "string" },
          position: { type: "string" },
          location: { type: "string" },
          email: { type: "string" },
          application_url: { type: "string" },
          cover_letter: { type: "string" }
        },
        required: ["company", "position", "location", "email", "application_url", "cover_letter"]
      }
    })
  });

  return response.ok;
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

function makeEmail(company, position) {
  return (
    "Yth. HRD " + company + ",\n\n" +
    "Perkenalkan, saya Muhammad Iqbal Ramadhan. Saya bermaksud melamar posisi " + position + " di " + company + ".\n\n" +
    "Saya merupakan lulusan SMK Teknik Elektronika Industri dari SMKN 1 Panyingkiran (2020–2023) dan memiliki pengalaman sebagai Helper Warehouse di PT Kaldu Sari Nabati Plant Majalengka, Crew Store di PT Alfaria Trijaya Tbk, serta Helper di PT Tiki Jalur Nugraha Ekakurir. Saya terbiasa bekerja secara teliti, bertanggung jawab, mengikuti SOP, bekerja dalam tim maupun shift, serta siap belajar dan beradaptasi.\n\n" +
    "Sebagai bahan pertimbangan, saya melampirkan CV.\n\n" +
    "Terima kasih atas perhatian dan kesempatan yang diberikan.\n\n" +
    "Hormat saya,\n" +
    "Muhammad Iqbal Ramadhan\n" +
    "088971323962\n" +
    "ikbalramadhan506@gmail.com"
  );
}

export async function POST(req) {
  const url = new URL(req.url);

  // TinyFish callback for photo-based vacancy processing.
  if (url.searchParams.get("source") === "tinyfish") {
    const chatId = url.searchParams.get("chat_id");
    const payload = await req.json().catch(() => null);
    const data = payload?.data || payload || {};
    const result = data?.result || {};
    if (chatId && payload?.status === "COMPLETED" && result?.cover_letter) {
      const details =
        "📸 LOWONGAN DARI FOTO\n\n" +
        "🏢 PT: " + (result.company || "Tidak terdeteksi") + "\n" +
        "💼 Posisi: " + (result.position || "Tidak terdeteksi") + "\n" +
        "📍 Lokasi: " + (result.location || "Tidak terdeteksi") + "\n" +
        (result.email ? "📧 Email: " + result.email + "\n" : "") +
        (result.application_url ? "🔗 Link: " + result.application_url + "\n" : "") +
        "\n📄 COVER LETTER SIAP PAKAI\n\n" +
        result.cover_letter;
      await sendTelegram({ chat_id: chatId, text: details });
    } else if (chatId && payload?.status !== "COMPLETED") {
      await sendTelegram({ chat_id: chatId, text: "⚠️ Foto lowongan belum berhasil diproses. Coba kirim ulang foto yang lebih jelas." });
    }
    return NextResponse.json({ ok: true });
  }

  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret && req.headers.get("x-telegram-bot-api-secret-token") !== secret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const update = await req.json().catch(() => null);
  const msg = update?.message || update?.channel_post;
  const chatId = msg?.chat?.id;

  // Photo vacancy: send the image to TinyFish vision/browser processing.
  if (msg?.photo?.length && chatId) {
    const started = await sendPhotoToTinyFish(msg, chatId).catch(() => false);
    await sendTelegram({
      chat_id: chatId,
      text: started
        ? "📸 Foto lowongan diterima. Saya sedang membaca lowongan dan membuat cover letter sesuai CV kamu. Tunggu sebentar..."
        : "⚠️ Foto diterima, tetapi pemrosesan belum bisa dimulai. Coba kirim ulang foto."
    });
    return NextResponse.json({ ok: true, photo: true });
  }

  const text = msg?.text || msg?.caption || "";
  if (!text) return NextResponse.json({ ok: true, ignored: true });

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
      "\n\n⚡ EMAIL SIAP KIRIM\n" +
      "Subject: Muhammad Iqbal Ramadhan_" + position + "\n\n" +
      makeEmail(company, position) +
      "\n\n📎 Lampirkan: Cv_Muhammad_Iqbal_Ramadhan.pdf";
  }

  if (forms.length) {
    reply +=
      "\n\n⚡ DATA FORM SIAP COPY\n" +
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
