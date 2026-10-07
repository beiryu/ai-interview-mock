import { MetadataRoute } from "next"

// Private, sign-in-only app: keep it out of search indexes
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: "/",
    },
  }
}
