import type { FastifyInstance } from 'fastify'
import { AppError } from './app-error.js'

export function registerErrorHandling(app: FastifyInstance): void {
  app.setNotFoundHandler((request, reply) => {
    return reply.status(404).send({
      error: {
        code: 'ROUTE_NOT_FOUND',
        message: 'Endpoint bulunamadı.',
        requestId: request.id,
      },
    })
  })

  app.setErrorHandler((error, request, reply) => {
    if (error.validation) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Gönderilen bilgiler geçerli değil.',
          requestId: request.id,
        },
      })
    }

    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          requestId: request.id,
        },
      })
    }

    request.log.error({ err: error }, 'unhandled request error')

    return reply.status(500).send({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'İşlem tamamlanamadı.',
        requestId: request.id,
      },
    })
  })
}
