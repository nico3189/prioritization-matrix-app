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
Brug kundeliste/team-liste/calendar events som sandhedskilder.
Delegation kun ved tydelig delegation-intent ("delegér til X", "bed X om", "send til X", "X skal …", "assign X"). "For Lukas" = Lukas i title/notes, ingen delegation.
Ingen opfundne datoer; ved usikkerhed brug needsMoreInfo.
"inden møde" → prøv at matche event i næste 14 dage; hvis match: dueAt=eventStart (0 offset). Hvis ikke match: reviewAt næste morgen kl 09 + needsMoreInfo.
Én inputtekst = én task.
Vigtighed vægtes højt for: delegation/skalering, kundeopfølgning før møder, nye kunder/salg.
nextAction skal være 1 konkret sætning.
Returnér kun gyldig JSON, ingen markdown.`

export async function parseSmartInput(input: ParserInput): Promise<ParserOutput> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
  const eventsStr = input.calendarEvents.length
    ? JSON.stringify(input.calendarEvents.slice(0, 50))
    : '[]'
  const userContent = `rawText: ${JSON.stringify(input.rawText)}
now: ${input.now}
timezone: ${input.timezone}
customerNames: ${JSON.stringify(input.customerNames)}
teamMemberNames: ${JSON.stringify(input.teamMemberNames)}
calendarEvents: ${eventsStr}

Return strict JSON with: title, type, durationBucket, customer, canDelegate, delegatedTo, linkedEventId, linkedEventType, dueAt, reviewAt, importance (0-100), urgency (0-100), quadrant (Q1-Q4), score, nextAction, needsMoreInfo, overallConfidence, suggestions (per field: value, confidence, evidence), matches (matchedCustomer, matchedEvent, matchScore).`

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
    return parserOutputSchema.parse(parsed) as ParserOutput
  } catch {
    return {}
  }
}
