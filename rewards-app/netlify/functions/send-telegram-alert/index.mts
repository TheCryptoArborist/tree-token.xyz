declare const Netlify:
  | {
      env: {
        get: (key: string) => string | undefined;
      };
    }
  | undefined;

type TelegramAlertBody = {
  alertType?: string;
  message?: string;
  photo?: string;
  assets?: string[];
  claimUrl?: string;
};

function envValue(key: string) {
  return typeof Netlify === "undefined" ? undefined : Netlify.env.get(key) || undefined;
}

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body, null, 2), {
    ...init,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      ...(init.headers || {}),
    },
  });
}

function telegramTopicId(value?: string) {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export default async function handler(req: Request) {
  const botToken = envValue("TELEGRAM_BOT_TOKEN");
  const chatId = envValue("TELEGRAM_CHAT_ID");
  const topicId = telegramTopicId(envValue("TELEGRAM_TOPIC_ID"));
  const configured = Boolean(botToken && chatId);

  if (req.method === "GET") {
    return jsonResponse({
      configured,
      hasTopicId: Boolean(topicId),
      message: configured ? "Telegram alert service is configured." : "Telegram alert service is not configured.",
    });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, { status: 405 });
  }

  if (!configured) {
    return jsonResponse(
      {
        error: "Telegram alert service is not configured.",
        requiredEnv: ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"],
      },
      { status: 503 },
    );
  }

  let body: TelegramAlertBody;
  try {
    body = (await req.json()) as TelegramAlertBody;
  } catch {
    return jsonResponse({ error: "Invalid JSON body." }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  const photo = typeof body.photo === "string" ? body.photo.trim() : "";
  if (!message) return jsonResponse({ error: "Message body is required." }, { status: 400 });
  if (message.length > 3900) return jsonResponse({ error: "Message is too long for Telegram." }, { status: 400 });

  const payload: Record<string, unknown> = {
    chat_id: chatId,
    disable_web_page_preview: false,
  };
  if (photo) {
    payload.photo = photo;
    payload.caption = message;
  } else {
    payload.text = message;
  }
  if (topicId) payload.message_thread_id = topicId;

  const telegramMethod = photo ? "sendPhoto" : "sendMessage";
  const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/${telegramMethod}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const telegramPayload = (await telegramResponse.json().catch(() => ({}))) as { ok?: boolean; description?: string };

  if (!telegramResponse.ok || !telegramPayload.ok) {
    return jsonResponse(
      {
        error: telegramPayload.description || "Telegram send failed.",
        status: telegramResponse.status,
      },
      { status: 502 },
    );
  }

  return jsonResponse({
    ok: true,
    alertType: body.alertType || "custom",
    assets: Array.isArray(body.assets) ? body.assets : [],
    sentAs: photo ? "photo" : "message",
    sentAt: new Date().toISOString(),
  });
}

export const config = {
  path: "/.netlify/functions/send-telegram-alert",
  method: ["GET", "POST"],
};

