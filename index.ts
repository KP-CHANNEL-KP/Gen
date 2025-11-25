// Define interfaces for Telegram Update structure
interface Env {
  BOT_TOKEN: string;
  CHAT_ID: string; // Used as default for sending initial results/errors
  TARGET_USERNAME: string;
  TARGET_PASSWORD: string;
  TARGET_URL_BASE: string;
}

interface TelegramMessage {
  text: string;
  chat: {
    id: number;
    // other fields omitted for brevity
  };
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  // other fields omitted
}

const KEYGEN_PATH = "/KEYGEN/index.php";

// ----------------------------------------------------
// --- Core Logic: Multi-Step Automation Function ---
// (Now accepts the specific chatId and deviceId)
// ----------------------------------------------------

async function runAutomation(env: Env, chatId: string, deviceId: string): Promise<string> {
  const SESSION_DATA: { cookie: string | null } = { cookie: null };
  const TARGET_URL = env.TARGET_URL_BASE + KEYGEN_PATH;

  // --- 1. LOGIN (POST Request) ---
  const loginPayload = {
    'user_field': env.TARGET_USERNAME, // ⚠️ Check the exact form field name
    'pass_field': env.TARGET_PASSWORD, // ⚠️ Check the exact form field name
    'login_submit': 'Login'
  };

  try {
    const loginResponse = await fetch(TARGET_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(loginPayload).toString(),
      redirect: 'manual'
    });

    const setCookieHeader = loginResponse.headers.get('Set-Cookie');
    if (setCookieHeader) {
      SESSION_DATA.cookie = setCookieHeader.split(';')[0];
    }

    if (!SESSION_DATA.cookie) {
        await sendTelegramMessage(env.BOT_TOKEN, chatId, "❌ လော့ဂ်အင် မအောင်မြင်ပါ။ အချက်အလက်များကို စစ်ဆေးပါ။");
        return "Login Failed";
    }

    // --- 2. GENERATE KEY ACTION (POST Request with parameters) ---
    const keygenPayload = {
      // ⚠️ Use the exact field names from your website's form
      'action_type': 'generate_new_key',
      'device_count': '1',               // One Device
      'days': '30',                      // 30 Days
      'hours': '0',
      'minutes': '0',
      'device_id_manual': deviceId,      // 👈 Telegram မှ ရလာသော Device ID
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

    // --- 3. EXTRACT THE KEY ---
    // ⚠️ You MUST adjust this regex to match the exact HTML structure where the key appears
    // If the key is inside a div with class="keygen-result":
    const keyExtractionRegex = /<div class="keygen-result">(.*?)<\/div>/s; 
    const match = keygenHTML.match(keyExtractionRegex);
    
    let generatedKey = match ? match[1].trim() : "🔑 Key not found in response HTML.";

    if (generatedKey.startsWith("🔑")) {
        await sendTelegramMessage(env.BOT_TOKEN, chatId, `❌ Key ထုတ်ယူခြင်း မအောင်မြင်ပါ။ ဝက်ဘ်ဆိုက်တုံ့ပြန်မှုကို စစ်ဆေးပါ။`);
        return "Key Extraction Failed";
    }

    // --- 4. SEND KEY TO TELEGRAM ---
    const telegramMessage = `✅ **Key Generate အောင်မြင်ပါပြီ!**\n\n\`${generatedKey}\`\n\nDevice ID: \`${deviceId}\``;
    await sendTelegramMessage(env.BOT_TOKEN, chatId, telegramMessage);

    return "Key Generated and Sent";

  } catch (error) {
    const errorMessage = `❌ အလိုအလျောက်လုပ်ဆောင်မှု Error ဖြစ်ပွား: ${error instanceof Error ? error.message : "အမည်မသိ Error"}`;
    await sendTelegramMessage(env.BOT_TOKEN, chatId, errorMessage);
    return "Automation Error";
  }
}

// ----------------------------------------------------
// --- Telegram API Helper Function ---
// ----------------------------------------------------

async function sendTelegramMessage(token: string, chatId: string, text: string) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  
  // Use try-catch to prevent a failed Telegram send from crashing the Worker
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'Markdown'
      })
    });
  } catch (e) {
      console.error("Failed to send message to Telegram:", e);
  }
}

// ----------------------------------------------------
// --- Worker Entry Point (Handles Telegram Webhook) ---
// ----------------------------------------------------

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    
    // Telegram Webhook သည် POST method ကိုသာ သုံးသည်
    if (request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }
    
    try {
        const update = await request.json() as TelegramUpdate;

        if (update.message && update.message.text) {
            const text = update.message.text.trim();
            // Chat ID ကို Message ကနေ တိုက်ရိုက်ယူပြီး တုံ့ပြန်မည်
            const chatId = update.message.chat.id.toString(); 
            
            if (text === '/start') {
                const welcomeMessage = "👋 **Keygen Bot** မှ ကြိုဆိုပါတယ်။ Device Key Generate လုပ်ဖို့အတွက် အောက်ပါအတိုင်း ပေးပို့ပါ။\n\n`/keygen [သင့်ရဲ့ Device ID]`\n\nဥပမာ- `/keygen My_New_Phone_2025`";
                
                await sendTelegramMessage(env.BOT_TOKEN, chatId, welcomeMessage);
                return new Response('Handled /start', { status: 200 });
                
            } else if (text.startsWith('/keygen ')) {
                // /keygen command ကို ကိုင်တွယ်ပြီး Device ID ကို ဆွဲထုတ်ခြင်း
                const deviceId = text.substring(8).trim(); 
                
                if (deviceId.length === 0) {
                     await sendTelegramMessage(env.BOT_TOKEN, chatId, "❌ Device ID ထည့်သွင်းဖို့ လိုပါတယ်။\n\nအသုံးပြုပုံ: `/keygen [သင့်ရဲ့ Device ID]`");
                     return new Response('Missing Device ID', { status: 200 });
                }

                // Automation Function ကို ခေါ်ဆိုခြင်း
                const resultSummary = await runAutomation(env, chatId, deviceId);

                return new Response(resultSummary, { status: 200 });
            }
        }

        // မည်သည့် command မှ မဟုတ်ပါက၊ Telegram ကို OK ပြန်ပေးပါ။
        return new Response('OK', { status: 200 });

    } catch (e) {
        // Parsing error or other unexpected error
        console.error("Error processing update:", e);
        // Telegram ကို Error ပြန်မပို့တော့ဘဲ 200 OK ပြန်ပေးပါ
        return new Response('Processing Error', { status: 200 }); 
    }
  },
};
