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
  importance: z.number().min(0).max(100).optional(),
  urgency: z.number().min(0).max(100).optional(),
  quadrant: z.enum(['Q1', 'Q2', 'Q3', 'Q4']).optional(),
  score: z.number().optional(),
  nextAction: z.string().optional().nullable(),
  tags: z.array(z.string()).max(4).optional(),
  url: z.string().optional().nullable(),
})

export type ParserOutput = z.infer<typeof parserOutputSchema>

export interface ParserInput {
  rawText: string
  now: string
  todayFormatted: string
  timezone: string
  customerNames: string[]
  teamMemberNames: string[]
  calendarEvents: Array<{ id: string; title: string; startAt: string; endAt: string }>
  /** Når task kommer fra en kalenderbegivenhed – brug til kontekst for type/kunde. */
  linkedEvent?: { title?: string; url?: string }
}

const SYSTEM_PROMPT = `Du er en parsing- og prioriteringsassistent til en Eisenhower todo-app.
Returnér STRICT JSON efter det definerede schema.

Titel vs beskrivelse: Brugerens fulde indtastning (rawText) gemmes som BESKRIVELSE. "title" skal være ÉN kort, præcise handling – som en overskrift (maks 5-10 ord). Brug kundens/team-medlemmets fulde navn i titlen, ikke 3-bogstavs koden (fx "Giv CeramicSpeed sparring" i stedet for "Giv CES sparring").

Brug kundeliste/team-liste/calendar events som sandhedskilder. Kunder/team med kode er angivet som "Navn (KODE)" – match på enten navn eller 3-bogstavs kode.
customer: Tildel kunde når kundens navn ELLER 3-bogstavs kode (fx CES, MSO, VDE) er nævnt i rawText. Så snart en kode fra kundelisten forekommer i teksten, brug den som customer (returnér koden eller navnet).
delegatedTo: Tildel team-medlem når navn eller 3-bogstavs kode er nævnt i kontekst af at hjælpe/levere/udføre opgaven (fx "MSO kan hjælpe med", "bed Lukas om", "delegér til VDE"). "For Lukas" = Lukas i title/notes, ingen delegation.
dueAt: Sæt når der er en eksplicit dato/tid/deadline. Brug "now" til at beregne: "tirsdag i næste uge" = tirsdag i den uge der følger efter nuværende uge (fx hvis i dag er onsdag 26. feb, er "tirsdag i næste uge" = tirsdag 3. marts). "inden tirsdag" = senest tirsdag. "inden for 1 time" = now + 1 time; "inden for 1 dag" = now + 1 dag (08:00 næste dag); "inden for 2 dage" = now + 2 dage; "inden for 1 uge" = now + 7 dage. Når kun ugedag/dato er nævnt uden klokkeslæt: brug 08:00 i brugerens timezone (Europe/Copenhagen). Returnér ISO-streng i lokal tid (fx 2026-03-03T08:00:00). Varighed (fx "ca. 30 min") er IKKE en deadline.
Ingen opfundne datoer; ved usikkerhed brug needsMoreInfo.
"inden møde" → prøv at matche event i næste 14 dage; hvis match: dueAt=eventStart (0 offset). Hvis ikke match: needsMoreInfo.
Én inputtekst = én task.
Vigtighed vægtes højt for: delegation/skalering, kundeopfølgning før møder, nye kunder/salg.
nextAction skal være 1 konkret sætning.
durationBucket SKAL være én af: LT15, M15_30, M30_60, GT60 (brug M30_60 for "ca 30-45 min", GT60 for over 1 time).
type SKAL ALTID være én af: kunde, internt, salg, ledelse. Vælg ud fra opgavens indhold:
- kunde: kundearbejde, kundemøder, kundesupport, leverance til kunde
- internt: intern drift, administration, interne møder, HR, IT, proces
- salg: salg, tilbud, forretningsudvikling, nye kunder, pipeline
- ledelse: ledelse, strategi, planlægning, beslutninger, teamledelse

VIGTIG – type vs. customer:
- Når type er "internt": customer SKAL altid være null. Interne møder har typisk kollegaer som deltagere, IKKE kunder. Sæt aldrig customer ved type internt.
- Sæt kun customer når type er kunde eller salg OG der er tydelig kundekontekst i rawText (fx kundens navn eller kode).
- Hvis linkedEvent er angivet: brug event-titel som kontekst. Event-titler som "X / Y (tjek ind...)" eller "1:1 med [kollega]" indikerer interne møder – sæt type til internt og customer til null.

tags: Tilføj 1-4 korte, relevante tags som array af strenge. Tags skal beskrive opgavens emne, kontekst eller kategori (fx "møde", "1:1", "kunde", "prep", "follow-up", "admin", "planlægning"). Brug danske eller engelske ord. Ingen duplikater. Maks 4 tags.

url: Hvis rawText indeholder en URL (fx https://..., http://...), udtræk den og returnér i url-feltet. Brug den første/mest relevante URL hvis flere findes. Returnér den fulde URL som den står i teksten.

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
  const linkedEventStr =
    input.linkedEvent?.title || input.linkedEvent?.url
      ? JSON.stringify(input.linkedEvent)
      : 'null'
  const userContent = `rawText: ${JSON.stringify(input.rawText)}
now: ${input.now}
I dag er ${input.todayFormatted} (timezone: ${input.timezone})
customerNames: ${JSON.stringify(input.customerNames)}
teamMemberNames: ${JSON.stringify(input.teamMemberNames)}
calendarEvents: ${eventsStr}
linkedEvent (kalenderbegivenhed denne task stammer fra – brug til type/kunde-kontekst): ${linkedEventStr}

Return strict JSON with: title (kun kort præcis handling, 1 linje), type (REQUIRED: kunde|internt|salg|ledelse), durationBucket (only: LT15 | M15_30 | M30_60 | GT60), customer, canDelegate, delegatedTo, linkedEventId, linkedEventType, dueAt (ISO), importance (0-100), urgency (0-100), quadrant (Q1-Q4), score, nextAction, tags (array of 1-4 relevante tags), url (hvis URL findes i rawText), needsMoreInfo, overallConfidence, suggestions, matches.`

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
    if (typeof obj.type === 'string' && ['kunde', 'internt', 'salg', 'ledelse'].includes(obj.type)) safe.type = obj.type as TaskType
    if (typeof obj.canDelegate === 'boolean') safe.canDelegate = obj.canDelegate
    if (Array.isArray(obj.tags) && obj.tags.length > 0) {
      const tagStrings = obj.tags
        .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
        .map((t) => t.trim())
        .slice(0, 4)
      if (tagStrings.length > 0) safe.tags = tagStrings
    }
    if (typeof obj.url === 'string' && obj.url.trim().length > 0) safe.url = obj.url.trim()
    return safe
  } catch {
    return {}
  }
}
