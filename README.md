# MyStuffsBetter

A trading-card binder app built with Next.js, Neon Auth, and Neon PostgreSQL. The application lives at the root of the dedicated mystuffsbetterbasic repository.

The interface opens on a binder shelf with colored covers and sleeve-style card pages. Fredoka is used for playful headings and Atkinson Hyperlegible Next for reading text; both are bundled locally under `public/fonts/` with their Open Font License files, so visitors do not request fonts from Google. Each binder has a theme with a short palette, independent cover and card-page colors, a 180-character bio, and rarity choices for its chosen game. Other supports custom rarity labels up to 60 characters. Interface copy explains actions and storage behavior without promotional slogans or decorative emoji.

## Run locally

Node 22+ is recommended. From this directory:

```sh
npm ci
npm run dev
```

Open http://localhost:3001. The ignored `.env.local` is configured for the new Neon project. Never commit it. `.env.example` lists the required environment variables.

## Neon project

- Project: **MyStuffsBetter**, `spring-rain-95366292`
- Branch: **main**, `br-twilight-bread-art6evec`
- Database: **mystuffsbetter**, PostgreSQL 18
- Region: AWS US West 2
- Console: https://console.neon.tech/app/projects/spring-rain-95366292
- Authentication: Neon Auth (Better Auth), email/password enabled
- Schema: `db/schema.sql` has already been applied to this database.

## How it works

Guests can create up to 6 binders and 50 cards per binder, subject to the browser's total storage quota. Their save is versioned in `localStorage` under `mystuffsbetter.guest.v1`. The app clearly explains that browser data can be lost. Guest photos are compressed to at most 40,000 data-URL characters to leave room for a full binder, and save errors are surfaced without showing unsaved changes as saved. Older guest photos retain their existing quality and may use more space. Signed-in users retain their existing unlimited card capacity.

On sign-in or signup, each guest binder is uploaded in batches of up to 10 cards, each saved in one atomic SQL statement. This keeps large imports below Vercel's request-size limit. Separate guest source IDs make retries idempotent, including after an interrupted batch. Browser data is removed only after every batch of every binder is acknowledged. On failure the save remains intact, and signed-in editing is blocked until retry succeeds. Once imported, all edits go to Neon rather than localStorage. Existing account binders are preserved.

The additive migrations `db/migrations/001-binder-details.sql`, `002-collection-organization.sql`, `003-card-details.sql`, and `004-collection-preferences.sql` have been applied to the configured Neon database. Run them in order when updating another existing deployment. Previous binders keep their colors and creation order; the sample binder keeps its black background. Changing a binder's game changes the available rarity choices while preserving existing card labels until edited. Cards have optional deck (100 characters) and card number (40 characters) fields. Images are optional; blank images render a designed placeholder. These fields persist through guest reloads, signup imports, account editing, and public sharing.

Source pictures accept JPG, PNG, WebP, and GIF up to exactly 10 MiB (10,485,760 bytes). Pictures are resized to at most 850px on the longest side, without upscaling, and compressed to JPEG in the browser. GIF uploads become one still frame. The server validates the saved image's MIME and signature with a 250,000-byte cap. The form, file accept types, client limits, and tests share `lib/upload-guidelines.mjs`.

New account pictures and guest imports upload to private Vercel Blob storage. Neon stores each file URL with its card. The browser receives an application image URL that checks binder ownership or the current share token on every request; revoking a share link also revokes its image access. Replacing or deleting cards removes their old Blob files. Existing Neon data-URL images remain readable. Guest pictures stay in localStorage until account transfer succeeds. Local development without Blob credentials retains the database image fallback; deployed uploads require a connected Blob store.

## Organizing collections

The sidebar Favorites view gathers favorite cards from all saved binders and shows each card's source binder. The favorites tab inside a binder remains local to that binder. The sample is excluded from owned collections.

Search the binder shelf by name or bio, filter by game, or display binders alphabetically. Arrange binders and Arrange cards open a saved-order editor with drag-and-drop, arrow buttons, and a direct position selector. Reordering sends the complete owned set to one atomic server statement; foreign, duplicate, incomplete, and stale ID lists are rejected without a partial update. Guests save the array order in localStorage. Both binder/card order and selected covers survive account transfers and appear on shared pages.

Click a card picture or title to open its detail popup. Owners can favorite, edit, delete, and pin it as the binder cover. A pinned cover survives reordering. Clearing the cover selection uses the first card automatically; deleting the selected cover also restores this fallback. Binder deletion is available on the shelf, in the sidebar, and in settings, with an explicit confirmation before removing the binder, its cards, and its share link.

Binder themes include Pastel, Vibrant, Neon, Gamer, and Classic, with four color choices per theme. Existing colors outside the selected palette remain available as one additional current choice so editing does not reset older binders.

Spine colors remain the theme's colored palette. Cover/page choices are four unlabeled complementary neutrals: one ultra-light (luminance at least 0.85), one dark (at most 0.045), and two flexible tones selected for perceptual variety and contrast with the spine. The extremes remain available even when a pale spine is chosen with a pale cover or a dark spine with a dark cover. Text and highlights use contrast-adjusted colors at 4.5:1 or better, and button text remains readable on the spine color. Changing the spine updates the options and replaces an incompatible draft color. Nothing is persisted until Save changes. Accessible swatch names and hover tooltips are retained.

The binder cover, form preview, open card layout, and shared page use the same exact base background color. Open-layout buttons and selected states use the spine color, with a contrast-adjusted shade of that color for text links/tabs and a readable foreground on colored buttons. Workspace navigation and the collection desk retain their own blue/ivory appearance.

