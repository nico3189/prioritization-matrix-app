import { prisma } from '@/lib/db'
import { TaskEventType } from '@prisma/client'
import type { Prisma } from '@prisma/client'

export async function logTaskEvent(
  taskId: string,
  userId: string,
  eventType: TaskEventType,
  payload?: Record<string, unknown>
) {
  await prisma.taskEvent.create({
    data: {
      taskId,
      userId,
      eventType,
      payload: payload ? (payload as Prisma.InputJsonValue) : undefined,
    },
  })
}
