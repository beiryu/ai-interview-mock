/**
 * Seeds the account(s) allowed to sign in (ALLOWED_EMAILS), so a fresh
 * database is ready for the magic-link login. Idempotent.
 *
 *   pnpm prisma db seed
 */
import { db } from "../lib/db"

async function main() {
  const emails = (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  if (emails.length === 0) {
    throw new Error("ALLOWED_EMAILS is empty: nothing to seed")
  }

  for (const email of emails) {
    const user = await db.user.upsert({
      where: { email },
      create: { email, name: email.split("@")[0], emailVerified: true },
      update: {},
    })
    console.log(`seeded ${user.email}`)
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => db.$disconnect())
