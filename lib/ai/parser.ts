import { z } from 'zod'
import OpenAI from 'openai'
import { DurationBucket, TaskType } from '@prisma/client'
import { classifyOpenAiError } from '@/lib/openai-errors'
import {
	recordIntegrationHealth,
	OPENAI_SERVICE,
} from '@/lib/integration-health'

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
  parkOnUdviklingsliste: z.boolean().optional(),
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
customer: Sæt KUN kunde når du er 100% sikker. Hvis du er det mindste i tvivl – returnér null. Kundens navn eller 3-bogstavs kode skal være UTVETYIGT nævnt i rawText. Ved tvivl, usikker match, uklar kontekst eller flere mulige kunder: returnér null.
delegatedTo: Tildel team-medlem KUN når navn, 3-bogstavs kode eller initialer (fx VSE) er nævnt som modtager af opgaven (fx "deleger til VSE", "bed Lukas om", "MSO kan hjælpe med"). Hvis ingen specifik person, navn, kode eller initialer er nævnt som modtager — returnér null. Gæt aldrig. "For Lukas" = Lukas i title/notes, ingen delegation.
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
- Sæt kun customer når type er kunde eller salg OG der er tydelig, utvetydig kundekontekst i rawText. Ved den mindste tvivl: returnér customer null.
- Hvis linkedEvent er angivet: brug event-titel som kontekst. Event-titler som "X / Y (tjek ind...)" eller "1:1 med [kollega]" indikerer interne møder – sæt type til internt og customer til null.

tags: Tilføj 1-4 korte, relevante tags som array af strenge. Tags skal beskrive opgavens emne, kontekst eller kategori. Foretræk tags fra tagNames-listen hvis angivet. Brug ALDRIG tags fra blacklistedTagNames. Brug danske eller engelske ord. Ingen duplikater. Maks 4 tags.

