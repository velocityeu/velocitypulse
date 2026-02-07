'use client'

import { useState, useCallback } from 'react'

interface FormSubmitState<T> {
  isSubmitting: boolean
  isSubmitted: boolean
  error: string | null
  fieldErrors: Record<string, string> | null
  data: T | null
}

interface FormSubmitOptions<T> {
  url: string
  onSuccess?: (data: T) => void
  onError?: (error: string) => void
  resetOnSuccess?: boolean
}

interface ApiResponse<T> {
  success?: boolean
  message?: string
  error?: string
  details?: Record<string, string>
  data?: T
}

export function useFormSubmit<T = unknown>(options: FormSubmitOptions<T>) {
  const { url, onSuccess, onError, resetOnSuccess = false } = options

  const [state, setState] = useState<FormSubmitState<T>>({
    isSubmitting: false,
    isSubmitted: false,
    error: null,
    fieldErrors: null,
    data: null,
  })

  const reset = useCallback(() => {
    setState({
      isSubmitting: false,
      isSubmitted: false,
      error: null,
      fieldErrors: null,
      data: null,
    })
  }, [])

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault()

      setState((prev) => ({
        ...prev,
        isSubmitting: true,
        error: null,
        fieldErrors: null,
      }))

      const formData = new FormData(e.currentTarget)
      const data = Object.fromEntries(formData)
      const formElement = e.currentTarget

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })

        const result: ApiResponse<T> = await response.json()

        if (!response.ok) {
          // Handle validation errors
          if (result.details) {
            setState((prev) => ({
              ...prev,
              isSubmitting: false,
              fieldErrors: result.details || null,
              error: result.error || 'Validation failed. Please check your input.',
            }))
            onError?.(result.error || 'Validation failed')
            return
          }

          // Handle other errors
          const errorMessage = result.error || 'Something went wrong. Please try again.'
          setState((prev) => ({
            ...prev,
            isSubmitting: false,
            error: errorMessage,
          }))
          onError?.(errorMessage)
          return
        }

        // Success
        setState((prev) => ({
          ...prev,
          isSubmitting: false,
          isSubmitted: true,
          data: result.data || (result as unknown as T),
        }))

        if (resetOnSuccess) {
          formElement.reset()
        }

        onSuccess?.(result.data || (result as unknown as T))
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Network error. Please check your connection.'
        setState((prev) => ({
          ...prev,
          isSubmitting: false,
          error: errorMessage,
        }))
        onError?.(errorMessage)
      }
    },
    [url, onSuccess, onError, resetOnSuccess]
  )

  return {
    ...state,
    handleSubmit,
    reset,
  }
}
