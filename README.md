# SecLab

SecLab is a lightweight workbench for web security testing. It combines an intercepting proxy, a high-powered repeater, header-rule automation, and passive findings in a single Next.js UI. Everything runs locally so that sensitive traffic never leaves the machine.

> ⚠️ Use SecLab only in environments and against targets where you have explicit authorization. The tooling is intentionally invasive.

## Highlights

- Intercept queue for pausing live requests/responses, editing payloads, and forwarding or dropping them.
- Batch-capable repeater with placeholder generators (constant, counter, random, UUID, wordlist) and response previews.
- Header Rules system to strip/override security headers when testing embedded content, protected by an `ADMIN_TOKEN`.
- Passive findings feed powered by built-in and user-provided plugins under `plugins/`.
- Reverse proxy, forward proxy, and HTTPS MITM proxy to cover different capture scenarios.
- JSON-backed persistence inside `data/` for easy scrubbing and auditability.

## Project Map

- `app/` — Next.js App Router UI (intercept pane, repeater, findings dashboard, header-rule editor).
- `app/api/*` — REST endpoints that back the UI (`/api/intercept`, `/api/repeater`, `/api/proxy`, `/api/mitm/*`, `/api/events`, etc.).
- `lib/` — core logic (intercept queue, data store, plugin loader, HTTP client, header matcher).
- `proxy/server.js` — forward + reverse proxy with header rewrites for HTTP traffic.
- `proxy/mitm.js` — HTTPS-intercepting proxy built on `http-mitm-proxy` with an auto-generated CA.
- `plugins/` — drop-in JavaScript modules that run on request/response to record flows or findings.
- `data/` — local JSON persistence (`intercept.json`, `repeater-drafts.json`, `findings.json`, `rules.json`, and optional `flows.json` when raw flow capture is enabled).

## Getting Started

1. **Install dependencies**
   ```bash
   npm install
   ```
2. **Run the web UI**
   ```bash
   npm run dev
   ```
   Visit [http://localhost:3000](http://localhost:3000) to open the dashboard.
3. **Optional: forward proxy for header rewriting**
   ```bash
   npm run proxy
   ```
   Configure your browser or tooling to use `http://localhost:8080` for HTTP traffic. HTTPS tunnels but is not rewritten.
4. **Optional: MITM proxy (HTTP+HTTPS)**
   ```bash
   npm run proxy:mitm
   ```
   The proxy listens on `http://localhost:8081`, generates a root CA in `data/mitm-ca/`, and exposes the certificate at `/api/mitm/ca`. Trust the CA to intercept HTTPS.

### Privileged operations

Certain endpoints (e.g., Header Rules) require an admin token. Export the token before launching the dev server:

```bash
export ADMIN_TOKEN=super-strong-token
npm run dev
```

When the UI prompts for the token, paste the same value. API clients should send `Authorization: Bearer <ADMIN_TOKEN>` on the protected routes.

## Using the Tools

- **Intercept** — Toggle interception from the navigation bar. Pending items appear in the queue; edit URLs, methods, headers, bodies, or responses, then send, drop, or forward to the repeater via “To Repeater”. Use “Edit response then Send” for one-off response rewrites.
- **Repeater** — Craft requests with placeholder generators, run them once or in batches, and inspect status, timing, headers, bodies, and an auto-generated `curl` command per run.
- **Header Rules** — Create host/path matchers and specify header mutations (remove, override, add). Rules apply inside the embedded reverse proxy and the optional MITM proxy.
- **Findings** — Built-in passive checks plus any plugins under `plugins/` call `ctx.addFinding` to populate `data/findings.json`. Surface them in the Findings panel or stream them via SSE.
- **Raw flows** — The proxies can still write raw flow JSON to `data/flows.json` for automation or plugins, but the interactive UI focuses on intercept/repeater workflows.

## Data & Privacy

Everything persists locally:

- `data/intercept.json` — intercept toggle state and response watch list.
- `data/repeater-drafts.json` — saved repeater payloads.
- `data/findings.json` — passive findings with timestamps.
- `data/rules.json` — header rules (created on first save).
- `data/flows.json` *(optional)* — written only if you enable raw flow capture; delete it if you do not wish to retain flows.

Stop the app before deleting any files. Removing a JSON file resets that section without affecting other state.

## API Surface

- `GET /api/intercept/queue` — inspect the intercept queue.
- `POST /api/intercept/toggle` — enable or disable interception.
- `POST /api/intercept/item/:id` — send or drop a queued item.
- `POST /api/repeater` — execute crafted requests.
- `POST /api/repeater/drafts` — create drafts for later use in the UI.
- `GET /api/events` — server-sent events for new findings (and optional flow updates).
- `GET /api/proxy?url=…` — reverse proxy a target URL with header rewrites.
- `GET /api/mitm/ca` — download the current MITM root certificate.

All APIs return JSON; sensitive operations require the admin token.

## Development Notes

- Target Node.js v20+.
- `npm run lint` runs ESLint with the Next.js config.
- Tailwind CSS v4 powers the utility-first styling via `app/globals.css`.
- The stores in `lib/` keep state in memory and mirror it to disk; restart the dev server after editing those modules.

## Security & Legal

- Trusting the generated CA gives SecLab man-in-the-middle capability across your system—use a dedicated profile whenever possible.
- Scrub the `data/` directory between engagements to avoid leaking sensitive traffic.
- Respect laws, customer policies, and contractual scopes; misuse is solely your responsibility.

## Roadmap Ideas

- Swappable persistence layer (MongoDB/Postgres) instead of JSON files.
- More passive plugins (DOM heuristics, secret detectors, fuzzing helpers).
- Workspace export/import for cross-team handoff.

Contributions, bug reports, and plugin ideas are welcome—open an issue or PR to discuss improvements.
