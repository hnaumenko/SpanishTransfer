# SpanishTransfer Bot

Telegram bot `@SpanishMeBot` — daily Spanish lessons via Language Transfer method for Ukrainian speakers.

## Setup

### 1. Install dependencies

```bash
cd bot
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in `.env`:

| Variable | Description |
|---|---|
| `BOT_TOKEN` | Telegram bot token from @BotFather |
| `OWNER_TELEGRAM_ID` | Your Telegram user ID |
| `DATABASE_URL` | Supabase PostgreSQL connection string |
| `GITHUB_RAW_BASE` | Raw GitHub URL to repo root (e.g. `https://raw.githubusercontent.com/USERNAME/SpanishTransfer/main`) |

### 3. Run database migrations

```bash
npx prisma migrate dev
```

### 4. Start in development mode

```bash
npm run start:dev
```

## Bot commands

| Command | Description |
|---|---|
| `/start` | Register and receive lesson 1 |
| `/lesson` | Get current lesson |
| `/progress` | View streak and progress |
| `/pause` | Pause daily delivery |
| `/resume` | Resume delivery |
| `/skip` | Skip to next lesson |

## Architecture

- **NestJS** — app framework with dependency injection
- **grammy** — Telegram Bot API (polling mode in Phase 1)
- **Prisma** — database ORM
- **Supabase** — PostgreSQL hosting
- **@nestjs/schedule** — cron jobs (09:00 lesson, 20:00 reminder, Europe/Madrid timezone)
- Lesson content fetched from GitHub raw URLs — never from local filesystem
