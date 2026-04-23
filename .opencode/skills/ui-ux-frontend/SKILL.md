---
name: ui-ux-frontend
description: UI/UX and frontend development skill for the Recur Next.js app — covers design system tokens, component architecture, Tailwind styling conventions, accessibility standards, and frontend best practices
license: MIT
compatibility: opencode
metadata:
  audience: frontend-developers
  stack: nextjs-react-tailwind
---

## Project Context

- **Framework**: Next.js 14.2.0 (App Router)
- **UI**: React 18.2 + React DOM
- **Language**: TypeScript 5.4
- **Styling**: Tailwind CSS 3.4.3 + PostCSS + Autoprefixer
- **Fonts**: Inter (sans) + JetBrains Mono (mono) via `next/font`
- **Component libraries**: None — all components are custom-built
- **Monorepo path**: `apps/web/` is the frontend app
- **Config files**: `apps/web/tailwind.config.js`, `apps/web/src/app/globals.css`

---

## Design System Token Reference

### Color Palette (`recur-*` Tailwind tokens)

| Token | Hex | Usage |
|---|---|---|
| `recur-base` | `#08080F` | Page background |
| `recur-surface` | `#0D0D14` | Section/card backgrounds |
| `recur-card` | `#12121C` | Elevated card backgrounds |
| `recur-purple-tint` | `#1E1535` | Highlighted/accent backgrounds |
| `recur-border` | `#2A2A3E` | Default borders |
| `recur-border-light` | `#3D2D70` | Accent/active borders |
| `recur-deep-purple` | `#4C1D95` | Dark purple accents |
| `recur-primary` | `#7C3AED` | Primary brand color, CTAs |
| `recur-mid-purple` | `#8B5CF6` | Secondary purple |
| `recur-light` | `#A78BFA` | Light purple text/accents |
| `recur-glow` | `#C084FC` | Glow effects, gradients |
| `recur-success` | `#34D399` | Success states |
| `recur-warning` | `#F59E0B` | Warning states |
| `recur-error` | `#F87171` | Error states |
| `recur-sgreen` | `#14F195` | Solana green |
| `recur-spurple` | `#9945FF` | Solana purple |
| `recur-text-heading` | `#F8F8FF` | Headings, emphasis text |
| `recur-text-subheading` | `#C4C4D4` | Subheadings |
| `recur-text-body` | `#8B8BA7` | Body text (default) |
| `recur-text-muted` | `#6B6B8A` | De-emphasized text |
| `recur-text-dim` | `#4B4B6B` | Least prominent text |

### Elevation Model

Use backgrounds to create visual depth — never use box-shadow for elevation:

```
base (#08080F)  →  surface (#0D0D14)  →  card (#12121C)  →  purple-tint (#1E1535)
 page bg             sections              cards              highlights
```

### Font Stack

- **Sans (body/headings)**: `font-sans` → Inter via `var(--font-inter)`
- **Mono (code/stats)**: `font-mono` → JetBrains Mono via `var(--font-mono)`

### Animation Tokens

| Class | Duration | Effect |
|---|---|---|
| `animate-pulse-dot` | 2s | Scale + glow pulse (status indicators) |
| `animate-fade-in-up` | 0.6s | Fade in from below (entrance) |
| `animate-slide-in-right` | 0.5s | Slide in from left (entrance) |
| `animate-float` | 6s | Gentle vertical float (decorative) |
| `animate-glow-pulse` | 3s | Box-shadow glow pulse (emphasis) |
| `animate-tx-fade` | 0.4s | Fade in from above (transaction items) |
| `animate-dot-pulse` | 2s | Status dot pulse (status indicators) |

---

## Reusable Component Classes

These are defined in `globals.css` under `@layer components` and `@layer utilities`. Always use them instead of recreating the same patterns:

### Buttons
- `btn-primary` — Purple filled button with hover scale + brightness
- `btn-secondary` — Transparent bordered button with hover border-color change

