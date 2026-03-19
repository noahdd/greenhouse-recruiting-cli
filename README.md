# greenhouse-recruiting-cli

CLI to interact with Greenhouse Recruiting via its internal JSON API. Fetch interview kits, read scorecards, save feedback — all from the terminal.

## How it works

Greenhouse is a server-rendered Rails app with no public API for interviewers. This CLI:

1. Reads your session cookies from Chrome's encrypted SQLite cookie database on macOS
2. Decrypts them using Chrome Safe Storage key from the macOS Keychain (AES-128-CBC)
3. Hits Greenhouse's internal JSON API (discovered by appending `.json` to page URLs)

## Setup

```bash
npm install
npm run build
```

You must be logged into Greenhouse in Chrome. The CLI reads your session automatically.

## Commands

### interview-kit

Fetch the full interview kit — candidate info, rubric, scorecard structure, interview schedule.

```bash
# By IDs
greenhouse interview-kit GUIDE_ID PERSON_ID --application-id APP_ID

# Or paste the full Greenhouse URL
greenhouse interview-kit "https://your-company.greenhouse.io/guides/GUIDE_ID/people/PERSON_ID?application_id=APP_ID"
```

Returns JSON with `candidate`, `interview`, `interview_kit` (rubric HTML), and `scorecard` (questions, options, answer types).

### scorecard

Fetch just the scorecard form structure — questions, dropdown options, answer IDs.

```bash
greenhouse scorecard GUIDE_ID PERSON_ID --application-id APP_ID
```

### my-interviews

List your upcoming interviews from the Greenhouse dashboard.

```bash
greenhouse my-interviews
```

### page

Fetch any raw Greenhouse page as HTML.

```bash
greenhouse page /dashboard
```

## API Endpoints

See [api-spec.md](api-spec.md) for the full internal API documentation, including:

- `GET /guides/:id/people/:id.json` — Interview kit JSON (candidate, rubric, scorecard)
- `POST /guides/:id/people/:id/scorecards` — Save/submit scorecard as draft or final
- `GET /dashboards/widgets/my_interviews` — Upcoming/past interviews
- `GET /tags/hiring_team/:app_id` — Hiring team for @-mentions
- `GET /departments`, `/offices`, `/plans.json` — Organization data

## Auth

The CLI automatically extracts session cookies from Chrome's cookie database on macOS:

```
~/Library/Application Support/Google/Chrome/Profile N/Cookies  (SQLite)
  → decrypted via macOS Keychain "Chrome Safe Storage" key
  → PBKDF2(password, "saltysalt", 1003, 16, SHA1) → AES-128-CBC
  → skip 32-byte Chrome prefix → actual cookie value
```

Alternatively, set `GREENHOUSE_SESSION_COOKIE` to a full cookie header string:

```bash
export GREENHOUSE_SESSION_COOKIE="_session_id=abc; _t=xyz..."
```

## Development

```bash
npm run dev      # Watch mode
npm test         # Run tests (10 passing)
```

## Project structure

```
src/
  auth.ts      Chrome cookie extraction + decryption
  client.ts    Greenhouse API client (JSON + HTML)
  index.ts     CLI entry point
tests/
  unit/
    cli.test.ts      Arg parsing + URL parsing
    client.test.ts   API client with mocked responses
api-spec.md          Full internal API documentation
```
