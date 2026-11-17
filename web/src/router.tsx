import { createRootRoute, createRoute, createRouter, Link } from '@tanstack/react-router'
import { AppShell } from './components/AppShell'
import { EmptyState, Page } from './components/Page'

const rootRoute = createRootRoute({
  component: AppShell,
  notFoundComponent: () => (
    <Page title="Page not found">
      <EmptyState title="This page doesn’t exist.">
        Check the address, or{' '}
        <Link to="/" className="text-ink underline underline-offset-3">
          go to your list
        </Link>
        .
      </EmptyState>
    </Page>
  ),
})

const myListRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: () => (
    <Page title="Your list" lead="Things you’d like, shared with the Circles you choose.">
      <EmptyState title="Your list is empty.">Paste a link from any store to add your first wish.</EmptyState>
    </Page>
  ),
})

const circlesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/circles',
  component: () => (
    <Page title="Circles" lead="Private groups where you see each other’s lists.">
      <EmptyState title="You’re not in a Circle yet.">
        Create one and share its invite code, or join with a code someone sent you.
      </EmptyState>
    </Page>
  ),
})

const activityRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/activity',
  component: () => (
    <Page title="Activity">
      <EmptyState title="Nothing new.">New items and price drops from your Circles will show up here.</EmptyState>
    </Page>
  ),
})

const receivedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/received',
  component: () => (
    <Page title="Received" lead="Gifts you’ve marked as received, and who gave them.">
      <EmptyState title="No gifts received yet.">
        When you get something from your list, mark it received to see who gave it.
      </EmptyState>
    </Page>
  ),
})

const routeTree = rootRoute.addChildren([myListRoute, circlesRoute, activityRoute, receivedRoute])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
