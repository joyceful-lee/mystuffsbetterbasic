# Deploy MyStuffsBetter to Vercel

Import [joyceful-lee/mystuffsbetterbasic](https://github.com/joyceful-lee/mystuffsbetterbasic) in [Vercel New Project](https://vercel.com/new). This repository contains the app at its root.

| Setting | Value |
| --- | --- |
| Root Directory | `.` (leave the default; do not enter `mystuffsbetter`) |
| Framework | Next.js |
| Production Branch | `main` |
| Node.js | 22.x, set by `package.json` |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | Framework default; do not override |
| Function region | Portland (`pdx1`), near the existing Neon database |

`vercel.json` contains the framework, build/install commands, and function region. The app uses the regular Node runtime and npm lockfile. Do not set `MSB_BUILD_DIR` in Vercel; that is only a local Windows build workaround.

## Set the server environment

Use Vercel Project Settings → Environment Variables. These values must stay server-only; do not add a `NEXT_PUBLIC_` prefix or commit them to GitHub.

| Variable | Production value |
| --- | --- |
| `DATABASE_URL` | Existing pooled Neon connection for database `mystuffsbetter`; copy securely from ignored `.env.local` or Neon Connect |
| `NEON_AUTH_BASE_URL` | Existing Neon Auth endpoint from ignored `.env.local` or Neon Auth configuration |
| `NEON_AUTH_COOKIE_SECRET` | A cryptographically random secret of at least 32 characters; use a separate production value |
| `APP_URL` | The exact public HTTPS origin assigned to this Vercel project, with no trailing slash |
| `BLOB_STORE_ID` | Connected private Vercel Blob store ID |
| `BLOB_READ_WRITE_TOKEN` | Server-only Blob credential provisioned by the storage integration |

Generate a cookie secret locally with `node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))"` and paste it directly into Vercel. Changing it later logs users out.

For previews, configure their own `APP_URL` matching the preview origin. Do not reuse a fixed production `APP_URL` on preview deployments: mutation Origin checks would reject the preview. Preview auth also needs the matching trusted domain in Neon. The [Neon/Vercel integration](https://neon.com/blog/auth-that-just-works-in-vercel-previews) can manage isolated preview endpoints and domains; otherwise configure exact origins explicitly.

## Finish Neon Auth domains

After Vercel assigns the production domain, add its full HTTPS origin in [Neon Console](https://console.neon.tech/app/projects/spring-rain-95366292) → Auth → Configuration → Domains. Use the same origin as `APP_URL`. This is required for signup, login, and password-reset redirects. If a custom domain is added later, update `APP_URL` and Neon trusted domains together, then redeploy.

The basic production origin `https://mystuffsbetterbasic.vercel.app` and local development origin are trusted. Configure the corresponding origin separately for a new deployment.

## Private card pictures

Connect a **private** Blob store under Storage. New uploads and guest transfers write image files there and save their URLs in Neon. `/api/cards/[id]/image` streams files only to the owner or a viewer with the binder's current share token. Responses are not cached, so revocation applies to subsequent image requests. Existing image data URLs in Neon remain supported. No bulk migration is required.

For local Blob testing, securely pull the connected store credentials into ignored `.env.local`. Without Blob credentials, local development stores image data in Neon for compatibility. Production refuses new picture uploads when Blob is unconfigured instead of silently falling back.

## Database and migrations

The existing Neon project is `spring-rain-95366292`, branch `br-twilight-bread-art6evec`, database `mystuffsbetter`, region AWS US West 2. The complete schema and migrations through `004-collection-preferences.sql` have already been applied there. Do not create a second empty database when configuring this app unless you intend to start over.

For a new database, apply `db/schema.sql` once. For an older deployment, apply the additive files in `db/migrations/` in numeric order. Builds do not apply migrations automatically. Auth is managed separately by Neon Auth.

## Verify the deployment

1. Create a guest binder, add cards with and without pictures, and reload.
2. Sign up and confirm the guest binder moves to the account.
3. Sign out and back in, then check cards, deck/card numbers, favorites, colors, order, and chosen cover.
4. Remove the sample binder and confirm it stays removed after signing back in.
5. Share a binder, open it in a private browser, then revoke the link.
6. Use Forgot password and complete the emailed reset link.

GitHub Actions runs unit/contrast tests and a production build using harmless build-only auth placeholders. It does not use production credentials or create QA accounts. `scripts/smoke.mjs` is an optional live API check that creates labeled QA data; use a test deployment/database for repeated runs.

Reference: [Vercel configuration](https://vercel.com/docs/project-configuration/vercel-json), [Node versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions), [regions](https://vercel.com/docs/regions), [Neon password reset](https://neon.com/docs/auth/guides/password-reset).
