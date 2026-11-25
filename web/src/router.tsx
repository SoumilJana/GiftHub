import { createRootRoute, createRoute, createRouter, Link, Outlet } from '@tanstack/react-router'
import { AppLayout } from './components/AppLayout'
import { EmptyState, Page } from './components/Page'
import { CirclePage } from './pages/Circle'
import { CirclesPage } from './pages/Circles'
import { CircleSettingsPage } from './pages/CircleSettings'
import { HelpPage } from './pages/Help'
import { IntroPage } from './pages/Intro'
import { JoinPage } from './pages/Join'
import { CookiesPage, PrivacyPage, TermsPage } from './pages/Legal'
import { MyListPage } from './pages/MyList'
import { ResetPasswordPage, UpdatePasswordPage } from './pages/Password'
import { ProfilePage } from './pages/Profile'
import { SharePage } from './pages/Share'
import { ReceivedPage } from './pages/Received'
import { SignInPage } from './pages/SignIn'
import { WelcomePage } from './pages/Welcome'

const rootRoute = createRootRoute({
  component: Outlet,
  notFoundComponent: () => (
    <div className="px-4 py-10 shell:px-11">
      <Page title="Page not found">
        <EmptyState title="This page doesn’t exist.">
          Check the address, or{' '}
          <Link to="/" className="font-semibold text-plum underline underline-offset-3">
            go to your list
          </Link>
          .
        </EmptyState>
      </Page>
    </div>
  ),
})

// Signed-out screens
const signInRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sign-in',
  validateSearch: (s: Record<string, unknown>): { redirect?: string; mode?: 'sign-up' } => ({
    redirect: typeof s.redirect === 'string' ? s.redirect : undefined,
    mode: s.mode === 'sign-up' ? 'sign-up' : undefined,
  }),
  component: SignInPage,
})
const resetRoute = createRoute({ getParentRoute: () => rootRoute, path: '/reset-password', component: ResetPasswordPage })
const updatePasswordRoute = createRoute({ getParentRoute: () => rootRoute, path: '/update-password', component: UpdatePasswordPage })
const joinRoute = createRoute({ getParentRoute: () => rootRoute, path: '/join/$code', component: JoinPage })

// Public reading pages, signed in or out
const introRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/intro',
  validateSearch: (s: Record<string, unknown>): { redirect?: string } => ({ redirect: typeof s.redirect === 'string' ? s.redirect : undefined }),
  component: IntroPage,
})
const helpRoute = createRoute({ getParentRoute: () => rootRoute, path: '/help', component: HelpPage })
const privacyRoute = createRoute({ getParentRoute: () => rootRoute, path: '/privacy', component: PrivacyPage })
const termsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/terms', component: TermsPage })
const cookiesRoute = createRoute({ getParentRoute: () => rootRoute, path: '/cookies', component: CookiesPage })

// Signed-in area
const appRoute = createRoute({ getParentRoute: () => rootRoute, id: 'app', component: AppLayout })

const str = (v: unknown) => (typeof v === 'string' && v ? v.slice(0, 2000) : undefined)
const myListRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/',
  // ?add=<link>&name=<guess>: open the add sheet with them (from the Share menu).
  validateSearch: (s: Record<string, unknown>): { add?: string; name?: string } => ({ add: str(s.add), name: str(s.name) }),
  component: MyListPage,
})
// The Share menu target (manifest `share_target`, Android). Signed-out people sign in first and come back here.
const shareRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/share',
  validateSearch: (s: Record<string, unknown>): { title?: string; text?: string; url?: string } => ({ title: str(s.title), text: str(s.text), url: str(s.url) }),
  component: SharePage,
})
const welcomeRoute = createRoute({ getParentRoute: () => appRoute, path: '/welcome', component: WelcomePage })
const circlesRoute = createRoute({ getParentRoute: () => appRoute, path: '/circles', component: CirclesPage })
const circleRoute = createRoute({ getParentRoute: () => appRoute, path: '/circles/$circleId', component: CirclePage })
const circleSettingsRoute = createRoute({ getParentRoute: () => appRoute, path: '/circles/$circleId/settings', component: CircleSettingsPage })
const receivedRoute = createRoute({ getParentRoute: () => appRoute, path: '/received', component: ReceivedPage })
const profileRoute = createRoute({ getParentRoute: () => appRoute, path: '/profile', component: ProfilePage })

const routeTree = rootRoute.addChildren([
  signInRoute,
  resetRoute,
  updatePasswordRoute,
  joinRoute,
  introRoute,
  helpRoute,
  privacyRoute,
  termsRoute,
  cookiesRoute,
  appRoute.addChildren([myListRoute, shareRoute, welcomeRoute, circlesRoute, circleRoute, circleSettingsRoute, receivedRoute, profileRoute]),
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