### Cards
- `dark-card` — Surface bg, default border, 14px radius, p-6
- `dark-card-elevated` — Card bg (elevated), default border, 14px radius, p-6

### UI Primitives
- `step-badge` — Numbered circle badge (11px mono, purple tint bg, 28px circle)
- `stat-block` — Flex column container for stat displays
- `stat-value` — Large mono heading (26px, 900 weight)
- `stat-label` — Small muted label (11px)

### Text Effects
- `text-gradient` — White-to-purple gradient text (headings)
- `text-gradient-purple` — Full purple spectrum gradient text
- `squiggly-highlight` — Inline text with purple bg tint + wavy underline

### Background Effects
- `dot-grid` — Dot grid pattern overlay
- `hero-radial-glow` — Radial purple glow for hero sections
- `hero-grid-bg` — Subtle grid line pattern

### Animation Utilities
- `section-animate` + `.visible` — Scroll-triggered fade-in-up (use with Intersection Observer)
- `code-line` + `.typed` — Typewriter reveal for code blocks
- `animate-marquee` — Horizontal scroll marquee (trust strip)
- `glow-line-top` — 1px purple gradient line on top edge of cards (via `::before`)
- `typing-cursor` — Blinking cursor after text (via `::after`)
- `step-connector` — Dashed line between step badges (hidden on mobile)

---

## Component Architecture

### Target Directory Structure

When building new components or refactoring, follow this structure:

```
apps/web/src/
├── app/                    # Next.js App Router pages and layouts
│   ├── globals.css         # Global styles, @layer components/utilities
│   ├── layout.tsx          # Root layout (fonts, metadata)
│   └── page.tsx            # Home page (compose from section components)
├── components/
│   ├── ui/                 # Atomic/reusable UI primitives
│   │   ├── Button.tsx      # Wraps btn-primary / btn-secondary
│   │   ├── Card.tsx        # Wraps dark-card / dark-card-elevated
│   │   ├── Badge.tsx       # Step badges, status badges
│   │   ├── StatBlock.tsx   # Stat display component
│   │   └── Input.tsx       # Form inputs
│   ├── layout/             # Structural components
│   │   ├── Navbar.tsx
│   │   ├── Footer.tsx
│   │   ├── Section.tsx     # Reusable section wrapper with section-animate
│   │   └── Container.tsx   # Max-width container
│   ├── sections/           # Page-level content sections
│   │   ├── Hero.tsx
│   │   ├── HowItWorks.tsx
│   │   ├── SDKPreview.tsx
│   │   ├── Dashboard.tsx
│   │   ├── Pricing.tsx
│   │   ├── UseCases.tsx
│   │   ├── FAQ.tsx
│   │   └── CTA.tsx
│   └── icons/              # SVG icon components
│       ├── RecurLogoIcon.tsx
│       └── RecurLogoWordmark.tsx
├── hooks/                  # Custom React hooks
│   ├── useIntersectionObserver.ts
│   └── useScrollProgress.ts
└── lib/                    # Utilities, constants, types
    ├── constants.ts
    └── types.ts
```

### Component Guidelines

- **One component per file**, named in PascalCase matching the filename
- **Named exports only** — no default exports (`export function Button() {}`)
- **Keep components under 150 lines** — split into sub-components if larger
- **Co-locate component-specific types** in the same file
- **Props interfaces**: name as `{Component}Props` using `interface`, not `type`

```tsx
// Good
interface CardProps {
  variant?: "default" | "elevated";
  children: React.ReactNode;
  className?: string;
}

export function Card({ variant = "default", children, className }: CardProps) {
  return (
    <div className={`${variant === "elevated" ? "dark-card-elevated" : "dark-card"} ${className ?? ""}`}>
      {children}
    </div>
  );
}
```

### Refactoring page.tsx

The current `page.tsx` (~1893 lines) is monolithic. When refactoring:

