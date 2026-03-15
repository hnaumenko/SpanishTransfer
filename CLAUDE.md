# SpanishTransfer — CLAUDE.md

Project context for Claude Code. Read this file before any work on the repository.

---

## What is this project

A Telegram bot `@SpanishMeBot` for systematic Spanish learning using the
Language Transfer method. Every day at a chosen time the bot sends a new lesson
plus an evening reminder to review the material. The course is 90 lessons —
one lesson per day.

**Target audience**: Ukrainian-speaking diaspora in Spain (~330,000 people),
developers who want to learn Spanish systematically.

**Core methodology**: Language Transfer (Michel Thomas method) — learning Spanish
by logically deriving it from English. No memorization, only pattern recognition.
Course content is in English; bot interface is in Ukrainian.

---

## Stack and technical decisions

### Bot (./bot/)
- **NestJS 10** — main framework
- **grammy** — Telegram Bot API (not telegraf, specifically grammy)
- **Prisma ORM** — database access
- **Supabase** — PostgreSQL hosting
- **@nestjs/schedule** — cron jobs
- **TypeScript strict mode** — required everywhere

### Scripts (./scripts/)
- **TypeScript + tsx** — one-off scripts, run via `npx tsx`
- **youtube-transcript** — extract transcripts from YouTube
- **@anthropic-ai/sdk** — Claude Batch API for generating message.md files
- **yt-dlp** (system binary) — audio download

### Infrastructure
- **Railway** — bot hosting (production)
- **Supabase** — PostgreSQL (free tier: 500MB)
- **GitHub** — lesson file storage (raw.githubusercontent.com URLs)

---

## Repository structure

```
SpanishTransfer/
├── CLAUDE.md                    ← this file
├── lessons/
│   ├── index.json               ← [{lesson: 1, videoId: "...", title: "..."}]
│   └── 001/
│       ├── message.md           ← ready Telegram message (Ukrainian)
│       └── audio.mp3            ← original audio from YouTube
├── scripts/
│   ├── fetch-playlist.ts        ← Phase 0, step 1
│   ├── generate-messages.ts     ← Phase 0, step 2
│   └── download-audio.ts        ← Phase 0, step 3
├── bot/
│   ├── src/
│   │   ├── main.ts
│   │   ├── app.module.ts
│   │   ├── prisma/
│   │   │   ├── prisma.module.ts
│   │   │   ├── prisma.service.ts
│   │   │   └── schema.prisma
│   │   ├── bot/
│   │   │   ├── bot.module.ts
│   │   │   ├── bot.service.ts   ← grammy instance + sendMessage()
│   │   │   └── bot.update.ts    ← commands: /start /lesson /progress /pause /resume /skip
│   │   ├── lessons/
│   │   │   ├── lessons.module.ts
│   │   │   └── lessons.service.ts ← getLessonMessage(n) from GitHub raw
│   │   └── scheduler/
│   │       ├── scheduler.module.ts
│   │       └── scheduler.service.ts ← 2 crons: 09:00 lesson, 20:00 reminder
│   ├── package.json
│   └── tsconfig.json
├── .env.example
└── package.json                 ← root, npm workspaces
```

---

## Development phases

### Phase 0 — Content generation (one-time only)
Scripts in ./scripts/ run once to prepare all 90 lessons.

```bash
npm run fetch-playlist      # → lessons/index.json
npm run generate-messages   # → lessons/NNN/message.md via Claude Batch API
npm run download-audio      # → lessons/NNN/audio.mp3 via yt-dlp
```

**Key detail**: Claude Batch API is 50% cheaper than regular API.
Poll every 15 seconds. If one lesson fails — log and continue, don't abort the batch.

### Phase 1 — Personal use bot
Single user (OWNER_TELEGRAM_ID). Polling mode. Local development.

```bash
cd bot
npm install
npx prisma migrate dev
npm run start:dev
```

### Phase 2 — Public release + Railway deploy
Onboarding with delivery time selection, inline buttons after lessons,
weekly report, webhook mode for production, GitHub Actions → Railway.

