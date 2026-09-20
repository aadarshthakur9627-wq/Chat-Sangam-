import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const { model, messages } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return Response.json(
        { error: "Messages are required." },
        { status: 400 }
      );
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // =========================
          // GEMINI STREAMING
          // =========================
          if (model === "gemini") {
            const geminiContents = messages.map((msg) => ({
              role: msg.role === "assistant" ? "model" : "user",
              parts: [
                {
                  text: msg.content,
                },
              ],
            }));

            const geminiResponse = await fetch(
              "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:streamGenerateContent?alt=sse",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "x-goog-api-key": process.env.GEMINI_API_KEY,
                },
                body: JSON.stringify({
                  contents: geminiContents,
                }),
              }
            );

            if (!geminiResponse.ok || !geminiResponse.body) {
              const errorText = await geminiResponse.text();

              console.error(
                "Gemini API error:",
                geminiResponse.status,
                errorText
              );

              throw new Error("Gemini API request failed");
            }

            const reader = geminiResponse.body.getReader();
            const decoder = new TextDecoder();

            let buffer = "";

            while (true) {
              const { value, done } = await reader.read();

              if (done) break;

              buffer += decoder.decode(value, {
                stream: true,
              });

              const lines = buffer.split("\n");

              buffer = lines.pop() || "";

              for (const line of lines) {
                const trimmed = line.trim();

                if (!trimmed.startsWith("data:")) {
                  continue;
                }

                const jsonText = trimmed.slice(5).trim();

                if (!jsonText) continue;

                try {
                  const data = JSON.parse(jsonText);

                  const parts =
                    data.candidates?.[0]?.content?.parts || [];

                  for (const part of parts) {
                    if (part.text) {
                      controller.enqueue(
                        encoder.encode(part.text)
                      );
                    }
                  }
                } catch (parseError) {
                  console.error(
                    "Gemini SSE parse error:",
                    parseError
                  );
                }
              }
            }

            // Process remaining buffer
            const remaining = buffer.trim();

            if (remaining.startsWith("data:")) {
              const jsonText = remaining.slice(5).trim();

              if (jsonText) {
                try {
                  const data = JSON.parse(jsonText);

                  const parts =
                    data.candidates?.[0]?.content?.parts || [];

                  for (const part of parts) {
                    if (part.text) {
                      controller.enqueue(
                        encoder.encode(part.text)
                      );
                    }
                  }
                } catch (parseError) {
                  console.error(
                    "Gemini final SSE parse error:",
                    parseError
                  );
                }
              }
            }
          }

          // =========================
          // GROQ STREAMING
          // =========================
          else {
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
              }
            }
          }

          controller.close();
        } catch (error) {
          console.error("Streaming error:", error);

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
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Chat API error:", error);

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
