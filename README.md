# Campus Loop

A responsive peer-to-peer student marketplace for U.S. colleges and high schools. Students can post textbooks, lab coats, dorm supplies, and other essentials for sale, trade, or free pickup.

## Features

- School and city/ZIP filters, category search, condition/type/price filters, and sorting
- ChatGPT sign-in with server-side ownership checks
- Persistent listings, saved items, school profiles, conversations, and messages in Cloudflare D1
- Optional JPG, PNG, or WebP item photos in Cloudflare R2
- Listing status controls for available, reserved, and completed exchanges
- Clearly marked sample listings when the marketplace is empty
- Responsive desktop and mobile layouts
- Owner dashboard with protected member metrics and complimentary promotion controls
- Loop Plus: $5 USD/month for up to three clearly labeled promoted listings
- Server-side Stripe subscription checkout and signed payment updates, disabled until securely configured

School names and locations are self-reported. The app does not verify enrollment, process item-sale payments, or provide shipping. Students arrange payment and public local pickup directly. High school students are prompted to involve a parent or guardian.

## Development

Use Node.js 22.13 or newer and npm. Run `npm ci`, `npm run db:generate` after schema changes, and `npm run dev`. Sites manages hosted authentication. Portable loopback development includes the starter's local sign-in simulation. The hosting manifest declares `DB` and `BUCKET` bindings; the owner dashboard requires a server-only owner setting. See [billing setup](docs/BILLING_SETUP.md) for the subscription configuration and payment testing still needed before enabling charges.

Generate the production output with `npm run build`. Apply local D1 migrations with the command documented in `scripts/` / the Sites starter; production migrations are applied by Sites during publishing. Do not change applied migration files.

Source lives in `app/`, schema in `db/schema.ts`, generated migrations in `drizzle/`, and original product illustrations in `public/illustrations/`. The app runs on Vinext and Cloudflare Workers using the Sites build integration.

Run `node --test tests/boost-policy.test.mjs` to verify membership eligibility, agreed pricing, sorting, and webhook signatures.
