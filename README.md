# TalentBridge

TalentBridge is a job-application assistant. This version covers account onboarding and resumes: sign up, upload a PDF or DOCX, review the extracted fields, and save a profile snapshot.

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

Passwords are hashed with bcrypt. The session cookie is `tb_session` (HttpOnly, SameSite=Lax, 30 days). Resume and profile queries are scoped to the signed-in user.

## Resume parsing

Text is extracted on the server: `unpdf` for PDF, `mammoth` for DOCX. The original file bytes are stored in Postgres. Other file types are rejected. Files over 4 MB are rejected so the upload stays under Vercel’s request body limit (about 4.5 MB).

The extracted text is parsed into name, contact, work experience, education, and skills.

- **Gemini** (`AI_PROVIDER=gemini` or unset, with `GEMINI_API_KEY`): `gemini-3.8-flash` via the Gemini REST API. The review screen says the draft came from that model.
- **Groq** (`AI_PROVIDER=groq` and `GROQ_API_KEY`): `openai/gpt-oss-20b` via Groq’s chat completions API. The review screen names Groq and that model.
- **Local fallback**: used when `AI_PROVIDER=fallback`, when the chosen API key is missing, when the provider name is unknown, or when the provider call fails. The draft is built from headings, dates, and contact lines in the file. The review screen is titled “Local fallback extractor” and states that an AI model did not produce the draft.

Confirming a resume saves it and copies the confirmed fields onto the user’s profile. Editing a saved resume updates that resume only. “Set as my profile” copies the resume onto the profile again. Deleting a resume leaves the profile snapshot in place.

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
5. Deploy. The app uses Route Handlers only and does not need a custom server.
