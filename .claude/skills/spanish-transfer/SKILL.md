---
name: spanish-transfer
description: >
  Skill for building and maintaining the SpanishTransfer Telegram bot project.
  Use this skill whenever working on @SpanishMeBot, the SpanishTransfer GitHub repo,
  or any task involving: NestJS Telegram bots with grammy, YouTube transcript
  pipelines, Claude Batch API for content generation, Supabase + Prisma setup,
  Railway deployment, or Ukrainian-language Telegram bot development.
  Also triggers for: generating lesson messages, writing cron schedulers,
  setting up bot commands, Railway Dockerfiles, or any Phase 0/1/2 development
  tasks described in CLAUDE.md.
---

# SpanishTransfer Skill

You are working on SpanishTransfer — a Telegram bot `@SpanishMeBot`
for learning Spanish via the Language Transfer method.

Always read `CLAUDE.md` in the repo root before starting any task.
It contains the current project state, DB schema, env vars, and all decisions.

---

## Project in one sentence

The bot delivers daily Spanish lessons (Language Transfer, 90 lessons)
to a Ukrainian-speaking audience. Content is generated once via scripts,
the bot only delivers pre-generated markdown files.

---

## Stack (do not change without a reason)

```
Bot:     NestJS + grammy + Prisma + Supabase + @nestjs/schedule
Scripts: TypeScript + tsx + youtube-transcript + @anthropic-ai/sdk + yt-dlp
Hosting: Railway (production) / local (development)
Storage: GitHub raw URLs for lessons/, Supabase for user state
```

---

## Phases overview

### Phase 0 — scripts/ (one-time)
1. `fetch-playlist.ts` → `lessons/index.json`
2. `generate-messages.ts` → `lessons/NNN/message.md` via Claude Batch API
3. `download-audio.ts` → `lessons/NNN/audio.mp3` via yt-dlp

### Phase 1 — bot/ (personal use)
- grammy polling mode
- 2 crons: 09:00 lesson, 20:00 reminder (Europe/Madrid)
- Commands: /start /lesson /progress /pause /resume /skip
- Single user via OWNER_TELEGRAM_ID

### Phase 2 — bot/ (public release)
- Onboarding with delivery time picker (inline keyboard)
- Inline buttons after every lesson: ✅ Done / 🔄 Remind / ⏭ Next
- Weekly report (Sunday 18:00)
- Webhook mode for production
- Railway deploy + GitHub Actions

---

## Critical implementation details

### lessons.service.ts — always fetch from GitHub, never local
```typescript
const padded = String(lessonNumber).padStart(3, '0')
const url = `${process.env.GITHUB_RAW_BASE}/lessons/${padded}/message.md`
const response = await fetch(url)
return response.text()
```

### Claude Batch API pattern (generate-messages.ts)
```typescript
// Send all 90 as ONE batch, not 90 separate calls
const batch = await client.messages.batches.create({ requests })

// Poll every 15 seconds
while (status.processing_status !== 'ended') {
  await new Promise(r => setTimeout(r, 15_000))
  status = await client.messages.batches.retrieve(batch.id)
  console.log(`⏳ ${status.request_counts.succeeded}/90 done`)
}

// Per-item error handling — never abort the whole batch
for await (const result of await client.messages.batches.results(batch.id)) {
  if (result.result.type !== 'succeeded') {
    console.error(`❌ Failed: ${result.custom_id}`)
    continue  // log and move on
  }
  // save to lessons/NNN/message.md
}
```

### grammy + NestJS — bot.service.ts pattern
```typescript
@Injectable()
export class BotService implements OnModuleInit {
  private bot: Bot

  onModuleInit() {
    this.bot = new Bot(process.env.BOT_TOKEN)
    // attach updates handler from BotUpdate
    this.bot.start() // polling in dev
  }

  async sendMessage(telegramId: bigint, text: string): Promise<void> {
    await this.bot.api.sendMessage(Number(telegramId), text, {
      parse_mode: 'MarkdownV2'
    })
  }
}
```

### Cron with explicit timezone
```typescript
@Cron('0 9 * * *', { timeZone: 'Europe/Madrid' })
async sendMorningLesson(): Promise<void> { ... }
```

### Polling vs Webhook switch
```typescript
if (process.env.NODE_ENV === 'production') {
  await this.bot.api.setWebhook(process.env.WEBHOOK_URL + '/bot')
} else {
  this.bot.start() // polling
}
```

---

## Telegram message format

Every `lessons/NNN/message.md` uses Telegram MarkdownV2, max 900 characters:

```
🇪🇸 *Урок N — Language Transfer*

*Головна ідея:*
(1 sentence in Ukrainian)

*Нові конструкції:*
• construction — translation

*Запам'ятай:*
(key pattern of the lesson)

*Приклад:*
_in Spanish_ — in Ukrainian
```

---

## Prisma schema (use exactly as written)

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

## Rules — always follow these

1. **Bot UI text** — Ukrainian only, no exceptions
2. **Code, comments, variables** — English
3. **TypeScript strict** — required, no `any`
4. **Logging** — NestJS Logger in bot/, console.log with emoji in scripts/
5. **Error handling** — catch + log + continue, never abort the whole process
6. **No runtime generation** — bot only reads pre-generated .md files
7. **Mode** — polling for dev, webhook for production (NODE_ENV check)

---

## Quick reference — npm packages

```bash
# Scripts
npm install @anthropic-ai/sdk youtube-transcript
npm install -D tsx typescript @types/node

# Bot
npm install @nestjs/common @nestjs/core @nestjs/schedule
npm install grammy grammy-ratelimiter
npm install @prisma/client
npm install -D prisma

# Useful binaries (install system-level)
brew install yt-dlp   # or: pip install yt-dlp
```

---

## Product context (for understanding decisions)

- **Niche**: Spanish for Ukrainians in Spain — zero competitors on Telegram
- **Audience**: 330,000+ Ukrainians in Spain, active Telegram communities
- **Method**: Language Transfer — derive Spanish from English via rules, not memorization
- **Monetization**: lessons 1-7 free, full course ~€19-29 via Telegram Stars
- **Portfolio signal**: real product + NestJS + Claude Batch API + Railway = strong LinkedIn story
