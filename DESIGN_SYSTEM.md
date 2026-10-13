# SMIS SEO / Resource Page Design System

Version: 1.0 — 14 Oct 2026

This is mandatory for future Presa-generated St. Mary’s SEO, resource and authority pages.

## Direction

Refined, minimal, calm and high-trust. St. Mary’s should feel premium and academic rather than like a generic coaching landing-page template.

Brand anchors:
- Red: `#C80000`
- Navy: `#131E35`
- Dark grey: `#545454`
- Neutral surfaces: `#F6F7F9`, white, soft borders

## Typography

- Use a controlled modern sans-serif hierarchy suitable for a premium education site.
- Resource pages should use a consistent system stack unless a site-wide approved brand font is available.
- Desktop H1: approximately 44–72px responsive.
- Mobile H1: approximately 35–48px responsive.
- Body copy: normally 15–19px with line-height at least 1.55.
- Keep text columns readable; avoid long full-width paragraphs.
- Avoid excessive all-caps, over-bold text and theme-default decorative fonts.

## Layout

- Full-bleed hero is allowed; internal content max-width ~1160px.
- Generous negative space.
- Use visual hierarchy before adding decoration.
- Desktop multi-column grids must collapse to 2 columns on tablet and 1 column on phone where density would otherwise suffer.
- No horizontal scrolling at a 390px viewport.
- Mobile buttons become full width when that improves usability.
- Avoid dense grids of near-identical cards.

## WordPress implementation

Critical lesson from the first NEET resource pages:

**Do not paste authored raw HTML directly into post_content without a Custom HTML block.** WordPress automatic paragraph formatting (`wpautop`) can inject `<p>` tags into cards/links and damage layouts.

For authored HTML/CSS resource pages:
- wrap the page in a Gutenberg `<!-- wp:html --> ... <!-- /wp:html -->` block;
- scope CSS to a unique page/root class;
- hide the theme title strip on a custom authority page when the authored content already contains the H1;
- purge WP Rocket/object/Elementor caches after structural changes;
- do not use inline style attributes for every element; prefer scoped reusable classes.

## Resource status UX

- Never make unavailable resources look like working links.
- Label queued content clearly, e.g. `Verification queue`.
- Do not publish empty year/chapter/question placeholders simply to occupy URLs.
- A disabled resource should still explain what is happening instead of appearing broken.

## Accessibility

- Strong text/background contrast, especially small labels.
- Practical tap targets around 44px or more.
- Semantic H1 → H2 → H3 hierarchy.
- Do not communicate status by colour alone.
- Link text should describe the destination/action.

## CTA rules

- The resource itself is the primary experience.
- Sales/admission CTAs are contextual and secondary.
- Prefer 1–2 meaningful CTA choices in a section rather than button clutter.
- Give users a clear back path in nested resource areas.

## Mandatory QA before a new page is considered complete

Review both desktop and mobile (target phone width: 390px) for:
- duplicate page-title/breadcrumb bands;
- header overlap;
- font size/weight consistency;
- accidental theme styles;
- broken card/link markup;
- grid wrapping;
- horizontal overflow;
- button overflow or cramped CTAs;
- low-contrast small text;
- unavailable resources that look clickable;
- excessive whitespace or dense sections;
- heading hierarchy;
- WordPress `wpautop` corruption.

Run mobile Lighthouse accessibility/SEO checks after major production pages are published. Site-wide theme/plugin issues should be separated from issues introduced by the authored page itself.
