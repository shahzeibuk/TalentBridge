# TalentBridge

TalentBridge is a job-application assistant. You can sign up, upload a PDF or DOCX, review the extracted fields, and save a profile snapshot. You can also connect Gmail and send a cover letter plus a saved resume to a job posting's contact address, then see whether that thread received a reply.

## Local setup

You need Node.js 20+ and PostgreSQL 16 (local install or Docker).

Create the database:

```bash
sudo -u postgres psql -c "CREATE USER talentbridge WITH PASSWORD 'talentbridge' CREATEDB;"
sudo -u postgres psql -c "CREATE DATABASE talentbridge OWNER talentbridge;"
```

Docker alternative:

```bash
docker run --name talentbridge-db -e POSTGRES_USER=talentbridge -e POSTGRES_PASSWORD=talentbridge -e POSTGRES_DB=talentbridge -p 5432:5432 -d postgres:16
```

Copy the environment file and set a real `AUTH_SECRET`:

```bash
cp .env.example .env
openssl rand -base64 32
```

Apply migrations and start the app:

```bash
npm install
npx prisma migrate dev
npm run dev
```

The dev server listens on `0.0.0.0:3847`. Open [http://127.0.0.1:3847](http://127.0.0.1:3847).

## Environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string. Local or Neon. |
| `AUTH_SECRET` | Signs the HttpOnly session cookie. At least 16 characters. |
| `AUTH_URL` | Public origin of the app, used as the metadata base URL. |
| `AI_PROVIDER` | `gemini` (default), `groq`, or `fallback`. |
| `GEMINI_API_KEY` | Google Gemini key. Used when `AI_PROVIDER` is `gemini` or unset. |
| `GROQ_API_KEY` | Groq key. Used only when `AI_PROVIDER=groq`. |
| `GOOGLE_CLIENT_ID` | OAuth client ID for Gmail. Leave empty until you create a testing client. |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret for that same client. |
| `GOOGLE_REDIRECT_URI` | Optional. Defaults to `AUTH_URL` + `/api/gmail/callback`. |

Passwords are hashed with bcrypt. The session cookie is `tb_session` (HttpOnly, SameSite=Lax, 30 days). Resume and profile queries are scoped to the signed-in user.

## Resume parsing

Text is extracted on the server: `unpdf` for PDF, `mammoth` for DOCX. The original file bytes are stored in Postgres. Other file types are rejected. Files over 4 MB are rejected so the upload stays under Vercel’s request body limit (about 4.5 MB).

The extracted text is parsed into name, contact, work experience, education, and skills.

- **Gemini** (`AI_PROVIDER=gemini` or unset, with `GEMINI_API_KEY`): `gemini-3.8-flash` via the Gemini REST API. The review screen says the draft came from that model.
- **Groq** (`AI_PROVIDER=groq` and `GROQ_API_KEY`): `openai/gpt-oss-20b` via Groq’s chat completions API. The review screen names Groq and that model.
- **Local fallback**: used when `AI_PROVIDER=fallback`, when the chosen API key is missing, when the provider name is unknown, or when the provider call fails. The draft is built from headings, dates, and contact lines in the file. The review screen is titled “Local fallback extractor” and states that an AI model did not produce the draft.

Confirming a resume saves it and copies the confirmed fields onto the user’s profile. Editing a saved resume updates that resume only. “Set as my profile” copies the resume onto the profile again. Deleting a resume leaves the profile snapshot in place.

## Job postings

Signed-in pages use an admin workspace: a side menu for overview, profile, resumes, job postings, and applications, and a top bar with the current section. The overview shows resume, posting, send, reply, and profile counts, a 14-day activity chart, and a one-line readout. Resumes, postings, and applications are listed in tables. Paste a job posting URL on Job postings. TalentBridge fetches that page and saves the title, company, and description on your account, listed next to your resumes. If the site blocks the fetch, times out, or doesn't include a readable description, the page shows the error and a form where you paste the posting yourself.

Tailor a resume from a saved posting to line up keywords and phrasing an applicant tracking system looks for. The draft only keeps keywords the source resume already supports. Keywords the posting asks for that aren't in the resume are listed as left out. With `GEMINI_API_KEY` or `GROQ_API_KEY`, the named model rewrites descriptions under that rule. Without a key, or if the model call fails, a local ATS pass does the same keyword match and says an AI model did not produce the draft. Review the draft before you confirm it.

## Gmail (testing mode)

Connect Gmail on the dashboard, then send a cover letter and a saved resume to a contact email you enter for a job. The message is sent by the Gmail API as the connected account. TalentBridge stores the thread id and, when you load the dashboard or choose Check for replies, reads that thread and shows whether someone else has replied.

The OAuth client should stay in Google Cloud Console’s **Testing** publishing status. That skips Google’s verification review and limits sign-in to the test users you add (up to 100). Testers see Google’s unverified-app warning and can continue. Refresh tokens in testing last about 7 days; after that, connect again.

Scopes requested:

- `https://www.googleapis.com/auth/gmail.send` — send the application from the user’s Gmail
- `https://www.googleapis.com/auth/gmail.metadata` — read headers on threads this app started, so reply status can be shown

TalentBridge does not list the rest of the mailbox. Tokens are encrypted with `AUTH_SECRET` and stored in Postgres.

Create a Web application OAuth client and register the redirect URI `http://127.0.0.1:3847/api/gmail/callback` (or the `GOOGLE_REDIRECT_URI` you set). Put the client id and secret in `.env`. Leave them empty to run without Gmail; the Connect Gmail button explains what is missing.

## Deploy on Vercel

1. Create a Neon Postgres database.
2. Run migrations against Neon’s **direct** (non-pooler) connection string: `DATABASE_URL="postgresql://…@ep-….neon.tech/neondb?sslmode=require" npx prisma migrate deploy`
3. Import the repo in Vercel. Framework preset: Next.js.
4. Set environment variables:
   - `DATABASE_URL`: the Neon **pooled** URL, with `sslmode=require&pgbouncer=true&connection_limit=1`. The host contains `-pooler`.
   - `AUTH_SECRET`: a long random string.
   - `AUTH_URL`: `https://your-deployment.vercel.app`
   - `AI_PROVIDER`: `gemini`, `groq`, or `fallback`
   - `GEMINI_API_KEY` and/or `GROQ_API_KEY` when you want model parsing. Leave them empty to use the local fallback.
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI` (`https://your-deployment.vercel.app/api/gmail/callback`) for Gmail. Keep the Google app in Testing and add the people who should connect.
5. Deploy. The app uses Route Handlers only and does not need a custom server.
