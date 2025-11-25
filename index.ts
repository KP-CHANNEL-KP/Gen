interface Env {
  BOT_TOKEN: string;
  CHAT_ID: string;
  TARGET_USERNAME: string;
  TARGET_PASSWORD: string;
  TARGET_URL_BASE: string;   // http://saikokowinmyanmar123.com  (နောက်ဆုံထချ မထည့်နဲ့)
}

async function send(token: string, chatId: string, text: string) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" })
  }).catch(() => {});
}

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

    const setCookies = loginRes.headers.getSetCookie();
    if (setCookies) cookie = setCookies.map(c => c.split(";")[0]).join("; ");
    if (!cookie) return await send(env.BOT_TOKEN, chatId, "Login မအောင်မြင်ပါ");

    await send(env.BOT_TOKEN, chatId, "Login အောင်မြင်ပါပြီ ✅\nGenerate New Key ဖွင့်နေပါပြီ...");

    // 2. Open Generate Form (GET request)
    const formRes = await fetch(env.TARGET_URL_BASE + "/KEYGEN/keys.php?action=generate", {
      headers: { Cookie: cookie }
    });

    if (!formRes.ok) return await send(env.BOT_TOKEN, chatId, "Generate form မဖွင့်နိုင်ပါ");

    // 3. Submit Generate Key (POST)
    const genRes = await fetch(env.TARGET_URL_BASE + "/KEYGEN/keys.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Cookie": cookie
      },
      body: new URLSearchParams({
        device_type: "one",           // One Device
        days: "30",
        hours: "0",
        minutes: "0",
        device_id_manual: deviceId,   // မင်း Telegram က ပို့တဲ့ ID
        generate_key: "Generate Key"  // ခလုတ်ရဲ့ name/value
      }).toString()
    });

    const resultHtml = await genRes.text();

    // 4. Extract Key (မင်းပေးထားတဲ့ ပုံစံအတိုင်း)
    const keyMatch = resultHtml.match(/([A-Za-z0-9+\/=]{20,})/);
    if (!keyMatch) {
      const snippet = resultHtml.substring(0, 500) + "...";
      return await send(env.BOT_TOKEN, chatId, 
        "Key ရှာမတွေ့ပါ ညီ 😭\n\nHTML နမူနာ:\n```\n" + snippet + "\n```"
      );
    }

    const key = keyMatch[0].trim();

    await send(env.BOT_TOKEN, chatId,
      `Key Generate အောင်မြင်ပါပြီ!\n\n\`\( {key}\`\n\nDevice ID: \` \){deviceId}\``
    );

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
        await send(env.BOT_TOKEN, chatId, 
          "Keygen Bot အဆင်သင့်ပါပြီ!\n\nသုံးပုံ: `/keygen မင်းရဲ့ Device ID`\nဥပမာ: `/keygen iPhone16`"
        );
        return new Response("ok");
      }

      if (text.startsWith("/keygen ")) {
        const deviceId = text.slice(8).trim();
        if (!deviceId) return await send(env.BOT_TOKEN, chatId, "Device ID ထည့်ပါ ညီ");
        
        await send(env.BOT_TOKEN, chatId, "ခဏစောင့်ပါ... Key ထုတ်နေပါပြီ ⏳");
        await run(env, chatId, deviceId);
        return new Response("ok");
      }

      return new Response("ok");
    } catch {
      return new Response("ok");
    }
  }
};
