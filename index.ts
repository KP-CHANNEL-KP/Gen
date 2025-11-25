// [Interfaces နှင့် Environment Variables များသည် ယခင်အတိုင်းပင် ရှိပါသည်]

// ... (TelegramUpdate, TelegramMessage, Env Interfaces များ) ...

const KEYGEN_PATH = "/KEYGEN/index.php";

// ----------------------------------------------------
// --- Core Logic: Multi-Step Automation Function (DEBUGGING ENABLED) ---
// ----------------------------------------------------

async function runAutomation(env: Env, chatId: string, deviceId: string): Promise<string> {
  const SESSION_DATA: { cookie: string | null } = { cookie: null };
  const TARGET_URL = env.TARGET_URL_BASE + KEYGEN_PATH;

  // --- 1. LOGIN (POST Request) ---
  const loginPayload = {
    'user_field': env.TARGET_USERNAME, // ⚠️ ဤ Form Field Name ကို စစ်ဆေးပါ
    'pass_field': env.TARGET_PASSWORD, // ⚠️ ဤ Form Field Name ကို စစ်ဆေးပါ
    'login_submit': 'Login'
  };

  try {
    // ... (Login Logic - အပြောင်းအလဲမရှိ) ...
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
      // ⚠️ ဤ Form Field Name များကိုလည်း စစ်ဆေးရန် လိုအပ်ပါသည်
      'action_type': 'generate_new_key',
      'device_count': '1',               
      'days': '30',                      
      'hours': '0',
      'minutes': '0',
      'device_id_manual': deviceId,      
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
    // ⚠️ စမ်းသပ်ရန်အတွက် ဤ Regex ကို အောက်ပါအတိုင်း ပြောင်းထားပါသည် (သင်ကိုယ်တိုင် ပြင်ရန်)
    // ဥပမာ- Key ကို h1 Tag ထဲကဟု ယူဆပြီး ပြင်ဆင်ပါ
    const keyExtractionRegex = /<h1>(.*?)<\/h1>/s; // <--- ဤနေရာကို သင့်ဝက်ဘ်ဆိုက်နှင့် ကိုက်ညီအောင် ပြင်ပါ
    
    const match = keygenHTML.match(keyExtractionRegex);
    
    let generatedKey = match ? match[1].trim() : "🔑 Key not found.";

    if (generatedKey.startsWith("🔑")) {
        // --- DEBUGGING OUTPUT ---
        // Key ရှာမတွေ့ပါက HTML ရဲ့ ပထမဆုံး စာလုံး ၃၀၀ ကို Telegram သို့ ပို့မည်။
        const debugOutput = keygenHTML.substring(0, 300);
        const debugMessage = `❌ Key ထုတ်ယူခြင်း မအောင်မြင်ပါ။ \n\n**HTML နမူနာ:**\n\`\`\`html\n${debugOutput}...\n\`\`\`\n\n**ပြင်ဆင်ရန်:** \`keyExtractionRegex\` ကို စစ်ဆေးပါ။`;
        
        await sendTelegramMessage(env.BOT_TOKEN, chatId, debugMessage);
        return "Key Extraction Failed (Debugging Output Sent)";
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
// [Telegram Helper Function နှင့် Worker Entry Point များသည် ယခင်အတိုင်းပင် ရှိပါသည်]
// ... (sendTelegramMessage function) ...
// ... (export default fetch function) ...
