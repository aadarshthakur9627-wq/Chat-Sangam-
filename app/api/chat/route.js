import Groq from "groq-sdk";
import { GoogleGenAI } from "@google/genai";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const gemini = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export async function POST(request) {
  try {
    const { model, messages } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return Response.json(
        { error: "Messages are required." },
        { status: 400 }
      );
    }

    if (model === "gemini") {
      const conversation = messages
        .map((msg) => `${msg.role}: ${msg.content}`)
        .join("\n");

      const interaction = await gemini.interactions.create({
        model: "gemini-3.8-flash",
        input: conversation,
      });

      return Response.json({
        reply: interaction.output_text || "No response received.",
      });
    }

    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-20b",
      messages,
    });

    return Response.json({
      reply:
        completion.choices[0]?.message?.content ||
        "No response received.",
    });
  } catch (error) {
    console.error("Chat API error:", error);

    return Response.json(
      {
        error: "AI response failed. Please try again.",
      },
      { status: 500 }
    );
  }
}
