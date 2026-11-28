# Premium Immersive UI — The Himalayan Horizon

Status: proposed design direction; implementation and screen-level approval pending.

## Reference
User-provided fitness mobile UI screenshot, Instagram @shahinurstk02, post dated 12 September 2025. Reference visual principles, not proprietary artwork or an exact clone.

## Visual system
Soft gradients, translucent surfaces where appropriate, rounded cards, asymmetric Bento layouts, realistic destination photography, floating navigation, restrained shadows and clear typography. Preserve existing public Forest Green and Gold brand; explore blue and ivory accents. Preserve approved management dashboards.

## Screens
- Home: immersive mountain hero, destination discovery, cab, stays and planner entry points.
- AI Trip Planner: interactive itinerary, map, budget and route cards.
- Cab: realistic vehicle assets, capacity-specific seat selection, availability and confirmation.
- Homestays and villages: editorial photography, amenities and booking cards.
- PWA: floating navigation, responsive layouts and lightweight loading animation.

## Motion
Use subtle micro-interactions, scroll-driven transitions and page transitions. Motion is a proposed enhancement, not verified from the static reference. Respect prefers-reduced-motion and avoid blocking interactions.

## Implementation guardrails
Reuse existing Next.js components and centralized design tokens; do not alter authentication, booking logic, Supabase schemas or approved management layouts solely for styling. Use licensed optimized assets. Preserve accessibility, keyboard navigation, contrast and mobile performance.

## Acceptance
Provide mobile and desktop staging previews; test navigation, booking flows, reduced motion, accessibility and performance. Obtain design approval before merging visual changes. This document does not implement or deploy UI changes.
