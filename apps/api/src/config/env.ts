export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production'
  host: string
  port: number
  databaseUrl: string
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const nodeEnv = env.NODE_ENV ?? 'development'
  if (!['development', 'test', 'production'].includes(nodeEnv)) {
    throw new Error(`Unsupported NODE_ENV: ${nodeEnv}`)
  }

  const databaseUrl = env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL is required')

  const port = Number(env.API_PORT ?? '4000')
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error('API_PORT must be a valid TCP port')
  }

  return {
    nodeEnv: nodeEnv as AppConfig['nodeEnv'],
    host: env.API_HOST ?? '0.0.0.0',
    port,
    databaseUrl,
  }
}
