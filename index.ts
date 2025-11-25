interface Env {
  BOT_TOKEN: string;
  CHAT_ID: string;
  TARGET_USERNAME: string;
  TARGET_PASSWORD: string;
  TARGET_URL_BASE: string;        // ဥပမာ: https://saikokowinmyanmar123.com
}

const LOGIN_PATH = "/KEYGEN/index.php";   // လက်ရှိ login page ရှိတဲ့ path

async function sendTelegram(token: string, chatId: string, text: string) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: "Markdown"
    })
  }).catch(() => {});
}

// အဓိက ပြင်ထားတဲ့ နေရာ (login ပြီးရင် တကယ့် keygen page URL ကို ယူမယ်)
async function runAutomation(env: Env, chatId: string, deviceId: string) {
  let cookie = "";

  try {
    // Step 1: Login
    const loginRes = await fetch(env.TARGET_URL_BASE + LOGIN_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        user_field: env.TARGET_USERNAME,
        pass_field: env.TARGET_PASSWORD,
        login_submit: "Login"
      }).toString(),
      redirect: "follow"               // အဓိကကြီး!!!
    });

    // Cookie အကုန်ယူမယ်
    const setCookies = loginRes.headers.getSetCookie();
    if (setCookies) cookie = setCookies.map(c => c.split(";")[0]).join("; ");

    if (!cookie) {
      await sendTelegram(env.BOT_TOKEN, chatId, "Login မအောင်မြင်ပါ");
      return;
    }

    // အရေးကြီးဆုံး: login ပြီးရင် ဘယ် page ကို redirect လုပ်လဲ ဆိုတာ ဒီနေရာမှာ သိသွားပြီ
    const DASHBOARD_URL = loginRes.url;   // ဥပမာ https://site.com/KEYGEN/dashboard.php လိုမျိုး ဖြစ်သွားမယ်

    await sendTelegram(env.BOT_TOKEN, chatId, "Login အောင်မြင်ပါပြီ ✅\nKey ထုတ်နေပါပြီ...");

    // Step 2: Generate Key (အခု တကယ့် keygen page ကို POST လုပ်မယ်)
    const genRes = await fetch(DASHBOARD_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Cookie": cookie
      },
      body: new URLSearchParams({
        action_type: "generate_new_key",
        device_count: "1",
        days: "30",
        hours: "0",
        minutes: "0",
        device_id_manual: deviceId,
        generate_submit: "Generate Key"
      }).toString(),
      redirect: "follow"
    });

    const html = await genRes.text();

    // Step 3: Key ထုတ်မယ် (အများဆုံး ဒီလို site တွေမှာ key က <pre> ထဲမှာ ရှိတယ်)
    const match = html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i) 
               || html.match(/<textarea[^>]*>([\s\S]*?)<\/textarea>/i)
               || html.match(/([A-Z0-9-]{10,})/);   // နောက်ဆုံး backup

    if (!match || !match[1] || match[1].trim().length < 8) {
      const snippet = html.substring(0, 400) + "...";
      await sendTelegram(env.BOT_TOKEN, chatId, 
        "Key မတွေ့ပါ 🙁\n\nHTML နမူနာ:\n```\n" + snippet + "\n```\n\nဒီ snippet ကို ငါ့ကို ပြပြီး regex ပြင်ခိုင်းပါ။");
      return;
    }

    const key = match[1].trim();

    await sendTelegram(env.BOT_TOKEN, chatId,
      `Key Generate အောင်မြင်ပါပြီ!\n\n\`\( {key}\`\n\nDevice ID: \` \){deviceId}\``
    );

  } catch (err: any) {
    await sendTelegram(env.BOT_TOKEN, chatId, "Error: " + err.message);
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
        await sendTelegram(env.BOT_TOKEN, chatId, 
          "Keygen Bot အဆင်သင့်ပါပြီ\n\nသုံးပုံ: `/keygen သင့် Device ID`\nဥပမာ: `/keygen iPhone15`");
        return new Response("ok");
      }

      if (text.startsWith("/keygen ")) {
        const deviceId = text.slice(8).trim();
        if (!deviceId) {
          await sendTelegram(env.BOT_TOKEN, chatId, "Device ID ထည့်ပါ\nဥပမာ: `/keygen MyPhone`");
          return new Response("ok");
        }

        await sendTelegram(env.BOT_TOKEN, chatId, "ခဏလောက် စောင့်ပါ... ⏳");
        await runAutomation(env, chatId, deviceId);
        return new Response("ok");
      }

      return new Response("ok");
    } catch {
      return new Response("ok");
    }
  }
};
