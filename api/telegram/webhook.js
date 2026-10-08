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

  const cvUrl = process.env.CV_URL || "";

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
    "Alamat: Gang Kober Blok B No.4, RT 002/RW 001, Sukadanau, Cikarang Barat, Kabupaten Bekasi, Jawa Barat",
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

  // Give each vacancy a deterministic writing angle so different vacancies do not collapse into the same generic letter.
  let hash = 0;
  for (let i = 0; i < vacancyText.length; i++) {
    hash = ((hash << 5) - hash) + vacancyText.charCodeAt(i);
    hash |= 0;
  }
  const angles = [
    "fokus pada pengalaman paling relevan dan kesiapan kerja",
    "fokus pada kecocokan pengalaman dengan tugas utama posisi",
    "fokus pada ketelitian, SOP, dan kualitas kerja jika relevan",
    "fokus pada teamwork, disiplin, dan kemampuan mengikuti target jika relevan",
    "fokus pada pengalaman operasional dan kemampuan beradaptasi",
    "fokus pada kontribusi konkret yang bisa diberikan sejak awal"
  ];
  const writingAngle = angles[Math.abs(hash) % angles.length];

  const prompt = [
    "Buat cover letter lamaran kerja yang benar-benar khusus untuk lowongan berikut. Jangan gunakan template cover letter yang sama berulang-ulang.",
    "",
    "PROFIL PELAMAR:",
    profile,
    "",
    "LOWONGAN:",
    vacancyText,
    "",
    "SUDUT PENULISAN UNTUK LOWONGAN INI:",
    writingAngle,
    "",
    "ATURAN:",
    "1. Identifikasi perusahaan, posisi, lokasi, tugas utama, dan persyaratan dari lowongan.",
    "1a. Tentukan 2-4 poin paling penting yang dicari perusahaan untuk posisi tersebut dan jadikan itu fokus utama surat.",
    "2. Sesuaikan isi dengan persyaratan, tugas, lokasi, dan kata kunci lowongan. Sebutkan hanya hal yang benar-benar didukung profil.",
    "3. Prioritaskan pengalaman pelamar yang paling relevan. Untuk Warehouse/Logistik, utamakan pengalaman warehouse dan JNE; untuk Store/Retail, utamakan pengalaman Crew Store; untuk Produksi/Operator, utamakan pengalaman kerja operasional, SOP, disiplin, teamwork, dan kesiapan shift. Jika posisi berbeda, pilih kombinasi pengalaman yang paling masuk akal.",
    "4. Jangan mengarang pengalaman, pendidikan, sertifikat, alamat, nomor HP, email, kemampuan, atau pencapaian.",
    "5. Jangan menyebut kemampuan yang tidak ada di profil.",
    "6. Bahasa profesional, natural, percaya diri, dan singkat. Surat WAJIB terasa ditulis khusus untuk lowongan ini, bukan surat massal.",
    "6a. Sebutkan posisi yang dilamar dan hubungkan minimal 2 persyaratan/tugas spesifik dari lowongan dengan pengalaman pelamar.",
    "6b. Jangan memakai pembuka, urutan paragraf, atau kalimat generik yang sama seperti surat sebelumnya. Buat struktur dan penekanan mengikuti posisi yang sedang dilamar.",
    "6c. Jangan membuat surat yang hanya mengganti nama perusahaan atau jabatan. Setidaknya 3 bagian isi harus berubah berdasarkan lowongan: alasan melamar, pengalaman yang ditonjolkan, dan hubungan pengalaman dengan tugas/syarat.",
    "7. Jangan terlalu memuji perusahaan. Fokus pada kecocokan pelamar dengan kebutuhan posisi.",
    "8. Jangan membuat klaim palsu.",
    "9. Buat cover letter sekitar 120-180 kata. Pilih pengalaman yang paling dekat dengan pekerjaan tersebut dan jelaskan relevansinya secara konkret.",
    "9a. Jika lowongan menyebut tugas atau syarat khusus, masukkan beberapa di antaranya secara natural. Jangan hanya mengganti nama perusahaan/posisi dari template.",
    "10. Jika nama HRD tidak tersedia, gunakan Yth. HRD [nama perusahaan].",
    "11. Buat SUBJECT EMAIL yang ringkas dan profesional.",
    "12. Jangan mengulang susunan kalimat atau paragraf secara mekanis dari lowongan lain. Variasikan pembuka dan penekanan sesuai isi lowongan, tetapi tetap profesional dan faktual.",
    "13. Output HARUS persis dengan format:",
    "",
    "SUBJECT:",
    "...",
    "",
    "COVER LETTER:",
    "...",
    "",
    "Tidak boleh ada analisis, skor, catatan, atau teks lain. Jangan menulis placeholder seperti [nama perusahaan] jika nama perusahaan sebenarnya tersedia di lowongan."
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

    if (cvUrl) {
      try {
        const cvResponse = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            document: cvUrl,
            caption: "📄 CV terbaru — Muhammad Iqbal Ramadhan"
          })
        });

        if (!cvResponse.ok) {
          const cvError = await cvResponse.json().catch(() => ({}));
          await sendTelegram("⚠️ Cover letter sudah siap, tetapi CV gagal dikirim: " + (cvError?.description || "Telegram error"));
        }
      } catch (cvError) {
        await sendTelegram("⚠️ Cover letter sudah siap, tetapi CV gagal dikirim: " + cvError.message);
      }
    } else {
      await sendTelegram("⚠️ Cover letter sudah siap. CV belum dikirim karena CV_URL belum dipasang di Vercel.");
    }

    return res.status(200).json({
      ok: true,
      action: "COVER_LETTER_GENERATED"
    });
  } catch (error) {
    await sendTelegram("❌ Cover letter gagal dibuat: " + error.message);
    return res.status(500).json({ ok: false, error: error.message });
  }
}
