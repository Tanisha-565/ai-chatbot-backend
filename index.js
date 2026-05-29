import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ---------------- TEST ----------------
app.get("/", (req, res) => {
  res.send("Server is working!");
});

// ---------------- AI ROUTE ----------------
app.post("/generate", async (req, res) => {
  const { messages } = req.body;

  if (!messages || messages.length === 0) {
    return res.status(400).send("Messages are required");
  }

  // ---------------- SMART MEMORY ----------------
  const MAX_MESSAGES = 10;

  const recentMessages = messages.slice(-MAX_MESSAGES);
  const firstMessage = messages[0];

  const smartMemory = [firstMessage, ...recentMessages];

  // ---------------- CONVERSATION FORMAT ----------------
  const conversation = smartMemory
    .map(m =>
      m.role === "user"
        ? `### User:\n${m.text}`
        : `### Assistant:\n${m.text}`
    )
    .join("\n\n");

  // ---------------- INTENT DETECTION ----------------
  const lastMessage = messages[messages.length - 1].text.toLowerCase();

  let instruction = "";

  if (lastMessage.includes("learn") || lastMessage.includes("teach")) {
    instruction = "Teach step-by-step like a tutor.";
  } else if (lastMessage.includes("conversation")) {
    instruction = "Act like a real conversation partner.";
  } else {
    instruction = "Give helpful and clear answers.";
  }

  // ---------------- SYSTEM PROMPT ----------------
 const systemPrompt = `
You are a precise AI assistant.

Rules:
- Give direct answers
- Do NOT add greetings
- Do NOT add unnecessary explanations
- Do NOT ask follow-up questions unless user asks
- Keep responses short and clear

Special Rule:
- If the question is simple (math, fact, definition), respond in ONE LINE only
`;

  const finalPrompt = `
${systemPrompt}

Instruction:
${instruction}

Conversation:
${conversation}

Continue as an intelligent tutor:
`;

  try {
    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama3",
        prompt: finalPrompt,
        stream: true,
        temperature: 0.7,
        top_p: 0.9,
        num_predict: 200
      })
    });

    // ---------------- STREAM SETUP ----------------
    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Transfer-Encoding", "chunked");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop();

      for (let line of lines) {
        if (!line.trim()) continue;

        try {
          const parsed = JSON.parse(line);

          if (parsed.response) {
            res.write(parsed.response);
          }
        } catch {
          // ignore invalid JSON
        }
      }
    }

    res.end();

  } catch (error) {
    console.error("ERROR:", error);
    res.status(500).send("Error generating response");
  }
});

// ---------------- START SERVER ----------------
app.listen(5000, () => {
  console.log("🚀 Server running on http://localhost:5000");
});