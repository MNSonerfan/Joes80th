import assert from "node:assert/strict";
import test from "node:test";
import worker, { buildRsvpBackupSql } from "./worker.js";

const origin = "https://mnsonerfan.github.io";
const backupToken = "test-backup-token-12345678901234567890";
const rows = [{
  id: "rsvp-1",
  name: "O'Brien",
  name_key: "o-brien",
  attending: 1,
  attendee_count: 2,
  comment: "Bring O'Brien's pie",
  created_at: 100,
  updated_at: 200,
}];

function env(token = backupToken) {
  return {
    RSVP_BACKUP_TOKEN: token,
    DB: {
      prepare() {
        return {
          async all() {
            return { results: rows };
          },
        };
      },
    },
  };
}

test("backup SQL safely escapes text and replaces the RSVP snapshot", () => {
  const sql = buildRsvpBackupSql(rows, new Date("2026-11-27T00:00:00.000Z"));

  assert.match(sql, /DELETE FROM rsvps;/);
  assert.match(sql, /'O''Brien'/);
  assert.match(sql, /'Bring O''Brien''s pie'/);
  assert.match(sql, /'rsvp-1', 'O''Brien', 'o-brien', 1, 2/);
});

test("RSVP backup requires the host backup key", async () => {
  const request = new Request("https://joes80th-rsvp.example.workers.dev/api/admin/rsvp-backup", {
    headers: { Origin: origin },
  });

  const response = await worker.fetch(request, env());

  assert.equal(response.status, 401);
});

test("authorized RSVP backup downloads restorable SQL with no-store headers", async () => {
  const request = new Request("https://joes80th-rsvp.example.workers.dev/api/admin/rsvp-backup", {
    headers: {
      Origin: origin,
      Authorization: `Bearer ${backupToken}`,
    },
  });

  const response = await worker.fetch(request, env());

  assert.equal(response.status, 200);
  assert.match(response.headers.get("Content-Type"), /application\/sql/);
  assert.match(response.headers.get("Content-Disposition"), /joes80th-rsvp-backup-/);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.match(await response.text(), /DELETE FROM rsvps;/);
});

test("RSVP backup reports an unconfigured secret", async () => {
  const request = new Request("https://joes80th-rsvp.example.workers.dev/api/admin/rsvp-backup", {
    headers: {
      Origin: origin,
      Authorization: `Bearer ${backupToken}`,
    },
  });

  const response = await worker.fetch(request, env("too-short"));

  assert.equal(response.status, 503);
});