1. Extract SVG icons into `components/icons/`
2. Extract each visual section (Hero, How It Works, etc.) into `components/sections/`
3. Extract repeated UI patterns (cards, buttons, badges) into `components/ui/`
4. Move Intersection Observer logic into `hooks/useIntersectionObserver.ts`
5. Keep `page.tsx` as a thin composition layer that imports and arranges sections

---

## Styling Conventions

### Rules

1. **Always use `recur-*` tokens** — never hardcode hex values in className or inline styles
2. **Dark-first design** — there is no light mode; do not add `dark:` variants
3. **Tailwind utilities first** — avoid inline `style={}` except for truly dynamic values (e.g., calculated positions)
4. **Use globals.css classes** for repeated patterns (`btn-primary`, `dark-card`, etc.)
5. **New reusable patterns** should be added to `@layer components` in `globals.css`
6. **Border radius convention**: `rounded-[10px]` for buttons/pills, `rounded-[14px]` for cards/panels
7. **Font sizes**: use arbitrary values matching the design system: `text-[11px]`, `text-[13px]`, `text-[15px]`, `text-[26px]`
8. **Transitions**: always use `transition-all duration-200` for interactive state changes
9. **Selection color**: already set globally to purple tint — do not override

### className Ordering Convention

Follow this order for Tailwind classes:

```
layout → sizing → spacing → typography → colors → borders → effects → animations → responsive
```

Example:
```tsx
<div className="flex items-center gap-4 w-full px-6 py-3 text-[13px] font-bold text-recur-text-heading bg-recur-surface border border-recur-border rounded-[14px] transition-all duration-200 hover:border-recur-primary md:flex-row">
```

---

## UI/UX Patterns & Best Practices

### Visual Hierarchy

Use the text color scale consistently to establish hierarchy:

```
heading (#F8F8FF)     →  Primary content, titles, emphasis
subheading (#C4C4D4)  →  Section subtitles, secondary headings
body (#8B8BA7)        →  Default body text (set on <body>)
muted (#6B6B8A)       →  Labels, captions, de-emphasized content
dim (#4B4B6B)         →  Disabled states, placeholder text
```

Combine with font weight and size to reinforce hierarchy:
- Headings: `text-recur-text-heading font-bold text-[26px]` or larger
- Subheadings: `text-recur-text-subheading font-semibold text-[15px]`
- Body: inherits from `<body>` — `text-recur-text-body text-[13px]`
- Muted: `text-recur-text-muted text-[11px]`

### Spacing Rhythm

Follow an **8px base grid** using Tailwind's spacing scale:

| Tailwind | Pixels | Usage |
|---|---|---|
| `gap-1` / `p-1` | 4px | Tight inline spacing |
| `gap-2` / `p-2` | 8px | Compact element spacing |
| `gap-3` / `p-3` | 12px | Default inline spacing |
| `gap-4` / `p-4` | 16px | Standard component spacing |
| `gap-6` / `p-6` | 24px | Card padding (convention) |
| `gap-8` / `mt-8` | 32px | Section internal spacing |
| `gap-12` / `py-12` | 48px | Between sections (mobile) |
| `gap-16` / `py-16` | 64px | Between sections (desktop) |
| `py-20` / `py-24` | 80-96px | Major section vertical padding |

### Interactive States

Every interactive element must define these states:

```tsx
// Buttons
className="... hover:scale-[1.02] hover:brightness-110 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-recur-primary focus-visible:ring-offset-2 focus-visible:ring-offset-recur-base"

// Links
className="... hover:text-recur-light transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-recur-primary"

// Cards (clickable)
className="... hover:border-recur-border-light hover:bg-recur-card/50 transition-all duration-200 cursor-pointer"
```

### Micro-interactions

- Use existing animation tokens — do not create new `@keyframes` unless truly needed
- Keep entrance animations under **0.7s** duration
- Use `animate-fade-in-up` for section entrances
- Use `animate-glow-pulse` sparingly — only on primary CTAs or key status indicators
- Use `transition-all duration-200` for hover/focus state changes
- Stagger entrance animations with `animation-delay` via arbitrary values: `[animation-delay:100ms]`

