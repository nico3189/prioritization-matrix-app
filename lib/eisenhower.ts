import type { TaskType } from '@prisma/client'
import {
  DEFAULT_PRIORITY_FACTORS,
  type PriorityFactors,
} from '@/lib/priority-factors'

/**
 * Beregner importance med type, kundepriority og keyword-offset integreret.
 * @param aiImportance AI's rå vurdering (0-100)
 * @param type Opgavetype – kunde/salg/ledelse vægtes højere end internt
 * @param customerPriority Kundens priority 0-10 (5=neutral). Kun relevant når type er kunde/salg.
 * @param factors Brugerens indstillede faktorer fra Indstillinger. Hvis undefined bruges standardværdier.
 * @param keywordImportance Offset fra keyword-match i rawText (beregnes med getKeywordOffsets).
 */
export function computeImportanceWithContext(
  aiImportance: number,
  type: TaskType | null | undefined,
  customerPriority?: number | null,
  factors?: PriorityFactors | null,
  keywordImportance?: number
): number {
  const f = factors ?? DEFAULT_PRIORITY_FACTORS
  const typeOffset = type ? f.typeImportance[type] ?? 0 : 0
  const customerOffset =
    customerPriority != null
      ? (customerPriority - 5) * f.customerMultiplier
      : 0
  const kwOffset = keywordImportance ?? 0
  const raw = aiImportance + typeOffset + customerOffset + kwOffset
  return Math.round(Math.max(0, Math.min(100, raw)))
}

/**
 * Beregner urgency uden deadline med type, kundepriority og keyword-offset integreret.
 * Bruges kun når der ikke er deadline – ellers bruges computeUrgencyFromDeadline.
 */
export function computeUrgencyWithContext(
  aiUrgency: number,
  type: TaskType | null | undefined,
  customerPriority?: number | null,
  factors?: PriorityFactors | null,
  keywordUrgency?: number
): number {
  const f = factors ?? DEFAULT_PRIORITY_FACTORS
  const typeOffset = type ? f.typeUrgency[type] ?? 0 : 0
  const customerOffset =
    customerPriority != null
      ? (customerPriority - 5) * f.customerMultiplier
      : 0
  const kwOffset = keywordUrgency ?? 0
  const raw = aiUrgency + typeOffset + customerOffset + kwOffset
  return Math.round(Math.max(0, Math.min(100, raw)))
}

/**
 * Matrix quadrant helpers.
 * Q1: Opgaver der skal gøres nu – høj score + under 30 min, eller score >= 75
 * Q2: Opgaver der skal forberedes – middelhøj score eller over 30 min
 * Q3: Opgaver der skal delegeres – har tildelt teammedlem
 * Q4: Opgaver der skal droppes eller genvurderes – lav score
 */
export type Quadrant = 'Q1' | 'Q2' | 'Q3' | 'Q4'

export interface MatrixTaskInput {
  importance?: number | null
  urgency?: number | null
  dueAt?: string | Date | null
  durationBucket?: string | null
  delegatedToId?: string | null
  delegatedTo?: { name?: string } | null
}

export function getMatrixQuadrant(task: MatrixTaskInput): Quadrant {
  const imp = task.importance ?? 0
  const urg = task.urgency ?? 0
  const score = getScore(imp, urg)
  const hasDelegation = !!(task.delegatedToId || task.delegatedTo)
  const bucket = task.durationBucket ?? ''
  const isUnder30Min = bucket === 'LT15' || bucket === 'M15_30'
  const isOver30Min = bucket === 'M30_60' || bucket === 'GT60'

  const qualifiesForQ1 = score >= 75 || (score >= 60 && isUnder30Min)
  if (qualifiesForQ1) return 'Q1'
  if (hasDelegation) return 'Q3'
  if (score >= 50 || isOver30Min) return 'Q2'
  return 'Q4'
}

/** @deprecated Brug getMatrixQuadrant(task) i stedet */
export function getQuadrant(importance: number, urgency: number): Quadrant {
  return getMatrixQuadrant({ importance, urgency })
}

export function getScore(importance: number, urgency: number): number {
  return 0.55 * importance + 0.45 * urgency
}

/**
 * Beregner hastegrad ud fra nærhed til deadline (0–100).
 * Forskellige værdier pr. dag op til en uge, derefter intervaller.
 */
export function computeUrgencyFromDeadline(dueAt: Date | string): number {
  const due = typeof dueAt === 'string' ? new Date(dueAt) : dueAt
  const hoursUntilDue = (due.getTime() - Date.now()) / (1000 * 60 * 60)
  if (hoursUntilDue < 0) return 100
  if (hoursUntilDue < 24) return 95   // dag 0
  if (hoursUntilDue < 48) return 90   // dag 1
  if (hoursUntilDue < 72) return 85   // dag 2
  if (hoursUntilDue < 96) return 80   // dag 3
  if (hoursUntilDue < 120) return 75  // dag 4
  if (hoursUntilDue < 144) return 70  // dag 5
  if (hoursUntilDue < 168) return 65  // dag 6
  if (hoursUntilDue < 14 * 24) return 55  // 1–2 uger
  return 35  // > 2 uger
}

/**
 * Returnerer hastegrad (stored value). Sync skriver computeUrgencyFromDeadline til DB.
 */
export function getEffectiveUrgency(
  baseUrgency: number,
  _dueAt: Date | string | null
): number {
  return baseUrgency
}

export function getScoreWithDueBonus(
  importance: number,
  urgency: number,
  _dueAt: Date | null
): number {
  return getScore(importance, urgency)
}
