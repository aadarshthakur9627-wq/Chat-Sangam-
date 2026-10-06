import { NextResponse } from "next/server";
import pdfParse from "pdf-parse";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_TEXT_CHARS = 120000;

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "File is required." }, { status: 400 });
    if (file.size > MAX_FILE_BYTES) return NextResponse.json({ error: "File is too large. Maximum size is 10 MB." }, { status: 413 });

    const name = file.name || "document";
    const ext = name.toLowerCase().split(".").pop();
    const supported = ["pdf","txt","md","csv","json"];
    if (!supported.includes(ext)) return NextResponse.json({ error: "Supported files: PDF, TXT, MD, CSV and JSON." }, { status: 415 });

    const buffer = Buffer.from(await file.arrayBuffer());
    let text = "";

    if (ext === "pdf") {
      const parsed = await pdfParse(buffer);
      text = parsed.text || "";
    } else {
      text = buffer.toString("utf8");
    }

    text = text.replace(/\u0000/g, "").replace(/\r\n/g, "\n").trim();
    const truncated = text.length > MAX_TEXT_CHARS;
    if (truncated) text = text.slice(0, MAX_TEXT_CHARS);

    return NextResponse.json({
      name,
      type: ext,
      characters: text.length,
      truncated,
      text,
    });
  } catch (error) {
    console.error("File extraction error:", error);
    return NextResponse.json({ error: "I couldn't read that file. Please try another PDF or text document." }, { status: 500 });
  }
}
