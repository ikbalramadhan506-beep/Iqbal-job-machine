module.exports = async (req, res) => {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    return res.status(500).json({
      ok: false,
      error: "TELEGRAM_BOT_TOKEN belum diset di Vercel"
    });
  }

  const host = req.headers.host;
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const webhookUrl = `${protocol}://${host}/api/telegram/webhook`;

  const response = await fetch(
    `https://api.telegram.org/bot${token}/setWebhook`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ["message", "channel_post"],
        drop_pending_updates: false
      })
    }
  );

  const result = await response.json();

  return res.status(response.ok ? 200 : 500).json({
    ok: result.ok,
    webhook_url: webhookUrl,
    telegram: result
  });
};
