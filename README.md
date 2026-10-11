# Chat Sangam

Chat Sangam is a mobile-first, multi-model AI workspace built with Next.js. It currently supports Groq-hosted chat/vision models and Google Gemini, with Markdown, math rendering, web search, document extraction, and local browser history.

## Required environment variables

Set provider keys **on the server only**. Never place API keys in client-side code, commit them to GitHub, or paste them into public chat.

- `GROQ_API_KEY` — required for Groq chat, vision, and Groq-powered web research.
- `GEMINI_API_KEY` — required to use the Gemini model.

### Configure on Vercel

1. Open the Chat Sangam project in Vercel.
2. Go to **Settings → Environment Variables**.
3. Add each key with its exact name and secret value.
4. Enable it for the environment you are testing: **Preview** for pull-request previews and **Production** for the live site.
5. Save, then redeploy the relevant deployment so the runtime receives the new value.
6. Open `/api/status` on that deployment. It returns only whether each key is present; it never returns key values. A key being present does not prove that the key is valid, so send a test prompt too.

## Local development

1. Install a supported Node.js version.
2. Run `npm install`.
3. Create a local `.env.local` file with the required environment variables.
4. Run `npm run dev` and open the local URL shown in the terminal.

Do not commit `.env.local`.

## Current behavior and limits

- Chat history is stored in the current browser's local storage; it is not a cloud-synced account history.
- Chat requests include a bounded recent message window to avoid oversized serverless requests.
- Up to three recent images are sent to the Groq vision model; supported image formats are JPG, PNG, WEBP, and GIF.
- PDF, TXT, MD, CSV, and JSON files are supported for text extraction. Scanned PDFs without selectable text need OCR first.
- Gemini web grounding returns source markers when the provider supplies grounding metadata.
- Provider status indicates key presence only, not provider uptime, quota, or key validity.

## Troubleshooting

- **“Groq is not configured”**: add `GROQ_API_KEY` to the environment used by that deployment and redeploy.
- **“Gemini is not configured”**: add `GEMINI_API_KEY` to the environment used by that deployment and redeploy.
- **Rate limit / temporary provider error**: wait, check the provider dashboard and key permissions, then retry. Do not repeatedly submit the same prompt while a request is still running.
- **A scanned PDF appears empty**: OCR the PDF first and upload the resulting searchable PDF or text.
