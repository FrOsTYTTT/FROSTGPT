# FROSTGPT™

FROSTGPT is a browser-based AI workspace created by FrOsTAI.

## Project layout

The Cloudflare Pages application lives in `FROST AI/`.

- `index.html` — application markup and formatting toolbar.
- `styles.css` — active application stylesheet.
- `app.js` — Firebase authentication, chat UI, settings, attachments, GIF picker, voice controls, and API client.
- `classic.js` — offline programmed-response mode.
- `functions/api/chat.js` — Cloudflare Workers AI chat endpoint.
- `functions/api/image.js` — Cloudflare Workers AI image-generation endpoint.
- `functions/api/gifs.js` — server-side GIPHY search endpoint.
- `sw.js` — versioned PWA service worker.
- `manifest.json` and `icon.svg` — install metadata and application icon.
- `icon-maker.html` — standalone icon preview/export utility.

## Cloudflare Pages setup

Configure the Pages project so that `FROST AI/` is the application project root. This is important because the Pages Functions directory must be discovered as `functions/` inside that project root.

The site is static HTML/CSS/JavaScript and does not require a frontend build command. Configure the Pages output directory to publish the static application files from the project root selected above.

### Required Cloudflare configuration

1. Add a Workers AI binding named **`AI`** to the Pages project.
2. Create a Cloudflare D1 database and bind it to the Pages project with the exact binding name **`SAFETY_DB`**.
3. Apply the SQL in `FROST AI/migrations/0001_safety.sql` to that D1 database before using the chat and safety endpoints.
4. Add a Pages secret named **`GIPHY_API_KEY`** for GIF search.
5. Redeploy after changing bindings, applying the migration, or changing secrets.

Do not put the GIPHY key in browser JavaScript or commit it to GitHub.

## Firebase setup

The browser app uses Firebase Authentication and Cloud Firestore.

- Enable the Google, Apple, and GitHub providers that you intend to offer.
- Add the deployed website hostname to Firebase Authentication's authorized domains.
- Configure Firestore security rules so each signed-in user can read and write only their own `users/{uid}/chats/**` data.
- Restrict the Firebase API key to the required Firebase APIs and authorized website referrers where practical.

The Firebase web configuration is client-side configuration, not a substitute for Firestore security rules.

## API endpoints

- `POST /api/chat` — accepts a JSON body containing a `messages` array and returns `{ "reply": "..." }`.
- `GET /api/health` — reports the deployed backend build, verifies the harmless-message safety bypass, and checks whether the Workers AI and D1 bindings are configured.
- `POST /api/image` — accepts `{ "prompt": "..." }` and returns a generated image data URL.
- `GET /api/gifs` — returns trending GIFs; `GET /api/gifs?search=...` searches GIPHY.

The chat endpoint accepts up to 80 messages per request. The browser sends the newest 80 messages while retaining the full conversation in the UI/history.

## Local verification

Before publishing changes:

1. Check that the JavaScript files parse.
2. Confirm every required HTML element ID exists.
3. Confirm the service-worker precache paths exist in the deployed Pages output.
4. Test sign-in, new chat, sending, settings, attachments, GIF search, image generation, and sign-out in a real browser.
5. Check the browser console and Cloudflare Pages Function logs if an API action fails.

A source-code check cannot replace testing against the deployed Firebase and Cloudflare configuration.

## Workers AI model routing

- Primary chat and vision model: `@cf/google/gemma-4-26b-a4b-it`.
- Text backup: `@cf/zai-org/glm-4.7-flash`.
- Additional text and vision backup: `@cf/qwen/qwen3.8-27b`.
- Image requests are routed only to vision-capable models. Text-only models are never sent image payloads.
- Safety classification uses `@cf/meta/llama-guard-3-8b`; uploaded-audio transcription uses `@cf/openai/whisper-large-v3-turbo`; image generation uses `@cf/black-forest-labs/flux-1-schnell`.
