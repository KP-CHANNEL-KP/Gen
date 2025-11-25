interface Env {
  BOT_TOKEN: string;
  CHAT_ID: string;
  TARGET_USERNAME: string;
  TARGET_PASSWORD: string;
  TARGET_URL_BASE: string;   // http://saikokowinmyanmar123.com
}

async function send(token: string, chatId: string, text: string) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" })
  }).catch(() => {});
}

// အရေးကြီးဆုံး: Cookie ကို အမြဲတမ်း ထည့်ပို့မယ်
async function run(env: Env, chatId: string, deviceId: string) {
  let cookie = "";

  try {
    // 1. Login
    const loginRes = await fetch(env.TARGET_URL_BASE + "/KEYGEN/index.php", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        user_field: env.TARGET_USERNAME,
        pass_field: env.TARGET_PASSWORD,
        login_submit: "Login"
      }).toString(),
      redirect: "follow"
    });

    // Cookie အကုန်ယူမယ် (အထူးသဖြင့် PHPSESSID ပါအောင်)
    const setCookies = loginRes.headers.getSetCookie();
    if (setCookies && setCookies.length > 0) {
      cookie = setCookies.map(c => c.split(";")[0]).join("; ");
    }

    if (!cookie.includes("PHPSESSID")) {
      return await send(env.BOT_TOKEN, chatId, "Login အောင်မြင်ပေမယ့် Session Cookie မရပါ (PHPSESSID ပျောက်နေတယ်)");
    }

    await send(env.BOT_TOKEN, chatId, "Login အောင်မြင်ပါပြီ ✅\nGenerate form ဖွင့်နေပါပြီ...");

    // 2. Generate Form ဖွင့် (GET) — ဒီတစ်ခါ Cookie ထည့်ပို့မယ်
    const formRes = await fetch(env.TARGET_URL_BASE + "/KEYGEN/keys.php?action=generate", {
      headers: {
        "Cookie": cookie,
        "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36"
      }
    });

    if (formRes.url.includes("index.php") || formRes.url.includes("login")) {
      return await send(env.BOT_TOKEN, chatId, "Generate form ဖွင့်လို့ မရပါ။ Session ပျောက်သွားတယ်။");
    }

    // 3. Generate Key (POST)
    const genRes = await fetch(env.TARGET_URL_BASE + "/KEYGEN/keys.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Cookie": cookie,
        "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36"
      },
      body: new URLSearchParams({
        device_type: "one",
        days: "30",
        hours: "0",
        minutes: "0",
        device_id_manual: deviceId,
        generate_key: "Generate Key"
      }).toString()
    });

    const html = await genRes.text();

    // 4. Key ရှာ
    const keyMatch = html.match(/([A-Za-z0-9+\/=]{20,})/);
    if (!keyMatch) {
      const short = html.substring(0, 600) + "...";
      return await send(env.BOT_TOKEN, chatId, `Key မတွေ့ပါ\n\nHTML:\n\`\`\`\n${short}\n\`\`\``);
    }

    const key = keyMatch[0].trim();
    await send(env.BOT_TOKEN, chatId, `Key ထွက်ပြီး!\n\n\`\( {key}\`\n\nDevice ID: \` \){deviceId}\``);

  } catch (err: any) {
    await send(env.BOT_TOKEN, chatId, "Error: " + err.message);
  }
}

export default {
  async fetch(request: Request, env: Env) {
    if (request.method !== "POST") return new Response("ok");
    try {
      const update = await request.json<any>();
      const text = update.message?.text?.trim();
      const chatId = update.message?.chat.id.toString();
      if (!text || !chatId) return new Response("ok");

      if (text === "/start") {
        await send(env.BOT_TOKEN, chatId, "Bot အဆင်သင့်ပါပြီ!\n\n`/keygen မင်းရဲ့ Device ID` လို့ ရိုက်ပါ");
        return new Response("ok");
      }

      if (text.startsWith("/keygen ")) {
        const deviceId = text.slice(8).trim();
        if (!deviceId) return await send(env.BOT_TOKEN, chatId, "Device ID ထည့်ပါ");
        await send(env.BOT_TOKEN, chatId, "ခဏစောင့်ပါ... ⏳");
        await run(env, chatId, deviceId);
        return new Response("ok");
      }

      return new Response("ok");
    } catch {
      return new Response("ok");
    }
  }
};
