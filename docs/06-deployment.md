# 06 — Deployment

Netlify (app) + Neon (Postgres) + GitHub (sign-in and PR data). About 20 minutes, once.

## 1. Neon

1. Create a project; pick the region closest to your Netlify functions (e.g. AWS `eu-central-1` with Netlify's Frankfurt functions). NF-01 depends on this more than on any code.
2. Copy two connection strings from *Connection details*:
   - **Pooled** (host contains `-pooler`) → `DATABASE_URL`
   - **Direct** → `DATABASE_URL_DIRECT` (migrations only)
   Both need `?sslmode=require`.
3. For deploy previews, create a branch (e.g. `preview`) and keep its two URLs for step 4.

## 2. GitHub OAuth App (sign-in)

GitHub → Settings → Developer settings → OAuth Apps → New:

- Homepage URL: `https://<your-site>.netlify.app`
- Callback URL: `https://<your-site>.netlify.app/auth/github/callback`

Copy the client id and generate a client secret. Find your numeric user id at `https://api.github.com/users/<your-login>` (`"id"`). It never changes even if you rename your account.

## 3. Fine-grained token (PR titles)

GitHub → Settings → Developer settings → Fine-grained tokens → Generate:

- Resource owner: **the organisation** whose repositories you work on (approve the token in the organisation if it requires approval).
- Repository access: all repositories, or the ones you use.
- Permissions: **Pull requests: Read-only**. Nothing else.

## 4. Netlify

Import the repository. `netlify.toml` already sets the build: production and preview deploys run `npm run db:migrate && npm run build`.

Environment variables (Site configuration → Environment variables):

| Variable | Value |
|---|---|
| `APP_URL` | `https://<your-site>.netlify.app` (must be https) |
| `APP_TIME_ZONE` | `Africa/Kampala` |
| `DATABASE_URL` | Neon pooled URL (preview context: the preview branch's) |
| `DATABASE_URL_DIRECT` | Neon direct URL (preview context: the preview branch's) |
| `GITHUB_OAUTH_CLIENT_ID` / `GITHUB_OAUTH_CLIENT_SECRET` | from step 2 |
| `ALLOWED_GITHUB_USER_ID` | your numeric id |
| `GITHUB_PR_TOKEN` | from step 3 — mark as secret |
| `GITHUB_ALLOWED_ORGS` | e.g. `suds-tech` (comma-separated) |
| `REPORT_AUTHOR_NAME` | your name as it should appear on reports |

Never set `GITHUB_API_URL` in production. Never prefix anything with `NEXT_PUBLIC_`.

Deploy previews sign in with the production OAuth App only if you add each preview's callback URL to it; usually it is simpler to check previews with `npm run test:e2e` locally.

## 5. After the first deploy

```bash
curl -sI https://<your-site>.netlify.app/sign-in | grep -iE 'content-security-policy|strict-transport|x-frame'
```

- The three headers are present.
- `/projects` without signing in redirects to `/sign-in`.
- Sign in with your GitHub account → you land on Projects. Sign in from another account → "Not allowed".
- Create a project, log one entry with a real PR link → the PR title appears.
- `/preview` returns 404.

## Rolling back

Netlify keeps every deploy: *Deploys → (an older deploy) → Publish deploy*. Migrations are additive only, so an older build runs against a newer schema. Neon's point-in-time restore covers data mistakes.
