import { afterEach, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../src/app.js'

let app: FastifyInstance | undefined

afterEach(async () => {
  if (app) await app.close()
  app = undefined
})

describe('system endpoints', () => {
  it('keeps liveness independent from readiness dependencies', async () => {
    app = buildApp({
      logger: false,
      readinessCheck: async () => {
        throw new Error('health must not call readiness')
      },
    })

    const response = await app.inject({ method: 'GET', url: '/api/v1/health' })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ status: 'ok' })
  })

  it('returns ready when dependency check succeeds', async () => {
    app = buildApp({ logger: false, readinessCheck: async () => undefined })

    const response = await app.inject({ method: 'GET', url: '/api/v1/ready' })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ status: 'ready', database: 'ok' })
  })

  it('returns standard 503 when readiness dependency fails', async () => {
    app = buildApp({
      logger: false,
      readinessCheck: async () => {
        throw new Error('database offline')
      },
    })

    const response = await app.inject({ method: 'GET', url: '/api/v1/ready' })
    const body = response.json()

    expect(response.statusCode).toBe(503)
    expect(body.error.code).toBe('DEPENDENCY_UNAVAILABLE')
    expect(body.error.requestId).toEqual(expect.any(String))
  })

  it('returns the common shape for unknown routes', async () => {
    app = buildApp({ logger: false, readinessCheck: async () => undefined })

    const response = await app.inject({ method: 'GET', url: '/api/v1/not-real' })
    const body = response.json()

    expect(response.statusCode).toBe(404)
    expect(body.error.code).toBe('ROUTE_NOT_FOUND')
    expect(body.error.requestId).toEqual(expect.any(String))
  })
})
