// Define the structure for environment variables (Set these securely in Cloudflare Settings)
interface Env {
  BOT_TOKEN: string;      // Your Telegram Bot Token
  CHAT_ID: string;        // Your Telegram Chat ID to send the key to
  TARGET_USERNAME: string; // tinsein@gmail.com
  TARGET_PASSWORD: string; // Koplm890
  TARGET_URL_BASE: string; // http://saikokowinmyanmar123.com
}

// Target Path for the keygen page
const KEYGEN_PATH = "/KEYGEN/index.php";

// ----------------------------------------------------
// --- Core Logic: Multi-Step Automation Function ---
// ----------------------------------------------------

async function runAutomation(env: Env): Promise<string> {
  const SESSION_DATA: { cookie: string | null } = { cookie: null };
  const TARGET_URL = env.TARGET_URL_BASE + KEYGEN_PATH;

  // --- STEP 1: LOGIN (POST Request) ---
  // Credentials and URL are safely pulled from the environment variables (Env)
  const loginPayload = {
    // ⚠️ Check your site's form field names here (e.g., 'user_email', 'user_pass')
    'user_field': env.TARGET_USERNAME,
    'pass_field': env.TARGET_PASSWORD,
    'login_submit': 'Login' // Example submit button name
  };

  try {
    const loginResponse = await fetch(TARGET_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      // Encode Payload to URLSearchParams format for safe transmission
      body: new URLSearchParams(loginPayload).toString(), 
      redirect: 'manual' 
    });

    const setCookieHeader = loginResponse.headers.get('Set-Cookie');
    if (setCookieHeader) {
      SESSION_DATA.cookie = setCookieHeader.split(';')[0]; 
    }

    if (!SESSION_DATA.cookie) {
        return "❌ Login Failed: Could not establish session. Check credentials and field names.";
    }

    // --- STEP 2: GENERATE KEY ACTION (POST Request with all parameters) ---
    const keygenPayload = {
      // ⚠️ Use the exact field names from your website's key generation form
      'action_type': 'generate_new_key',
      'device_count': '1',               // One Device
      'days': '30',
      'hours': '0',
      'minutes': '0',
      // Manual Device ID will be replaced by the input from the Telegram Bot command later
      'device_id_manual': 'MANUAL_ID_FROM_TELEGRAM', 
      'generate_submit': 'Generate Key' 
    };

    const keygenResponse = await fetch(TARGET_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Cookie': SESSION_DATA.cookie 
        },
        body: new URLSearchParams(keygenPayload as Record<string, string>).toString()
    });

    const keygenHTML = await keygenResponse.text();

    // --- STEP 3: EXTRACT THE KEY ---
    // ⚠️ You MUST adjust this regex to match the exact HTML structure where the key appears
    // For example, if the key is inside a div with class="keygen-result":
    const keyExtractionRegex = /<div class="keygen-result">(.*?)<\/div>/s; 
    const match = keygenHTML.match(keyExtractionRegex);
    
    let generatedKey = match ? match[1].trim() : "🔑 Key not found in response HTML.";

    if (generatedKey.startsWith("🔑")) {
        return `❌ Key Extraction Failed! Could not find the key in the HTML.`;
    }

    // --- STEP 4: SEND KEY TO TELEGRAM ---
    const telegramMessage = `✅ Key Generated:\n\`${generatedKey}\``;
    await sendTelegramMessage(env.BOT_TOKEN, env.CHAT_ID, telegramMessage);

    return `✅ Success! Key generated and sent to Telegram: ${generatedKey}`;

  } catch (error) {
    return `❌ Automation Error: ${error instanceof Error ? error.message : "Unknown error"}`;
  }
}

// ----------------------------------------------------
// --- Telegram API Helper Function ---
// ----------------------------------------------------

async function sendTelegramMessage(token: string, chatId: string, text: string) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: 'Markdown'
    })
  });
}

// ----------------------------------------------------
// --- Worker Entry Point (Placeholder for Telegram Webhook) ---
// ----------------------------------------------------

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // In a real bot, you would process the incoming request from Telegram Webhook here.
    // For now, it runs the automation directly when the worker URL is accessed.
    
    const result = await runAutomation(env);
    
    // In a production bot, this response should be a simple 200 OK.
    return new Response(result, { status: 200 });
  },
};
