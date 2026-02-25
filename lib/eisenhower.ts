/**
 * Eisenhower quadrant and score helpers.
 * Q1: importance >= 60 && urgency >= 60
 * Q2: importance >= 60 && urgency < 60
 * Q3: importance < 60 && urgency >= 60
 * Q4: importance < 60 && urgency < 60
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

export function getScoreWithDueBonus(
  importance: number,
  urgency: number,
  dueAt: Date | null
): number {
  let score = getScore(importance, urgency)
  if (dueAt) {
    const hoursUntilDue = (dueAt.getTime() - Date.now()) / (1000 * 60 * 60)
    if (hoursUntilDue < 48 && hoursUntilDue > 0) score += 5
  }
  return score
}
