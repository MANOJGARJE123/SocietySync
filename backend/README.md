# Society Management System Backend

Node.js + Express + PostgreSQL backend with strict layered architecture:

- `routes -> controllers -> services -> repositories -> utils`

## Modules

- Authentication: register/login with JWT, role-based authorization
- Users: list users, profile view/update
- Notices: admin create, members/admin view
- Complaints: member create, admin status update
- Maintenance/Payments: track dues and record payments
- RAG Assistant: upload PDF (admin), query assistant (authenticated)

## Project Structure

- `src/routes`
- `src/controllers`
- `src/services`
- `src/repositories`
- `src/utils`
- `src/config`
- `src/middlewares`

## Setup

1. Install dependencies

```bash
npm install
```

2. Configure environment

```bash
cp .env.example .env
```

### PostgreSQL (local dev)

This backend connects via `DATABASE_URL` (or `PG*` env vars) and will auto-create tables on startup.

1. Create a database (run with a superuser like `postgres`):

```bash
createdb society_management
```

2. Set a working connection string in `.env`:

```bash
DATABASE_URL=postgresql://postgres:<your_password>@127.0.0.1:5432/society_management
JWT_SECRET=<your-strong-secret>
```

If you see `password authentication failed`, double-check the username/password in `DATABASE_URL` (or use `PGHOST/PGUSER/PGDATABASE/PGPASSWORD` instead).

3. Start server

```bash
npm run dev
```

### RAG Notes

The RAG assistant uses Gemini when `GEMINI_API_KEY` is set. If it is missing or invalid, the backend falls back to a local embedding + extractive answer so the feature still works in development.

You can tune retrieval strictness with `RAG_MIN_SIMILARITY` (default: `0.35`). Higher values make the assistant ignore weak document matches and respond using general chat mode more often.

## API Endpoints

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`

### Users

- `GET /api/users` (admin)
- `GET /api/users/profile` (authenticated)
- `PATCH /api/users/profile` (authenticated)

### Notices

- `POST /api/notices` (admin)
- `GET /api/notices` (authenticated)

### Complaints

- `POST /api/complaints` (member)
- `GET /api/complaints/my` (member)
- `GET /api/complaints` (admin)
- `PATCH /api/complaints/:id/status` (admin)

### Maintenance / Payments

- `POST /api/maintenance/dues` (admin)
- `GET /api/maintenance` (admin)
- `GET /api/maintenance/my` (member)
- `POST /api/maintenance/:id/pay` (authenticated)

### RAG Assistant

- `POST /api/rag/upload` (admin)
- `POST /api/rag/query` (authenticated)

### Quick Seed (local dev)

Use the bundled PDF to seed embeddings:

```bash
node scripts/rag-seed.js
```

Or pass a custom PDF path:

```bash
node scripts/rag-seed.js /path/to/your.pdf
```

If no chunks exist yet, the backend will auto-seed from the first PDF found in `backend/test-data/` once on the first RAG query.
