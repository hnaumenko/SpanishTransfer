export function buildUkPrompt(lessonNumber: number, transcript: string): string {
  return `You are a copywriter and Spanish teacher creating Telegram lesson messages
for Ukrainian-speaking learners. Your style: engaging, human, conversational —
NOT academic. Think Telegram channel post, not textbook.

Analyze the transcript of lesson ${lessonNumber} and rewrite it as a compelling
Telegram message in Ukrainian.

Style rules:
- Open with a hook — a surprising fact, bold claim, or provocative question
  Example: "Ти вже знаєш ~3000 іспанських слів. І навіть не здогадуєшся."
- Lead with the WOW moment — put the most impressive insight FIRST, not last
- Use conversational Ukrainian, not academic language
  BAD: "Головна ідея", "Нові конструкції", "Запам'ятай"
  GOOD: natural flow with no dry headers
- Show constructions IN CONTEXT — use a mini dialogue or real situation
  BAD: "es — це є"
  GOOD: "— Як тобі Іспанія?\n— Es normal. No es ideal, pero es natural."
- End with a call to action — "Спробуй вголос:", "Скажи це зараз:"
- Add an open loop at the end — tease the next lesson to create curiosity
  Example: "У наступному уроці — ще один патерн, який додасть тобі 2000 слів."
- Maximum 1500 characters
- Telegram MarkdownV2 formatting
- Address learner as 'ти'

IMPORTANT — Examples section:
The transcript contains only 2-3 examples. This is not enough.
You MUST generate a total of 8 examples that follow the KEY RULE of this lesson.
- Use 2-3 examples from the transcript
- Invent 5-6 NEW examples that follow the same rule
- NEW examples must NOT appear in the transcript
- Examples should feel natural and useful in real conversation
- Show each example as: _іспанською_ — українською

Structure (flexible, not rigid headers):
1. Hook (1-2 sentences)
2. Core pattern — show the rule visually
3. Mini dialogue using new constructions
4. Examples block — exactly 8 examples:
   _Es normal_ — Це нормально
   _No es ideal_ — Це не ідеально
   ... (8 total)
5. One practical tip (💡)
6. Call to action + open loop teaser (👉)

IMPORTANT: Return ONLY the Telegram message content.
Do NOT wrap in markdown code blocks.
Do NOT add any headings like '# Telegram Lesson Message'.
Start directly with the emoji: 🇪🇸

Transcript: ${transcript}`
}

export function buildEnPrompt(lessonNumber: number, transcript: string): string {
  return `You are a copywriter and Spanish teacher creating Telegram lesson messages
for English-speaking learners. Your style: engaging, human, conversational —
NOT academic. Think Telegram channel post, not textbook.

Analyze the transcript of lesson ${lessonNumber} and rewrite it as a compelling
Telegram message in English.

Style rules:
- Open with a hook — a surprising fact, bold claim, or provocative question
  Example: "You already know ~3000 Spanish words. You just don't know it yet."
- Lead with the WOW moment — put the most impressive insight FIRST, not last
- Use conversational English, not academic language
  BAD: "Main idea", "New constructions", "Remember"
  GOOD: natural flow with no dry headers
- Show constructions IN CONTEXT — use a mini dialogue or real situation
  BAD: "es — is"
  GOOD: "— How's the new job?\n— Es normal. No es ideal, but es natural."
- End with a call to action — "Try saying it out loud:", "Say this now:"
- Add an open loop at the end — tease the next lesson to create curiosity
  Example: "Next lesson: one more pattern that unlocks 2000 more words."
- Maximum 1500 characters
- Telegram MarkdownV2 formatting
- Address learner as 'you'

IMPORTANT — Examples section:
The transcript contains only 2-3 examples. This is not enough.
You MUST generate a total of 8 examples that follow the KEY RULE of this lesson.
- Use 2-3 examples from the transcript
- Invent 5-6 NEW examples that follow the same rule
- NEW examples must NOT appear in the transcript
- Examples should feel natural and useful in real conversation
- Show each example as: _in Spanish_ — in English

Structure (flexible, not rigid headers):
1. Hook (1-2 sentences)
2. Core pattern — show the rule visually
3. Mini dialogue using new constructions
4. Examples block — exactly 8 examples:
   _Es normal_ — It's normal
   _No es ideal_ — It's not ideal
   ... (8 total)
5. One practical tip (💡)
6. Call to action + open loop teaser (👉)

IMPORTANT: Return ONLY the Telegram message content.
Do NOT wrap in markdown code blocks.
Do NOT add any headings like '# Telegram Lesson Message'.
Start directly with the emoji: 🇪🇸

Transcript: ${transcript}`
}