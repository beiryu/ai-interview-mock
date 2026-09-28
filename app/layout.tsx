import { Outfit as FontOutfit } from "next/font/google"

import "@/styles/globals.css"
import { siteConfig } from "@/config/defaults/site"
import { absoluteUrl, cn } from "@/lib/utils"
import { Toaster } from "@/components/ui/toaster"
import { Analytics } from "@/components/analytics"
import { TailwindIndicator } from "@/components/tailwind-indicator"
import { ThemeProvider } from "@/components/theme-provider"

import { ReactQueryProvider } from "./_provider/react-query-provider"

const fontOutfit = FontOutfit({
  subsets: ["latin"],
  variable: "--font-outfit",
})

interface RootLayoutProps {
  children: React.ReactNode
}

// TODO: Add metadata
export const metadata = {
  metadataBase: new URL(siteConfig.url),
  alternates: {
    canonical: "/",
    languages: {
      "en-US": "/en-US",
    },
  },
  // title: {
  //   default: siteConfig.name,
  //   template: `%s | ${siteConfig.name}`,
  // },
  // description: siteConfig.description,
  // keywords: [
  //   "Next.js",
  //   "React",
  //   "Tailwind CSS",
  //   "Server Components",
  //   "Radix UI",
  // ],
  // authors: [
  //   {
  //     name: "beiryu",
  //     url: "https://beiryu.com",
  //   },
  // ],
  // creator: "beiryu",
  // themeColor: [
  //   { media: "(prefers-color-scheme: light)", color: "white" },
  //   { media: "(prefers-color-scheme: dark)", color: "black" },
  // ],
  openGraph: {
    // type: "website",
    // locale: "en_US",
    // url: siteConfig.url,
    // title: siteConfig.name,
    // description: siteConfig.description,
    // siteName: siteConfig.name,
    images: [`${siteConfig.url}/og.jpg`],
  },
  // twitter: {
  //   card: "summary_large_image",
  //   title: siteConfig.name,
  //   description: siteConfig.description,
  //   images: [`${siteConfig.url}/og.jpg`],
  //   creator: "@beiryu",
  // },
  // icons: {
  //   icon: "/favicon.ico",
  //   shortcut: "/favicon-16x16.png",
  //   apple: "/apple-touch-icon.png",
  // },
  // manifest: `${siteConfig.url}/site.webmanifest`,
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head />
      <body
        className={cn(
          "min-h-screen bg-background font-sans antialiased",
          fontOutfit.variable
        )}
        suppressHydrationWarning
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <ReactQueryProvider>
            {children}
            <Analytics />
            <Toaster />
            <TailwindIndicator />
          </ReactQueryProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
