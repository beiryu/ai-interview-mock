import "./env.mjs"

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
    ],
  },
  serverExternalPackages: [
    "@prisma/client",
    "@openai/agents",
    "@openai/agents-core",
    "@openai/agents-openai",
  ],
}

export default nextConfig
