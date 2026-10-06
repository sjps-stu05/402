import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY || "";
const ai = new GoogleGenAI({ apiKey });

export async function generateContentWithRetry(contents: string, config?: any): Promise {
  const modelsToTry = ["gemini-2.5-flash", "gemini-1.5-flash"];
  let lastError: any = null;

  for (const model of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        config,
      });
      return response;
    } catch (err: any) {
      lastError = err;
      console.warn(`嘗試模型 ${model} 失敗，準備切換備用模型:`, err);
    }
  }

  throw lastError || new Error("所有 AI 模型呼叫失敗，請檢查 API Key。");
}

// 1. 生成班級情緒週報
export async function summarizeSELReport(entries: any[]): Promise {
  if (!entries || !Array.isArray(entries) || entries.length === 0) {
    return "目前尚無足夠的「修復日誌」數據。請讓學生先填寫情緒修復護照，系統才能進行 AI 分析喔！";
  }

  const formattedEntries = entries.map((entry: any) => {
    const dateStr = new Date(entry.timestamp).toLocaleDateString('zh-TW');
    const moodName = entry.mood === 'sun' ? '大太陽 ☀️' : entry.mood === 'cloud' ? '多雲 ☁️' : entry.mood === 'rain' ? '雨天 🌧️' : '暴風雨 ⛈️';
    return `- 學生: \({entry.studentName} (\){dateStr})\n  原本心情: \({moodName}\n  情緒事件:\){entry.incident}\n  修復與策略: ${entry.result}`;
  }).join("\n\n");

  const prompt = `你是一位專業的國小 SEL（社會情緒學習）輔導專家與班級經營大師。
請分析以下班級學生的「情緒修復日誌」，並為導師（依雯老師）總結出一份溫暖、專業且富有實用建議的「本週情緒修復亮點報告」。

學生的情緒修復日誌：
${formattedEntries}

報告要求：
1. **整體亮點總結**：簡述本週班級情緒狀況與情緒修復的整體成效，用正向、鼓勵的筆調。
2. **卓越修復案例與策略**：挑選 1-2 個值得表揚或特別有創意的學生情緒修復案例，分析他們使用了什麼優異的調節策略（例如：轉移注意力、深呼吸、尋求協助、自我對話等），並說明為什麼這些策略對他們有效。
3. **具體班級經營與輔導建議**：針對目前學生的情緒挑戰（例如課業壓力、人際摩擦或焦慮），提供依雯老師 2-3 個具體、好操作的 SEL 班級引導或關懷建議。
4. **溫馨小叮嚀**：給老師一份支持與充能的話語。

排版要求：
- 請使用 Markdown 格式輸出。
- 標題要生動溫暖（例如：✨ 依雯老師的班級本週情緒亮點報告）。
- 使用粗體、條列式，讓老師一目了然。
- 語言要用繁體中文（台灣習慣用語），語氣要專業且非常貼心、溫暖。`;

  const response = await generateContentWithRetry(prompt, { temperature: 0.7 });
  return response.text || "報告生成完成。";
}

// 2. 生成正向笑話
export async function getDailyJoke(): Promise {
  const response = await generateContentWithRetry(
    "請跟我說一個適合國小學生的笑話，要幽默且正向。只需要回傳笑話內容。",
    { temperature: 0.8, maxOutputTokens: 200 }
  );
  return response.text || "祝大家今天都有好心情！";
}
