# Verification screenshots

Full-page screenshots of the VHSND Supervisor Dashboard, captured via Playwright
MCP against `next dev`. Desktop (1440px) covers all 6 sections × light/dark,
plus sub-states (`06b` high-risk filtered, `07b`/`07c` referral form empty/filled).
Mobile (390px, light only) covers the same 6 sections for a responsive spot-check.

## Known non-issue: dev-tools overlay in mobile-06-high-risk-light.png

The Next.js dev-tools badge and TanStack Query devtools icon (both
fixed-position, `next dev`-only — never present in a production build) overlap
the "Ipsita Rout" card partway down that page. This is a full-page screenshot
stitching artifact from fixed-position elements repeating at their viewport
position in each stitched slice, not a real layout defect in the app. Do not
re-flag it in a later pass; to avoid it entirely next time, capture against
`next build && next start` instead of `next dev`, or hide the dev overlays
before shooting.
