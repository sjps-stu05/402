import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// Robust content generation helper with exponential backoff and model fallback
async function generateContentWithRetry(contents: string, config?: any): Promise<any> {
  const modelsToTry = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-3.5-flash"];
  let lastError: any = null;

  for (const model of modelsToTry) {
    let attempts = 0;
    const maxAttempts = 3;
    let delay = 1000; // Start with 1 second delay

    while (attempts < maxAttempts) {
      try {
        console.log(`Attempting content generation using model: ${model} (Attempt ${attempts + 1}/${maxAttempts})`);
        const response = await ai.models.generateContent({
          model,
          contents,
          config,
        });
        return response;
      } catch (err: any) {
        lastError = err;
        attempts++;
        console.warn(`Error using model ${model} on attempt ${attempts}:`, err.message || err);

        const errMsg = err.message || "";
        const isTransient = err.status === 503 || 
                            err.status === 429 || 
                            errMsg.includes("503") || 
                            errMsg.includes("429") || 
                            errMsg.includes("high demand") || 
                            errMsg.includes("UNAVAILABLE");

        if (isTransient && attempts < maxAttempts) {
          console.log(`Transient error encountered. Waiting ${delay}ms before retrying...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 2; // Exponential backoff
        } else {
          // Switch to the next fallback model
          break;
        }
      }
    }
  }

  throw lastError || new Error("All model generation attempts failed.");
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route for Jokes
  app.post("/api/gemini/joke", async (req, res) => {
    try {
      const response = await generateContentWithRetry(
        "請跟我說一個適合國小學生的笑話，要幽默且正向。只需要回傳笑話內容。",
        {
          temperature: 0.8,
          maxOutputTokens: 200,
        }
      );

      res.json({ text: response.text });
    } catch (error) {
      console.error("Gemini API Error:", error);
      res.status(500).json({ error: "無法生成笑話，請稍後再試。" });
    }
  });

  // API Route for SEL Weekly Emotion Recovery Highlights Report
  app.post("/api/gemini/summarize", async (req, res) => {
    try {
      const { entries } = req.body;
      if (!entries || !Array.isArray(entries) || entries.length === 0) {
        return res.json({ text: "目前尚無足夠的「修復日誌」數據。請讓學生先填寫情緒修復護照，系統才能進行 AI 分析喔！" });
      }

      // Format entries nicely for Gemini
      const formattedEntries = entries.map((entry: any) => {
        const dateStr = new Date(entry.timestamp).toLocaleDateString('zh-TW');
        const moodName = entry.mood === 'sun' ? '大太陽 ☀️' : entry.mood === 'cloud' ? '多雲 ☁️' : entry.mood === 'rain' ? '雨天 🌧️' : '暴風雨 ⛈️';
        return `- 學生: ${entry.studentName} (${dateStr})\n  原本心情: ${moodName}\n  情緒事件: ${entry.incident}\n  修復與策略: ${entry.result}`;
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
- 語言要用繁體中文（台灣習慣用語），語氣要專業且非常貼心、溫慢。`;

      const response = await generateContentWithRetry(prompt, {
        temperature: 0.7,
      });

      res.json({ text: response.text });
    } catch (error) {
      console.error("Gemini API Error in summarize:", error);
      res.status(500).json({ error: "無法生成報告，請稍後再試。" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
