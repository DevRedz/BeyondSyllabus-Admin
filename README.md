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

The console includes searchable, paginated Supabase Auth user management;
account signup and last-sign-in details; and a course leaderboard ranked by
positive votes on generated outputs. Selecting a course shows its resume
bullets and skillsets with their recommendation counts. Admin data access
continues to be restricted to the `ADMIN_EMAILS` allowlist.

The Syllabus Files section lists recent files with course and offering details,
creates short-lived signed viewing links for the private `syllabi` Storage
bucket, and lets admins upload a PDF up to 4 MB by selecting a course offering.
Deleting a syllabus removes its database record and stored PDF.

The relevant `profiles`, `courses`, `departments`, `votes`, `ai_generations`,
`course_offerings`, and `syllabi` tables, along with the `syllabi` Storage
bucket, must exist in the connected Supabase project. `/api/health` returns a
minimal JSON liveness response.
