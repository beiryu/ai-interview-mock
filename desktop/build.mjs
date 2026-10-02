// Bundles the Electron main + preload scripts into desktop/dist (CommonJS),
// fetching the Electron binary first if the package install skipped it.
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { build } from "esbuild"

const electronDir = "node_modules/electron"
const binary = existsSync(`${electronDir}/path.txt`)
  ? `${electronDir}/dist/${readFileSync(
      `${electronDir}/path.txt`,
      "utf8"
    ).trim()}`
  : null
if (!binary || !existsSync(binary)) {
  console.log("desktop: downloading the Electron binary…")
  execFileSync(process.execPath, [`${electronDir}/install.js`], {
    stdio: "inherit",
  })
}

const common = {
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  sourcemap: true,
  // Resolved from node_modules at runtime (audiotee ships a native binary)
  external: ["electron", "audiotee"],
  logLevel: "warning",
}

await Promise.all([
  build({
    ...common,
    entryPoints: ["desktop/main.ts"],
    outfile: "desktop/dist/main.js",
  }),
  build({
    ...common,
    entryPoints: ["desktop/preload.ts"],
    outfile: "desktop/dist/preload.js",
  }),
])
console.log("desktop: built desktop/dist")
