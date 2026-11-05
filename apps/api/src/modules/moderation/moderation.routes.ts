import {
  ApiErrorResponseSchema,
  CreateListingAppealRequestSchema,
  CreateListingAppealResponseSchema,
  CreateListingReportRequestSchema,
  CreateListingReportResponseSchema,
  ModerationAppealListResponseSchema,
  ModerationReportListResponseSchema,
  ResolveModerationAppealRequestSchema,
  ResolveModerationAppealResponseSchema,
  ResolveModerationReportRequestSchema,
  ResolveModerationReportResponseSchema,
} from '@bizzat/contracts'
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox'
import type { Kysely } from 'kysely'
import { Type } from 'typebox'
import type { BizzatAuth } from '../../auth/auth.js'
import { getAuthSession } from '../../auth/session.js'
import { AppError } from '../../common/errors/app-error.js'
import type { Database } from '../../db/client.js'
import { AppealRepository } from './appeal.repository.js'
import { AppealService } from './appeal.service.js'
import { hashReporterIp } from './report-abuse.js'
import { requireModerator } from './moderation.authorization.js'
import { ReportRepository } from './report.repository.js'
import { ReportService } from './report.service.js'

export interface ModerationRoutesOptions {
  auth: BizzatAuth
  db: Kysely<Database>
}

const ListingParamsSchema = Type.Object({
  listingId: Type.String({ format: 'uuid' }),
})

const ReportParamsSchema = Type.Object({
  reportId: Type.String({ format: 'uuid' }),
})

const AppealParamsSchema = Type.Object({
  appealId: Type.String({ format: 'uuid' }),
})

const ModerationAppealsQuerySchema = Type.Object({
  status: Type.Optional(Type.Union([
    Type.Literal('pending'),
    Type.Literal('approved'),
    Type.Literal('rejected'),
    Type.Literal('all'),
  ])),
})

const ModerationReportsQuerySchema = Type.Object({
  status: Type.Optional(Type.Union([
    Type.Literal('open'),
    Type.Literal('reviewing'),
    Type.Literal('resolved'),
    Type.Literal('dismissed'),
    Type.Literal('all'),
  ])),
})

export const moderationRoutes: FastifyPluginAsyncTypebox<ModerationRoutesOptions> = async (
  app,
  options,
) => {
  const service = new ReportService(options.db, new ReportRepository(options.db))
  const appealService = new AppealService(options.db, new AppealRepository(options.db))

  app.post('/listings/:listingId/reports', {
    schema: {
      params: ListingParamsSchema,
      body: CreateListingReportRequestSchema,
      response: {
        201: CreateListingReportResponseSchema,
        400: ApiErrorResponseSchema,
        404: ApiErrorResponseSchema,
        409: ApiErrorResponseSchema,
        429: ApiErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const session = await getAuthSession(options.auth, request.headers)
    const reporterIpHash = session ? null : hashReporterIp(request.ip)
    const report = await service.reportListing(
      request.params.listingId,
      request.body,
      session?.user.id ?? null,
      reporterIpHash,
    )
    reply.header('Cache-Control', 'no-store')
    return reply.code(201).send(report)
  })

  app.post('/listings/:listingId/appeal', {
    schema: {
      params: ListingParamsSchema,
      body: CreateListingAppealRequestSchema,
      response: {
        201: CreateListingAppealResponseSchema,
        400: ApiErrorResponseSchema,
        401: ApiErrorResponseSchema,
        404: ApiErrorResponseSchema,
        409: ApiErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const session = await getAuthSession(options.auth, request.headers)
    if (!session) {
      throw new AppError(401, 'UNAUTHENTICATED', 'Oturum açman gerekiyor.')
    }
    const appeal = await appealService.createAppeal(
      request.params.listingId,
      session.user.id,
      request.body,
    )
    reply.header('Cache-Control', 'no-store')
    return reply.code(201).send(appeal)
  })

  app.get('/moderation/appeals', {
    schema: {
      querystring: ModerationAppealsQuerySchema,
      response: {
        200: ModerationAppealListResponseSchema,
        401: ApiErrorResponseSchema,
        403: ApiErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const session = await getAuthSession(options.auth, request.headers)
    if (!session) {
      throw new AppError(401, 'UNAUTHENTICATED', 'Oturum açman gerekiyor.')
    }
    await requireModerator(options.db, session.user.id)
    reply.header('Cache-Control', 'no-store')
    return await appealService.listAppeals(request.query.status ?? 'pending')
  })

  app.patch('/moderation/appeals/:appealId', {
    schema: {
      params: AppealParamsSchema,
      body: ResolveModerationAppealRequestSchema,
      response: {
        200: ResolveModerationAppealResponseSchema,
        400: ApiErrorResponseSchema,
        401: ApiErrorResponseSchema,
        403: ApiErrorResponseSchema,
        404: ApiErrorResponseSchema,
        409: ApiErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const session = await getAuthSession(options.auth, request.headers)
    if (!session) {
      throw new AppError(401, 'UNAUTHENTICATED', 'Oturum açman gerekiyor.')
    }
    await requireModerator(options.db, session.user.id)
    const result = await appealService.resolveAppeal(
      request.params.appealId,
      session.user.id,
      request.body,
    )
    reply.header('Cache-Control', 'no-store')
    return result
  })

  app.get('/moderation/reports', {
    schema: {
      querystring: ModerationReportsQuerySchema,
      response: {
        200: ModerationReportListResponseSchema,
        401: ApiErrorResponseSchema,
        403: ApiErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const session = await getAuthSession(options.auth, request.headers)
    if (!session) {
      throw new AppError(401, 'UNAUTHENTICATED', 'Oturum açman gerekiyor.')
    }
    await requireModerator(options.db, session.user.id)
    reply.header('Cache-Control', 'no-store')
    return await service.listReports(request.query.status ?? 'open')
  })

  app.patch('/moderation/reports/:reportId', {
    schema: {
      params: ReportParamsSchema,
      body: ResolveModerationReportRequestSchema,
      response: {
        200: ResolveModerationReportResponseSchema,
        400: ApiErrorResponseSchema,
        401: ApiErrorResponseSchema,
        403: ApiErrorResponseSchema,
        404: ApiErrorResponseSchema,
        409: ApiErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const session = await getAuthSession(options.auth, request.headers)
    if (!session) {
      throw new AppError(401, 'UNAUTHENTICATED', 'Oturum açman gerekiyor.')
    }
    await requireModerator(options.db, session.user.id)
    const report = await service.resolveReport(
      request.params.reportId,
      session.user.id,
      request.body,
    )
    reply.header('Cache-Control', 'no-store')
    return report
  })
}
