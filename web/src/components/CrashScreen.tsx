import { Component, type ReactNode } from 'react'

/**
 * Last line of defence: if the app stops rendering, show a way out instead of a
 * blank page. Reloading usually fixes it, as it did for the blank page after sign-in.
 */
export class CrashScreen extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.error('GiftHub stopped rendering', error)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-6 text-plum">
        <h1 className="text-display font-extrabold">Something went wrong</h1>
        <p className="text-plum-soft">GiftHub hit a snag. Reloading the page usually fixes it.</p>
        <button
          type="button"
          className="min-h-11 rounded-full bg-plum px-6 font-semibold text-print"
          onClick={() => window.location.reload()}
        >
          Reload
        </button>
      </main>
    )
  }
}
