/**
 * Corbitrage lead handler: Cloudflare Pages Function proxy for a Make.com webhook.
 * The Make.com URL is a secret (env.MAKE_WEBHOOK_URL) and never reaches the browser.
 *
 * Checks: POST only, origin allow-list, JSON body size cap, honeypot, validation,
 * explicit consent required (DPDP Act 2023). Only whitelisted fields are forwarded.
 */

const MAX_BODY = 5000;
const NAME_RE = /^[\p{L}\p{M}.' -]{2,80}$/u;
const PHONE_RE = /^(?:\+?91)?[6-9]\d{9}$/;
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;
const TOPICS = ["sip-planning", "mutual-funds", "other"];

function corsHeaders(origin, env, selfOrigin) {
  const allowed = (env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  // Same-origin calls (the website's own form) are always allowed; others need ALLOWED_ORIGINS.
  const ok = Boolean(origin) && (origin === selfOrigin || allowed.includes(origin));
  return {
    ok,
    headers: {
      "Access-Control-Allow-Origin": ok ? origin : "null",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
      Vary: "Origin",
    },
  };
}

function json(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers },
  });
}

export function validate(data) {
  const errors = {};
  const clean = {};
  const s = (v) => (typeof v === "string" ? v.trim() : "");

  clean.name = s(data.name);
  if (!NAME_RE.test(clean.name)) errors.name = "Please enter your name.";

  clean.phone = s(data.phone).replace(/[\s-]/g, "");
  if (!PHONE_RE.test(clean.phone)) errors.phone = "Please enter a valid 10-digit Indian mobile number.";

  clean.email = s(data.email);
  if (clean.email && !EMAIL_RE.test(clean.email)) errors.email = "Please enter a valid email or leave it blank.";

  clean.topic = s(data.topic);
  if (!TOPICS.includes(clean.topic)) errors.topic = "Please choose a topic.";

  clean.message = s(data.message).slice(0, 1000);

  clean.marketing_consent = data.marketing_consent === true;

  if (data.consent !== true) errors.consent = "Consent is required so we can contact you.";

  return { errors, clean, valid: Object.keys(errors).length === 0 };
}

export async function onRequest({ request, env }) {
    const origin = request.headers.get("Origin");
    const cors = corsHeaders(origin, env, new URL(request.url).origin);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: cors.ok ? 204 : 403, headers: cors.headers });
    }
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, cors.headers);
    if (!cors.ok) return json({ error: "Origin not allowed" }, 403, cors.headers);

    const text = await request.text();
    if (text.length > MAX_BODY) return json({ error: "Payload too large" }, 413, cors.headers);

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return json({ error: "Invalid JSON" }, 400, cors.headers);
    }
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return json({ error: "Invalid payload" }, 400, cors.headers);
    }

    // Honeypot: bots fill the hidden field. Pretend success, forward nothing.
    if (typeof data.website === "string" && data.website.trim() !== "") {
      return json({ ok: true }, 200, cors.headers);
    }

    const { errors, clean, valid } = validate(data);
    if (!valid) return json({ error: "Validation failed", fields: errors }, 422, cors.headers);

    const payload = {
      ...clean,
      consent: true,
      consent_text_version: "privacy-v2-2026-11-17",
      source: "corbitrage.com",
      submitted_at: new Date().toISOString(),
    };

    // Fail closed: staging validates the request without contacting Make unless explicitly enabled.
    if (env.LEAD_WEBHOOK_ENABLED !== "true") {
      return json({
        ok: true,
        success: true,
        dryRun: true,
        dispatched: false,
        message: "Lead validated; webhook dispatch disabled",
      }, 200, cors.headers);
    }

    // Require Make credentials only when outbound dispatch is explicitly enabled.
    if (!env.MAKE_WEBHOOK_URL || !env.MAKE_WEBHOOK_API_KEY) {
      return json({ error: "Service not configured" }, 500, cors.headers);
    }

    try {
      const res = await fetch(env.MAKE_WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-make-apikey": env.MAKE_WEBHOOK_API_KEY,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) return json({ error: "Could not deliver your request. Please use WhatsApp." }, 502, cors.headers);
    } catch {
      return json({ error: "Could not deliver your request. Please use WhatsApp." }, 502, cors.headers);
    }
    return json({ ok: true }, 200, cors.headers);
}
