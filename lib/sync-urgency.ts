import { prisma } from '@/lib/db'
import { TaskStatus } from '@prisma/client'
import {
  computeUrgencyFromDeadline,
  computeImportanceWithContext,
} from '@/lib/eisenhower'
import {
  getKeywordOffsets,
  normalizePriorityFactors,
} from '@/lib/priority-factors'
import { parseSmartInput } from '@/lib/ai/parser'
import { toZonedTime } from 'date-fns-tz'
import { format } from 'date-fns'
import { da } from 'date-fns/locale'

const TZ = 'Europe/Copenhagen'
const MAX_AI_TASKS_PER_RUN = 15

/**
 * Opdaterer hastegrad for opgaver:
 * - Med deadline: urgency beregnes fra nærhed til deadline
 * - Uden deadline: importance fra AI med type og kundepriority integreret (max MAX_AI_TASKS_PER_RUN)
 * Urgency opdateres kun fra deadline – aldrig fra AI når ingen deadline.
 */
export async function runSyncUrgency(userId?: string): Promise<{ updated: number; total: number }> {
  const where: { status: { in: TaskStatus[] }; userId?: string } = {
    status: { in: [TaskStatus.qualified, TaskStatus.needs_clarification] },
  }
  if (userId) where.userId = userId

  const tasks = await prisma.task.findMany({
    where,
    select: {
      id: true,
      userId: true,
      urgency: true,
      importance: true,
      dueAt: true,
      customerId: true,
      type: true,
      title: true,
      notes: true,
      updatedAt: true,
      importanceManuallyOverriddenAt: true,
      urgencyManuallyOverriddenAt: true,
    },
  })

  const withDeadline = tasks.filter((t) => t.dueAt != null)
  const withoutDeadline = tasks
    .filter((t) => t.dueAt == null && !t.importanceManuallyOverriddenAt)
    .sort((a, b) => (a.updatedAt?.getTime() ?? 0) - (b.updatedAt?.getTime() ?? 0))
    .slice(0, MAX_AI_TASKS_PER_RUN)

  let updated = 0

  for (const task of withDeadline) {
    const newUrg = Math.round(computeUrgencyFromDeadline(task.dueAt!))
    const current = task.urgency ?? 0
    if (newUrg !== current && newUrg >= 0 && newUrg <= 100) {
      await prisma.task.update({
        where: { id: task.id },
        data: { urgency: newUrg },
      })
      updated += 1
    }
  }

  const userIds = Array.from(new Set(withoutDeadline.map((t) => t.userId)))
  const settingsByUser = await prisma.userSettings.findMany({
    where: { userId: { in: userIds } },
    select: { userId: true, priorityFactors: true },
  })
  const factorsByUser = Object.fromEntries(
    settingsByUser.map((s) => [s.userId, normalizePriorityFactors(s.priorityFactors)])
  )
  const customersByUser = await prisma.customer.findMany({
    where: { userId: { in: userIds } },
    select: { id: true, userId: true, name: true, code: true, priority: true },
  })
  const teamByUser = await prisma.teamMember.findMany({
    where: { userId: { in: userIds } },
    select: { userId: true, name: true, code: true },
  })

  const now = toZonedTime(new Date(), TZ)
  const todayFormatted = format(now, 'EEEE d. MMMM yyyy', { locale: da })

  for (const task of withoutDeadline) {
    const customers = customersByUser
      .filter((c) => c.userId === task.userId)
      .map((c) => (c.code ? `${c.name} (${c.code})` : c.name))
    const teamMembers = teamByUser
      .filter((tm) => tm.userId === task.userId)
      .map((tm) => (tm.code ? `${tm.name} (${tm.code})` : tm.name))
    const rawText = [task.title, task.notes].filter(Boolean).join('\n') || task.title || ''
    if (!rawText.trim()) continue

    try {
      const result = await parseSmartInput({
        rawText,
        now: now.toISOString(),
        todayFormatted,
        timezone: TZ,
        customerNames: customers,
        teamMemberNames: teamMembers,
        calendarEvents: [],
      })
      const aiImportance =
        result.importance != null ? Math.round(result.importance) : 50
      const customer = task.customerId
        ? customersByUser.find(
            (c) => c.userId === task.userId && c.id === task.customerId
          )
        : null
      const factors = factorsByUser[task.userId]
      const kwOffsets = getKeywordOffsets(rawText, factors.keywordWeights)
      const newImp = computeImportanceWithContext(
        aiImportance,
        task.type,
        customer?.priority,
        factors,
        kwOffsets.importance
      )
      const currentImp = task.importance ?? 0
      if (newImp !== currentImp) {
        await prisma.task.update({
          where: { id: task.id },
          data: { importance: newImp },
        })
        updated += 1
      }
    } catch (err) {
      console.error(`[sync-urgency] AI parse failed for task ${task.id}:`, err)
    }
  }

  return { updated, total: tasks.length }
}
