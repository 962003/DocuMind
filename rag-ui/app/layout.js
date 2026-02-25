
import './globals.css'

export const metadata = {
  title: 'RAG Document Chat',
  description: 'Mint themed AI Document Chat'
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
