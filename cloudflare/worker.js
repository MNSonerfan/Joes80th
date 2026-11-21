const ALLOWED_ORIGIN = "https://mnsonerfan.github.io";
const encoder = new TextEncoder();

function corsHeaders(origin) {
  const headers = new Headers();
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  if (origin === ALLOWED_ORIGIN) {
    headers.set("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  }
  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type");
  return headers;
}

function json(payload, status = 200, origin = "") {
  return new Response(JSON.stringify(payload), {
    status,
    headers: corsHeaders(origin),
  });
}

function randomId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function cleanText(value, maxLength) {
  return String(value || "").replace(/\u0000/g, "").trim().slice(0, maxLength);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (url.pathname === "/api/rsvps" && request.method === "GET") {
      const rows = await env.DB.prepare(
        "SELECT id, name, attending, comment, updated_at FROM rsvps ORDER BY name COLLATE NOCASE"
      ).all();
      return json({ rsvps: rows.results || [] }, 200, origin);
    }

    if (url.pathname === "/api/rsvps" && request.method === "POST") {
      if (origin !== ALLOWED_ORIGIN && origin !== "") {
        return json({ error: "Request origin was rejected." }, 403, origin);
      }

      let payload;
      try {
        payload = await request.json();
      } catch {
        return json({ error: "Please send a valid RSVP." }, 400, origin);
      }

      if (payload.website) {
        return json({ ok: true }, 200, origin);
      }

      const name = cleanText(payload.name, 80);
      const comment = cleanText(payload.comment, 500);
      const attending = payload.attending === true || payload.attending === "yes";

      if (name.length < 2) {
        return json({ error: "Please enter your name." }, 400, origin);
      }

      const nameKey = name.normalize("NFKC").toLowerCase()
        .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      if (!nameKey) {
        return json({ error: "Please enter a valid name." }, 400, origin);
      }

      const now = Math.floor(Date.now() / 1000);
      await env.DB.prepare(
        `INSERT INTO rsvps (id, name, name_key, attending, comment, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(name_key) DO UPDATE SET
           name = excluded.name,
           attending = excluded.attending,
           comment = excluded.comment,
           updated_at = excluded.updated_at`
      ).bind(randomId(), name, nameKey, attending ? 1 : 0, comment, now, now).run();

      const rows = await env.DB.prepare(
        "SELECT id, name, attending, comment, updated_at FROM rsvps ORDER BY name COLLATE NOCASE"
      ).all();
      return json({ ok: true, rsvps: rows.results || [] }, 200, origin);
    }

    return json({ error: "Not found." }, 404, origin);
  },
};
