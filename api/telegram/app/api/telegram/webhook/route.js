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

  const goal =
    "CHAT_ID:" + chatId + " Read the vacancy text visible in this image. " +
    "Return ONLY these fields: company (nama PT/perusahaan), email (alamat email/from untuk lamaran). " +
    "If there are multiple emails, return the most relevant HR/recruitment/application email; if none is visible, return empty string. " +
    "Do not create or guess any information. Do not write a cover letter. " +
    "Return JSON exactly with keys company and email.";

  const response = await fetch("https://agent.tinyfish.ai/v1/automation/run-async", {
    method: "POST",
    headers: {
      "X-API-Key": tinyfishKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      url: imageUrl,
      goal,
      webhook_url: webhookBase + "/api/tinyfish/webhook",
      browser_profile: "lite",
      output_schema: {
        type: "object",
        properties: {
          company: { type: "string" },
          email: { type: "string" }
        },
        required: ["company", "email"]
      }
    })
  });

  return response.ok;
}

