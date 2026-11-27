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
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
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

function matchesBackupToken(provided, expected) {
  const providedBytes = encoder.encode(provided);
  const expectedBytes = encoder.encode(expected);
  let mismatch = providedBytes.length ^ expectedBytes.length;
  const length = Math.max(providedBytes.length, expectedBytes.length);
  for (let index = 0; index < length; index += 1) {
    mismatch |= (providedBytes[index] || 0) ^ (expectedBytes[index] || 0);
  }
  return mismatch === 0;
}

function sqlString(value) {
  return `'${String(value ?? "").replaceAll("'", "''")}'`;
}

function sqlInteger(value) {
  const integer = Number(value);
  if (!Number.isSafeInteger(integer)) {
    throw new Error("The RSVP database contains an invalid integer value.");
  }
  return String(integer);
}

export function buildRsvpBackupSql(rows, exportedAt = new Date()) {
  const lines = [
    `-- Joe's 80th RSVP backup created ${exportedAt.toISOString()}`,
    "-- Restore only to the intended RSVP database; this script replaces all RSVP rows.",
    "DELETE FROM rsvps;",
  ];

  for (const row of rows) {
    const attending = Number(row.attending);
    if (attending !== 0 && attending !== 1) {
      throw new Error("The RSVP database contains an invalid attendance value.");
    }
    lines.push(
      "INSERT INTO rsvps (id, name, name_key, attending, attendee_count, comment, created_at, updated_at) VALUES ("
      + [
        sqlString(row.id),
        sqlString(row.name),
        sqlString(row.name_key),
        String(attending),
        sqlInteger(row.attendee_count),
        sqlString(row.comment),
        sqlInteger(row.created_at),
        sqlInteger(row.updated_at),
      ].join(", ")
      + ");",
    );
  }

  return `${lines.join("\n")}\n`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (url.pathname === "/api/admin/rsvp-backup" && request.method === "GET") {
      if (origin && origin !== ALLOWED_ORIGIN) {
        return json({ error: "Request origin was rejected." }, 403, origin);
      }

      const expectedToken = String(env.RSVP_BACKUP_TOKEN || "");
      if (expectedToken.length < 32) {
        return json({ error: "Host backup access is not configured." }, 503, origin);
      }

      const authorization = request.headers.get("Authorization") || "";
      const tokenMatch = authorization.match(/^Bearer\s+(.+)$/i);
      if (!tokenMatch || !matchesBackupToken(tokenMatch[1], expectedToken)) {
        return json({ error: "The host backup key was not accepted." }, 401, origin);
      }

      const result = await env.DB.prepare(
        "SELECT id, name, name_key, attending, attendee_count, comment, created_at, updated_at FROM rsvps ORDER BY name COLLATE NOCASE"
      ).all();
      const backup = buildRsvpBackupSql(result.results || []);
      const headers = corsHeaders(origin);
      headers.set("Content-Type", "application/sql; charset=utf-8");
      headers.set(
        "Content-Disposition",
        `attachment; filename="joes80th-rsvp-backup-${new Date().toISOString().slice(0, 10)}.sql"`,
      );
      return new Response(backup, { status: 200, headers });
    }

    if (url.pathname === "/api/rsvps" && request.method === "GET") {
      const rows = await env.DB.prepare(
        "SELECT id, name, attending, attendee_count, comment, updated_at FROM rsvps ORDER BY name COLLATE NOCASE"
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
      const attendeeCount = attending
        ? Math.min(20, Math.max(1, Number.parseInt(payload.attendeeCount, 10) || 1))
        : 0;

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
        `INSERT INTO rsvps (id, name, name_key, attending, attendee_count, comment, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(name_key) DO UPDATE SET
           name = excluded.name,
           attending = excluded.attending,
           attendee_count = excluded.attendee_count,
           comment = excluded.comment,
           updated_at = excluded.updated_at`
      ).bind(randomId(), name, nameKey, attending ? 1 : 0, attendeeCount, comment, now, now).run();

      const rows = await env.DB.prepare(
        "SELECT id, name, attending, attendee_count, comment, updated_at FROM rsvps ORDER BY name COLLATE NOCASE"
      ).all();
      return json({ ok: true, rsvps: rows.results || [] }, 200, origin);
    }

    return json({ error: "Not found." }, 404, origin);
  },
};
