import { createFileRoute } from '@tanstack/react-router'
import { fetchRscGreeting, fetchRscUserList } from '~/utils/rsc'

export const Route = createFileRoute('/rsc-basic')({
  loader: async () => {
    const [greeting, users] = await Promise.all([
      fetchRscGreeting(),
      fetchRscUserList(),
    ])
    return { ...greeting, ...users }
  },
  component: RscBasicPage,
})

function RscBasicPage() {
  const { Greeting, UserList } = Route.useLoaderData()
  return (
    <div className="p-2">
      <h2>RSC Basic Demo</h2>
      <p>This page demonstrates basic React Server Components rendered via <code>renderServerComponent</code>.</p>
      <hr />
      {Greeting}
      <hr />
      {UserList}
    </div>
  )
}
