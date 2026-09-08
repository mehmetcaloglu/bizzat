import { Type } from 'typebox'

export const HealthResponseSchema = Type.Object({
  status: Type.Literal('ok'),
})

export const ReadyResponseSchema = Type.Object({
  status: Type.Literal('ready'),
  database: Type.Literal('ok'),
})
