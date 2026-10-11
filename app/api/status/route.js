export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(
    {
      providers: {
        groq: { configured: Boolean(process.env.GROQ_API_KEY?.trim()) },
        gemini: { configured: Boolean(process.env.GEMINI_API_KEY?.trim()) },
      },
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}
