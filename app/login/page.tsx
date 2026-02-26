'use client'

import { signIn } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function LoginForm() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')
  const isCallbackError = error === 'Callback'

  return (
    <>
      <h1 className="text-3xl font-semibold text-slate-100 mb-2">
        Prioritization Matrix
      </h1>
      <p className="text-sm text-slate-300 mb-6">
        Eisenhower todo med AI og Google Calendar. Log ind med Google.
      </p>
      {isCallbackError && (
        <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm">
          Login fejlede (Callback). Prøv igen om et øjeblik – det kan tage op til
          flere minutter efter ændringer i Google Cloud. Hvis det fortsætter:{' '}
          <code className="text-xs bg-black/20 px-1 rounded">
            heroku logs --tail --app prioritization-matrix-app
          </code>
        </div>
      )}
      <button
        type="button"
        onClick={() => signIn('google', { callbackUrl: '/inbox' })}
        className="w-full bg-app-accent text-white px-4 py-3 rounded-lg text-sm font-medium shadow-md hover:opacity-90 active:scale-95 transition-colors duration-200 ease-out"
      >
        Log ind med Google
      </button>
    </>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="app-card-gradient rounded-xl2 p-8 shadow-card border border-white/5 max-w-md w-full">
        <Suspense fallback={<p className="text-sm text-app-muted">Henter...</p>}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  )
}
