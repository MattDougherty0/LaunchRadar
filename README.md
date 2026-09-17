# LaunchRadar

A working prototype for tracking product updates from multiple companies in one place.

**[View the live prototype](https://launch-radar-view.vercel.app/)**

I built it because meaningful product changes are scattered across changelogs, release notes, press releases, and company posts. LaunchRadar puts those updates into a single feed that is easier to scan and compare.

## Current prototype

- Tracks 286 updates from Figma, Gumroad, Notion, Stripe, Supabase, and Vercel
- Timeline and company views
- Filters for features, pricing, bug fixes, improvements, security, and performance
- Company-level activity summaries
- Links back to the source material
- Scraper and data pipeline for refreshing the feed

## Tech

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS

## Run locally

1. Run `npm install`.
2. Run `npm run dev`.
3. Open `http://localhost:3000`.