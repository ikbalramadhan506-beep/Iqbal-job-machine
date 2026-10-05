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

  let score = 0;

  if (lower.includes("operator produksi")) score += 45;
  if (
    lower.includes("operator") ||
    lower.includes("helper") ||
    lower.includes("warehouse") ||
    lower.includes("teknisi")
  ) score += 28;

  if (
    lower.includes("smk") ||
    lower.includes("sma") ||
    lower.includes("elektronika") ||
    lower.includes("teknik")
  ) score += 20;

  if (
    lower.includes("shift") ||
    lower.includes("produksi") ||
    lower.includes("gudang") ||
    lower.includes("warehouse") ||
    lower.includes("sop")
  ) score += 15;

  if (lower.includes("email") || lower.includes("google form")) score += 5;

  let action = "SKIP";

  if (
    lower.includes("otp") ||
    lower.includes("captcha") ||
    lower.includes("transfer uang") ||
    lower.includes("biaya pendaftaran") ||
    lower.includes("bayar")
  ) {
    action = "SKIP";
  } else if (score >= 80) {
    action = "APPLY";
  } else if (score >= 70) {
    action = "REVIEW";
  }

  const icon =
    action === "APPLY" ? "🟢" :
    action === "REVIEW" ? "🟡" : "🔴";

  const reply =
`${icon} ${action}

Match: ${score}%

Saya sudah menganalisis lowongan ini.

${action === "APPLY"
  ? "Lowongan memenuhi kriteria untuk proses APPLY."
  : action === "REVIEW"
  ? "Lowongan perlu diperiksa sebelum APPLY."
  : "Lowongan tidak memenuhi kriteria otomatis."}`;

  if (token && msg.chat && msg.chat.id) {
    await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: msg.chat.id,
          text: reply
        })
      }
    );
  }

  return res.status(200).json({
    ok: true,
    action,
    score
  });
    }
