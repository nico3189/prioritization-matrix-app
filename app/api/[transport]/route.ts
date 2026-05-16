import { createMcpHandler, withMcpAuth } from 'mcp-handler'
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js'
import { z } from 'zod'
import { verifyMcpBearer, getUserIdFromAuthInfo } from '@/lib/mcp-auth'
import {
	mcpToolResult,
	formatListTasksSummary,
	formatGetTaskSummary,
} from '@/lib/services/mcp-task-utils'
import {
	createTaskFromRawText,
	listTasks,
	getTask,
	updateTask,
	completeTask,
} from '@/lib/services/tasks'

const mcpHandler = createMcpHandler(
	(server) => {
		server.registerTool(
			'create_task',
			{
				title: 'Opret opgave',
				description:
					'Opret en ny opgave i prioriteringsmatrix-appen ud fra en fritekst-beskrivelse. App\'en parser teksten med ChatGPT og udtrækker felter (kategori, varighed, vigtighed, type, kunde, links, deadline). Brug dette tool når brugeren beder om at oprette en opgave, tilføje noget til todo, eller skubbe en Slack-/Gmail-besked over som en opgave.',
				inputSchema: {
					rawText: z
						.string()
						.min(1)
						.describe(
							'Naturligt sprog beskrivelse af opgaven. Inkludér gerne kontekst som afsender, deadline, hastighed, links — parseren læser dem.'
						),
				},
			},
			async ({ rawText }, extra) => {
				const userId = getUserIdFromAuthInfo(extra.authInfo)
				const task = await createTaskFromRawText({ rawText }, userId)
				return {
					content: [
						{
							type: 'text',
							text: `✅ Opgave oprettet (id: ${task.id})\nTitel: ${task.title}\nHastighed: ${task.urgency ?? '—'}\nType: ${task.type ?? '—'}`,
						},
					],
				}
			}
		)

		server.registerTool(
			'list_tasks',
			{
				title: 'List opgaver',
				description:
					'List opgaver med valgfrie filtre. Brug når brugeren spørger om overblik over opgaver.',
				inputSchema: {
					status: z.enum(['open', 'done', 'all']).optional(),
					urgency: z.enum(['akut', 'snart', 'normal', 'lav']).optional(),
					type: z.string().optional(),
					customer: z.string().optional(),
					search: z.string().optional(),
					deadlineBefore: z.string().datetime().optional(),
					limit: z.number().int().min(1).max(200).optional(),
				},
			},
			async (args, extra) => {
				const userId = getUserIdFromAuthInfo(extra.authInfo)
				const statusFilter = args.status ?? 'open'
				const items = await listTasks(
					{
						status: statusFilter,
						urgency: args.urgency,
						type: args.type,
						customer: args.customer,
						search: args.search,
						deadlineBefore: args.deadlineBefore,
						limit: args.limit,
					},
					userId
				)
				const summary = formatListTasksSummary(items, statusFilter)
				return mcpToolResult(summary, { tasks: items, count: items.length })
			}
		)

		server.registerTool(
			'get_task',
			{
				title: 'Hent opgave',
				description: 'Hent en enkelt opgave med alle felter.',
				inputSchema: { id: z.string() },
			},
			async ({ id }, extra) => {
				const userId = getUserIdFromAuthInfo(extra.authInfo)
				const detail = await getTask(id, userId)
				return mcpToolResult(formatGetTaskSummary(detail), detail)
			}
		)

		server.registerTool(
			'update_task',
			{
				title: 'Opdater opgave',
				description:
					'Opdater felter på en eksisterende opgave. Send kun de felter der skal ændres.',
				inputSchema: {
					id: z.string(),
					fields: z.object({
						title: z.string().optional(),
						urgency: z.enum(['akut', 'snart', 'normal', 'lav']).optional(),
						type: z.string().optional(),
						customer: z.string().optional(),
						deadline: z.string().datetime().nullable().optional(),
						duration: z.number().nullable().optional(),
						links: z.array(z.string().url()).optional(),
						notes: z.string().optional(),
					}),
				},
			},
			async ({ id, fields }, extra) => {
				const userId = getUserIdFromAuthInfo(extra.authInfo)
				const { detail, changedFields } = await updateTask(
					id,
					fields,
					userId
				)
				const summary =
					changedFields.length > 0
						? `Opdateret: ${id}. Ændrede felter: ${changedFields.join(', ')}.`
						: `Ingen ændringer for ${id} (felter havde allerede samme værdi).`
				return mcpToolResult(summary, detail)
			}
		)

		server.registerTool(
			'complete_task',
			{
				title: 'Afslut opgave',
				description: 'Marker en opgave som færdig.',
				inputSchema: { id: z.string() },
			},
			async ({ id }, extra) => {
				const userId = getUserIdFromAuthInfo(extra.authInfo)
				const detail = await completeTask(id, userId)
				return mcpToolResult(
					`✅ Markeret færdig: ${detail.title}`,
					detail
				)
			}
		)

		server.registerTool(
			'reparse_task',
			{
				title: 'Gen-parse opgave',
				description:
					'Kør ChatGPT-parseren igen på opgavens tekst og overskriv felter.',
				inputSchema: { id: z.string() },
			},
			async () => {
				throw new Error('TODO: implementér reparse_task')
			}
		)

		server.registerTool(
			'delete_task',
			{
				title: 'Slet opgave',
				description: 'Slet en opgave permanent.',
				inputSchema: { id: z.string() },
			},
			async () => {
				throw new Error('TODO: implementér delete_task')
			}
		)
	},
	{
		serverInfo: {
			name: 'prioritization-matrix-mcp',
			version: '0.1.0',
		},
	},
	{
		basePath: '/api',
		verboseLogs: process.env.NODE_ENV === 'development',
	}
)

const verifyToken = async (
	_req: Request,
	bearerToken?: string
): Promise<AuthInfo | undefined> => verifyMcpBearer(bearerToken)

const handler = withMcpAuth(mcpHandler, verifyToken, { required: true })

export { handler as GET, handler as POST, handler as DELETE }
