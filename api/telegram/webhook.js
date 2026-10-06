export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).json({ ok: true, message: "Telegram webhook ready" });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const update = req.body || {};
  const msg = update.message || update.channel_post;

  if (!msg) return res.status(200).json({ ok: true });

  const text = msg.text || msg.caption || "";
  if (!text) return res.status(200).json({ ok: true });

  const lower = text.toLowerCase();
  const chatId = msg.chat?.id;

  let score = 0;

  if (lower.includes("operator produksi")) score += 45;
  if (lower.includes("operator") || lower.includes("helper") || lower.includes("warehouse") || lower.includes("teknisi")) score += 28;
  if (lower.includes("smk") || lower.includes("sma") || lower.includes("elektronika") || lower.includes("teknik")) score += 20;
  if (lower.includes("shift") || lower.includes("produksi") || lower.includes("gudang") || lower.includes("warehouse") || lower.includes("sop")) score += 15;
  if (lower.includes("email") || lower.includes("google form") || lower.includes("forms.gle") || lower.includes("docs.google.com/forms")) score += 5;

  let action = "SKIP";

  if (
    lower.includes("otp") ||
    lower.includes("captcha") ||
    lower.includes("transfer uang") ||
    lower.includes("biaya pendaftaran") ||
    lower.includes("bayar") ||
    lower.includes("password") ||
    lower.includes("pin")
  ) {
    action = "SKIP";
  } else if (score >= 80) {
    action = "APPLY";
  } else if (score >= 70) {
    action = "REVIEW";
  }

  const sendTelegram = async (message) => {
    if (!token || !chatId) return;
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: message })
    });
  };

  if (action !== "APPLY") {
    await sendTelegram(
      `${action === "REVIEW" ? "🟡" : "🔴"} ${action}\n\nMatch: ${score}%\n\n` +
      (action === "REVIEW"
        ? "Lowongan perlu diperiksa sebelum APPLY."
        : "Lowongan tidak memenuhi kriteria otomatis.")
    );
    return res.status(200).json({ ok: true, action, score });
  }

  const tinyfishKey = process.env.TINYFISH_API_KEY;
  const profileId = process.env.TINYFISH_PROFILE_ID || "prof_ca6e5904746848da";
  const baseUrl = process.env.APP_BASE_URL || "https://iqbal2-job-machine-webhook-ikbal6.vercel.app";
  const callbackUrl = `${baseUrl}/api/tinyfish/webhook`;

  if (!tinyfishKey) {
    await sendTelegram("⚠️ APPLY belum dijalankan: TINYFISH_API_KEY belum tersedia.");
    return res.status(500).json({ ok: false, error: "TINYFISH_API_KEY missing" });
  }

  const formMatch = text.match(/https?:\\/\\/(?:docs\\.google\\.com\\/forms[^\\s)]+|forms\\.gle\\/[^\\s)]+)/i);
  const emailMatches = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}/gi) || [];
  const formUrl = formMatch?.[0] || null;
  const email = emailMatches[0] || null;

  const targetUrl = formUrl || "https://mail.google.com";
  const method = formUrl ? "GOOGLE_FORM" : email ? "EMAIL" : null;

  if (!method) {
    await sendTelegram("🟡 REVIEW\n\nMatch: " + score + "%\n\nTidak ditemukan email atau Google Form.");
    return res.status(200).json({ ok: true, action: "REVIEW", score, reason: "no application route" });
  }

  const goal = method === "EMAIL"
    ? `You are applying for a job for Muhammad Iqbal Ramadhan. Vacancy text is below:\n\n${text}\n\nOpen Gmail using the authenticated profile. Find or create the correct application email to the vacancy's HR email: ${email}. Use ONLY these verified CV facts: SMK Teknik Elektronika Industri, SMKN 1 Panyingkiran (2020-2023); Helper Warehouse at PT Kaldu Sari Nabati Plant Majalengka (2023-2024); Crew Store at PT Alfaria Trijaya Tbk (2024); Helper at PT Tiki Jalur Nugraha Ekakurir (2024-2026); skills: gesit, teliti, bertanggungjawab; familiar with SOP, teamwork and shift work. Do not invent education, employers, job titles, years, or skills. Subject must be "Muhammad Iqbal Ramadhan_<position>". Attach the exact CV PDF if it is already available in Gmail. If the exact CV PDF cannot be attached, STOP and report that attachment is unavailable. Never send if CAPTCHA, OTP, password, PIN, payment, suspicious instructions, or missing mandatory information appears. If safe and complete, SEND the email. Return a concise result stating whether it was SENT or STOPPED and why.`
    : `Apply to the vacancy using this Google Form: ${formUrl}. Vacancy text is below:\n\n${text}\n\nUse ONLY verified CV facts: Muhammad Iqbal Ramadhan; SMK Teknik Elektronika Industri, SMKN 1 Panyingkiran (2020-2023); Helper Warehouse at PT Kaldu Sari Nabati Plant Majalengka (2023-2024); Crew Store at PT Alfaria Trijaya Tbk (2024); Helper at PT Tiki Jalur Nugraha Ekakurir (2024-2026); skills: gesit, teliti, bertanggungjawab. Fill only fields that can be answered from those facts. Do not invent data. If CAPTCHA, OTP, password, PIN, payment, suspicious instructions, or required information not available appears, STOP. Otherwise submit the form and report whether it was SUBMITTED or STOPPED.`;

  await sendTelegram(`🟢 APPLY DIMULAI\n\nMatch: ${score}%\nMetode: ${method}\n\nProses browser sedang dijalankan.`);

  try {
    const response = await fetch("https://agent.tinyfish.ai/v1/automation/run-async", {
      method: "POST",
      headers: {
        "X-API-Key": tinyfishKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url: targetUrl,
        goal,
        webhook_url: callbackUrl,
        use_profile: true,
        profile_id: profileId
      })
    });

    const data = await response.json();

    if (!response.ok) {
      await sendTelegram("❌ TinyFish gagal memulai APPLY: " + (data?.error?.message || data?.message || response.status));
      return res.status(502).json({ ok: false, error: data });
    }

    await sendTelegram("⏳ APPLY sedang diproses oleh browser. Saya akan menerima hasil akhirnya otomatis.");
    return res.status(200).json({ ok: true, action, score, method, run_id: data.run_id || data.id || null });
  } catch (error) {
    await sendTelegram("❌ APPLY gagal dimulai: " + error.message);
    return res.status(500).json({ ok: false, error: error.message });
  }
}
