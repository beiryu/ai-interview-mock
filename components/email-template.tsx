import * as React from "react"

interface EmailTemplateProps {
  url: string
  productName: string
}

/** Magic-link sign-in email. */
export function EmailTemplate({ url, productName }: EmailTemplateProps) {
  return (
    <div
      style={{ fontFamily: "sans-serif", maxWidth: "600px", margin: "0 auto" }}
    >
      <h1 style={{ color: "#333", fontSize: "24px", marginBottom: "24px" }}>
        Sign in to {productName}
      </h1>
      <p style={{ color: "#555", fontSize: "16px", marginBottom: "24px" }}>
        Click the button below to sign in. The link expires in 5 minutes and can
        be used once.
      </p>
      <a
        href={url}
        style={{
          backgroundColor: "#0070f3",
          color: "white",
          padding: "12px 24px",
          textDecoration: "none",
          borderRadius: "4px",
          display: "inline-block",
          marginBottom: "24px",
        }}
      >
        Sign in
      </a>
      <p style={{ color: "#777", fontSize: "14px" }}>
        If you didn&apos;t request this email, you can safely ignore it.
      </p>
    </div>
  )
}
