import type { NextConfig } from 'next'
import path from 'node:path'
const config: NextConfig = {
  poweredByHeader: false,
  turbopack: { root: path.resolve(process.cwd(), '../..') },
  outputFileTracingRoot: path.resolve(process.cwd(), '../..'),
  outputFileTracingExcludes: { '/*': ['../../.local/**/*', '../../.git/**/*', '../../**/.env*'] },
  serverExternalPackages: ['nodemailer', 'docx', 'pdf-lib'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'Permissions-Policy', value: 'camera=()' },
        ],
      },
    ]
  },
}
export default config
