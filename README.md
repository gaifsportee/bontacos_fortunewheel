# BON TACOS — QR Fortune Wheel (Phase 1)

Local web app: scan a QR → enter the daily code → spin a weighted wheel → win a prize
→ optional Google review / private feedback. See the spec in
`docs/superpowers/specs/2026-08-25-qr-fortune-wheel-reviews-design.md`.

## Run locally

```bash
npm install
npm start
```

- Player page: http://localhost:3000/
- Admin page:  http://localhost:3000/admin.html  (default password `changeme` — set `ADMIN_PASSWORD` env var to change)

## Daily code

The unlock code rotates daily. Staff read today's code off the admin page.
Customers must enter it before they can spin.

## Prizes & odds

Edit prizes, weights (odds), and daily caps in the admin page. Weight is relative
(a weight-40 prize is awarded ~20× as often as a weight-2 prize). A daily cap stops
a prize once it's been awarded N times that day.

## Google review link

Set the Google review URL in the admin page under **Settings**. After a spin, a
customer who taps 👍 is sent there; 👎 opens a private feedback form instead. Both
buttons always show, and the prize never depends on the answer (keeps it compliant
with Google/TripAdvisor review-incentive rules).

## QR code

Point the QR at the player URL (locally `http://localhost:3000/`; in production the
public URL). Generate one at any QR site, or with:

```bash
npx qrcode "http://localhost:3000/" -o qr.png
```

## Tests

```bash
npm test
```

## Phase 2 (later)

The player page supports `?mode=kiosk` for a mounted tablet + physical button.
Button hardware is specced separately when Phase 2 begins.
