// globals CSS inlined to avoid PostCSS processing in dev
import React from 'react'
import './globals.css'

export const metadata = {
  title: 'Hima Krishi',
  description: "Sikkim's Certified Organic Marketplace",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head />
      <body>{children}</body>
    </html>
  )
}