url: Hvis rawText indeholder URL(s) (fx https://..., http://...), udtræk ALLE og returnér i url-feltet som én streng med én URL per linje (newline-separeret). Ingen URL må udelades. Returnér hver fulde URL som den står i teksten.

parkOnUdviklingsliste (boolean): Skal opgaven parkeres på udviklingslisten (idéer/forbedring — ikke dagens to-do)?
- true: idé, inspiration, "god idé at…", processoptimering uden konkret deadline, "når der er tid", brainstorm, "måske", "overvej om…" uden commit.
- false: eksplicit deadline, "i dag", "skal gøres", haster, kundelevering, konkret handling nu/snart, delegation med klar opgave.
- VIGTIG: Ved tvivl → altid false (primær to-do-liste). Parkér kun når sproget tydeligt peger på idé/udvikling/senere.

Returnér kun gyldig JSON, ingen markdown.

Hvis overrideExamples er angivet: Brugeren har tidligere rettet lignende opgaver. Vægt disse eksempler HØJT – brug samme mønster for type, durationBucket, tags osv. når rawText ligner.`

const DURATION_BUCKETS = ['LT15', 'M15_30', 'M30_60', 'GT60'] as const

function extractSuggestionValue(
	obj: Record<string, unknown>,
	key: string
): unknown {
	const direct = obj[key]
	if (direct !== undefined && direct !== null) return direct
	const suggestions = obj.suggestions
	if (!suggestions || typeof suggestions !== 'object') return undefined
	const entry = (suggestions as Record<string, unknown>)[key]
	if (entry && typeof entry === 'object' && entry !== null && 'value' in entry) {
		return (entry as { value?: unknown }).value
	}
	return undefined
}

function normalizeDurationBucket(value: unknown): DurationBucket | undefined {
	if (typeof value !== 'string') return undefined
	const trimmed = value.trim()
	const upper = trimmed.toUpperCase()
	if (DURATION_BUCKETS.includes(upper as (typeof DURATION_BUCKETS)[number])) {
		return upper as DurationBucket
	}
	const lower = trimmed.toLowerCase()
	if (/under\s*15|<\s*15|10\s*min|5\s*min/.test(lower)) return DurationBucket.LT15
	if (/15\s*[-–]\s*30|20\s*min|25\s*min/.test(lower)) return DurationBucket.M15_30
	if (/30\s*[-–]\s*60|45\s*min|ca\.?\s*30|ca\.?\s*45|30\s*min/.test(lower)) {
		return DurationBucket.M30_60
	}
	if (/over\s*60|over\s*1\s*time|2\s*timer?|\b90\s*min/.test(lower)) {
		return DurationBucket.GT60
	}
	return undefined
}

export function inferDurationBucketFromText(text: string): DurationBucket | undefined {
	const t = text.toLowerCase()
	const minMatch = t.match(/(\d+)\s*min/)
	if (minMatch) {
		const mins = Number.parseInt(minMatch[1], 10)
		if (Number.isFinite(mins)) {
			if (mins < 15) return DurationBucket.LT15
			if (mins < 30) return DurationBucket.M15_30
			if (mins < 60) return DurationBucket.M30_60
			return DurationBucket.GT60
		}
	}
	const hourMatch = t.match(/(\d+(?:[.,]\d+)?)\s*(time|timer|t)\b/)
	if (hourMatch) {
		const hours = Number.parseFloat(hourMatch[1].replace(',', '.'))
		if (Number.isFinite(hours)) {
			if (hours < 0.25) return DurationBucket.LT15
			if (hours < 0.5) return DurationBucket.M15_30
			if (hours <= 1) return DurationBucket.M30_60
			return DurationBucket.GT60
		}
	}
	if (/\b(under\s*)?15\s*min\b/.test(t)) return DurationBucket.LT15
	if (/\b15\s*[-–]\s*30\s*min\b/.test(t)) return DurationBucket.M15_30
	if (/\b30\s*[-–]\s*60\s*min\b|\bca\.?\s*30\b|\bca\.?\s*45\b/.test(t)) {
		return DurationBucket.M30_60
	}
	if (/\bover\s*60\b|\bover\s*1\s*time\b/.test(t)) return DurationBucket.GT60
	return undefined
}

function normalizeParserOutput(
	obj: Record<string, unknown>,
	rawText: string
): ParserOutput {
	const safe: ParserOutput = {}

	const title = extractSuggestionValue(obj, 'title')
	if (typeof title === 'string') safe.title = title

	const customer = extractSuggestionValue(obj, 'customer')
	if (typeof customer === 'string' || customer === null) safe.customer = customer

	const delegatedTo = extractSuggestionValue(obj, 'delegatedTo')
	if (typeof delegatedTo === 'string' || delegatedTo === null) {
		safe.delegatedTo = delegatedTo
	}

	const type = extractSuggestionValue(obj, 'type')
	if (
		typeof type === 'string' &&
		['kunde', 'internt', 'salg', 'ledelse'].includes(type)
	) {
		safe.type = type as TaskType
	}

	const durationRaw = extractSuggestionValue(obj, 'durationBucket')
	const durationBucket =
		normalizeDurationBucket(durationRaw) ??
		inferDurationBucketFromText(rawText) ??
		DurationBucket.M30_60
	safe.durationBucket = durationBucket

	const importance = extractSuggestionValue(obj, 'importance')
	if (
		typeof importance === 'number' &&
		importance >= 0 &&
		importance <= 100
	) {
		safe.importance = importance
	}

	const urgency = extractSuggestionValue(obj, 'urgency')
	if (typeof urgency === 'number' && urgency >= 0 && urgency <= 100) {
		safe.urgency = urgency
	}

	const nextAction = extractSuggestionValue(obj, 'nextAction')
	if (typeof nextAction === 'string' || nextAction === null) {
		safe.nextAction = nextAction
	}

	const dueAt = extractSuggestionValue(obj, 'dueAt')
	if (typeof dueAt === 'string' || dueAt === null) safe.dueAt = dueAt

	const canDelegate = extractSuggestionValue(obj, 'canDelegate')
	if (typeof canDelegate === 'boolean') safe.canDelegate = canDelegate

	const tags = extractSuggestionValue(obj, 'tags')
	if (Array.isArray(tags) && tags.length > 0) {
		const tagStrings = tags
			.filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
			.map((t) => t.trim())
			.slice(0, 4)
		if (tagStrings.length > 0) safe.tags = tagStrings
	}

	const url = extractSuggestionValue(obj, 'url')
	if (typeof url === 'string' && url.trim().length > 0) {
		safe.url = url.trim()
	} else if (Array.isArray(obj.urls)) {
		const urlLines = obj.urls
			.filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
			.map((u) => u.trim())
		if (urlLines.length > 0) safe.url = urlLines.join('\n')
	}

	const parkOnUdviklingsliste = extractSuggestionValue(obj, 'parkOnUdviklingsliste')
	if (typeof parkOnUdviklingsliste === 'boolean') {
		safe.parkOnUdviklingsliste = parkOnUdviklingsliste
	}

	if (obj.suggestions && typeof obj.suggestions === 'object') {
		safe.suggestions = obj.suggestions as ParserOutput['suggestions']
	}
	if (obj.matches && typeof obj.matches === 'object') {
		safe.matches = obj.matches as ParserOutput['matches']
	}
	if (Array.isArray(obj.needsMoreInfo)) {
		safe.needsMoreInfo = obj.needsMoreInfo as string[]
	}
	if (typeof obj.overallConfidence === 'number') {
		safe.overallConfidence = obj.overallConfidence
	}

	return safe
}

export async function parseSmartInput(input: ParserInput): Promise<ParserOutput> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey || apiKey.trim() === '') {
    const message =
      'OPENAI_API_KEY er ikke sat. Tilføj den i .env (lokalt) eller Heroku Config Vars.'
    await recordIntegrationHealth(
      OPENAI_SERVICE,
      false,
      'missing_key',
      message
    )
    throw new Error(message)
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

Return strict JSON with: title (kun kort præcis handling, 1 linje), type (REQUIRED: kunde|internt|salg|ledelse), durationBucket (REQUIRED: LT15 | M15_30 | M30_60 | GT60 — gæt 30-60 min hvis ukendt), customer, canDelegate, delegatedTo, linkedEventId, linkedEventType, dueAt (ISO), importance (0-100), urgency (0-100), quadrant (Q1-Q4), score, nextAction, tags (array of 1-4 relevante tags), url (hvis URL findes i rawText), parkOnUdviklingsliste (boolean), needsMoreInfo, overallConfidence, suggestions, matches.`

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    })
    await recordIntegrationHealth(OPENAI_SERVICE, true)
    const raw = completion.choices[0]?.message?.content
    if (!raw) return {}
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>
      return normalizeParserOutput(parsed, input.rawText)
    } catch {
      return {}
    }
  } catch (err) {
    const classified = classifyOpenAiError(err)
    await recordIntegrationHealth(
      OPENAI_SERVICE,
      false,
      classified.code,
      classified.message
    )
    throw new Error(classified.message)
  }
}
