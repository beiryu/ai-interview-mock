import "./env.mjs"

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["@prisma/client"],
  // Interviews became jobs (one interview per job): keep old links working
  async redirects() {
    return [
      {
        source: "/dashboard/interviews",
        destination: "/dashboard/jobs",
        permanent: false,
      },
      {
        source: "/dashboard/interviews/:id/cv",
        destination: "/dashboard/jobs/:id?tab=cv",
        permanent: false,
      },
      {
        source: "/dashboard/interviews/:id/sessions",
        destination: "/dashboard/jobs/:id?tab=sessions",
        permanent: false,
      },
      {
        source: "/dashboard/interviews/:id",
        destination: "/dashboard/jobs/:id/live",
        permanent: false,
      },
    ]
  },
}

export default nextConfig
