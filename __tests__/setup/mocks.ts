/**
 * Global Mocks
 * Mock external services and APIs that shouldn't be called during tests
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { vi } from 'vitest'

/**
 * Mock fetch for external API calls
 * Individual tests can override this with more specific mocks
 */
export const mockFetch = vi.fn()

// Store original fetch
const originalFetch = global.fetch

// Mock by default, but allow tests to restore if needed
global.fetch = mockFetch as any

export function restoreFetch() {
  global.fetch = originalFetch
}

export function mockFetchResponse(data: any, options?: { status?: number; ok?: boolean }) {
  mockFetch.mockResolvedValueOnce({
    ok: options?.ok ?? true,
    status: options?.status ?? 200,
    json: async () => data,
    text: async () => JSON.stringify(data),
    headers: new Headers(),
  } as Response)
}

export function mockFetchError(error: string) {
  mockFetch.mockRejectedValueOnce(new Error(error))
}

/**
 * Mock localStorage
 */
export const mockLocalStorage = (() => {
  let store: Record<string, string> = {}

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString()
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
    get length() {
      return Object.keys(store).length
    },
    key: (index: number) => {
      const keys = Object.keys(store)
      return keys[index] || null
    },
  }
})()

// Assign to global
global.localStorage = mockLocalStorage as any

/**
 * Mock window.location
 */
export function mockWindowLocation(href: string) {
  delete (window as any).location
  window.location = {
    href,
    origin: new URL(href).origin,
    hostname: new URL(href).hostname,
    port: new URL(href).port,
    pathname: new URL(href).pathname,
    search: new URL(href).search,
    hash: new URL(href).hash,
  } as any
}

/**
 * Mock console methods for cleaner test output
 */
export function suppressConsole(methods: Array<'log' | 'warn' | 'error' | 'info'> = ['error', 'warn']) {
  const mocks: Record<string, any> = {}
  
  methods.forEach(method => {
    mocks[method] = console[method]
    console[method] = vi.fn()
  })

  return () => {
    methods.forEach(method => {
      console[method] = mocks[method]
    })
  }
}

