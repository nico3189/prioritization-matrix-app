import type { PrismaClient } from '@prisma/client'

export async function getTaskDependencyEdges(
	prisma: PrismaClient,
	userId: string,
	taskIds: string[]
): Promise<Array<{ taskId: string; dependsOnTaskId: string }>> {
	if (taskIds.length === 0) return []
	const rows = await prisma.taskDependency.findMany({
		where: {
			taskId: { in: taskIds },
			task: { userId },
		},
		select: { taskId: true, dependsOnTaskId: true },
	})
	return rows
}

/**
 * Returnerer true hvis `targetTaskId` er reachable fra `startTaskId`
 * via prerequisites (TaskDependency edges).
 */
export async function isReachableViaPrerequisites(
	prisma: PrismaClient,
	userId: string,
	startTaskId: string,
	targetTaskId: string
): Promise<boolean> {
	if (startTaskId === targetTaskId) return true
	let frontier = [startTaskId]
	const visited = new Set<string>()

	while (frontier.length > 0) {
		const nextFrontier: string[] = []
		const edges = await getTaskDependencyEdges(prisma, userId, frontier)
		for (const e of edges) {
			if (e.dependsOnTaskId === targetTaskId) return true
			if (visited.has(e.dependsOnTaskId)) continue
			visited.add(e.dependsOnTaskId)
			nextFrontier.push(e.dependsOnTaskId)
		}
		frontier = nextFrontier
	}
	return false
}

/**
 * Validerer at tilføjelse af prerequisites ikke skaber cycles.
 * For hver candidate prerequisite P må `taskId` ikke være reachable fra P.
 */
export async function assertNoDependencyCycles(
	prisma: PrismaClient,
	userId: string,
	taskId: string,
	dependencyIds: string[]
): Promise<void> {
	for (const depId of dependencyIds) {
		if (depId === taskId) {
			throw new Error('En opgave kan ikke afhænge af sig selv')
		}
		const hasCycle = await isReachableViaPrerequisites(
			prisma,
			userId,
			depId,
			taskId
		)
		if (hasCycle) {
			throw new Error('Dependency skaber en cirkel')
		}
	}
}

