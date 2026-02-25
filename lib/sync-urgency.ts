import { prisma } from '@/lib/db'
import { TaskStatus } from '@prisma/client'
import { getEffectiveUrgency } from '@/lib/eisenhower'

/**
 * Opdaterer hastegrad for opgaver med deadline til effektiv hastegrad.
 * @param userId - Hvis sat, kun denne brugers opgaver; ellers alle (til cron).
 */
export async function runSyncUrgency(userId?: string): Promise<{ updated: number; total: number }> {
  const where: { dueAt: { not: null }; status: { in: TaskStatus[] }; userId?: string } = {
    dueAt: { not: null },
    status: { in: [TaskStatus.qualified, TaskStatus.needs_clarification] },
  }
  if (userId) where.userId = userId

  const tasks = await prisma.task.findMany({
    where,
    select: { id: true, urgency: true, dueAt: true },
  })

  let updated = 0
  for (const task of tasks) {
    const baseUrg = task.urgency ?? 0
    const effective = getEffectiveUrgency(baseUrg, task.dueAt)
    const rounded = Math.round(effective)
    if (rounded !== baseUrg && rounded >= 0 && rounded <= 100) {
      await prisma.task.update({
        where: { id: task.id },
        data: { urgency: rounded },
      })
      updated += 1
    }
  }

  return { updated, total: tasks.length }
}
