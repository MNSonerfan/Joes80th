# Joe's 80th Birthday

A mobile-friendly invitation and RSVP site. The static page is hosted on GitHub
Pages; RSVP records are stored separately in a Cloudflare D1 database.

## Customize

Edit `config.js` to change the displayed event date, time, and contact details.
The full street address should not be placed on this public page.

## RSVP backups

The RSVP database is separate from GitHub Pages, so losing the site files or
repository does not by itself delete the responses. Use the host-only download
to keep an additional, restorable copy:

1. Configure a backup key as a Cloudflare Worker secret:
   `npx wrangler secret put RSVP_BACKUP_TOKEN --config cloudflare/wrangler.jsonc`
2. When prompted, enter a random key of at least 32 characters and keep it in
   a password manager. Do not add it to this repository or share it in chat.
3. Open the live site with `#host` appended to its URL, for example
   `https://mnsonerfan.github.io/Joes80th/#host`.
4. Choose **Download RSVP backup**, enter the backup key, and save the `.sql`
   file in a private location such as a private OneDrive folder.

The downloaded SQL file contains all RSVP fields, including comments. Treat it
as private. It starts by deleting existing RSVP rows, so restoring it replaces
the current list. To restore after applying the database migrations, run:

```powershell
npx wrangler d1 execute joes80th-rsvp --remote --file="C:\path\to\joes80th-rsvp-backup.sql" --config cloudflare/wrangler.jsonc
```

Keep more than one dated backup if possible. The download is manual; remember
to save a fresh copy periodically as RSVPs change.

## Publish with GitHub Pages

The site is published from the `main` branch at `/ (root)`. Worker and D1
configuration lives in `cloudflare/`.
