# Beyond Syllabus Admin Server

Starter admin-side server for deployment to Vercel. It uses Next.js App Router,
so Vercel can build and deploy it without a custom server or `vercel.json`.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The health endpoint is
available at [http://localhost:3000/api/health](http://localhost:3000/api/health).

```bash
npm run lint
npm run build
npm run start
```

## Deploy to Vercel

Import this repository in Vercel and keep the detected Next.js framework
settings and default build command. Vercel will deploy the App Router API
handlers as serverless functions.

No secrets or database credentials are needed for this initial skeleton. Add
environment variables in Vercel Project Settings when connecting the admin
server to its data services. Keep privileged credentials server-side (never
prefix them with `NEXT_PUBLIC_`) and require verified admin authorization on
every privileged API route before adding admin operations.

## API

- `GET /api/health` — returns a minimal JSON liveness response.

Add future admin endpoints under `src/app/api/`. Keep privileged data access
and authorization checks in server-only code.
