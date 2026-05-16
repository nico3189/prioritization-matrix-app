import { withAuth } from 'next-auth/middleware'

export default withAuth({
  pages: { signIn: '/login' },
})

export const config = {
  matcher: [
    '/historik/:path*',
    '/today/:path*',
    '/alle-opgaver/:path*',
    '/tasks/:path*',
    '/clarify/:path*',
    '/calendar/:path*',
    '/settings/:path*',
  ],
}
