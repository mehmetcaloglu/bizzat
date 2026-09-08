import { Type } from 'typebox'

export const UserRoleSchema = Type.Union([
  Type.Literal('user'),
  Type.Literal('moderator'),
  Type.Literal('admin'),
])

export const MeResponseSchema = Type.Object({
  user: Type.Object({
    id: Type.String({ format: 'uuid' }),
    name: Type.String(),
    email: Type.String({ format: 'email' }),
  }),
  profile: Type.Object({
    role: UserRoleSchema,
  }),
})
