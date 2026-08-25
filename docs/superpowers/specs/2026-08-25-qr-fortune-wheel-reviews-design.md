# QR Fortune Wheel + Reviews — Design Spec

**Date:** 2026-08-25
**Client (Phase 1):** BON TACOS (single restaurant)
**Long-term:** Reusable multi-restaurant product

---

## 1. Concept & Compliance

Customers scan a QR code in the restaurant, play a fortune-wheel game, win a prize,
and are then invited (not required) to leave a review.

**Compliance is the foundation of the design:**
- Google and TripAdvisor prohibit incentivizing reviews (review-gating / paid reviews).
- Therefore: **everyone who plays wins something regardless of whether they review.**
- The prize is the reward for *engagement*, never for the review itself.
- After the game, we ask for feedback. Happy customers (👍) are guided to Google;
  unhappy customers (👎) go to a private feedback form — and **both buttons are always
  shown** (showing only the happy path is what platforms penalize).

This model is compliant *and* more effective: it protects the public rating, catches
complaints privately, and builds an owned marketing list.

---

## 2. Scope

**Phase 1 (build now):** Single restaurant. Everything runs on the customer's own phone
via a URL — no app install. Anti-cheat via a daily staff-unlock code.

**Phase 2 (later):** Shared in-restaurant screen (tablet/mini-PC) running the same page
in kiosk mode, triggered by a physical arcade button instead of the unlock code.

**Future:** Multi-restaurant SaaS product with per-restaurant branding, admin, and billing.
The data model is designed so this is an extension, not a rewrite.

**Decisions locked in:**
- Redemption: **show-the-staff first** (unique code + live countdown). Unique-code redeem
  marking and email/SMS coupons are secondary/later.
- Anti-cheat: **daily rotating unlock code** the server tells to the customer (easy version).
- Review platform: **Google only** for now (TripAdvisor later).
- Review flow: **happy/unhappy split** (👍 → Google, 👎 → private form).
- Odds: **weighted and configurable** (cheap prizes common, big prizes rare), with optional
  per-prize daily caps. Real prize list finalized by client later.

---

## 3. Architecture

Four parts, one shared codebase:

1. **QR code** — printed on tables/receipts/table-tents. Points to a single URL
   (e.g. `bontacos.link/play`). No app, no login.

2. **Player page** — a single mobile web page that runs the whole experience
   (unlock → spin → prize → review ask). The *same* page runs full-screen on the
   Phase 2 tablet via a `?mode=kiosk` switch.

3. **Backend (source of truth)** — a small server that:
   - holds and rotates today's unlock code,
   - selects the prize using weighted odds **server-side** (never on the phone),
   - logs every play and win,
   - enforces "already played" and per-prize daily caps,
   - later: sends coupon emails/SMS.

4. **Admin page** — password-protected page for the owner/you: edit prizes & odds,
   see today's unlock code, view stats, read feedback.

**Key design principle:** the phone is "dumb"; the backend is the brain. The phone never
decides the prize and never relies on its own storage for anti-cheat. This makes it hard
to game and easy to extend to many restaurants later.

**Data flow:** phone opens Player page → sends unlock code → backend verifies + picks
prize + logs → phone animates wheel to that prize → shows review ask.

---

## 4. Customer Journey (Player page)

1. **Welcome** — logo, "Spin to win! 🌮", **Start** button.
2. **Unlock** — "Ask your server for today's code." Customer enters the short daily code.
   Wrong code → gentle retry. *(Phase 2: physical button replaces this step.)*
3. **Wheel** — big fortune wheel, **SPIN** button, sound + animation, lands on the
   backend-chosen prize (looks random; odds secretly weighted).
4. **Prize reveal** — "🎉 You won [prize]!" + **live countdown** ("Show your server in
   the next 5:00") + unique win code. This is show-the-staff redemption.
5. **Review ask** (only after the prize) — "How was it?" 👍 / 👎.
   - 👍 → Google review page.
   - 👎 → private feedback form (what went wrong; name optional) → comes to owner.
   - Skippable; prize is already theirs. (Compliance.)
6. **(Optional) Save my coupon** — email/SMS field → builds marketing list. Skippable.

**Guardrails:**
- Unlock required before the wheel (only real diners who talked to a server can play).
- Once a phone has played on a given code/day → "You already played today 🌮".

---

## 5. Data Model

1. **Restaurant config** (one record in Phase 1) — name, logo, Google review URL,
   today's unlock code + its date, prize list.
2. **Prizes** (editable list) — label, emoji/color, **weight** (odds), optional **daily cap**.
3. **Plays** (one row per spin) — timestamp, prize won, unique win code, unlock-code/day,
   device fingerprint (for "already played"), redeemed flag (for later).
4. **Feedback / leads** (only when given) — 👎 feedback text, or opt-in email/phone.

**Notes:**
- No customer accounts or passwords; nothing sensitive stored. Email/phone opt-in only
  (keeps privacy simple).
- "Restaurant" is its own record, so multi-restaurant later = more rows, not a rebuild.

---

## 6. Admin Page (Phase 1)

Password-protected, deliberately minimal:

1. **Today's unlock code** — shown large for staff; auto-rotates daily; **"new code now"**
   button if it leaks.
2. **Prizes editor** — add/rename slices, set weight + optional daily cap, pick color/emoji,
   live wheel preview.
3. **Stats** — today + last 30 days: plays, wins by prize, 👍 count, 👎 count, coupons saved.
4. **Feedback inbox** — 👎 comments + saved emails/phones, exportable as CSV.

No staff logins, roles, or billing in Phase 1.

---

## 7. Phase 2 — Screen + Physical Button (later)

Mostly a *display mode*, not new software:
- Tablet/mini-PC by the counter runs the same Player page full-screen in kiosk mode
  (`?mode=kiosk`).
- A physical arcade button (USB/Bluetooth arcade button or Raspberry Pi) sends a "spin"
  signal, **replacing the unlock-code step**. Press → spin → prize on the big screen.
- In-person redemption; optionally show a QR to save the coupon to phone.
- **Build note:** Phase 1 Player page is built to already support `?mode=kiosk` and a
  button-triggered spin input, so Phase 2 is mostly hardware + config. Exact button
  hardware to be specced when Phase 2 starts.

---

## 8. Edge Cases

- **No internet** → wheel spins with a cached prize set; wins sync when back online
  (Phase 2 tablet especially).
- **Page closed mid-spin** → prize already logged server-side; reopening shows existing
  prize + countdown, not a new spin.
- **Prize cap hit** → slice quietly skipped in the odds; no "sold out" shown.
- **Unlock code leaks** → daily rotation + "new code now" button limit damage.

---

## 9. Testing

Before any real customer:
- Odds match configured weights over many spins.
- "Already played" block works.
- Daily caps actually stop awarding capped prizes.
- 👍/👎 split routes to Google vs private form correctly.
- Wrong/expired unlock code is rejected.