### Loading States

Use skeleton screens, not spinners:

```tsx
// Skeleton pattern
<div className="animate-pulse bg-recur-border rounded-[14px] h-[200px] w-full" />

// Skeleton text line
<div className="animate-pulse bg-recur-border rounded h-4 w-3/4" />
```

### Empty States

Always provide:
1. A descriptive message explaining why it's empty
2. An icon or illustration (use existing SVG patterns)
3. A CTA button to take action

```tsx
<div className="dark-card flex flex-col items-center justify-center py-16 text-center">
  <p className="text-recur-text-muted text-[13px] mb-4">No transactions yet</p>
  <button className="btn-primary">Create your first payment</button>
</div>
```

### Error States

- Use `text-recur-error` for error messages and `border-recur-error` for input borders
- Always provide a clear recovery action
- Never show raw error codes to users — provide human-readable messages

```tsx
<div className="dark-card border-recur-error/50">
  <p className="text-recur-error text-[13px] font-semibold">Transaction failed</p>
  <p className="text-recur-text-muted text-[11px] mt-1">Insufficient SOL balance for this operation.</p>
  <button className="btn-secondary mt-4">Retry transaction</button>
</div>
```

### Success Feedback

- Use `text-recur-success` for success messages
- For blockchain/Solana-specific confirmations, use `text-recur-sgreen`
- Pair with the `animate-fade-in-up` entrance for toast-like feedback

### Glow Effects

Use sparingly for emphasis:
- `glow-line-top` — on primary feature cards only
- `animate-glow-pulse` — on the single most important CTA on the page
- Custom glow: `shadow-[0_0_20px_rgba(124,58,237,0.15)]` for subtle ambient glow

### Scroll Animations

Use the existing `section-animate` pattern with Intersection Observer:

```tsx
// In a custom hook: hooks/useIntersectionObserver.ts
export function useIntersectionObserver(options?: IntersectionObserverInit) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        el.classList.add("visible");
        observer.unobserve(el);
      }
    }, { threshold: 0.1, ...options });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return ref;
}

// Usage
function Section({ children }: { children: React.ReactNode }) {
  const ref = useIntersectionObserver();
  return <section ref={ref} className="section-animate">{children}</section>;
}
```

### Content Width

- Max container: `max-w-container` (1120px) with `mx-auto px-6`
- Full-bleed sections: remove `max-w-container` but keep `px-6` for mobile padding

---

## Responsive Design

### Approach

**Mobile-first**: write base styles for mobile, add breakpoints for larger screens.

### Breakpoints

| Prefix | Min-width | Target |
|---|---|---|
| (base) | 0px | Mobile phones |
| `sm:` | 640px | Large phones / small tablets |
| `md:` | 768px | Tablets |
| `lg:` | 1024px | Laptops / desktops |
| `xl:` | 1280px | Large desktops |

### Layout Patterns

```tsx
// Stack on mobile, row on tablet+
<div className="flex flex-col gap-4 md:flex-row md:gap-8">

// Single column mobile, two columns tablet, three columns desktop
<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">

// Full-width mobile, constrained desktop
<div className="w-full max-w-container mx-auto px-6">
```

### Touch Targets

- Minimum **44x44px** touch target for all interactive elements on mobile
- Use `min-h-[44px] min-w-[44px]` on buttons and links if needed
- Add generous padding to links in navigation: `px-4 py-3`

### Typography Scaling

- Headings: `text-[22px] md:text-[26px] lg:text-[32px]`
- Subheadings: `text-[14px] md:text-[15px]`
- Body: `text-[13px]` (consistent across breakpoints)

---

## Accessibility Standards

### Semantic HTML

- Use `<main>` for primary content, `<nav>` for navigation, `<section>` for content sections
- Use `<button>` for actions, `<a>` for navigation — never `<div onClick>`
- Use heading hierarchy (`h1` > `h2` > `h3`) without skipping levels
- One `<h1>` per page

