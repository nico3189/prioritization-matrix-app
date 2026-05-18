import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { AppShell } from '@/components/app-shell'

export default async function AppLayout({
  children,
  modal,
}: {
  children: React.ReactNode
  modal: React.ReactNode
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  return (
    <AppShell user={session.user}>
      {children}
      {modal}
    </AppShell>
  )
}
