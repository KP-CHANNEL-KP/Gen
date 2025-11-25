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

async function run(env: Env, chatId: string, deviceId: string) {
  let cookie = "";

  try {
    // Step 1: Login
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
    if (setCookies && setCookies.length > 0) {
      cookie = setCookies.map(c => c.split(";")[0]).join("; ");
    }
    if (!cookie) {
      return await send(env.BOT_TOKEN, chatId, "❌ Login မအောင်မြင်ပါ။ Username/Password စစ်ပါ။");
    }

    await send(env.BOT_TOKEN, chatId, "✅ Login အောင်မြင်ပါပြီ!\n⏳ Generate form ဖွင့်နေပါပြီ...");

    // Step 2: မင်း ပြောတဲ့အတိုင်း တိုက်ရိုက် generate URL ကို GET လုပ် (form စာမျက်နှာ ရောက်ရန်)
    const formUrl = env.TARGET_URL_BASE + "/KEYGEN/keys.php?action=generate";
    const formRes = await fetch(formUrl, {
      headers: {
        "Cookie": cookie,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
      }
    });

    const formHtml = await formRes.text();
    if (formHtml.includes("Login") || formRes.status !== 200) {
      return await send(env.BOT_TOKEN, chatId, "❌ Session ပျောက်သွားပါပြီ။ နောက်တစ်ကြိမ် စမ်းကြည့်ပါ။");
    }

    await send(env.BOT_TOKEN, chatId, "✅ Form ဖွင့်အောင်မြင်ပါပြီ!\n⏳ Key ထုတ်နေပါပြီ...");

    // Step 3: Generate Key POST (form ကနေ တိုက်ရိုက် ထုတ်ယူပြီး ပို့)
    const genRes = await fetch(env.TARGET_URL_BASE + "/KEYGEN/keys.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Cookie": cookie,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
      },
      body: new URLSearchParams({
        action: "generate",  // action ထည့်ထားတယ်
        device_type: "one",  // One Device
        days: "30",
        hours: "0",
        minutes: "0",
        device_id_manual: deviceId,  // Telegram ကနေ လာတဲ့ ID
        generate_key: "Generate Key"  // ခလုတ်ရဲ့ value
      }).toString(),
      redirect: "follow"
    });

    const resultHtml = await genRes.text();

    // Step 4: Key ထုတ်ယူ (မင်း ပေးထားတဲ့ နမူနာ ပုံစံအတိုင်း - Base64-like key ရှာ)
    // ဥပမာ: T0/dp7GDF/HO3rA9Gw++Hg== လို ရှာမယ် (20+ လုံး, / + = ပါနိုင်တယ်)
    const keyMatch = resultHtml.match(/([A-Za-z0-9+\/]{20,}[=]{0,2})/);
    if (!keyMatch || keyMatch[0].length < 20) {
      // Debug အတွက် HTML snippet ပို့
      const snippet = resultHtml.substring(0, 800).replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return await send(env.BOT_TOKEN, chatId, 
        `❌ Key ရှာမတွေ့ပါ။\n\n**Debug HTML:**\n\`\`\`html\n${snippet}...\n\`\`\`\n\nဒီ snippet ကို ငါ့ကို ပို့ပေးပါ၊ ချက်ချင်း ပြင်ပေးမယ်။`
      );
    }

    const key = keyMatch[0].trim();

    // Step 5: Telegram ကနေ ပြန်ပို့
    await send(env.BOT_TOKEN, chatId, 
      `✅ **Key Generate အောင်မြင်ပါပြီ!**\n\n\`\( {key}\`\n\n**Device ID:** \` \){deviceId}\`\n\nဒီ key ကို copy လုပ်ပြီး သုံးပါ။`
    );

  } catch (err: any) {
    await send(env.BOT_TOKEN, chatId, `❌ Error ဖြစ်ပွားပါပြီ: ${err.message}`);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    try {
      const update = await request.json() as any;
      const text = update.message?.text?.trim();
      const chatId = update.message?.chat?.id?.toString();

      if (!text || !chatId) {
        return new Response("OK", { status: 200 });
      }

      if (text === "/start") {
        await send(env.BOT_TOKEN, chatId, 
          `👋 **VPN Keygen Bot** ကို ကြိုဆိုပါတယ်!\n\n**သုံးပုံ:**\n\`/keygen [မင်းရဲ့ Device ID]\`\n\n**ဥပမာ:**\n\`/keygen iPhone16\`\n\nGenerate လုပ်ပြီး key ကို ချက်ချင်း ပြန်ပို့ပေးမယ်။`
        );
        return new Response("OK", { status: 200 });
      }

      if (text.startsWith("/keygen ")) {
        const deviceId = text.slice(8).trim();
        if (!deviceId) {
          await send(env.BOT_TOKEN, chatId, "❌ Device ID ထည့်ပါ ညီ!\n\nဥပမာ: `/keygen MyPhone123`");
          return new Response("OK", { status: 200 });
        }

        await run(env, chatId, deviceId);
        return new Response("OK", { status: 200 });
      }

      return new Response("OK", { status: 200 });
    } catch (error) {
      console.error("Worker error:", error);
      return new Response("Internal Error", { status: 500 });
    }
  }
};
