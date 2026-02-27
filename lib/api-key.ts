import { createHash, randomBytes } from 'crypto'
import { prisma } from '@/lib/db'

const KEY_PREFIX = 'pm_'
const KEY_BYTES = 32

/** Genererer en ny API-nøgle. Returnerer { key, keyHash }. */
export function generateApiKey(): { key: string; keyHash: string } {
  const raw = randomBytes(KEY_BYTES).toString('hex')
  const key = KEY_PREFIX + raw
  const keyHash = hashKey(key)
  return { key, keyHash }
}

/** Hash en API-nøgle til sammenligning. */
export function hashKey(key: string): string {
  return createHash('sha256').update(key.trim()).digest('hex')
}

/** Tjekker om en streng ligner en API-nøgle (pm_ + hex). */
export function looksLikeApiKey(value: string): boolean {
  if (!value?.trim()) return false
  const t = value.trim()
  if (!t.startsWith(KEY_PREFIX)) return false
  const rest = t.slice(KEY_PREFIX.length)
  return /^[a-f0-9]+$/i.test(rest) && rest.length === KEY_BYTES * 2
}

/** Finder userId for en gyldig API-nøgle. Returnerer null hvis ugyldig. */
export async function getUserIdFromApiKey(key: string): Promise<string | null> {
  const trimmed = key.trim()
  if (!looksLikeApiKey(trimmed)) return null
  const keyHash = hashKey(trimmed)
  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash },
    select: { userId: true },
  })
  return apiKey?.userId ?? null
}