### ARIA

- Decorative SVGs: `aria-hidden="true"`
- Functional SVGs/icons: `aria-label="Description"`
- Interactive elements without visible text: `aria-label`
- Dynamic content updates: `aria-live="polite"` for non-urgent, `aria-live="assertive"` for errors
- Expandable sections (FAQ): `aria-expanded`, `aria-controls`

### Focus Management

```tsx
// Visible focus ring (use on ALL interactive elements)
className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-recur-primary focus-visible:ring-offset-2 focus-visible:ring-offset-recur-base"
```

- Never remove outline without replacing it with a visible focus indicator
- Use `focus-visible:` (not `focus:`) to avoid showing focus rings on mouse click

### Color Contrast

- `recur-text-heading` (#F8F8FF) on `recur-base` (#08080F) = **19.5:1** (passes AAA)
- `recur-text-body` (#8B8BA7) on `recur-base` (#08080F) = **6.8:1** (passes AA)
- `recur-text-muted` (#6B6B8A) on `recur-base` (#08080F) = **4.6:1** (passes AA for large text)
- `recur-text-dim` (#4B4B6B) on `recur-base` (#08080F) = **3.1:1** (use only for decorative/disabled)
- Never use `recur-text-dim` for actionable or informational content

### Reduced Motion

Wrap animations with `motion-safe:` or provide `motion-reduce:` alternatives:

```tsx
className="motion-safe:animate-fade-in-up motion-reduce:opacity-100"
```

### Screen Reader Content

```tsx
// Visually hidden but accessible
<span className="sr-only">Open navigation menu</span>
```

---

## React / Next.js Patterns

### Server vs Client Components

- **Default to Server Components** — no directive needed
- Add `"use client"` only when the component uses:
  - React hooks (`useState`, `useEffect`, `useRef`, etc.)
  - Browser APIs (`window`, `document`, `IntersectionObserver`)
  - Event handlers (`onClick`, `onChange`, etc.)
- Push `"use client"` boundaries as deep as possible — wrap only the interactive leaf, not entire sections

### Component Patterns

```tsx
// Composition over configuration
// Good: composable
<Card>
  <Card.Header>Title</Card.Header>
  <Card.Body>Content</Card.Body>
</Card>

// Acceptable: prop-driven for simple cases
<Card title="Title" variant="elevated">Content</Card>
```

### Custom Hooks

Extract reusable logic into hooks in `hooks/`:

```tsx
// hooks/useIntersectionObserver.ts — scroll-triggered animations
// hooks/useMediaQuery.ts — responsive logic in JS
// hooks/useScrollPosition.ts — scroll progress tracking
```

### Image Optimization

- Use `next/image` for all raster images
- Set explicit `width` and `height` to prevent layout shift
- Use `priority` prop for above-the-fold images

### Link Navigation

- Use `next/link` for all internal navigation
- External links: `target="_blank" rel="noopener noreferrer"`

---

## Performance Guidelines

1. **Lazy load below-the-fold sections** with Next.js `dynamic()` imports
2. **Avoid layout shift**: set explicit dimensions on images, SVGs, and skeleton placeholders
3. **Minimize client bundles**: keep `"use client"` boundaries small and deep
4. **Memoize expensive renders**: use `React.memo` for list items, `useMemo` for computed values
5. **Prefer CSS animations** (`@keyframes` in Tailwind config) over JS-driven animations
6. **Optimize SVGs**: inline small icons, use `next/image` for complex illustrations
7. **Font loading**: fonts are loaded via `next/font` — never add Google Fonts via `<link>`

---

## When to Use This Skill

Load this skill when:
- Building new UI components or pages in `apps/web/`
- Refactoring existing frontend code or `page.tsx`
- Implementing new design patterns or visual features
- Reviewing frontend code for consistency and best practices
- Adding responsive or accessible behavior
- Working with the Tailwind design system tokens
- Creating animations or interactive elements
