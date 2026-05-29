import type { Metadata } from 'next'
export const metadata: Metadata = { title: 'Timespace' }
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body style={{ margin: 0, background: '#04030c', overflow: 'hidden' }}>
        {children}
      </body>
    </html>
  )
}
