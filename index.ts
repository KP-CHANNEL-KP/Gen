interface Env {
  BOT_TOKEN: string;
  CHAT_ID: string;
  TARGET_USERNAME: string;
  TARGET_PASSWORD: string;
  TARGET_URL_BASE: string;   // http://saikokowinmyanmar123.com
}

async function send(t: string, c: string, m: string) {
  await fetch(`https://api.telegram.org/bot${t}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: c, text: m, parse_mode: "Markdown" })
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

    const cookies = loginRes.headers.getSetCookie();
    if (cookies) cookie = cookies.map(c => c.split(";")[0]).join("; ");
    if (!cookie) return await send(env.BOT_TOKEN, chatId, "Login မအောင်မြင်ပါ");

    await send(env.BOT_TOKEN, chatId, "Login အောင်မြင်ပါပြီ!\nGenerate form ဖွင့်နေပါပြီ...");

    // 2. Generate form ဖွင့် (မင်း ပြောတဲ့ URL)
    const formRes = await fetch(env.TARGET_URL_BASE + "/KEYGEN/keys.php?action=generate", {
      headers: { Cookie: cookie }
    });

    const formHtml = await formRes.text();

    // Login page ပြန်ရောက်နေရင် session ပျောက်တယ်
    if (formHtml.includes("user_field") || formHtml.includes("Login")) {
      return await send(env.BOT_TOKEN, chatId, "Session ပျောက်သွားပါပြီ။ နောက်တစ်ခါ ထပ်စမ်းပါ။");
    }

    // 3. Hidden token ရှာ (ဥပမာ name="token" သို့မဟုတ် name="_token" စသဖြင့်)
    const tokenMatch = formHtml.match(/name=["'](?:token|_token|csrf_token)["']\s+value=["']([^"']+)["']/i);
    const token = tokenMatch ? tokenMatch[1] : "";

    await send(env.BOT_TOKEN, chatId, "Form ဖွင့်အောင်မြင်ပါပြီ!\nKey ထုတ်နေပါပြီ...");

    // 4. Generate Key POST
    const payload = new URLSearchParams({
      device_type: "one",
      days: "30",
      hours: "0",
      minutes: "0",
      device_id_manual: deviceId,
      generate_key: "Generate Key"
    });

    // Token ရှိရင် ထည့်ပို့
    if (token) {
      payload.append("token", token);
      // တချို့ site က _token လို့ သုံးတယ်
      payload.append("_token", token);
    }

    const genRes = await fetch(env.TARGET_URL_BASE + "/KEYGEN/keys.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Cookie": cookie
      },
      body: payload.toString()
    });

    const result = await genRes.text();

    // 5. Key ရှာ (မင်း နမူနာ အတိုင်း)
    const key = result.match(/([A-Za-z0-9+\/=]{20,})/)?.[0];
    if (!key) {
      const short = result.substring(0, 600);
      return await send(env.BOT_TOKEN, chatId, `Key မတွေ့ပါ\n\nHTML:\n\`\`\`\n${short}\n\`\`\``);
    }

    await send(env.BOT_TOKEN, chatId, `Key ထွက်ပါပြီ!\n\n\`\( {key}\`\n\nDevice ID: \` \){deviceId}\``);

  } catch (e: any) {
    await send(env.BOT_TOKEN, chatId, "Error: " + e.message);
  }
}

export default {
  async fetch(req: Request, env: Env) {
    if (req.method !== "POST") return new Response("ok");
    try {
      const u = await req.json<any>();
      const txt = u.message?.text?.trim();
      const cid = u.message?.chat.id.toString();
      if (!txt || !cid) return new Response("ok");

      if (txt === "/start") {
        await send(env.BOT_TOKEN, cid, "Bot အဆင်သင့်ပါပြီ!\n\n`/keygen မင်းရဲ့ Device ID`");
        return new Response("ok");
      }
      if (txt.startsWith("/keygen ")) {
        const id = txt.slice(8).trim();
        if (!id) return await send(env.BOT_TOKEN, cid, "Device ID ထည့်ပါ");
        await send(env.BOT_TOKEN, cid, "ခဏစောင့်ပါ... ⏳");
        await run(env, cid, id);
        return new Response("ok");
      }
      return new Response("ok");
    } catch { return new Response("ok"); }
  }
};
