import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthProvider } from './components/AuthProvider'
import { ToastProvider } from './components/ToastProvider'
// Self-hosted so visitors' IP addresses are not sent to Google Fonts.
import '@fontsource-variable/bricolage-grotesque/opsz.css'
import './index.css'
import { startAutoUpdate } from './lib/pwa'
import { router } from './router'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: true, retry: 1 },
  },
})

startAutoUpdate()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
