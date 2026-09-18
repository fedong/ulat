# Payments & Entitlement — Implementation Spec

**Date:** 2026-09-17 · **Companion to:** `pricing-and-referral.md` · **Stack:** NestJS + Prisma + Postgres 16 + Redis/BullMQ, Expo client

---

## 0. The one constraint that shapes everything

**PayMongo Subscriptions supports automated recurring billing on cards and Maya only. GCash is not supported for auto-charge.**

GCash is the dominant wallet for Philippine instructors, so a meaningful share of your subscribers cannot be auto-renewed. They must be re-billed manually via a payment link each period.

Two consequences, both of which should be treated as product decisions, not workarounds:

1. **GCash is annual-only.** Twelve manual GCash renewals a year is a churn machine — one a year is fine. Monthly is offered on card and Maya only.
2. **The renewal reminder pipeline is not optional.** For GCash subscribers it *is* the billing system.

| Method | Monthly | Annual | Renewal |
|---|---|---|---|
| Card | ✓ | ✓ | Automatic (PayMongo retries on failure) |
| Maya | ✓ | ✓ | Automatic |
| GCash | — | ✓ | Manual — reminder + payment link at T−14, T−7, T−1, T+0 |

---

## 1. Entitlement model

One server-side resolver is the sole authority. **The client never computes entitlement**; it reads what `/v1/auth/me` returns.

### States

| State | Meaning | Access |
|---|---|---|
| `TRIALING` | Within the 5-month trial | Pro |
| `ACTIVE` | Paid, current period not expired | Pro |
| `PAST_DUE` | Auto-charge failed, PayMongo retrying | Pro (access preserved during retry) |
| `GRACE` | Trial or subscription ended, within grace window | Pro |
| `FREE` | No entitlement | Free limits |

### Resolution order

```ts
// packages/shared/src/entitlement.ts — pure, no I/O, heavily unit-tested
export function resolveEntitlement(input: EntitlementInput, now: Date): Entitlement {
  const { subscription, trial, grace } = input;

  if (subscription?.status === 'ACTIVE'   && subscription.currentPeriodEnd > now)
    return { tier: 'PRO', state: 'ACTIVE',   until: subscription.currentPeriodEnd };

  if (subscription?.status === 'PAST_DUE'  && subscription.retryUntil > now)
    return { tier: 'PRO', state: 'PAST_DUE', until: subscription.retryUntil };

  if (trial && trial.endsAt > now)
    return { tier: 'PRO', state: 'TRIALING', until: trial.endsAt };

  if (grace && grace.endsAt > now)
    return { tier: 'PRO', state: 'GRACE',    until: grace.endsAt };

  return { tier: 'FREE', state: 'FREE', until: null };
}
```

Pure function, no database access, no clock access — `now` is injected. Property-test it: for any combination of inputs, exactly one state is returned, and `tier === 'PRO'` implies `until > now`.

### Caching

Denormalize into an `entitlements` row updated by a job on every state change (payment, trial start, grace start, expiry). Never read entitlement by recomputing across three tables on a hot path. A repeatable BullMQ job sweeps hourly for expiries.

---

## 2. Prisma schema

