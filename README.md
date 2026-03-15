# SpanishTransfer

Telegram bot `@SpanishMeBot` — daily Spanish lessons via the Language Transfer method for Ukrainian speakers.

## Quick start

### Phase 0 — Generate content (one-time)

```bash
# Prerequisites
brew install yt-dlp

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Fill in YOUTUBE_PLAYLIST_URL and ANTHROPIC_API_KEY

# Run in order:
npm run fetch-playlist      # → lessons/index.json
npm run generate-messages   # → lessons/NNN/message.md
npm run download-audio      # → lessons/NNN/audio.mp3
```

### Phase 1 — Run the bot locally

```bash
cd bot
npm install
cp .env.example .env   # fill in BOT_TOKEN, DATABASE_URL, GITHUB_RAW_BASE
npx prisma migrate dev
npm run start:dev
```

## Repository structure

```
SpanishTransfer/
├── lessons/
│   ├── index.json          ← [{lesson, videoId, title}]
│   └── 001/
│       ├── message.md      ← Telegram MarkdownV2 message (Ukrainian)
│       └── audio.mp3       ← original audio from YouTube
├── scripts/
│   ├── fetch-playlist.ts   ← Phase 0, step 1
│   ├── generate-messages.ts ← Phase 0, step 2 (Claude Batch API)
│   └── download-audio.ts   ← Phase 0, step 3
└── bot/                    ← NestJS + grammy Telegram bot
```

## Environment variables

| Variable | Used by | Description |
|---|---|---|
| `YOUTUBE_PLAYLIST_URL` | scripts | Language Transfer playlist URL |
| `ANTHROPIC_API_KEY` | scripts | Claude API key for Batch API |
| `BOT_TOKEN` | bot | Telegram bot token from @BotFather |
| `DATABASE_URL` | bot | Supabase PostgreSQL connection string |
| `GITHUB_RAW_BASE` | bot | Raw GitHub URL for lesson content |
