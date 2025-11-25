interface Env {
  BOT_TOKEN: string;
  CHAT_ID: string;
  TARGET_USERNAME: string;
  TARGET_PASSWORD: string;
  TARGET_URL_BASE: string;   // e.g. http://saikokowinmyanmar123.com
}

async function send(token: string, chatId: string, message: string) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: "Markdown"
    })
  }).catch(() => {});
}

async function run(env: Env, chatId: string, deviceId: string) {
  let cookie = "";

  try {
    // 1) LOGIN
    const loginRes = await fetch(env.TARGET_URL_BASE + "/KEYGEN/index.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0",
        "Accept": "*/*"
      },
      body: new URLSearchParams({
        user_field: env.TARGET_USERNAME,
        pass_field: env.TARGET_PASSWORD,
        login_submit: "Login"
      }).toString(),
      redirect: "manual"
    });

    // 1.a) COOKIE PARSE (Cloudflare + fallback)
    const setCookies: string[] = [];

    const sc = loginRes.headers.get("set-cookie");
    if (sc) setCookies.push(sc);

    const getSetCookie = (loginRes.headers as any).getSetCookie?.();
    if (getSetCookie && Array.isArray(getSetCookie)) {
      setCookies.push(...getSetCookie);
    }

    if (setCookies.length > 0) {
      cookie = setCookies
        .map(c => c.split(";")[0])
        .join("; ");
    }

    if (!cookie) {
      await send(env.BOT_TOKEN, chatId, "Login မအောင်မြင်ပါ ❌ (Cookie မရလို့)");
      return;
    }

    await send(env.BOT_TOKEN, chatId, "Login အောင်မြင်ပါတယ် 🔐\nGenerate form ဖွင့်နေပါပြီ...");

    // 2) GENERATE FORM
    const formRes = await fetch(env.TARGET_URL_BASE + "/KEYGEN/keys.php?action=generate", {
      method: "GET",
      headers: {
        "Cookie": cookie,
        "User-Agent": "Mozilla/5.0",
        "Accept": "*/*",
        "Referer": env.TARGET_URL_BASE + "/KEYGEN/index.php"
      }
    });

    const formHtml = await formRes.text();

    // Login page ပြန်ရောက်နေရင် session fail
    if (formHtml.includes("user_field") || formHtml.includes("Login")) {
      const short = formHtml.substring(0, 400);
      await send(
        env.BOT_TOKEN,
        chatId,
        `Session ပျောက်သွားတယ် ❗\nLogin page ပြန်ရောက်နေတယ်။\n\nHTML Preview:\n\`\`\`\n${short}\n\`\`\``
      );
      return;
    }

    await send(env.BOT_TOKEN, chatId, "Form ဖွင့်အောင်မြင်ပါတယ် 🎉\nKey ထုတ်နေပါပြီ...");

    // 3) TOKEN ရှာ
    const tokenMatch = formHtml.match(
      /name=["'](?:token|_token|csrf_token)["']\s+value=["']([^"']+)["']/i
    );
    const token = tokenMatch ? tokenMatch[
