import { createFileRoute } from '@tanstack/react-router'
import { CompositeComponent } from '@tanstack/react-start/rsc'
import { fetchRscCard } from '~/utils/rsc'
import { Counter } from '~/components/Counter'

export const Route = createFileRoute('/rsc-composite')({
  loader: () => fetchRscCard(),
  component: RscCompositePage,
})

function RscCompositePage() {
  const { Card } = Route.useLoaderData()
  return (
    <div className="p-2">
      <h2>RSC Composite Demo</h2>
      <p>
        This page demonstrates <code>createCompositeComponent</code> with children slots.
        The card shell is rendered on the server, while the counter inside is a client component.
      </p>
      <hr />
      <CompositeComponent src={Card}>
        <Counter />
      </CompositeComponent>
    </div>
  )
}