---

## Prisma schema (current)

```prisma
model User {
  id            Int       @id @default(autoincrement())
  telegramId    BigInt    @unique
  currentLesson Int       @default(1)
  streak        Int       @default(0)
  lastLessonAt  DateTime?
  deliveryHour  Int       @default(9)
  timezone      String    @default("Europe/Madrid")
  isActive      Boolean   @default(true)
  createdAt     DateTime  @default(now())
  completions   LessonCompletion[]
}

model LessonCompletion {
  id           Int      @id @default(autoincrement())
  telegramId   BigInt
  lessonNumber Int
  completedAt  DateTime @default(now())

  @@unique([telegramId, lessonNumber])
}
```

---

## Environment variables

```bash
# Telegram
BOT_TOKEN=                    # @SpanishMeBot token from @BotFather
OWNER_TELEGRAM_ID=            # your Telegram ID (Phase 1)

# Database
DATABASE_URL=                 # Supabase connection string (postgresql://...)

# Content
GITHUB_RAW_BASE=https://raw.githubusercontent.com/USERNAME/SpanishTransfer/main
YOUTUBE_PLAYLIST_URL=         # Language Transfer playlist URL on YouTube

# AI
ANTHROPIC_API_KEY=            # for content generation scripts

# Production (Phase 2)
NODE_ENV=production
WEBHOOK_URL=                  # https://YOUR-APP.railway.app
```

---

## Technical decisions

| Decision | Alternative | Reason |
|---|---|---|
| grammy | telegraf | Newer, better TypeScript types, actively maintained |
| Supabase | Local PostgreSQL | Free hosted DB, Prisma connects directly |
| GitHub raw URLs for .md | S3/R2 | Simple, versioned via git, free |
| Claude Batch API | Regular Claude API | 50% cheaper, no rate limit management needed |
| youtube-transcript | Whisper API | Free, Language Transfer already has YouTube captions |
| Railway | Heroku/Render | Simple Dockerfile deploy, reasonable pricing |
| NestJS | Plain Node.js | Familiar stack (also used in Pathfinder), DI, modules, schedule |
| No N8N | N8N | 10 years TypeScript experience — code > visual workflows |

---

## Telegram message format (message.md)

Each `lessons/NNN/message.md` is a ready-to-send Telegram message in Ukrainian.
Format: Telegram MarkdownV2, max 900 characters.

```
🇪🇸 *Урок N — Language Transfer*

*Головна ідея:*
(1 sentence)

*Нові конструкції:*
• construction — translation

*Запам'ятай:*
(key pattern of the lesson)

*Приклад:*
_in Spanish_ — in Ukrainian
```

The bot reads this file and sends it as-is. No runtime generation.

---

## Bot commands (UI in Ukrainian)

| Command | Action |
|---|---|
| /start | Register + welcome message + lesson 1 |
| /lesson | Send current lesson |
| /progress | Lesson N of 90, streak, start date |
| /pause | Stop delivery (isActive = false) |
| /resume | Resume delivery |
| /skip | Skip current lesson (currentLesson + 1) |

---

## Cron jobs

| Job | Time | Action |
|---|---|---|
| Morning lesson | 09:00 Europe/Madrid | Send currentLesson to all active users |
| Evening reminder | 20:00 Europe/Madrid | Remind to review today's material |
| Weekly report (Phase 2) | Sun 18:00 Europe/Madrid | Weekly stats summary |

---

## Claude Code prompts per phase

### Phase 0