Pastel uses a specific four-color cover/page palette: Chalk (`#FDFDFB`, white-based ultra-light), Cream (`#FBF4E8`, warm brown-based ultra-light), Clay (`#80766B`), and Slate (`#303943`). Swatches remain unlabeled, with accessible names and hover tooltips. Other themes retain their existing palette selection.

Classic uses burgundy red, navy, forest teal, and brass gold, distinct from Pastel. The left navigation's Open a binder heading expands/collapses its list, including on mobile. The footer wordmark has been removed.

The top bar includes Light and Dark appearance controls, also available on the password reset page. On first use the workspace follows the browser's system preference, and an explicit choice is saved under `mystuffsbetter.display-mode` in localStorage and synchronized across tabs. This preference contains no binder data. Navigation, workspace, dialogs, and forms follow the selected mode; the tan collection desk and chosen binder colors remain independent. Card details always show Deck and Card number, with `-` for blank values. Binder cover shows `This card` for the selected/automatic cover and `-` otherwise.

Dark mode uses deep graphite surfaces with bright blue navigation accents and actions. Light surfaces use a darker blue accent for contrast, including the lighter tan collection desk. Binder background palettes remain independent from these interface accents. The card layout omits the decorative grey binding marks and Open binder eyebrow; shelf covers omit Open/View binder labels and the desk has no introductory sentence. See all cards in the sidebar gathers saved cards across binders, excludes samples, and supports search, alphabetical order, grid/list layouts, favorites, details, and links to each source binder.

Arrange binders and Arrange cards preview the order during native dragging. Crossing a row's midpoint moves the dragged item and animates surrounding rows into place. Dropping inside the list keeps the draft; cancelling restores the draft from before that drag. Save order persists the draft through the existing guest or account flow. Reduced-motion preferences disable movement animations; arrow and position controls remain available.

The login form includes Forgot password. Neon sends the reset link to the account email, and `/reset-password` accepts the token and lets the user choose and confirm a new password. Missing, expired, or invalid links offer a new request. The form uses the installed Better Auth client's `requestPasswordReset` and `resetPassword` methods through the existing Neon Auth route; it does not store reset tokens in browser storage. See [Neon password reset](https://neon.com/docs/auth/guides/password-reset). The deployed site's origin must be trusted in Neon Auth, as with login/signup.

Themes are chosen with a dropdown. The workspace and navigation stay consistent, and the collection desk keeps its tan paper surface. Binder spine color is independent from the color used on the cover face, open pages, previews, and image-detail surface. Pastel uses light paper colors, Vibrant and Neon use bright colors, and Gamer retains its intended dark palette. Adaptive text, control colors, and subtle text shadows keep the different surfaces readable. Shelf edit/delete actions, sidebar trash controls, and card edit/delete controls appear on hover or keyboard focus. On touch devices, selecting a binder reveals its actions and card actions remain available.

All private API routes verify the Neon Auth session and constrain queries by the authenticated owner. Mutations check the request Origin. Database row-level security is enabled with no public policies; server routes use the owner connection and enforce ownership explicitly. No database credentials reach the browser. Share links use 64 random hex characters, expose only binder/card details, require no account to view, and allow no edits. Turning sharing off revokes the old link; enabling again creates a fresh token.

The showcase is an explicitly labeled, read-only example, excluded from user statistics and guest imports. Example Pokémon card images come from https://images.pokemontcg.io/ (Pokémon TCG API). Pokémon and card artwork belong to their respective owners; this app is not affiliated with Pokémon. Replace example assets with your own licensed art for a commercial launch.

## GitHub and Vercel

Repository: [joyceful-lee/mystuffsbetterbasic](https://github.com/joyceful-lee/mystuffsbetterbasic).

Import it into Vercel with root directory `.` and production branch `main`. Node 22.x, npm install/build commands, Next.js framework settings, and the Portland function region are prepared in the repository. The deployment guide in [docs/VERCEL.md](docs/VERCEL.md) lists the four server environment variables, Neon trusted-domain setup, and post-deployment checks. Credentials stay in ignored `.env.local` and encrypted deployment settings.

GitHub Actions runs the automated tests and a production build without live Neon credentials. The basic production project has Neon and a private Blob store connected. A separate copy must configure its own environment and trusted domain before deployment.

## Checks

```sh
npm run typecheck
npm test
npm run build
```

The 21 automated tests cover rarity choices and custom labels, theme palettes, aggregate favorites, order integrity, pinned-cover fallback, upload boundaries, browser persistence, and safe 50-card migration. `scripts/smoke.mjs` exercises the live Neon-backed API with two disposable test accounts and checks imports including a late-batch cover, editable settings, saved order, ownership isolation, cover selection and deletion, binder deletion cascades, sharing, auth, and uploads. Run against a local dev server with `node scripts/smoke.mjs`. It removes only its explicitly created disposable organization binder and leaves other labeled QA accounts and binders for inspection.

The sample binder can be removed from its shelf, sidebar, or open-layout footer using the same confirmation flow. Removal is a preference: guests save it locally, signed-in users save it in Neon `collection_preferences`, and a guest removal transfers to the account at signup/login. Removing the sample does not delete any owned binder or card. When no binders remain, the page offers Create a binder instead of reopening the sample.

For build verification when Windows locks the default output, `MSB_BUILD_DIR=.next-check` selects an ignored alternate output folder. Normal dev/build/start commands keep the default `.next` folder.
