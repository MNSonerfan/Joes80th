# Joe's 80th Birthday

A mobile-friendly, static invitation and RSVP landing page for Joe's 80th
birthday.

## Customize

Edit `config.js`:

- `date`: The date shown on the page.
- `time`: The time shown on the page.
- `phoneDisplay`: The Google Voice number or label to display.
- `phoneLink`: Use `tel:+1...` for calling/texting.
- `rsvpUrl`: The private Google Form RSVP URL.

The full street address should not be placed on this public page.

## Track RSVPs with Google Forms

1. Create a Google Form with questions for name, attending yes/no, number of
   guests, dietary or accessibility notes, and optional follow-up contact.
2. Link the form responses to a Google Sheet.
3. Keep the form and sheet visible only to the host and co-hosts.
4. Paste the form URL into `rsvpUrl` in `config.js`.

## Publish with GitHub Pages

From the repository settings, open **Pages**, set the source to **Deploy from
a branch**, select `main`, and choose `/ (root)`.
