import type { NextConfig } from 'next'
import path from 'node:path'
const config: NextConfig = {
  poweredByHeader: false,
  turbopack: { root: path.resolve(process.cwd(), '../..') },
  outputFileTracingRoot: path.resolve(process.cwd(), '../..'),
  // The generated .env.production contains only cloud resource references.
  outputFileTracingExcludes: {
    '/*': [
      '../../.local/**/*',
      '../../.git/**/*',
      '../../**/.env.local',
      '../../**/.env.*.local',
      '../../.env*',
    ],
  },
  serverExternalPackages: [
    'nodemailer',
    'docx',
    'pdf-lib',
    '@aws-sdk/client-rds-data',
    '@aws-sdk/client-secrets-manager',
  ],
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
