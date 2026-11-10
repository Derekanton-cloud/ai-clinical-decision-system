# Deployment

This repository uses one public Vercel URL. The Next.js application proxies
`/api/*` to the private Render service configured in `BACKEND_URL`; visitors do
not need the Render URL.

## Free-tier setup

1. Create a free Neon PostgreSQL database and set its pooled connection string
   as Render `DATABASE_URL`.
2. Create the Render service from this repository using `render.yaml`. Set
   `CORS_ORIGINS` to the final Vercel URL. Render generates `JWT_SECRET_KEY`.
3. Create a Vercel project from this repository. Set `BACKEND_URL` to the
   Render service URL (server-only; do not use `NEXT_PUBLIC_`), then deploy.
4. Set Render `CORS_ORIGINS` to `https://<your-vercel-domain>` and redeploy.
5. To create the optional fictional demo tenant once, run the seed script in a
   secure Render shell with `DEMO_PASSWORD` set. Share those credentials only
   through the agreed private channel.

## Company demo bypass

Set `DEMO_LOGIN_ENABLED=true` and a strong `DEMO_PASSWORD` only in the backend
service environment. `POST /api/auth/demo-login` then creates (only once) and
authenticates the fictional Demo Clinician at Harborview Demonstration Hospital.
It also seeds linked fictional patients, cases, reports, and monitoring data.
Set `DEMO_LOGIN_ENABLED=false` to make the endpoint return 404 immediately.

## AI operational status

`backend/models/xray_model.pt` is deliberately ignored and is not deployed.
It must be installed from a validated, versioned training artifact with its
provenance and evaluation record. Until then, X-ray classification, Monte Carlo
uncertainty, Grad-CAM, and denoising return an honest unavailable state. The
risk model and related explanations are demonstration-only because they use
synthetic/rule-based logic. BioBERT is optional and lazy-loaded; failures are
not represented as successful analysis.

The free deployment uses `requirements-deploy.txt`, keeping core patient,
case, dashboard, authentication, reporting, and health workflows operational
without exhausting a small Python service. `requirements.txt` remains the full
research environment.
