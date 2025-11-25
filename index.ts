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
    // Step 1: Login
    const login = await fetch(env.TARGET_URL_BASE + "/KEYGEN/index.php", {
      method: "POST",
      body: new URLSearchParams({
        user_field: env.TARGET_USERNAME,
        pass_field: env.TARGET_PASSWORD,
        login_submit: "Login"
      }).toString(),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      redirect: "follow"
    });

    const c = login.headers.getSetCookie();
    if (c) cookie = c.map(x => x.split(";")[0]).join("; ");
    if (!cookie) return await send(env.BOT_TOKEN, chatId, "Login မအောင်မြင်ပါ");

    await send(env.BOT_TOKEN, chatId, "Login အောင်မြင်ပါပြီ ✅\nDashboard ရောက်ပါပြီ...");

    // Step 2: Dashboard ကနေ Generate New Key ခလုတ်ရှာ
    const dash = await fetch(env.TARGET_URL_BASE + "/KEYGEN/dashboard.php", {
      headers: { Cookie: cookie }
    });
    const dashHtml = await dash.text();

    // ခလုတ်ထဲက URL ထုတ်ယူ (onclick ထဲက သို့မဟုတ် href)
    const genLinkMatch = dashHtml.match(/href=["']([^"']*keys\.php\?action=generate[^"']*)["']/) ||
                         dashHtml.match(/window\.location=["']([^"']*keys\.php\?action=generate[^"']*)["']/);
    if (!genLinkMatch) return await send(env.BOT_TOKEN, chatId, "Generate ခလုတ်မတွေ့ပါ");

    const genUrl = env.TARGET_URL_BASE + "/" + genLinkMatch[1].replace(/^\/+/, "");

    await send(env.BOT_TOKEN, chatId, "Generate Form ဖွင့်နေပါပြီ...");

    // Step 3: Generate Form ဖွင့်
    const form = await fetch(genUrl, { headers: { Cookie: cookie } });
    const formHtml = await form.text();

    // Step 4: Generate Key POST
    const postRes = await fetch(env.TARGET_URL_BASE + "/KEYGEN/keys.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Cookie": cookie
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

    const result = await postRes.text();

    // Step 5: Key ရှာ
    const key = result.match(/([A-Za-z0-9+\/=]{20,})/)?.[0];
    if (!key) {
      const s = result.substring(0, 500);
      return await send(env.BOT_TOKEN, chatId, `Key မတွေ့ပါ\n\n\`\`\`\n${s}\n\`\`\``);
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
      const text = u.message?.text?.trim();
      const chat = u.message?.chat.id.toString();
      if (!text || !chat) return new Response("ok");

      if (text === "/start") {
        await send(env.BOT_TOKEN, chat, "Bot အဆင်သင့်ပါပြီ!\n\n`/keygen မင်းရဲ့ Device ID`");
        return new Response("ok");
      }
      if (text.startsWith("/keygen ")) {
        const id = text.slice(8).trim();
        if (!id) return await send(env.BOT_TOKEN, chat, "Device ID ထည့်ပါ");
        await send(env.BOT_TOKEN, chat, "ခဏစောင့်ပါ... ⏳");
        await run(env, chat, id);
        return new Response("ok");
      }
      return new Response("ok");
    } catch { return new Response("ok"); }
  }
};
