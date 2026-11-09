import type { Metadata } from 'next'
import './globals.css'
export const metadata: Metadata = {
  title: 'Rose Jade AI™ | Your life, thoughtfully supported',
  description: 'A personal AI workspace with user-controlled memory, chat, planning and creation.',
}
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
