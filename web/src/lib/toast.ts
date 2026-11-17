import { createContext, useContext } from 'react'

export const ToastContext = createContext<(message: string) => void>(() => {})

/** Shows a short status message at the bottom of the screen. */
export const useToast = () => useContext(ToastContext)
