import './globals.css'

export const metadata = {
  title: 'Weather Advisor',
  description: 'Get personalized weather advice',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
