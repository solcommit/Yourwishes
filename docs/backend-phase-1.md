# Backend Phase 1 setup

This describes the Phase 1 baseline. After completing it, follow
[Phase 2](backend-phase-2.md) before using the current wishlist UI. Use Phase 2's
integration tests instead of the Phase 1-only RLS script once the required-image
constraints are installed.

Phase 1 adds authentication and database authorization only. Wishes still use the
existing mock data; nickname/settings/avatar editing still uses browser storage.
There are no database wishlist calls, Storage buckets, uploads, invitations,
sign-up UI, or password-reset UI. Sign Out is in the existing profile menu and
signs out the current device session. Other devices remain signed in.

## 1. Restrict Supabase Auth before deploying

In Supabase Dashboard → Authentication → Sign In / Providers:

1. Turn **Allow new users to sign up** OFF and save. This blocks public Auth
   signup API calls too; removing a frontend link would not do that.
2. Turn anonymous sign-ins OFF. Keep Email enabled and disable other providers.
3. Use email/password accounts only. The app calls only `signInWithPassword`;
   it does not expose OTP/magic-link or recovery flows. Supabase's Email provider
   also supports email-based flows: this UI restriction does not remove Auth
   endpoints supplied by Supabase itself.
4. In Authentication → URL Configuration set Site URL to your deployed HTTPS
   origin. Add localhost only to your development project's allowed URLs.
5. Set reasonable Auth rate limits. Never enable public signup for provisioning.

Official references:
[Auth configuration](https://supabase.com/docs/guides/auth/general-configuration),
[SSR clients](https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs).

## 2. Create the two accounts manually

Dashboard → Authentication → Users → Add user → Create new user (not invitation).
Create Account A and Account B using their actual email addresses and unique,
strong passwords. Mark/auto-confirm their emails using the administrator option.
Copy each user's UUID from the Users table. Never store passwords in SQL, source,
the browser test report, or `NEXT_PUBLIC_*` variables. Do not create any other
accounts in the production project. Even an accidentally created third account
will not have application access without membership.

## 3. Apply both versioned migrations

Using Dashboard SQL Editor as the project administrator, execute the entire files
in this order, once each:

1. `supabase/migrations/202610220001_phase1_schema.sql`
2. `supabase/migrations/202610220002_phase1_policies.sql`

Each file is transactional. They are not intended to be re-run. Keep the app
undeployed until both finish. If you already manage this project with Supabase
CLI migration history, apply these files with `supabase db push` instead; do not
apply through both methods without reconciling migration history.

## 4. Assign slots permanently

Open `supabase/provision-members.sql.example`, replace the two UUID placeholders
with Account A/B UUIDs, and run the whole transaction in Dashboard SQL Editor.
This inserts slots A and B plus both profiles. It intentionally fails on existing
membership instead of replacing users. Verify as administrator:

```sql
select slot, user_id from public.app_members order by slot;
select id, nickname from public.profiles;
select tablename, rowsecurity from pg_tables
where schemaname = 'public'
  and tablename in ('app_members', 'profiles', 'wishlist_items', 'wishlist_images');
```

Expect two distinct users, slots A/B, two profiles, and RLS true on all four
tables. Slots are globally unique and limited to A/B, so a third membership
cannot exist. Clients have SELECT only on their own membership; only an
administrator can provision/change it. Do not change/delete memberships after
provisioning. No self-service re-pairing exists. Foreign keys prevent wishes or
profiles belonging to nonmembers. No SECURITY DEFINER functions are used.

## 5. Configure the app

Copy `.env.example` to `.env.local` only if you do not already have `.env.local`.
Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from the
project Connect dialog. Preserve your existing values if already configured.
Next.js does **not** load a file named `env.local` without the leading dot.
Both local environment filenames are ignored. Set the same two variables in your
hosting provider and rebuild/restart the app. No service-role/secret key is needed.

All workspace routes require a verified Auth user and an A/B membership. Proxy
refreshes session cookies; the server layout repeats the authorization check
before rendering private UI. Auth requests use no-store caching. Future Phase 2
Server Actions/Route Handlers must also verify identity close to the data and
keep RLS enabled; a layout check alone is not sufficient authorization.

## 6. Verify honestly

Run `npm run lint`, `npx tsc --noEmit --incremental false`, `npm run build`, and
`npm run test:e2e`. Browser tests always check anonymous redirects, invalid
session handling, and sign-in layouts at all seven viewport sizes. Existing
workspace tests and session/sign-out tests run only when the Playwright process
has `E2E_MEMBER_A_EMAIL` and `E2E_MEMBER_A_PASSWORD`. Without those credentials,
they explicitly skip; this is not a successful authenticated security test.
Credentials must be supplied privately to the test process, not committed.
Do not enable Playwright traces with real credentials: they can contain form
values and session material. The configuration disables traces for Phase 1.

For database verification, use a **separate disposable Supabase test project**.
Apply the migrations, manually create A/B and a third nonmember account, provision
only A/B, then put these variables in an ignored `.env.rls-test` file:

```text
NEXT_PUBLIC_SUPABASE_URL=your_test_project_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_test_publishable_key
E2E_MEMBER_A_EMAIL=account_a_email
E2E_MEMBER_A_PASSWORD=account_a_password
E2E_MEMBER_B_EMAIL=account_b_email
E2E_MEMBER_B_PASSWORD=account_b_password
E2E_MEMBER_NONMEMBER_EMAIL=nonmember_email
E2E_MEMBER_NONMEMBER_PASSWORD=nonmember_password
```

Run `node --env-file=.env.rls-test scripts/verify-rls.mjs`. It uses ordinary Auth
sessions (no privileged key), checks ownership/partner reads, image metadata,
profiles, immutable membership, anonymous/nonmember denial, and cleans up its
temporary wishes. It performs same-value updates on the two test profiles, which
advance updated_at. Use only a test project. Do not create a third production
account just to run this script. Inspect the test database if cleanup fails.

The presence of a publishable key is not database administrator access. This
repository does not apply migrations, create users, change Auth settings, or
claim RLS passes until those operations/tests are actually performed.
