'use client'

import { signIn } from 'next-auth/react'

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-app-bg flex items-center justify-center p-8">
      <div className="bg-app-card rounded-xl2 p-8 shadow-card border border-white/5 max-w-md w-full">
        <h1 className="text-3xl font-semibold text-slate-100 mb-2">
          Prioritization Matrix
        </h1>
        <p className="text-sm text-slate-300 mb-6">
          Eisenhower todo med AI og Google Calendar. Log ind med Google.
        </p>
        <button
          type="button"
          onClick={() => signIn('google', { callbackUrl: '/inbox' })}
          className="w-full bg-app-accent text-white px-4 py-3 rounded-lg text-sm font-medium shadow-md hover:opacity-90 active:scale-95 transition duration-200"
        >
          Log ind med Google
        </button>
      </div>
    </div>
  )
}