```prisma
enum Plan          { MONTHLY ANNUAL }
enum PayMethod     { CARD MAYA GCASH }
enum SubStatus     { INCOMPLETE ACTIVE PAST_DUE CANCELED EXPIRED }
enum EntTier       { FREE PRO }
enum EntState      { FREE TRIALING ACTIVE PAST_DUE GRACE }
enum ReferralState { PENDING QUALIFIED AWARDED VOID }
enum CreditSource  { REFERRAL GOODWILL REFUND }

model Subscription {
  id                 String     @id @default(cuid())
  userId             String
  user               User       @relation(fields: [userId], references: [id])
  plan               Plan
  method             PayMethod
  status             SubStatus  @default(INCOMPLETE)
  autoRenew          Boolean    // false for GCASH
  paymongoCustomerId String?
  paymongoSubId      String?    // null for GCASH (link-based)
  currentPeriodStart DateTime
  currentPeriodEnd   DateTime
  retryUntil         DateTime?
  cancelAtPeriodEnd  Boolean    @default(false)
  canceledAt         DateTime?
  createdAt          DateTime   @default(now())
  updatedAt          DateTime   @updatedAt

  @@index([userId, status])
  @@index([currentPeriodEnd])
}

model Trial {
  id        String   @id @default(cuid())
  userId    String   @unique          // one trial per user, ever
  startedAt DateTime                  // set on FIRST class creation, not signup
  endsAt    DateTime                  // startedAt + 150 days
  createdAt DateTime @default(now())
}

model GraceWindow {
  id        String   @id @default(cuid())
  userId    String
  reason    String                    // 'TRIAL_ENDED' | 'SUBSCRIPTION_LAPSED'
  startedAt DateTime
  endsAt    DateTime
  @@index([userId, endsAt])
}

model Entitlement {
  userId     String   @id
  tier       EntTier
  state      EntState
  until      DateTime?
  computedAt DateTime @updatedAt
  @@index([until])
}

model PaymentEvent {
  id              String   @id @default(cuid())
  providerEventId String   @unique     // idempotency key from PayMongo
  type            String
  payload         Json
  receivedAt      DateTime @default(now())
  processedAt     DateTime?
  error           String?
}

model Invoice {
  id                    String   @id @default(cuid())
  userId                String
  subscriptionId        String?
  plan                  Plan
  grossCentavos         Int                 // what the customer paid
  creditAppliedCentavos Int      @default(0)
  netChargedCentavos    Int
  // --- VAT: populated now with zeros, live if you ever cross ₱3M ---
  vatRateApplied        Decimal  @default(0)  // 0.00 while non-VAT, 0.12 after
  vatCentavos           Int      @default(0)
  netOfVatCentavos      Int
  vatRegistered         Boolean  @default(false) // status AT TIME OF SALE
  // ----------------------------------------------------------------
  status                String              // 'PENDING' | 'PAID' | 'FAILED' | 'PAID_BY_CREDIT'
  paymongoPaymentId     String?  @unique
  paidAt                DateTime?
  invoiceNumber         String?  @unique    // BIR-registered sequence
  createdAt             DateTime @default(now())
  @@index([userId, createdAt])
}

model Referral {
  id          String        @id @default(cuid())
  referrerId  String
  referredId  String        @unique        // one award per referred person, ever
  code        String
  state       ReferralState @default(PENDING)
  qualifiedAt DateTime?
  awardedAt   DateTime?
  voidReason  String?
  @@index([referrerId, state])
}

model AccountCredit {
  id              String       @id @default(cuid())
  userId          String
  amountCentavos  Int
  source          CreditSource
  referralId      String?
  availableAt     DateTime                 // qualifiedAt + 14 days
  appliedAt       DateTime?
  appliedInvoice  String?
  createdAt       DateTime     @default(now())
  @@index([userId, appliedAt, availableAt])
}
```

Add to `User`: `referralCode String @unique` (short, shareable — 6–8 chars, no ambiguous glyphs).

**All money in centavos as `Int`.** Never float, never decimal-as-string.

**Record the VAT rate on each invoice, never derive it from current status.** Otherwise every historical invoice silently rewrites itself the day you register for VAT, and your books stop reconciling.

---

## 3. The trial clock

**Trigger:** first successful `courseClass` creation by an instructor — not account signup. Someone who registers in March to look around and starts teaching in June should not have burned half their trial browsing.

```ts
// In ClassService.create(), inside the same transaction
const existing = await tx.trial.findUnique({ where: { userId } });
if (!existing) {
  const startedAt = new Date();
  await tx.trial.create({
    data: { userId, startedAt, endsAt: addDays(startedAt, 150) },
  });
  await queue.add('entitlement.recompute', { userId });
}
```

- **150 days**, fixed, identical for everyone. **Never derive trial length from the instructor's declared term dates** — that hands the customer control of the billing period, and someone will declare an 11-month term.
- One trial per user for life. Key on verified email; also block if the payment method later used matches one already attached to a consumed trial.
- Unsynced school calendars are a non-issue: the clock is per-instructor from their own first class, not anchored to any shared date.

---

## 4. Grace windows

Created when a trial ends or a subscription lapses **while the instructor has an unfinished term**.

```ts
const termEnd = await getCurrentTermEnd(userId);   // may be null
const endsAt  = clamp(
  termEnd ?? addDays(now, 60),
  addDays(now, 14),    // floor — never cut someone off abruptly
  addDays(now, 60),    // ceiling — stops the "one five-year term" exploit
);
```

