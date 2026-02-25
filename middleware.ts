import { withAuth } from 'next-auth/middleware'

export default withAuth({
  pages: { signIn: '/login' },
})

export const config = {
  matcher: ['/inbox/:path*', '/today/:path*', '/matrix/:path*', '/clarify/:path*', '/calendar/:path*', '/settings/:path*'],
}
