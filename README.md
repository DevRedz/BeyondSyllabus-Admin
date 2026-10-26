# Beyond Syllabus Admin

Admin console for the Beyond Syllabus Supabase project, built with Next.js App
Router and deployable to Vercel.

## Configure

Copy `.env.example` to `.env.local` and provide:

- `NEXT_PUBLIC_SUPABASE_URL` — the Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — publishable key used for Supabase Auth
  (the legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` is also accepted).
- `SUPABASE_SECRET_KEY` — server-only key used by admin data and storage APIs.
- `ADMIN_EMAILS` — comma-separated list of Google-authenticated admin emails.

Never expose `SUPABASE_SECRET_KEY` with a `NEXT_PUBLIC_` prefix. Add the same
variables to Vercel Project Settings. Enable Google in Supabase Auth and allow
`https://<your-vercel-domain>/auth/callback` as an auth redirect URL.

## Run

```bash
npm install
npm run dev
```

Run checks/build with `npm run lint` and `npm run build`. Import the repository
in Vercel using the detected Next.js settings to deploy.

## Admin console

The root route redirects to `/dashboard`. Admins sign in with Google; the
server checks the user's verified Supabase Auth email against `ADMIN_EMAILS`
before rendering the console and before every privileged API request.

The console lists Supabase Auth users and manages the configured prompt-chain,
term, AI generation, LLM, signup allowlist, and image resources. Editable
records use JSON to accommodate database columns that vary by deployment.
Queries are capped at 100 records. Read-only resources include users, AI media,
generation requests, AI generations, and LLM responses.

The Images section also lists private syllabus records and creates short-lived
signed viewing links for the private `syllabi` Storage bucket. Admins can upload
a PDF up to 4 MB for an existing course offering by entering its offering UUID;
the upload creates a `syllabi` record associated with the signed-in admin.
Deleting a syllabus removes its database record and stored PDF.

The relevant database tables and `syllabi` bucket must exist in the connected
Supabase project. The configured table names and key fields are centralized in
`src/lib/admin-resources.ts`; adjust them there if your schema uses different
names. `/api/health` returns a minimal JSON liveness response.