**Never downgrade mid-term.** The reason is not generosity toward the instructor: a mid-term cutoff stops guardian digests and student standing for families who made no purchase decision. Breaking that promise to collect ₱199 is a bad trade, and it is the fastest way to lose the word-of-mouth the whole business depends on.

---

## 5. Enforcement

### At creation, never by revocation

```ts
// ClassService.create() guard
if (entitlement.tier === 'FREE') {
  const active = await countActiveClassesInCurrentTerm(userId);
  if (active >= 2) throw new UpgradeRequiredException('FREE_CLASS_LIMIT');
}
```

A limit that stops you creating class three reads as fair. A limit that reaches into finished work and switches it off reads as confiscation — identical economics, completely different trust outcome.

### When grace expires with more than 2 active classes

1. Set `user.pendingClassSelection = true`.
2. Pre-select the **2 most recently graded** classes (by latest `scores.gradedAt`) — not the first two created; creation order tells you nothing about what they care about.
3. Until the instructor chooses, the pre-selected two stay editable and the rest are read-only. There is always a defined state; nothing waits on a user action.
4. Show a selection modal on next web login. Let them change the choice at any time.

### What read-only means

| | Read-only class |
|---|---|
| View gradebook, attendance, students | ✓ |
| Export (CSV + PDF with Ulat footer) | ✓ |
| Student sees their standing | ✓ |
| Guardian digests continue | ✓ |
| Co-instructor view access | ✓ |
| New grades, assessments, attendance sessions | ✗ |

**Nothing is ever deleted.** A gradebook that destroys records when you stop paying is one nobody recommends to a colleague.

---

## 6. PayMongo integration

### 6.1 Card / Maya — automated subscription

1. `POST /customers` → store `paymongoCustomerId`.
2. Create Plans once at deploy time (idempotent, seeded): `ulat_monthly` = 19900 centavos / 1 month; `ulat_annual` = 119900 centavos / 1 year.
3. `POST /subscriptions` with customer + plan → returns an authorization URL.
4. Redirect the instructor to authorize the recurring mandate (full browser, not a webview).
5. Activate on the `subscription.active` / first `payment.paid` webhook — **never on the redirect return**, which is spoofable and unreliable.

### 6.2 GCash — manual annual renewal

1. Create a Checkout Session or Payment Link for ₱1,199 (less any credit — see §7).
2. On `payment.paid`: set `currentPeriodEnd = max(now, currentPeriodEnd) + 1 year`, `autoRenew = false`.
3. Enqueue delayed reminder jobs at **T−14, T−7, T−1, T+0** relative to `currentPeriodEnd`, each carrying a fresh payment link.
4. On expiry with no payment → grace window (§4), then Free.

Be explicit in the UI: *"GCash can't renew automatically. We'll remind you before your plan ends."* Do not let someone believe they are auto-renewing when they aren't.

### 6.3 Webhooks — the only source of truth

`POST /v1/webhooks/paymongo`

```ts
@Post()
async handle(@Req() req, @Headers('paymongo-signature') sig: string) {
  verifySignature(req.rawBody, sig);              // reject if invalid, before parsing

  const event = JSON.parse(req.rawBody);
  try {
    await this.prisma.paymentEvent.create({
      data: { providerEventId: event.data.id, type: event.data.attributes.type, payload: event },
    });
  } catch (e) {
    if (isUniqueViolation(e)) return { ok: true };  // duplicate delivery — already queued
    throw e;
  }

  await this.queue.add('paymongo.process', { eventId: event.data.id });
  return { ok: true };                              // return fast; never do business logic here
}
```

Rules:
- **Raw body required** for signature verification — disable the JSON body parser on this route.
- The unique constraint on `providerEventId` *is* the idempotency mechanism. PayMongo will redeliver.
- All business logic runs in the BullMQ worker, which must itself be idempotent (re-running a processed event changes nothing).
- Events to handle: `payment.paid`, `payment.failed`, `subscription.active`, `subscription.cancelled`, `subscription.unpaid`.

### 6.4 Dunning

PayMongo retries failed card charges automatically. On the first failure → `PAST_DUE`, `retryUntil = now + 14 days`, email the instructor. On final failure → `EXPIRED` → grace window. Access is preserved throughout; the instructor loses nothing while a card problem is being sorted out.

---

## 7. Credits and referrals

### Qualification

On `payment.paid` where the invoice plan is `ANNUAL` and it is the referred user's first payment:

