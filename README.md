# sysadmin-login-docker

Flag guessing game with user registration/login, per-session scoring, and a shared leaderboard. Built with Express + EJS, PostgreSQL, and Docker so it can be demonstrated locally or in containers for the Systems Administration course project.

## Features
- **Secure auth flow** – bcrypt-hashed credentials, validation, and session management with `express-session` + `connect-pg-simple`.
- **Flag quiz gameplay** – random flag prompts with running score, streak tracking, and graceful game-over screen when a guess is wrong.
- **Persistent leaderboard** – aggregates each user’s best streak, total correct guesses, and accuracy.
- **Docker-ready** – containerized Node.js runtime with production dependencies only.

## Requirements
- Node.js 18+ and npm (for local development)
- PostgreSQL 13+ instance reachable from the app/container
- `DATABASE_URL`, `SESSION_SECRET`, optional `PORT`, and `COOKIE_SECURE` environment variables

## Environment variables
Copy `.env.example` to `.env` and replace the placeholder values (never commit real secrets):

```ini
DATABASE_URL=postgres://username:password@host:5432/flagquiz
SESSION_SECRET=change-me
PORT=3000
COOKIE_SECURE=false
```

## Database quick start
Minimum schema expected by the app:

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL
);

CREATE TABLE flags (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  flag TEXT NOT NULL  -- Unicode flag emoji or similar representation
);

CREATE TABLE flag_highscores (
  user_id INTEGER PRIMARY KEY REFERENCES users(id),
  highest_streak INTEGER DEFAULT 0,
  total_correct INTEGER DEFAULT 0,
  total_attempts INTEGER DEFAULT 0,
  last_played TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_sessions (
  sid TEXT PRIMARY KEY,
  sess JSON NOT NULL,
  expire TIMESTAMPTZ NOT NULL
);
```

Populate the `flags` table with any dataset you want to quiz against.

## Run locally
```bash
npm install
node index.js
# or set PORT explicitly:
PORT=4000 node index.js
```

Visit `http://localhost:3000` (or your chosen `PORT`) to use the app.

## Docker
### Single-container (app only)
1. Build the image (from repo root):
   ```bash
   docker build -t flag-quiz .
   ```
2. Run the container, providing the same environment variables (either via `--env-file` or `-e` flags) and mapping the port:
   ```bash
   docker run --env-file .env -p 3000:3000 flag-quiz
   ```
   Ensure the `DATABASE_URL` inside `.env` points to a reachable PostgreSQL instance/host.

### Docker Compose (app + Postgres)
1. Copy `.env.example` to `.env` and set:
   - `SESSION_SECRET` to a random string.
   - `POSTGRES_PASSWORD` (and optionally user/db names).
   - `DATABASE_URL` for local (host) usage; Compose overrides it inside the container.
2. Launch both services:
   ```bash
   docker compose up --build
   ```
   The Express app will be available at `http://localhost:${PORT:-3000}`.
3. Common maintenance commands:
   ```bash
   docker compose logs -f app           # follow app logs
   docker compose down                  # stop containers
   docker compose down -v               # stop and remove the pgdata volume
   ```