```
You are working on the SpanishTransfer project. Read CLAUDE.md first.

Create TypeScript scripts in /scripts/ to generate content for the
Language Transfer Spanish course (90 lessons).

Stack: youtube-transcript, @anthropic-ai/sdk (Batch API), yt-dlp via execSync, tsx.

Scripts to create:

1. fetch-playlist.ts
   Extract all video IDs from YouTube playlist (YOUTUBE_PLAYLIST_URL from .env)
   using: yt-dlp --flat-playlist -J "URL"
   Save to lessons/index.json: [{lesson: 1, videoId: "...", title: "..."}]

2. generate-messages.ts
   For each video: fetch English transcript via youtube-transcript package.
   Send all 90 as ONE Claude Batch API request (not 90 separate calls).
   Poll status every 15 seconds, log progress.
   Save each result to lessons/NNN/message.md (padStart 3 zeros).
   If one lesson fails — log and continue, never abort the whole batch.
   
   Prompt per lesson:
   "You are a Language Transfer Spanish course assistant.
    Analyze the transcript of lesson {N} and create a Telegram message in Ukrainian.
    Rules: Telegram MarkdownV2 format, max 900 characters,
    extract insight not raw transcript, address the learner as 'ти'.
    
    Format:
    🇪🇸 *Урок {N} — Language Transfer*
    
    *Головна ідея:*
    (1 sentence)
    
    *Нові конструкції:*
    • construction — translation
    
    *Запам'ятай:*
    (key pattern)
    
    *Приклад:*
    _in Spanish_ — in Ukrainian
    
    Transcript: {text}"

3. download-audio.ts
   For each video in index.json, download audio via yt-dlp:
   yt-dlp -x --audio-format mp3 -o "lessons/NNN/audio.mp3" "URL"
   Skip if file already exists. Add 2s delay between downloads.

Add to root package.json scripts:
  "fetch-playlist", "generate-messages", "download-audio"

Requirements:
- TypeScript strict mode
- Progress logging with emoji at every step
- Error handling per item (not global abort)
- Final summary: X succeeded / Y failed
- README.md with run order
```

### Phase 1

```
You are working on the SpanishTransfer project. Read CLAUDE.md first.

Create a Telegram bot in /bot/ using NestJS + grammy + Prisma + Supabase.
Phase 0 is complete: lessons/index.json and lessons/NNN/message.md exist.

The bot reads lesson files from GitHub raw URLs — NOT from local filesystem:
  ${GITHUB_RAW_BASE}/lessons/${padded}/message.md

Modules to create:

PrismaModule
  Standard NestJS Prisma service. Use schema from CLAUDE.md exactly as written.

LessonsModule
  getLessonMessage(lessonNumber: number): Promise<string>
  Fetches from GITHUB_RAW_BASE env var. Pads lesson number to 3 digits.
  getTotalLessons(): number → 90

BotModule
  Initialize grammy Bot in polling mode.
  Export sendMessage(telegramId: bigint, text: string, parseMode?: string): Promise<void>
  Used by SchedulerModule to push messages to users.

BotUpdate (grammy command handlers)
  All user-facing text in Ukrainian.
  /start → if new user: create in DB. Send welcome + lesson 1.
  /lesson → send user's currentLesson
  /progress → "📊 Твій прогрес:\n📍 Урок: {N} з 90\n🔥 Streak: {N} днів\n📅 Розпочато: {date}"
  /pause → isActive=false, confirm message
  /resume → isActive=true, confirm message
  /skip → currentLesson+1, confirm message

SchedulerModule (two @Cron jobs, timezone: Europe/Madrid)
  09:00 → find all active users, send currentLesson, increment currentLesson+1,
           streak+1, set lastLessonAt=now. If currentLesson > 90: send completion message.
  20:00 → find active users where lastLessonAt is today,
           send: "🔄 Нагадування\n\nСьогодні був урок {N}. Повтори ключові конструкції перед сном 💪"

Requirements:
- TypeScript strict, no any
- NestJS Logger everywhere (not console.log)
- Graceful shutdown (app.enableShutdownHooks())
- Polling mode only (no webhook in Phase 1)
- README: npm install, npx prisma migrate dev, npm run start:dev
```

### Phase 2

