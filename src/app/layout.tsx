import type { Metadata } from 'next'
import './globals.css'
import { UserProvider } from '@/context/UserContext'

export const metadata: Metadata = {
  title:       'Incelicas',
  description: 'A rede da galera — anime, BBB, música, séries, filmes e livros.',
  icons: {
    icon:     '/logo.svg',
    shortcut: '/logo.svg',
    apple:    '/logo.svg',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <body>
        <UserProvider>{children}</UserProvider>
      </body>
    </html>
  )
}
