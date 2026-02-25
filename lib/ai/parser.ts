import { z } from 'zod'
import OpenAI from 'openai'
import { DurationBucket, TaskType } from '@prisma/client'

const parserOutputSchema = z.object({
  suggestions: z.record(z.object({
    value: z.unknown(),
    confidence: z.number().min(0).max(1).optional(),
    evidence: z.string().optional(),
  })).optional(),
  matches: z.object({
    matchedCustomer: z.string().optional(),
    matchedEvent: z.string().optional(),
    matchScore: z.number().optional(),
  }).optional(),
  needsMoreInfo: z.array(z.string()).optional(),
  overallConfidence: z.number().min(0).max(1).optional(),
  title: z.string().optional(),
  customer: z.string().optional().nullable(),
  type: z.nativeEnum(TaskType).optional().nullable(),
  durationBucket: z.nativeEnum(DurationBucket).optional().nullable(),
  canDelegate: z.boolean().optional(),
  delegatedTo: z.string().optional().nullable(),
  linkedEventId: z.string().optional().nullable(),
  linkedEventType: z.enum(['prep', 'followup']).optional().nullable(),
  dueAt: z.string().optional().nullable(),
  reviewAt: z.string().optional().nullable(),
  importance: z.number().min(0).max(100).optional(),
  urgency: z.number().min(0).max(100).optional(),
  quadrant: z.enum(['Q1', 'Q2', 'Q3', 'Q4']).optional(),
  score: z.number().optional(),
  nextAction: z.string().optional().nullable(),
})

export type ParserOutput = z.infer<typeof parserOutputSchema>

export interface ParserInput {
  rawText: string
  now: string
  timezone: string
  customerNames: string[]
  teamMemberNames: string[]
  calendarEvents: Array<{ id: string; title: string; startAt: string; endAt: string }>
}

const SYSTEM_PROMPT = `Du er en parsing- og prioriteringsassistent til en Eisenhower todo-app.
Returnér STRICT JSON efter det definerede schema.

Titel vs beskrivelse: Brugerens fulde indtastning (rawText) gemmes som BESKRIVELSE. "title" skal være ÉN kort, præcise handling – som en overskrift (maks 5-10 ord). Titlen må ikke gentage hele beskrivelsen; den skal være den konkrete handling (fx "Forbered noter til møde med Vardeengroslager" i stedet for den lange sætning med dato og varighed).

Brug kundeliste/team-liste/calendar events som sandhedskilder.
Delegation kun ved tydelig delegation-intent ("delegér til X", "bed X om", "send til X", "X skal …", "assign X"). "For Lukas" = Lukas i title/notes, ingen delegation.
Ingen opfundne datoer; ved usikkerhed brug needsMoreInfo.
"inden møde" → prøv at matche event i næste 14 dage; hvis match: dueAt=eventStart (0 offset). Hvis ikke match: reviewAt næste morgen kl 09 + needsMoreInfo.
Én inputtekst = én task.
Vigtighed vægtes højt for: delegation/skalering, kundeopfølgning før møder, nye kunder/salg.
nextAction skal være 1 konkret sætning.
durationBucket SKAL være én af: LT15, M15_30, M30_60, GT60 (brug M30_60 for "ca 30-45 min", GT60 for over 1 time).
Returnér kun gyldig JSON, ingen markdown.`

export async function parseSmartInput(input: ParserInput): Promise<ParserOutput> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('OPENAI_API_KEY er ikke sat. Tilføj den i Heroku Config Vars.')
  }
  const openai = new OpenAI({ apiKey })
  const eventsStr = input.calendarEvents.length
    ? JSON.stringify(input.calendarEvents.slice(0, 50))
    : '[]'
  const userContent = `rawText: ${JSON.stringify(input.rawText)}
now: ${input.now}
timezone: ${input.timezone}
customerNames: ${JSON.stringify(input.customerNames)}
teamMemberNames: ${JSON.stringify(input.teamMemberNames)}
calendarEvents: ${eventsStr}

Return strict JSON with: title (kun kort præcis handling, 1 linje), type, durationBucket (only: LT15 | M15_30 | M30_60 | GT60), customer, canDelegate, delegatedTo, linkedEventId, linkedEventType, dueAt (ISO), reviewAt (ISO), importance (0-100), urgency (0-100), quadrant (Q1-Q4), score, nextAction, needsMoreInfo, overallConfidence, suggestions, matches.`

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.2,
  })
  const raw = completion.choices[0]?.message?.content
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    const parsedSchema = parserOutputSchema.safeParse(parsed)
    if (parsedSchema.success) return parsedSchema.data as ParserOutput
    const obj = parsed as Record<string, unknown>
    const durationBuckets = ['LT15', 'M15_30', 'M30_60', 'GT60'] as const
    const safe: ParserOutput = {}
    if (typeof obj.title === 'string') safe.title = obj.title
    if (typeof obj.customer === 'string' || obj.customer === null) safe.customer = obj.customer
    if (typeof obj.delegatedTo === 'string' || obj.delegatedTo === null) safe.delegatedTo = obj.delegatedTo
    if (durationBuckets.includes(obj.durationBucket as (typeof durationBuckets)[number])) {
      safe.durationBucket = obj.durationBucket as DurationBucket
    }
    if (typeof obj.importance === 'number' && obj.importance >= 0 && obj.importance <= 100) safe.importance = obj.importance
    if (typeof obj.urgency === 'number' && obj.urgency >= 0 && obj.urgency <= 100) safe.urgency = obj.urgency
    if (typeof obj.nextAction === 'string' || obj.nextAction === null) safe.nextAction = obj.nextAction
    if (typeof obj.dueAt === 'string' || obj.dueAt === null) safe.dueAt = obj.dueAt
    if (typeof obj.reviewAt === 'string' || obj.reviewAt === null) safe.reviewAt = obj.reviewAt
    if (typeof obj.type === 'string' && ['kunde', 'internt', 'salg', 'privat'].includes(obj.type)) safe.type = obj.type as TaskType
    if (typeof obj.canDelegate === 'boolean') safe.canDelegate = obj.canDelegate
    return safe
  } catch {
    return {}
  }
}
