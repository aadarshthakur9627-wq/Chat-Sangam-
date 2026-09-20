import Groq from "groq-sdk";
import { GoogleGenAI } from "@google/genai";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const gemini = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const { model, messages } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return Response.json(
        {
          error: "Messages are required.",
        },
        {
          status: 400,
        }
      );
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          if (model === "gemini") {
            const geminiContents = messages.map((msg) => ({
              role:
                msg.role === "assistant"
                  ? "model"
                  : "user",
              parts: [
                {
                  text: msg.content,
                },
              ],
            }));

            const responseStream =
              await gemini.models.generateContentStream({
                model: "gemini-3.8-flash",
                contents: geminiContents,
              });

            for await (const chunk of responseStream) {
              const text = chunk.text || "";

              if (text) {
                controller.enqueue(
                  encoder.encode(text)
                );

                await new Promise((resolve) =>
                  setTimeout(resolve, 20)
                );
              }
            }
          } else {
            const responseStream =
              await groq.chat.completions.create({
                model: "openai/gpt-oss-20b",
                messages,
                stream: true,
              });

            for await (const chunk of responseStream) {
              const text =
                chunk.choices?.[0]?.delta?.content || "";

              if (text) {
                controller.enqueue(
                  encoder.encode(text)
                );

                await new Promise((resolve) =>
                  setTimeout(resolve, 20)
                );
              }
            }
          }

          controller.close();
        } catch (error) {
          console.error(
            "Streaming error:",
            error
          );

          controller.enqueue(
            encoder.encode(
              "\n\n[AI response failed. Please try again.]"
            )
          );

          controller.close();
        }
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type":
          "text/plain; charset=utf-8",
        "Cache-Control":
          "no-cache, no-transform",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    console.error(
      "Chat API error:",
      error
    );

    return Response.json(
      {
        error: "AI response failed.",
      },
      {
        status: 500,
      }
    );
  }
}