```
You are working on the SpanishTransfer project. Read CLAUDE.md first.
Phase 1 is complete and working locally for a single user.

Extend the existing bot/ with the following additions:

1. Onboarding flow (update /start in bot.update.ts)
   New users go through 3 steps:
   Step 1: welcome message explaining the course
   Step 2: InlineKeyboard to pick delivery time:
     [🌅 07:00] [☀️ 08:00] [🌤 09:00]
     [🕙 10:00] [🌞 11:00] [🕛 12:00]
   Step 3: save deliveryHour to DB → send lesson 1

2. Inline keyboard after every lesson (update sendLesson logic)
   Attach InlineKeyboard to every lesson message:
     [✅ Зрозумів] [🔄 Нагадай ввечері] [⏭ Далі]
   Callbacks:
   - lesson_done:{N} → streak+1, motivational reply
   - lesson_remind:{N} → schedule one-off reminder at 21:00 that day
   - lesson_next:{N} → immediately send next lesson

3. Weekly report cron (Sunday 18:00 Europe/Madrid)
   Send to all active users:
   "📊 Твій тиждень
   
   Уроків пройдено: {N}
   🔥 Streak: {N} днів
   📍 Урок {current} з 90
   ⏱ До кінця: ~{weeks} тижнів
   
   {motivation based on streak: <3 days / 3-7 days / >7 days}"

4. Dynamic hourly scheduler
   Replace fixed 09:00 cron with '0 * * * *' (every hour).
   Find users where deliveryHour equals current hour in Europe/Madrid timezone.

5. Webhook mode for production
   In bot.service.ts:
   if NODE_ENV=production → use webhookCallback() + setWebhook(WEBHOOK_URL + '/bot')
   if NODE_ENV=development → startPolling()

6. Health endpoint
   GET /health → { status: 'ok', uptime: process.uptime() }

7. Railway deployment files
   bot/Dockerfile: Node 20 alpine, npm ci --only=production, 
     npx prisma generate, npm run build, CMD node dist/main.js
   railway.toml: dockerfile builder, healthcheckPath /health, restart on-failure
   .github/workflows/deploy.yml: deploy to Railway on push to main

8. Rate limiting
   Add grammy-ratelimiter middleware to bot.service.ts.

Update Prisma schema with deliveryHour field and LessonCompletion model
exactly as shown in CLAUDE.md.
```

---

## Product context

### Why Language Transfer + Ukrainian
- Phonetic similarity: Ukrainian and Spanish share open vowels, similar rhythm
  and syllable structure — linguistics researchers note striking similarities
- Both are phonetic languages (spelling matches pronunciation, unlike English)
- Grammatical similarity: grammatical gender, rich verb conjugation system
- 330,000+ Ukrainians in Spain need Spanish for daily life and integration
- Zero competitors in "Spanish for Ukrainians on Telegram" niche

### Language Transfer methodology
- 90 free audio lessons on YouTube, 1M+ users worldwide
- Student derives Spanish from English through transformation rules
- Example: English words ending in -tion → Spanish -ción (nation → nación)
- Pattern recognition, not memorization — ideal for developer mindset
- Course content in English, but linguistic advantages transfer from Ukrainian too:
  Ukrainian and Spanish share phonetics and grammatical gender logic

### Monetization (Phase 2+)
- Lessons 1–7 free (one full week)
- Full course (lessons 8–90): one-time payment ~€19–29
- Payment via Telegram Stars (native to Telegram, no external gateway)
- At 10,000 users with 5% conversion at €24: ~€12,000 total revenue

### LinkedIn / portfolio positioning
- Demonstrates: NestJS + grammy production bot, Claude Batch API pipeline,
  AI content generation at scale, Railway deployment, TypeScript strict codebase
- Key differentiator: real product solving real problem for real audience
- Good headline: "Senior TypeScript Engineer → AI Engineer | NestJS · MCP · Agentic AI"

---

## Development rules

- All code — TypeScript strict mode, no `any`
- Logging — NestJS Logger in bot/, console.log with emoji in scripts/
- Error handling — catch + log + continue (never abort the entire process)
- Content — no runtime AI generation, only read pre-generated .md files
- Mode — polling for development, webhook for production (check NODE_ENV)
- Bot UI text — always in Ukrainian
- Code, comments, variable names — English
