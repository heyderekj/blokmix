import { describe, expect, it } from 'vitest'
import { allowedOrigin } from '@/core/commands/bridge'

describe('who may drive the local agent bridge', () => {
  it('lets Blokmix in, locally or where it is hosted, and nobody else', () => {
    expect(allowedOrigin('http://localhost:5173')).toBe(true)
    expect(allowedOrigin('http://127.0.0.1:8000')).toBe(true)
    expect(allowedOrigin('https://blokmix-production-l9esns.laravel.cloud')).toBe(true)
    expect(allowedOrigin('https://blokmix.com')).toBe(true)
    expect(allowedOrigin('http://blokmix.com')).toBe(false)
    expect(allowedOrigin('https://blokmix.com.evil.example')).toBe(false)
    expect(allowedOrigin('https://evil-production.laravel.cloud')).toBe(false)
    expect(allowedOrigin(undefined)).toBe(false)
    expect(allowedOrigin('https://staging.blokmix.com')).toBe(false)
    expect(allowedOrigin('https://staging.blokmix.com', ['https://staging.blokmix.com'])).toBe(true)
  })
})