```
Referral.state = QUALIFIED, qualifiedAt = now
→ enqueue 'referral.award' delayed 14 days
```

### Award (14 days later)

Verify no refund and no chargeback on the qualifying payment, then:

```
AccountCredit { userId: referrerId, amountCentavos: 19900,
                source: REFERRAL, availableAt: now }
Referral.state = AWARDED
```

The 14-day hold is what makes chargeback fraud unprofitable.

### Applying credit at invoice time

```ts
const credits = await tx.accountCredit.findMany({
  where: { userId, appliedAt: null, availableAt: { lte: now } },
  orderBy: { createdAt: 'asc' },        // FIFO
});

let applied = 0;
for (const c of credits) {
  if (applied >= gross) break;
  const use = Math.min(c.amountCentavos, gross - applied);
  applied += use;
  // partial consumption: split the credit row rather than mutating the amount
}

const net = gross - applied;
```

**Edge case you must handle explicitly: `net === 0`.** PayMongo cannot charge ₱0. Skip the gateway call entirely, write the invoice as `PAID_BY_CREDIT`, and extend the period. A naive implementation throws a gateway error here and silently fails to renew someone who is fully paid up in credit.

### Guardrails

- One award per referred **person**, for life — enforced by `@unique` on `referredId`.
- Distinct verified email **and** distinct payment instrument.
- Credit applies to future billing only. Never cashed out. Never expires.
- Self-referral blocked on matching payment fingerprint.
- No cap on referral count — at a 77% margin the trade never stops being good.

---

## 8. App store strategy

The US anti-steering rulings that permit external purchase links do **not** cover the Philippines. Default App Store rules apply, so the conservative path is:

**Phase 1 — web-only checkout.**
- All purchasing happens in the web app, which is already your primary instructor surface for grade encoding.
- The **iOS app contains no purchase UI at all**: no prices, no upgrade button, no link to the pricing page. It displays plan status and, at the limit, a neutral message: *"You've reached 2 classes on the Free plan."* — with no call to action and no link.
- Entitlement is read from your API.

**If Apple pushes back**, add StoreKit IAP at a higher price (₱1,499/year in-app vs ₱1,199 on the web) to absorb the 15% small-business commission. Do not ship IAP before you have to — it is real work and 15% of every sale.

Android is more permissive, but keep both clients identical for now; divergence costs more than it saves at your scale.

---

## 9. Tax and compliance

**None of this is tax advice — confirm every point with a CPA before you register.**

### Structure

Sole proprietorship, **8% income tax option, non-VAT**. Elect the 8% at registration or in your first quarterly return; miss the election and graduated rates plus 3% percentage tax apply automatically.

Register **before your first payment**, not before your first line of code. Running a free pilot does not require a registered business; accepting money does.

### VAT

- Threshold is **₱3,000,000 gross annual sales** — about 2,500 annual subscribers. Cross it and you must register within 30 days.
- **You cannot charge VAT while non-VAT-registered.** Collecting 12% and labelling it VAT without registration is a violation, and the amounts are still assessable with penalties. Invoices while non-VAT must be marked *"Non-VAT registered."*
- **Do not register voluntarily.** It forfeits the 8% option, and your cost base is almost entirely foreign (Hetzner, Anthropic, Cloudflare) so there is very little input VAT to reclaim against it.
- Build the invoice VAT-aware now with the rate at zero (see §2). Flipping to VAT then becomes a config change, not a migration under deadline.
- Plan your margins on ₱1,199 eventually netting **₱1,070** after VAT, so crossing the threshold never forces a price rise.

### Invoicing

Every sale needs a BIR-registered invoice. Automated numbering usually means registering a Computerized Accounting System with the BIR — worth paying an accountant to set up once rather than discovering it after your hundredth sale.

### Also ask your accountant about

Payments to foreign service providers can carry **withholding VAT obligations on you as the resident payor**, independent of your own VAT status. Hetzner and Anthropic invoices would both be in scope. This one routinely catches solo founders.

### Refunds

Publish a policy. Suggested: 14 days, no questions asked, on the first annual payment only. Cheap, and it removes the main objection to paying a year upfront.

### Audit

Every entitlement change writes to `audit_logs`, matching the blueprint's append-only posture.

---

## 10. Test bar

Non-negotiable, given no human reviews the diff:

