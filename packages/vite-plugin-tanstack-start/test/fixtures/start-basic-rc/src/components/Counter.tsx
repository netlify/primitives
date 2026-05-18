import * as React from 'react'

/**
 * A client-only interactive counter component.
 * Used as a child slot inside a server-rendered composite component
 * to demonstrate RSC composition with client interactivity.
 */
export function Counter() {
  const [count, setCount] = React.useState(0)
  // Flip to true on the client after hydration completes. Tests read this
  // attribute to wait for interactivity before dispatching events.
  const [hydrated, setHydrated] = React.useState(false)
  React.useEffect(() => {
    setHydrated(true)
  }, [])
  return (
    <div data-testid="client-counter" data-hydrated={hydrated}>
      <p>Client-side counter: <span data-testid="counter-value">{count}</span></p>
      <button data-testid="counter-button" onClick={() => setCount((c) => c + 1)}>
        Increment
      </button>
    </div>
  )
}
