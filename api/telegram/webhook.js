export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).json({ ok: true, message: "Telegram cover letter webhook ready" });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!token) {
    return res.status(500).json({ ok: false, error: "TELEGRAM_BOT_TOKEN missing" });
  }

  const update = req.body || {};
  const msg = update.message || update.channel_post;

  if (!msg) return res.status(200).json({ ok: true });

  const vacancyText = msg.text || msg.caption || "";
  if (!vacancyText.trim()) return res.status(200).json({ ok: true });

  // For channel posts, set TELEGRAM_OUTPUT_CHAT_ID in Vercel
  // so the result is sent to your private Telegram chat.
  const chatId = process.env.TELEGRAM_OUTPUT_CHAT_ID || msg.chat?.id;

  const sendTelegram = async (message) => {
    if (!chatId) return;

    await fetch(\`https://api.telegram.org/bot\${token}/sendMessage\`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message
      })
    });
  };

  if (!openaiKey) {
    await sendTelegram(
      "⚠️ Cover Letter belum bisa dibuat. OPENAI_API_KEY belum dipasang di Vercel."
    );
    return res.status(500).json({ ok: false, error: "OPENAI_API_KEY missing" });
  }

  const profile = [
    "Nama: Muhammad Iqbal Ramadhan",
    "Pendidikan: SMK Teknik Elektronika Industri, SMKN 1 Panyingkiran (2020-2023)",
    "Pengalaman:",
    "- Helper Warehouse, PT Kaldu Sari Nabati Plant Majalengka (2023-2024)",
    "- Crew Store, PT Alfaria Trijaya Tbk (2024)",
    "- Helper, PT Tiki Jalur Nugraha Ekakurir / JNE (2024-2026)",
    "Kemampuan yang terverifikasi:",
    "- Gesit",
    "- Teliti",
    "- Bertanggung jawab",
    "- Terbiasa mengikuti SOP",
    "- Teamwork",
    "- Siap bekerja shift"
  ].join("\n");

  const prompt = [
    "Buat cover letter lamaran kerja yang sangat relevan untuk lowongan berikut.",
    "",
    "PROFIL PELAMAR:",
    profile,
    "",
    "LOWONGAN:",
    vacancyText,
    "",
    "ATURAN:",
    "1. Identifikasi perusahaan dan posisi dari lowongan jika tersedia.",
    "2. Sesuaikan isi dengan persyaratan dan kata kunci lowongan.",
    "3. Prioritaskan pengalaman pelamar yang paling relevan.",
    "4. Jangan mengarang pengalaman, pendidikan, sertifikat, alamat, nomor HP, email, kemampuan, atau pencapaian.",
    "5. Jangan menyebut kemampuan yang tidak ada di profil.",
    "6. Bahasa profesional, natural, percaya diri, dan singkat.",
    "7. Jangan terlalu memuji perusahaan.",
    "8. Jangan membuat klaim palsu.",
    "9. Buat cover letter sekitar 120-180 kata.",
    "10. Jika nama HRD tidak tersedia, gunakan Yth. HRD [nama perusahaan].",
    "11. Buat SUBJECT EMAIL yang ringkas dan profesional.",
    "12. Output HARUS persis dengan format:",
    "",
    "SUBJECT:",
    "...",
    "",
    "COVER LETTER:",
    "...",
    "",
    "Tidak boleh ada analisis, skor, catatan, atau teks lain."
  ].join("\n");

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": \`Bearer \${openaiKey}\`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-6-luna",
        input: prompt,
        max_output_tokens: 500
      })
    });

    const data = await response.json();

    if (!response.ok) {
      await sendTelegram(
        "❌ Gagal membuat cover letter: " +
        (data?.error?.message || \`HTTP \${response.status}\`)
      );
      return res.status(502).json({ ok: false, error: data?.error || data });
    }

    const result = data.output_text?.trim();

    if (!result) {
      await sendTelegram("❌ AI tidak menghasilkan cover letter.");
      return res.status(502).json({ ok: false, error: "empty AI response" });
    }

    await sendTelegram("✉️ COVER LETTER SIAP\n\n" + result);

    return res.status(200).json({
      ok: true,
      action: "COVER_LETTER_GENERATED"
    });
  } catch (error) {
    await sendTelegram("❌ Cover letter gagal dibuat: " + error.message);
    return res.status(500).json({ ok: false, error: error.message });
  }
}
