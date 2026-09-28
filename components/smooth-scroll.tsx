"use client"

import { ReactNode } from "react"
import { ReactLenis } from "lenis/react"

type Props = {
  children?: ReactNode
}

function SmoothScrolling({ children }: Props) {
  return (
    <ReactLenis root options={{ lerp: 0.05, duration: 0.5 }}>
      {children}
    </ReactLenis>
  )
}

export default SmoothScrolling
