import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { NextConfig } from 'next'

const apiProxyTarget = process.env.API_PROXY_TARGET
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: repoRoot,
  async rewrites() {
    if (!apiProxyTarget) return []

    return [
      {
        source: '/api/:path*',
        destination: `${apiProxyTarget}/api/:path*`,
      },
    ]
  },
}

export default nextConfig
