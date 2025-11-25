// အခု သုံးရမယ့် code (key မတွေ့ရင် တကယ့် HTML တစ်ခုလုံး ပို့ပေးမယ်)

interface Env {
  BOT_TOKEN: string;
  CHAT_ID: string;
  TARGET_USERNAME: string;
  TARGET_PASSWORD: string;
  TARGET_URL_BASE: string;
}

const LOGIN_PATH = "/KEYGEN/index.php";

async function send(token: string, chatId: string, text: string) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" })
  }).catch(() => {});
}

async function run(env: Env, chatId: string, deviceId: string) {
  let cookie = "";

  // 1. Login
  const loginRes = await fetch(env.TARGET_URL_BASE + LOGIN_PATH, {
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

  await send(env.BOT_TOKEN, chatId, "Login အောင်မြင်ပါပြီ ✅\nKey ထုတ်နေပါပြီ...");

  const dashboardUrl = loginRes.url;   // ဒီနေရာက အဓိကကြီး

  // 2. Generate Key
  const genRes = await fetch(dashboardUrl, {
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

  // === အဓိက ပြောင်းလိုက်တဲ့ နေရာ ===
  // key ရှာမတွေ့ရင် HTML တစ်ခုလုံး ပြန်ပို့ပေးမယ် (အများဆုံး 3800 လုံးလောက်ပဲ ပို့လို့ရတယ်)
  const keyMatch = html.match(/([A-Z0-9-]{10,})/);
  if (!keyMatch || keyMatch[0].length < 10) {
    const shortHtml = html.length > 3800 ? html.substring(0, 3800) + "\n\n... (truncated)" : html;
    await send(env.BOT_TOKEN, chatId,
      "Key ရှာမတွေ့ပါ ညီ\n\nအောက်က HTML ကို ငါ့ကို ပို့ပေးပါ (copy လုပ်ပြီး ငါ့ကို paste လုပ်ရုံပဲ)\n\n```html\n" + shortHtml + "\n```"
    );
    return;
  }

  const key = keyMatch[0];
  await send(env.BOT_TOKEN, chatId, `Key ထွက်ပြီး!\n\n\`\( {key}\`\n\nDevice ID: \` \){deviceId}\``);
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
        await send(env.BOT_TOKEN, chatId, "Bot အဆင်သင့်ပါပြီ\n\n`/keygen သင့် Device ID` လို့ ရိုက်ပို့ပါ");
        return new Response("ok");
      }

      if (text.startsWith("/keygen ")) {
        const deviceId = text.slice(8).trim();
        if (!deviceId) return await send(env.BOT_TOKEN, chatId, "Device ID ထည့်ပါ");
        await send(env.BOT_TOKEN, chatId, "ခဏစောင့်ပါ...");
        await run(env, chatId, deviceId);
        return new Response("ok");
      }

      return new Response("ok");
    } catch { return new Response("ok"); }
  }
};
