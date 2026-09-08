import type { FastifyPluginAsync } from 'fastify'
import { fromNodeHeaders } from 'better-auth/node'
import type { BizzatAuth } from './auth.js'

export interface AuthRoutesOptions {
  auth: BizzatAuth
  baseUrl: string
}

export const authRoutes: FastifyPluginAsync<AuthRoutesOptions> = async (
  app,
  options,
) => {
  app.route({
    method: ['GET', 'POST'],
    url: '/api/auth/*',
    async handler(request, reply) {
      const url = new URL(request.url, options.baseUrl)
      const headers = fromNodeHeaders(request.headers)
      const hasBody = request.method !== 'GET' && request.method !== 'HEAD' && request.body !== undefined
      const authRequest = new Request(url, {
        method: request.method,
        headers,
        ...(hasBody ? { body: JSON.stringify(request.body) } : {}),
      })

      const response = await options.auth.handler(authRequest)
      reply.status(response.status)

      response.headers.forEach((value, key) => {
        if (key.toLowerCase() !== 'set-cookie') reply.header(key, value)
      })

      const cookies = response.headers.getSetCookie()
      if (cookies.length > 0) reply.header('set-cookie', cookies)

      const body = response.body ? await response.text() : null
      return reply.send(body)
    },
  })
}
