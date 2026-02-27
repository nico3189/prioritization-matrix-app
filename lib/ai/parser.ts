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
  /** Brugerens tags (navne) – foretræk disse ved kategorisering. */
  tagNames?: string[]
  /** Tags brugeren har blacklistet – brug aldrig disse. */
  blacklistedTagNames?: string[]
  /** Eksempler på tidligere rettelser – vægt disse højt ved lignende inputs. */
  overrideExamples?: string
  /** Arbejdstider per ugedag (mon-sun): { start: "08:00", end: "16:00" } eller null for fridage. Bruges til "i dag", "inden jeg går hjem", "inden i morgen" → deadline = slut af arbejdsdag. */
  workHours?: Record<string, { start: string; end: string } | null>
}

const SYSTEM_PROMPT = `Du er en parsing- og prioriteringsassistent til en Eisenhower todo-app.
Returnér STRICT JSON efter det definerede schema.

Titel vs beskrivelse: Brugerens fulde indtastning (rawText) gemmes som BESKRIVELSE. "title" skal være ÉN kort, præcise handling – som en overskrift (maks 5-10 ord). Brug kundens/team-medlemmets fulde navn i titlen, ikke 3-bogstavs koden (fx "Giv CeramicSpeed sparring" i stedet for "Giv CES sparring").

Brug kundeliste/team-liste/calendar events som sandhedskilder. Kunder/team med kode er angivet som "Navn (KODE)" – match på enten navn eller 3-bogstavs kode.
customer: Tildel kunde når kundens navn ELLER 3-bogstavs kode (fx CES, MSO, VDE) er nævnt i rawText. Så snart en kode fra kundelisten forekommer i teksten, brug den som customer (returnér koden eller navnet).
delegatedTo: Tildel team-medlem når navn eller 3-bogstavs kode er nævnt i kontekst af at hjælpe/levere/udføre opgaven (fx "MSO kan hjælpe med", "bed Lukas om", "delegér til VDE"). "For Lukas" = Lukas i title/notes, ingen delegation.
dueAt: Sæt når der er en eksplicit dato/tid/deadline. Brug "now" og workHours til at beregne. VIGTIG – når rawText siger "gøres i dag", "inden jeg går hjem i dag", "skal være løst inden i morgen", "inden i dag" osv. UDEN eksplicit klokkeslæt: brug workHours.end (fx 16:00) som deadline for den pågældende dag. mandag=mon, tirsdag=tue, onsdag=wed, torsdag=thu, fredag=fri, lørdag=sat, søndag=sun. Når workHours[dag] er null = fridag (brugeren arbejder ikke den dag). "i dag" = dagens workHours.end – hvis i dag er fridag, brug næste arbejdsdags end. "i morgen" = morgendagens workHours.end – hvis i morgen er fridag, brug næste arbejdsdags end. "tirsdag" uden kl = tirsdags workHours.end (hvis tirsdag er fridag, brug næste arbejdsdag). "inden tirsdag" = senest tirsdags workHours.end. Hvis workHours ikke er angivet: brug 08:00 som start, 16:00 som end. "inden kl. 15.00 i dag" = I DAG kl 15:00 (eksplicit tid overstyrer). "tirsdag i næste uge" = tirsdag i næste uge kl workHours.end. "inden for 1 time" = now + 1 time. Når kun ugedag/dato uden klokkeslæt: brug workHours.end for den dag. Returnér ISO-streng i lokal tid. Varighed (fx "ca. 30 min") er IKKE en deadline.
Ingen opfundne datoer; ved usikkerhed brug needsMoreInfo.
"inden møde" → prøv at matche event i næste 14 dage; hvis match: dueAt=eventStart (0 offset). Hvis ikke match: needsMoreInfo.
Én inputtekst = én task.
importance (0-100): Vægt HØJT ud fra sproglige signaler i rawText. "meget vigtigt", "mega vigtigt", "super vigtigt", "ekstremt vigtigt", "det er vigtigt at", "vigtigt!" → sæt importance 85-95 (IKKE 50). "kritisk", "haste" → 90-100. Neutrale opgaver uden stærke signaler → 40-60. Vigtighed vægtes også højt for: delegation/skalering, kundeopfølgning før møder, nye kunder/salg.
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

tags: Tilføj 1-4 korte, relevante tags som array af strenge. Tags skal beskrive opgavens emne, kontekst eller kategori. Foretræk tags fra tagNames-listen hvis angivet. Brug ALDRIG tags fra blacklistedTagNames. Brug danske eller engelske ord. Ingen duplikater. Maks 4 tags.

url: Hvis rawText indeholder en URL (fx https://..., http://...), udtræk den og returnér i url-feltet. Brug den første/mest relevante URL hvis flere findes. Returnér den fulde URL som den står i teksten.

Returnér kun gyldig JSON, ingen markdown.

Hvis overrideExamples er angivet: Brugeren har tidligere rettet lignende opgaver. Vægt disse eksempler HØJT – brug samme mønster for type, durationBucket, tags osv. når rawText ligner.`

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
  const tagNamesStr = input.tagNames?.length
    ? `tagNames (foretræk disse): ${JSON.stringify(input.tagNames)}`
    : ''
  const blacklistStr = input.blacklistedTagNames?.length
    ? `blacklistedTagNames (brug ALDRIG): ${JSON.stringify(input.blacklistedTagNames)}`
    : ''
  const overrideStr = input.overrideExamples
    ? `\n\noverrideExamples (bruger har tidligere rettet – vægt HØJT):\n${input.overrideExamples}`
    : ''
  const workHoursStr = input.workHours
    ? `workHours (brugerens arbejdstider – brug .end som deadline for "i dag", "inden jeg går hjem", "inden i morgen" osv.): ${JSON.stringify(input.workHours)}`
    : 'workHours: ikke angivet – brug 08:00-16:00 som standard'
  const userContent = `rawText: ${JSON.stringify(input.rawText)}
now: ${input.now}
I dag er ${input.todayFormatted} (timezone: ${input.timezone})
customerNames: ${JSON.stringify(input.customerNames)}
teamMemberNames: ${JSON.stringify(input.teamMemberNames)}
calendarEvents: ${eventsStr}
linkedEvent (kalenderbegivenhed denne task stammer fra – brug til type/kunde-kontekst): ${linkedEventStr}
${workHoursStr}
${tagNamesStr ? tagNamesStr + '\n' : ''}${blacklistStr ? blacklistStr + '\n' : ''}${overrideStr}

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
