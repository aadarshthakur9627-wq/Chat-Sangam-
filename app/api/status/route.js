export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(
    {
      providers: {
        groq: { configured: Boolean(process.env.GROQ_API_KEY) },
        gemini: { configured: Boolean(process.env.GEMINI_API_KEY) },
      },
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}
