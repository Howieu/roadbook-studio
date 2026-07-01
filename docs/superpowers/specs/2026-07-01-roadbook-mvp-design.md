# Roadbook Studio MVP - Design Spec

## Overview
Refactor existing roadbook-studio into a two-step MVP: paste text/screenshots → AI generates structured roadbook. Deploy to Cloudflare Pages + Vercel with pluggable AI backend.

## User Flow
1. **Input Page**: User pastes travel guide text and/or uploads screenshots → clicks "生成路书"
2. **Result Page**: AI-parsed roadbook in London style + QR share link

## Architecture
- Frontend: Static HTML/CSS/JS (no framework)
- Backend: `/api/parse` endpoint, pluggable per platform
  - Cloudflare Pages Functions → Workers AI (Llama 3)
  - Vercel Edge Functions → external LLM API
- Share: LZ-string compression in URL hash (no database)
- Fallback: client-side regex parser when no API available

## Design Direction
"Wanderlust Atlas" - editorial travel journal aesthetic
- Typography: Fraunces (display serif) + Outfit (body sans)
- Colors: warm cream (#f5f4ef), deep teal (#1f5f70), burnt sienna (#c8702e)
- Motion: staggered reveals, smooth step transitions

## Roadbook JSON Schema (unchanged from existing)
```json
{
  "trip": { "title", "destination", "startDate", "endDate", "pace", "interests" },
  "days": [{ "date", "title", "summary", "stops": [{ "time", "name", "type", "description", "mustGo", "durationMinutes", "deadline", "fallback" }] }],
  "lodging": [], "transport": [], "warnings": [], "sourceRecords": []
}
```

## Constraints
- YAGNI: no auth, no database, no user accounts
- Must work as static site (fallback parser) + enhanced with AI when deployed
- Keep existing roadbook-renderer.js and roadbook.css (London style)
