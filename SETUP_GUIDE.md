# Tablespot for Tony's — Setup Guide (v2, real hosting)

This replaces the earlier Google Apps Script guide. No coding needed —
still copy, paste, click — but now everything lives on real, professional
infrastructure: a GitHub repo, a proper hosting service, and Supabase.
Budget about 45–60 minutes, in 5 parts, done in order.

Keep a scratch note open — you'll copy values between steps.

---

## Part 1 — Put the code on GitHub — ~10 minutes

GitHub is just where the code lives — think of it as Google Drive for
code. It doesn't cost anything and you won't touch a command line.

1. Go to **github.com** → sign up (free) if you don't have an account.
2. Click the **+** (top right) → **New repository**.
   - Name: `tablespot-tonys`
   - Visibility: **Private** (keeps the code non-public — recommended,
     though it doesn't contain any secrets itself)
   - Leave everything else default → **Create repository**.
3. On the empty repo page, click **uploading an existing file**.
4. Drag in **everything** I gave you, keeping the folder structure intact:
   `server.js`, `package.json`, `.gitignore`, `.env.example`, `README.md`,
   `supabase_schema.sql`, the whole `src` folder (this is the backend —
   config, services, routes, all organized into subfolders), and the
   whole `public` folder (the frontend — `index.html`, `css/`, `js/`).
   GitHub's uploader accepts folders dragged in directly and keeps their
   structure — you don't need to recreate the folders by hand.
5. Scroll down, click **Commit changes**.

That's your code safely stored and version-controlled — exactly the
"real GitHub" setup you were picturing.

---

## Part 2 — The database (Supabase) — ~10 minutes

Same as before if you already did this part — skip to Part 3 if so.

1. Go to **supabase.com** → **Start your project** → sign up (free).
2. **New project** → name `tablespot-tonys` → region **Frankfurt
   (eu-central-1)** (keeps data in the EU) → set a database password
   (save it) → **Create new project**, wait ~2 minutes.
3. **SQL Editor** → **New query** → paste in `supabase_schema.sql` →
   **Run**. You should see "Success."
4. **Project Settings** (gear icon) → **API** → copy into your scratch
   note:
   - **Project URL**
   - **service_role** key (click Reveal first — starts with `eyJ...`,
     keep this private)

---

## Part 3 — Email sending (Resend) — ~10 minutes

Resend is a proper transactional email service — no Google account
quirks, better deliverability, and this is what "real" products use.

1. Go to **resend.com** → sign up (free tier: 3,000 emails/month, plenty
   for now).
2. **Domains** → **Add Domain** → enter `tonysristorante.de`.
3. Resend will show you 2–3 DNS records to add (usually a couple of
   `TXT` and a `CNAME`, for DKIM/SPF verification). Log into **Strato**
   → find **DNS-Verwaltung** for `tonysristorante.de` → add each record
   exactly as Resend shows it.
   - This step can take a few hours to verify (DNS needs to propagate) —
     don't worry if it's not instant.
4. Once verified (green checkmark in Resend), go to **API Keys** →
   **Create API Key** → copy it into your scratch note.
5. Decide the "from" address — I'd suggest `bookings@tonysristorante.de`
   (same one already in use) — save that in your scratch note too.

*(If you want to test everything before DNS verification finishes, you
can temporarily use `onboarding@resend.dev` as the from-address — emails
will work but look less official until your domain is verified.)*

---

## Part 4 — Deploy it (Railway) — ~10 minutes

This is the part that actually makes the app live on the internet.
I'm walking through **Railway** here — **Render** works almost
identically if you'd rather use that instead.

1. Go to **railway.app** → sign up (you can sign up directly with your
   GitHub account, which also connects the two automatically).
2. **New Project** → **Deploy from GitHub repo** → pick `tablespot-tonys`.
3. Railway will detect it's a Node app and start building automatically.
   While that runs, click into the new service → **Variables** tab, and
   add these (paste from your scratch note):
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
   - `JWT_SECRET` → make up any long random string here
   - `RESEND_API_KEY`
   - `FROM_EMAIL`
4. Once the build finishes, go to the **Settings** tab → **Networking**
   → **Generate Domain**. You'll get a URL like
   `tablespot-tonys-production.up.railway.app` — **open it**. You should
   see the actual booking app, live on the internet.
5. Test it right there: make a booking, then come back to log into the
   staff side with PIN `1111` and confirm it shows up.

---

## Part 5 — Your own domain — ~10 minutes

Now point `booking.tonysristorante.de` at this Railway app directly —
no iframe tricks needed this time, since this is a real server.

1. Back in Railway → **Settings** → **Networking** → **Custom Domain** →
   enter `booking.tonysristorante.de` → it'll show you a `CNAME` record
   to add.
2. Log into **Strato** → DNS settings for `tonysristorante.de` → add a
   new **CNAME** record: host `booking`, pointing to the value Railway
   gave you.
3. Wait a few minutes to an hour for DNS to propagate, then visit
   `https://booking.tonysristorante.de` — it should load the app
   directly, on your own domain, full stop. Railway also issues the SSL
   certificate (the padlock) automatically.

---

## Part 6 — Link it + go-live checklist

- Add a "Tisch reservieren" / "Reserve a Table" link on the Webflow site
  pointing to `https://booking.tonysristorante.de`.
- Go through the same test checklist as before: book in both languages,
  check the allergy-consent checkbox behavior, log in as staff and
  admin, cancel a booking and confirm the waitlist auto-promotes, check
  emails actually arrive.
- **Change the 4 PINs** (1111/2222/3333/9999) from the Admin → Branch
  settings screen before telling Tony's staff to use it for real.
- Update `privacy_policy_url` in the `restaurants` table (via Supabase's
  **Table Editor**, no SQL needed) once the Datenschutzerklärung is
  actually published as a page on tonysristorante.de.

---

## If something breaks

1. **Blank page / "Could not connect"** → check the 5 environment
   variables in Railway for typos — this is the #1 cause.
2. **Build fails on Railway, or the page loads but is completely blank
   with console errors about failed module imports** → almost always
   means the folder structure didn't survive the GitHub upload in Part 1.
   Check the repo on GitHub itself: you should see a `src` folder with
   subfolders inside it (`config`, `db`, `services`, `middleware`,
   `routes`), and a `public` folder containing `index.html` plus `css`
   and `js` subfolders. If any of those are missing or flattened, redo
   the upload making sure you drag the *folders themselves*, not just
   the files inside them.
3. **No email arrives** → check the Resend dashboard's **Logs** tab, it
   shows exactly why an email did or didn't send (usually: domain not
   verified yet, or a typo in `FROM_EMAIL`).
4. **Custom domain doesn't load** → DNS changes can take up to 24 hours
   in rare cases, even though it's usually minutes; double-check the
   CNAME value was copied exactly from Railway.

Paste me the exact error and I'll help you debug it either way.
