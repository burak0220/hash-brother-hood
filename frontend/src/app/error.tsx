'use client';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-950 px-4">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-full bg-neon-red/10 border border-neon-red/20 flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-neon-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Something went wrong</h2>
        <p className="text-dark-400 text-sm mb-6">
          An unexpected error occurred. Please try again or contact support if the issue persists.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-6 py-2.5 bg-gradient-to-r from-primary-400 to-primary-500 text-dark-950 font-bold text-sm rounded-xl hover:opacity-90 transition-opacity"
          >
            Try Again
          </button>
          <a
            href="/dashboard"
            className="px-6 py-2.5 border border-dark-500/50 text-dark-200 font-bold text-sm rounded-xl hover:border-primary-400/40 hover:text-primary-400 transition-all"
          >
            Go to Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
