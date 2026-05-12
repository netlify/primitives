import * as React from 'react'
import { createServerFn } from '@tanstack/react-start'
import {
  renderServerComponent,
  createCompositeComponent,
} from '@tanstack/react-start/rsc'

/**
 * A basic server function that renders a server component using renderServerComponent.
 * The component fetches data on the server and renders it — the fetch logic never
 * reaches the client bundle.
 */
export const fetchRscGreeting = createServerFn().handler(async () => {
  // Simulate server-only work (e.g., DB query, secret API call)
  const timestamp = new Date().toISOString()

  const Greeting = await renderServerComponent(
    <div data-testid="rsc-greeting">
      <h2>Hello from a Server Component!</h2>
      <p>This was rendered on the server at {timestamp}.</p>
      <p>
        This content comes from a React Server Component. The rendering logic
        and any server-only dependencies never reach the client bundle.
      </p>
    </div>,
  )

  return { Greeting }
})

/**
 * A server function that fetches data and renders it as a server component.
 * Demonstrates data fetching colocated within an RSC.
 */
export const fetchRscUserList = createServerFn().handler(async () => {
  const res = await fetch('https://jsonplaceholder.typicode.com/users')
  if (!res.ok) {
    throw new Error('Failed to fetch users for RSC')
  }
  const users = (await res.json()) as Array<{ id: number; name: string; email: string }>

  const UserList = await renderServerComponent(
    <div data-testid="rsc-user-list">
      <h3>Users (Server Component)</h3>
      <ul>
        {users.slice(0, 5).map((user) => (
          <li key={user.id} data-testid={`rsc-user-${user.id}`}>
            {user.name} — {user.email}
          </li>
        ))}
      </ul>
    </div>,
  )

  return { UserList }
})

/**
 * A composite component that accepts children slots.
 * The server renders the outer shell, and client components can be
 * passed as children.
 */
export const fetchRscCard = createServerFn().handler(async () => {
  const src = await createCompositeComponent(
    (props: { children?: React.ReactNode }) => (
      <div data-testid="rsc-card" style={{ border: '1px solid #ccc', padding: '16px', borderRadius: '8px' }}>
        <h3>Server-Rendered Card</h3>
        <p>This card shell is rendered on the server.</p>
        <div data-testid="rsc-card-children">{props.children}</div>
      </div>
    ),
  )

  return { Card: src }
})