| Area | Required tests |
|---|---|
| `resolveEntitlement` | Unit + property-based. Exactly one state for any input; `PRO` implies `until > now`; no state gap across boundaries. |
| Webhook idempotency | e2e — deliver the same event 3× → one state change. |
| Credit application | Unit — partial consumption, FIFO order, and the `net === 0` path. |
| Referral | e2e — award fires at 14 days; voided by refund inside the window; self-referral blocked. |
| Class limit | e2e — creation blocked at 2 on Free; never blocked while `TRIALING`/`GRACE`. |
| Grace | Unit — clamped to [14, 60] days; null term end handled. |
| Downgrade | e2e — read-only classes still export, and guardians still receive digests. |
| Invoice VAT | Unit — historical invoices keep their stored rate when VAT status changes. |

Use PayMongo test keys and its test card numbers in CI. Never call the live API from a test.

---

## 11. Build order

1. `resolveEntitlement` + schema + `/auth/me` returning entitlement (no payments yet)
2. Trial start on first class creation
3. Class-limit guard + read-only mode
4. PayMongo card/Maya subscription + webhook pipeline
5. GCash annual link + reminder jobs
6. Grace windows + expiry sweep + class selection modal
7. Credits ledger
8. Referral qualification and award

**Steps 1–3 are shippable on their own and let you run the whole pilot on trials before a single peso moves — and before the business is registered.**

---

## 12. In-app pricing table

Shown on web only (see §8). Annual is the default selection.

### Plan cards

**Free — ₱0**
*For instructors trying Ulat, or teaching a light load.*

- 2 active classes per term
- Unlimited students per class
- Full gradebook — components, weights, transmutation, locked Finals
- Attendance with Lecture/Lab sync
- Guardian links, weekly digest, student app
- Roster import (CSV, XLSX, TXT, PDF)
- PDF grade report *(with Ulat footer)*
- Basic XLSX export
- Unlimited archived terms

**Pro — ₱1,199/year** · Best value · *₱100/month, billed yearly*
*For instructors carrying a full teaching load.*

- **Everything in Free, plus:**
- **Unlimited active classes**
- **Registrar-format XLSX export** with scope selection
- **PDF grade report with your institution's letterhead and signature block** — no Ulat mark
- **Co-instructors**
- **Full term history**
- Priority support

Secondary line under the Pro card: *Prefer monthly? ₱199/month — card or Maya.*

### Copy rules

- Never show a struck-through monthly total next to annual. State the effective rate (₱100/month) and let the reader do the comparison.
- Payment method note under the buttons: *Card · Maya · GCash. GCash is available on the yearly plan.*
- Trial banner, site-wide while `TRIALING`: **"You're on Pro — free until 14 February. 43 days left."** Show the date, not just the countdown.
- Grace banner: **"Your Pro trial has ended. You'll keep full access until your term finishes on 30 May."**
- At the free limit, on web: *"You've reached 2 classes on the Free plan. Pro gives you unlimited classes and the registrar-format export."* On mobile: the first sentence only, no link.

### Filipino strings

Have a native speaker check the register before shipping — these are a starting point, not final copy.

| Key | English | Filipino |
|---|---|---|
| `plan.free` | Free | Libre |
| `plan.pro` | Pro | Pro |
| `plan.best_value` | Best value | Pinakasulit |
| `plan.per_year` | per year | kada taon |
| `plan.per_month_billed_yearly` | ₱100/month, billed yearly | ₱100 kada buwan, bayad taunan |
| `plan.unlimited_classes` | Unlimited active classes | Walang limitasyong klase |
| `plan.everything_in_free` | Everything in Free, plus: | Lahat ng nasa Libre, kasama ang: |
| `trial.banner` | You're on Pro — free until {date}. | Nasa Pro ka — libre hanggang {date}. |
| `limit.reached` | You've reached 2 classes on the Free plan. | Umabot ka na sa 2 klase sa Libreng plano. |

---

## 13. Open decisions

1. Refund policy wording and window.
2. Whether founding-user pricing (first 100 instructors, locked for life) is a separate Plan in PayMongo or a permanent credit. **Recommend a separate Plan** — permanent credits make the ledger hard to reason about.
3. BIR-registered invoice numbering mechanism (CAS registration vs manual sequence).
4. Whether to launch at ₱1,199 or ₱1,349 — the latter survives VAT registration without a price rise, the former is the easier number to launch with.
