# Chat Sangam: Zero-Budget Revenue Roadmap

## Goal

Validate willingness to pay before adding paid AI providers or costly infrastructure. Keep the existing Next.js App Router, Groq/Gemini routing, and Vercel Git deployment. Do not replace the current chat experience.

## Non-negotiable constraints

- Initial provider/API budget: INR 0; use eligible free-tier models only.
- Never promise unlimited AI access. Free-tier quotas, policies, and availability can change.
- Never route a user to a paid model or paid API without explicit consent.
- Keep provider API keys server-side.
- Do not treat localStorage, client-supplied plan names, or client-supplied usage counts as trusted entitlement/billing state.
- Do not launch a checkout or claim a subscription is active until payment verification and server-side entitlement enforcement exist.
- Make changes incrementally and run build/smoke tests before declaring production ready.

## Initial customer hypothesis

First test a small "Research Pro" offer for students, creators, freelancers, and small teams who need source-backed research, saved research projects, and exportable reports. This is a hypothesis, not validated demand.

### Validation before billing

1. Interview 10–20 likely users about the recurring research workflow they currently struggle with.
2. Show a real working demo; do not advertise unfinished features as available.
3. Ask 3–5 qualified users to commit to a paid pilot or join an explicitly described early-access test.
4. Record which workflow they value, their expected frequency of use, and what they would pay for.
5. If there is no meaningful willingness to pay, revise the offer before building a billing system.

## Suggested experiment pricing

Treat INR 49–99/month as a test range, not a final price. Explain exactly what is included and what limits apply. Avoid lifetime unlimited plans while provider costs and quotas are uncertain.

## Implementation sequence

### Phase 0 — Reliability and cost controls

- Verify current production deployment and main branch commit.
- Test Groq, Gemini, Auto (Free), fallback behavior, image input, document extraction, and web citations.
- Add or verify request-size limits, sensible output-token caps, safe error handling, and abuse controls.
- Track provider/model, request outcome, latency, and estimated token usage without logging secrets or unnecessary user content.

### Phase 1 — Customer-facing validation

- Prepare a focused Research Pro description based only on existing working capabilities.
- Collect feedback and pilot interest through an explicitly configured contact/waitlist destination.
- Do not add a fake checkout or claim paid features are live.

### Phase 2 — Accounts and entitlement foundation

- Choose/verify the database and authentication provider for Chat Sangam before implementing accounts; do not assume another project’s Supabase configuration is reusable.
- Define server-side user, plan, subscription, usage-event, and billing-event records.
- Enforce entitlements in server routes, not only in the UI.
- Provide export/delete controls and privacy disclosures.

### Phase 3 — Payments

- Select a payment provider after checking eligibility, fees, tax/invoice obligations, refunds, and webhook support.
- Verify payment webhooks server-side and make webhook processing idempotent.
- Grant/revoke access from verified billing state only.
- Test successful, failed, duplicate, refunded, and cancelled payment events before launch.

### Phase 4 — Launch and retention

- Release to a small cohort.
- Track activation, successful response rate, returning users, paid conversion, refunds, and estimated cost per active user.
- Expand only when retention and unit economics support it.

## Initial success criteria (targets, not current results)

- 20 customer conversations.
- 3–5 users willing to trial a paid pilot.
- First 10 paying users.
- At least 95% successful request target during controlled smoke testing.
- INR 0 unexpected paid-provider spend.

## Production release checklist

- Existing general chat and current model routing remain functional.
- No provider key is exposed to the browser or committed to source control.
- Free plan limits are enforced server-side where identity is available.
- Paid entitlements cannot be forged by editing client state.
- Payment webhook signatures are verified and duplicate events are safe.
- Pricing and refund/cancellation terms match the implemented product.
- Build and smoke tests are run; deployment readiness is confirmed from Vercel rather than inferred from a Git commit.
