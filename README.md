# Chat Sangam

Chat Sangam is a mobile-first, multi-model AI workspace built with Next.js. It includes a free-model router, chat and vision models, Markdown/math rendering, web search and research, document extraction, and browser-local chat history.

## Current model routing

- **Auto (Free)** is the default selection.
- Auto tries configured providers in this order: **Groq GPT-OSS 20B → Gemini Flash-Lite → Antigravity Agent**.
- If a provider fails with a retryable error, the router tries the next configured provider. The response includes headers identifying the model that answered and, when applicable, the provider it fell back from.
- Users can also choose a supported model directly from the model menu. Auto routing is not a guarantee of unlimited free usage; provider quotas and terms can change.
- **Antigravity Agent is experimental/preview** and uses Google's Interactions API. Verify its availability and current API access before relying on it in production.
- Vision requests use the configured Groq vision model and follow the vision-specific route.

The UI's provider status shows whether an API key is present. It does **not** confirm that the key is valid, that quota remains, or that a provider is currently healthy.

## Required environment variables

Set provider keys **on the server only**. Never place API keys in client-side code, commit them to GitHub, or paste them into public chat.

- `GROQ_API_KEY` — enables Groq text/vision and Groq-powered web research.
- `GEMINI_API_KEY` — enables Gemini and the experimental Antigravity route.

## Configure on Vercel

1. Open the Chat Sangam project in Vercel.
2. Go to **Settings → Environment Variables**.
3. Add each key with its exact name and secret value.
4. Enable it for the environment being tested: **Preview** for pull-request previews and **Production** for the live site.
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
- API keys are server-side only; the status endpoint reports key presence, not provider health.
- Paid providers such as OpenAI, Claude, Perplexity, and DeepSeek are future integrations, not active selectable integrations yet.

## Smoke-test checklist

After a deployment, verify these separately:

1. Send a normal prompt in **Auto (Free)** and confirm the assistant response shows the actual provider/model.
2. Test web search and confirm citations open the expected sources.
3. Test a math prompt and verify formulas render correctly.
4. Test an image and a text document upload.
5. Test provider fallback only when safe to do so; a successful normal response does not prove fallback works. Inspect the response's `X-Chat-Sangam-Model` and `X-Chat-Sangam-Fallback-From` headers or the deployment logs.
6. Confirm a direct model selection uses the requested provider when it is available.

## Troubleshooting

- **“No free AI provider is configured”**: add `GROQ_API_KEY` or `GEMINI_API_KEY` to the environment used by that deployment and redeploy.
- **“Groq is not configured”**: add `GROQ_API_KEY` to the correct Vercel environment and redeploy.
- **“Gemini is not configured”**: add `GEMINI_API_KEY` to the correct Vercel environment and redeploy.
- **Rate limit / temporary provider error**: wait, check the provider dashboard and key permissions, then retry. Do not repeatedly submit the same prompt while a request is still running.
- **A scanned PDF appears empty**: OCR the PDF first and upload the resulting searchable PDF or text.
