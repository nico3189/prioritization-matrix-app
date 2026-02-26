import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { google } from 'googleapis'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const accessToken = (session as { accessToken?: string }).accessToken
  if (!accessToken) return NextResponse.json({ error: 'No Google token' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const timeMin = searchParams.get('timeMin') ?? new Date().toISOString()
  const timeMax = searchParams.get('timeMax') ?? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
  const oauth2Client = new google.auth.OAuth2()
  oauth2Client.setCredentials({ access_token: accessToken })
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client })
  try {
    const res = await calendar.events.list({
      calendarId: 'primary',
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: 'startTime',
      eventTypes: ['default'],
      maxAttendees: 50,
    })
    const events = (res.data.items ?? []).map((e) => ({
      id: e.id,
      summary: e.summary ?? '',
      start: e.start?.dateTime ?? e.start?.date,
      end: e.end?.dateTime ?? e.end?.date,
      htmlLink: e.htmlLink ?? null,
      attendees: (e.attendees ?? []).map((a) => ({
        email: a.email ?? null,
        displayName: a.displayName ?? null,
        organizer: a.organizer ?? false,
        self: a.self ?? false,
        responseStatus: a.responseStatus ?? null,
      })),
    }))
    return NextResponse.json(events)
  } catch (err) {
    console.error('Calendar list error', err)
    return NextResponse.json({ error: 'Calendar error' }, { status: 500 })
  }
}
