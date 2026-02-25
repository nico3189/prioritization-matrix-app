/**
 * Eisenhower quadrant and score helpers.
 * Q1: importance >= 60 && urgency >= 60
 * Q2: importance >= 60 && urgency < 60
 * Q3: importance < 60 && urgency >= 60
 * Q4: importance < 60 && urgency < 60
 *
 * Priorities shift over time: effective urgency increases as deadline approaches.
 */
export type Quadrant = 'Q1' | 'Q2' | 'Q3' | 'Q4'

export function getQuadrant(importance: number, urgency: number): Quadrant {
  if (importance >= 60 && urgency >= 60) return 'Q1'
  if (importance >= 60 && urgency < 60) return 'Q2'
  if (importance < 60 && urgency >= 60) return 'Q3'
  return 'Q4'
}

export function getScore(importance: number, urgency: number): number {
  return 0.65 * importance + 0.35 * urgency
}

/**
 * Effective urgency: base urgency plus boost as deadline approaches.
 * So "what I should do now" stays current without re-running AI.
 */
export function getEffectiveUrgency(
  baseUrgency: number,
  dueAt: Date | string | null
): number {
  if (!dueAt) return baseUrgency
  const due = typeof dueAt === 'string' ? new Date(dueAt) : dueAt
  const hoursUntilDue = (due.getTime() - Date.now()) / (1000 * 60 * 60)
  if (hoursUntilDue < 0) return Math.max(baseUrgency, 95)
  if (hoursUntilDue < 24) return Math.min(100, baseUrgency + 25)
  if (hoursUntilDue < 48) return Math.min(100, baseUrgency + 20)
  if (hoursUntilDue < 7 * 24) return Math.min(100, baseUrgency + 15)
  if (hoursUntilDue < 14 * 24) return Math.min(100, baseUrgency + 10)
  return baseUrgency
}

export function getScoreWithDueBonus(
  importance: number,
  urgency: number,
  dueAt: Date | null
): number {
  const effectiveUrg = getEffectiveUrgency(urgency, dueAt)
  return getScore(importance, effectiveUrg)
}
