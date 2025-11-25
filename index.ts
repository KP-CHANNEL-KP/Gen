// Define interfaces for Cloudflare Environment Variables
interface Env {
  BOT_TOKEN: string;
  CHAT_ID: string; // Default Chat ID for general errors
  TARGET_USERNAME: string;
  TARGET_PASSWORD: string;
  TARGET_URL_BASE: string; // e.g., http://saikokowinmyanmar123.com
}

// Define interfaces for Telegram Update structure
interface TelegramMessage {
  text: string;
  chat: {
    id: number;
  };
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

const KEYGEN_PATH = "/KEYGEN/index.php";

// ----------------------------------------------------
// --- Helper: Escape for MarkdownV2 ---
// ----------------------------------------------------
function escapeMarkdownV2(text: string): string {
  return text.replace(/([_\*\[\]\(\)\~\`>#\+\-=|\{\}\.\!])/g, '\\$1');
}

// ----------------------------------------------------
// --- Core Logic: Multi-Step Automation Function (DEBUGGING ENABLED) ---
// ----------------------------------------------------

/**
 * Handles the login, key generation, and key extraction sequence.
 * Sends results or debugging info back to the specific Telegram chat.
 */
async function runAutomation(env: Env, chatId: string, deviceId: string): Promise<string> {
  const SESSION_DATA: { cookie: string | null } = { cookie: null };
  const TARGET_URL = env.TARGET_URL_BASE + KEYGEN_PATH;

  // --- 1. LOGIN (POST Request) ---
  const loginPayload = {
    // ⚠️ Form field names (user_field, pass_field) သည် သင့်ဝက်ဘ်ဆိုက်နှင့် ကိုက်ညီရပါမည်
    'user_field': env.TARGET_USERNAME, 
    'pass_field': env.TARGET_PASSWORD, 
    'login_submit': 'Login'
  };

  try {
    const loginResponse = await fetch(TARGET_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(loginPayload).toString(),
      redirect: 'follow'  // အရေးကြီး: Redirect လိုက်အောင်လုပ်ရန်
    });

    const setCookies = loginResponse.headers.getSetCookie();
    if (setCookies && setCookies.length > 0) {
      SESSION_DATA.cookie = setCookies.map(c => c.split(';')[0]).join('; ');
    }

    if (!SESSION_DATA.cookie) {
        await sendTelegramMessage(env.BOT_TOKEN, chatId || env.CHAT_ID, "❌ လော့ဂ်အင် မအောင်မြင်ပါ။ အချက်အလက်များကို စစ်ဆေးပါ။", 'MarkdownV2');
        return "Login Failed";
    }

    // Login ပြီးတဲ့ URL ကို ယူမယ် (dynamic ဖြစ်အောင်)
    const KEYGEN_URL = loginResponse.url;  // သို့မဟုတ် လိုအပ်ရင် env.TARGET_URL_BASE + '/dashboard/keygen.php' လိုမျိုး ပြင်ပါ

    // --- 2. GENERATE KEY ACTION (POST Request) ---
    const keygenPayload = {
      // ⚠️ ဤ Form Field Names များကိုလည်း စစ်ဆေးရပါမည်
      'action_type': 'generate_new_key',
      'device_count': '1',  // One Device
      'days': '30',                      
      'hours': '0',
      'minutes': '0',
      'device_id_manual': deviceId,      
      'generate_submit': 'Generate Key' 
    };

    const keygenResponse = await fetch(KEYGEN_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Cookie': SESSION_DATA.cookie 
        },
        body: new URLSearchParams(keygenPayload).toString(),
        redirect: 'follow'  // လိုအပ်ရင် redirect လိုက်မယ်
    });

    const keygenHTML = await keygenResponse.text();

    // --- 3. EXTRACT THE KEY (Multi-Regex Attempt) ---
    
    // ⚠️ IMPORTANT: သင့်ရဲ့ ဝက်ဘ်ဆိုက်နဲ့ ကိုက်ညီမယ့် Regex ကို ရွေးချယ်ပြီး အောက်မှာထားပါ
    const keyExtractionRegexes = [
        // 1. Key ကို <textarea> tag ထဲကနေ ဆွဲထုတ်ခြင်း (အများဆုံးဖြစ်တတ်သည်)
        /<textarea[^>]*>(.*?)<\/textarea>/s, 
        // 2. Key ကို div ထဲက class name (keygen-result) ထဲကနေ ဆွဲထုတ်ခြင်း
        /<div class="keygen-result">(.*?)<\/div>/s,
        // 3. Key ကို <b> tag သို့မဟုတ် <h1> tag ထဲကနေ ဆွဲထုတ်ခြင်း
        /<b>(.*?)<\/b>/s,
        /<h1>(.*?)<\/h1>/s,
        // 4. အသစ်ထည့်ထားတဲ့ နမူနာ regexes (site အများစုမှာ ရှိနိုင်တယ်)
        /<pre[^>]*>(.*?)<\/pre>/s,  // Pre tag ထဲမှာ ရှိနိုင်တယ်
        /<code[^>]*>(.*?)<\/code>/s,  // Code tag ထဲမှာ
        /Generated Key:\s*([A-Z0-9-]{10,})/i  // Text-based ရှာမယ် (အပေါ်ဆုံး key အတွက်)
    ];

    let generatedKey = "🔑 Key not found.";

    // Key Extraction Regex မျိုးစုံနဲ့ စမ်းသပ်ခြင်း
    for (const regex of keyExtractionRegexes) {
        const match = keygenHTML.match(regex);
        // Match တွေ့ပြီး၊ အရှည် ၅ လုံးထက် ပိုပါက Key အဖြစ် လက်ခံမည် (အပေါ်ဆုံး key ပဲ ယူမယ်)
        if (match && match[1].trim().length > 5) { 
            generatedKey = match[1].trim();
            break; 
        }
    }

    // Key ရှာမတွေ့ပါက Debugging Message ပို့ခြင်း
    if (generatedKey.startsWith("🔑")) {
        // --- DEBUGGING OUTPUT ---
        const debugOutput = keygenHTML.substring(0, 500); 
        const debugMessage = `❌ Key ထုတ်ယူခြင်း မအောင်မြင်ပါ။\n\n**Server တုံ့ပြန်မှု နမူနာ (HTML ဖွဲ့စည်းပုံကို စစ်ဆေးရန်):**\n\`\`\`html\n${escapeMarkdownV2(debugOutput)}...\n\`\`\`\n\n**ပြင်ဆင်ရန်:** \`keyExtractionRegexes\` ထဲမှ သင့်ဝက်ဘ်ဆိုက်နှင့် ကိုက်ညီသော Regex ကို ရွေးချယ် အသုံးပြုပါ၊ သို့မဟုတ် အသစ်ထပ်ထည့်ပါ။`;
        
        await sendTelegramMessage(env.BOT_TOKEN, chatId || env.CHAT_ID, debugMessage, 'MarkdownV2');
        return "Key Extraction Failed (Debugging Output Sent)";
    }

    // --- 4. SEND KEY TO TELEGRAM ---
    const telegramMessage = `✅ **Key Generate အောင်မြင်ပါပြီ!**\\n\\n\`\( {escapeMarkdownV2(generatedKey)}\`\\n\\nDevice ID: \` \){escapeMarkdownV2(deviceId)}\``;
    await sendTelegramMessage(env.BOT_TOKEN, chatId, telegramMessage, 'MarkdownV2');

    return "Key Generated and Sent";

  } catch (error) {
    const errorMessage = `❌ အလိုအလျောက်လုပ်ဆောင်မှု Error ဖြစ်ပွား: ${error instanceof Error ? escapeMarkdownV2(error.message) : "အမည်မသိ Error"}`;
    await sendTelegramMessage(env.BOT_TOKEN, chatId || env.CHAT_ID, errorMessage, 'MarkdownV2');
    return "Automation Error";
  }
}

// ----------------------------------------------------
// --- Telegram API Helper Function ---
// ----------------------------------------------------

/**
 * Sends a Markdown formatted message back to the specified Telegram chat.
 * @param parseMode Default 'MarkdownV2'
 */
async function sendTelegramMessage(token: string, chatId: string, text: string, parseMode: 'MarkdownV2' | 'HTML' = 'MarkdownV2') {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: parseMode
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
    
    if (request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }
    
    try {
        const update = await request.json() as TelegramUpdate;

        if (update.message && update.message.text) {
            const text = update.message.text.trim();
            const chatId = update.message.chat.id.toString(); 
            
            if (text === '/start') {
                const welcomeMessage = "👋 **Keygen Bot** မှ ကြိုဆိုပါတယ်။ Device Key Generate လုပ်ဖို့အတွက် အောက်ပါအတိုင်း ပေးပို့ပါ။\\n\\n`/keygen [သင့်ရဲ့ Device ID]`\\n\\nဥပမာ- `/keygen My_New_Phone_2025`";
                
                await sendTelegramMessage(env.BOT_TOKEN, chatId, welcomeMessage, 'MarkdownV2');
                return new Response('Handled /start', { status: 200 });
                
            } else if (text.startsWith('/keygen ')) {
                const deviceId = text.substring(8).trim(); 
                
                if (deviceId.length === 0) {
                     await sendTelegramMessage(env.BOT_TOKEN, chatId, "❌ Device ID ထည့်သွင်းဖို့ လိုပါတယ်။\\n\\nအသုံးပြုပုံ: `/keygen [သင့်ရဲ့ Device ID]`", 'MarkdownV2');
                     return new Response('Missing Device ID', { status: 200 });
                }

                const resultSummary = await runAutomation(env, chatId, deviceId);

                return new Response(resultSummary, { status: 200 });
            }
        }

        return new Response('OK', { status: 200 });

    } catch (e) {
        console.error("Error processing update:", e);
        return new Response('Processing Error', { status: 200 }); 
    }
  },
};
