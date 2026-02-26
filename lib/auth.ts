import { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@/lib/db'

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as NextAuthOptions['adapter'],
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: [
            'openid',
            'email',
            'profile',
            'https://www.googleapis.com/auth/calendar.readonly',
          ].join(' '),
          access_type: 'offline',
        },
      },
    }),
  ],
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: '/login' },
  callbacks: {
    async jwt({ token, account, user, profile }) {
      if (account?.access_token) {
        token.accessToken = account.access_token
        token.refreshToken = account.refresh_token ?? token.refreshToken
        token.expiresAt = account.expires_at
          ? account.expires_at * 1000
          : Date.now() + 55 * 60 * 1000
      }
      if (account?.refresh_token) token.refreshToken = account.refresh_token
      const expiresAt = token.expiresAt as number | undefined
      if (
        token.refreshToken &&
        (!token.accessToken || (expiresAt && Date.now() >= expiresAt - 60 * 1000))
      ) {
        try {
          const res = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_id: process.env.GOOGLE_CLIENT_ID!,
              client_secret: process.env.GOOGLE_CLIENT_SECRET!,
              grant_type: 'refresh_token',
              refresh_token: token.refreshToken,
            }),
          })
          const data = (await res.json()) as {
            access_token?: string
            expires_in?: number
          }
          if (data.access_token) {
            token.accessToken = data.access_token
            token.expiresAt = Date.now() + (data.expires_in ?? 3600) * 1000
          }
        } catch (err) {
          console.error('[auth] Token refresh failed:', err)
        }
      }
      if (user?.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email },
        })
        if (dbUser) token.userId = dbUser.id
      }
      if (user?.name) token.name = user.name
      if (user?.image) token.picture = user.image
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId as string
        session.accessToken = token.accessToken as string | undefined
        session.refreshToken = token.refreshToken as string | undefined
      }
      return session
    },
    async signIn({ user, account }) {
      if (account?.provider === 'google' && user.email) return true
      return false
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NEXTAUTH_DEBUG === 'true',
}

declare module 'next-auth' {
  interface Session {
    user: { id: string; name?: string | null; email?: string | null; image?: string | null }
    accessToken?: string
    refreshToken?: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId?: string
    accessToken?: string
    refreshToken?: string
    expiresAt?: number
  }
}
