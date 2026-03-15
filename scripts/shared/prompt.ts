export function buildUkPrompt(lessonNumber: number, transcript: string): string {
  return `You are a Language Transfer Spanish course assistant.
Analyze the transcript of lesson ${lessonNumber} and create a Telegram message in Ukrainian.

Rules:
- Telegram MarkdownV2 formatting
- Maximum 1200 characters
- Extract insight, do not retell the transcript word by word
- Address the learner as 'ти'
- Focus on what is NEW in this specific lesson

Format (use exactly):
🇪🇸 *Урок ${lessonNumber} — Spanish Transfer*

*Головна ідея:*
(1 sentence)

*Нові конструкції:*
- construction — translation and brief explanation

*Запам'ятай:*
(key pattern or rule of this lesson)

*Приклад:*
_best example from the lesson_ — translation

💡 (one practical tip or observation)

/приклади_${lessonNumber}

Transcript: ${transcript}`;
}

export function buildEnPrompt(lessonNumber: number, transcript: string): string {
  return `You are a Language Transfer Spanish course assistant.
Analyze the transcript of lesson ${lessonNumber} and create a Telegram message in English.

Rules:
- Telegram MarkdownV2 formatting
- Maximum 1200 characters
- Extract insight, do not retell the transcript word by word
- Address the learner as 'you'
- Focus on what is NEW in this specific lesson

Format (use exactly):
🇪🇸 *Lesson ${lessonNumber} — Language Transfer*

*Main idea:*
(1 sentence)

*New constructions:*
- construction — translation and brief explanation

*Remember:*
(key pattern or rule of this lesson)

*Example:*
_best example from the lesson_ — in English

💡 (one practical tip)

/examples_${lessonNumber}

Transcript: ${transcript}`;
}

export function buildExamplesPrompt(lessonNumber: number, transcript: string): string {
  return `You are a Language Transfer Spanish course assistant.
Based on this transcript of lesson ${lessonNumber}, generate 8 ADDITIONAL practice examples.

Critical rules:
- Identify the KEY RULE or PATTERN taught in this lesson
- Generate NEW words/phrases that follow the SAME rule
- Do NOT use any examples that already appear in the transcript
- Examples must be words a student could figure out themselves using the rule
- Keep it simple — only use constructions taught up to this lesson

IMPORTANT: Every item MUST have exactly 4 fields: "es", "uk", "en", "note"
- "es" — Spanish phrase
- "uk" — Ukrainian translation (REQUIRED, do not skip)
- "en" — English translation
- "note" — pronunciation or grammar hint

Return ONLY a valid JSON array, no markdown, no explanation, no code blocks:
[
  {
    "es": "Es criminal",
    "uk": "Це кримінально",
    "en": "It's criminal",
    "note": "criminal → criminal (stress: crimi-NAL)"
  },
  {
    "es": "No es brutal",
    "uk": "Це не брутально",
    "en": "It's not brutal",
    "note": "brutal → brutal (stress: bru-TAL)"
  }
]

All 8 items must follow this exact structure. Missing "uk" field is an error.

Transcript: ${transcript}`;
}
