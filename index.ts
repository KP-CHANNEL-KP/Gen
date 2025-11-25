// === မင်းရဲ့ မူရင်း code ကို အလုပ်ဖြစ်အောင် အနည်းဆုံး ပြင်ထားတာ ===

interface Env {
  BOT_TOKEN: string;
  CHAT_ID: string;
  TARGET_USERNAME: string;
  TARGET_PASSWORD: string;
  TARGET_URL_BASE: string;
}

interface TelegramUpdate {
  update_id: number;
  message?: {
    text: string;
    chat: { id: number };
  };
}

const KEYGEN_PATH = "/KEYGEN/index.php";

async function sendTelegramMessage(token: string, chatId: string, text: string) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: "Markdown", // ဒီဟာကိုပဲ သုံးထားမယ်၊ ရိုးရိုးပဲ အလုပ်ဖြစ်တယ်
      }),
    });
  } catch (e) {
    console.error("Telegram send failed:", e);
  }
}

async function runAutomation(env: Env, chatId: string, deviceId: string): Promise<string> {
  const cookies: string[] = [];
  const TARGET_URL = env.TARGET_URL_BASE + KEYGEN_PATH;

  try {
    // Step 1: Login (redirect လိုက်အောင် လုပ်မယ်)
    const loginResp = await fetch(TARGET_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        user_field: env.TARGET_USERNAME,
        pass_field: env.TARGET_PASSWORD,
        login_submit: "Login",
      }).toString(),
      redirect: "follow", // ဒီတစ်ကြောင်းက အဓိကကြဧည်!
    });

    // Cookie အကုန်ယူမယ်
    const setCookies = loginResp.headers.getSetCookie();
    if (setCookies) {
      cookies.push(...setCookies.map(c => c.split(";")[0]));
    }

    if (cookies.length === 0) {
      await sendTelegramMessage(env.BOT_TOKEN, chatId, "Login မအောင်မြင်ပါ။ Username/Password စစ်ပါ။");
      return "login fail";
    }

    // Step 2: Generate Key
    const genResp = await fetch(TARGET_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: cookies.join("; "),
      },
      body: new URLSearchParams({
        action_type: "generate_new_key",
        device_count: "1",
        days: "30",
        hours: "0",
        minutes: "0",
        device_id_manual: deviceId,
        generate_submit: "Generate Key",
      }).toString(),
      redirect: "follow",
    });

    const html = await genResp.text();

    // Step 3: Key ထုတ်မယ် (မင်းရဲ့ site မှာ ဘယ်လိုရှိလဲ ဆိုတာ မသိသေးလို့ အများဆုံး ဖြစ်တတ်တာတွေ အကုန်ထည့်ထားတယ်)
    const regexes = [
      /<textarea[^>]*>([\s\S]*?)<\/textarea>/i,
      /<pre[^>]*>([\s\S]*?)<\/pre>/i,
      /<code[^>]*>([\s\S]*?)<\/code>/i,
      /<div[^>]+class=["']key[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
      />Key\s*:\s*([A-Z0-9-]{8,})/i,
      /([A-Z0-9-]{10,})/, // နောက်ဆုံး အလွယ်ကူဆုံး ရှာမယ်
    ];

    let key = "";
    for (const r of regexes) {
      const m = html.match(r);
      if (m && m[1] && m[1].trim().length > 8) {
        key = m[1].trim();
        break;
      }
    }

    if (!key) {
      // Debug ပို့ပေးမယ် (500 လုံးပဲ ပို့မယ်၊ များရင် Telegram က လက်မခံဘူး)
      const snippet = html.substring(0, 450) + "...";
      await sendTelegramMessage(env.BOT_TOKEN, chatId,
        "Key မတွေ့ပါ။ အောက်မှာ HTML နမူနာ ပြထားတယ်။ ငါ့ကို ဒါကို ပြပြီး regex ပြင်ခိုင်းပါ။\n\n```\n" + snippet + "\n```"
      );
      return "no key";
    }

    // အောင်မြင်ရင် ပို့မယ်
    await sendTelegramMessage(env.BOT_TOKEN, chatId,
      `Key Generate အောင်မြင်ပါပြီ!\n\n\`\( {key}\`\n\nDevice ID: \` \){deviceId}\``
    );
    return "success";

  } catch (err: any) {
    await sendTelegramMessage(env.BOT_TOKEN, chatId, "Error တက်သွားတယ်: " + err.message);
    return "error";
  }
}

// =============== Worker ===============
export default {
  async fetch(request: Request, env: Env) {
    if (request.method !== "POST") return new Response("ok");

    try {
      const update = await request.json<TelegramUpdate>();

      if (!update.message?.text) return new Response("ok");

      const text = update.message.text.trim();
      const chatId = update.message.chat.id.toString();

      if (text === "/start") {
        await sendTelegramMessage(env.BOT_TOKEN, chatId,
          "Keygen Bot ကို သုံးလို့ရပါပြီ\n\nသုံးပုံ ➜ /keygen နောက်မှာ Device ID ရိုက်ပို့ပါ\nဥပမာ ➜ `/keygen MyPhone_2025`"
        );
        return new Response("ok");
      }

      if (text.startsWith("/keygen ")) {
        const deviceId = text.slice(8).trim();
        if (!deviceId) {
          await sendTelegramMessage(env.BOT_TOKEN, chatId, "Device ID ထည့်ပါ။\nဥပမာ: `/keygen Samsung123`");
          return new Response("ok");
        }

        await sendTelegramMessage(env.BOT_TOKEN, chatId, "ခဏစောင့်ပါ... Key ထုတ်နေပါပြီ");
        await runAutomation(env, chatId, deviceId);
        return new Response("ok");
      }

      return new Response("ok");
    } catch (e) {
      return new Response("ok");
    }
  },
};
