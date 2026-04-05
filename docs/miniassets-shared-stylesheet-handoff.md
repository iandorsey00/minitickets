# MiniAssets Shared Stylesheet Handoff

## Purpose

Use MiniTickets as the stylesheet base for MiniAssets.

MiniAssets is close enough in product shape and interaction style that it should not maintain its own slightly-different visual system. The goal is a calmer and more consistent cross-app experience, not a second design dialect.

## Core Rule

Start by copying the MiniTickets stylesheet system and only diverge where MiniAssets clearly needs a product-specific exception.

Do not redesign from scratch.

Do not create a parallel token system unless it is intentionally shared across both apps.

## What To Treat As Shared

MiniAssets should adopt the MiniTickets base for:

- root spacing tokens
- root radius tokens
- root surface and text color tokens
- theme attribute model
- accent attribute model
- base typography rules
- Chinese and English font handling
- base button styling
- base input styling
- focus ring behavior
- panel styling
- auth page styling
- top-level shell spacing and structural rhythm
- pill, badge, and low-noise control language

The current MiniTickets source of truth is:

- [`/Users/iandorsey/dev/minitickets/app/globals.css`](/Users/iandorsey/dev/minitickets/app/globals.css)

## Tokens To Preserve

MiniAssets should preserve these core MiniTickets tokens unless there is a strong reason to change them across both apps:

- `--font-size-base`
- `--radius-xl`
- `--radius-lg`
- `--radius-md`
- `--radius-sm`
- `--space-1` through `--space-6`
- `--accent-glow-strong`
- `--accent-glow-soft`
- `--accent-glow-auth-strong`
- `--accent-glow-auth-soft`
- `--shadow-sm`
- `--shadow-md`

It should also preserve the same theme token structure:

- `html[data-theme="light"]`
- `html[data-theme="dark"]`
- `html[data-theme="system"]`

And the same accent token structure:

- `html[data-accent="blue"]`
- `html[data-accent="cyan"]`
- `html[data-accent="teal"]`
- `html[data-accent="green"]`
- `html[data-accent="lime"]`
- `html[data-accent="yellow"]`
- `html[data-accent="orange"]`
- `html[data-accent="red"]`
- `html[data-accent="pink"]`
- `html[data-accent="purple"]`

## Rendering Model To Match

MiniAssets should match MiniTickets in these rendering assumptions:

- `data-theme` on the root html element controls light, dark, or system mode
- `data-accent` on the root html element controls accent color
- CSS variables derive the actual visual treatment from those two attributes
- the body background should use the same restrained atmosphere:
  - radial accent glow
  - low-contrast surface gradients
  - neutral text-first contrast

This matters because users should feel like they stayed in the same product family when moving between MiniTickets and MiniAssets.

## Typography Rules To Match

MiniAssets should keep the same font handling as MiniTickets:

- `Inter` for English and Latin UI text
- `PingFang SC` / `Hiragino Sans GB` / `Noto Sans SC Variable` for Chinese text
- language-aware overrides using `html:lang(...)`
- tighter Chinese headline tracking for classes like `.subtitle-only` and other large display labels when needed

Do not let MiniAssets drift into a different font voice unless both apps intentionally change together.

## Component-Level Patterns To Match

MiniAssets should reuse MiniTickets patterns for:

- primary buttons:
  - filled accent
  - pill shape
  - subtle lift on hover
- secondary or ghost buttons:
  - soft transparent panel fill
  - neutral text
  - shared line color
- inputs:
  - rounded medium radius
  - low-noise filled surface
  - accent focus ring
- cards and panels:
  - soft translucent surface
  - same border weight
  - same shadow family
- badges and pills:
  - restrained color usage
  - no unnecessary saturation
- auth screens:
  - same centered large-brand layout
  - same spacing rhythm
  - same card sizing on desktop and mobile

MiniAssets should not create “close but different” versions of these unless there is a real workflow reason.

## Layout Rules To Match

MiniAssets should generally inherit the same layout language:

- full-height shell
- calm sidebar or topbar spacing
- generous panel padding
- stacked mobile layouts rather than compressed dense rows
- section grouping through spacing and surface contrast, not extra dividers

MiniTickets should remain the baseline reference for:

- shell spacing
- panel padding
- form rhythm
- auth layout
- mobile collapse behavior

## What MiniAssets May Customize

MiniAssets can still have app-specific styles for:

- domain-specific list rows
- asset-location hierarchies
- barcode or QR scanning surfaces
- item-photo layouts
- inventory or storage visualization
- asset condition/status indicators if the semantics differ from tickets

But those app-specific pieces should be layered on top of the shared MiniTickets base instead of replacing it.

## Recommended File Strategy

If MiniAssets is not yet using a shared package, the practical near-term approach is:

1. Copy the relevant MiniTickets base stylesheet structure into MiniAssets.
2. Keep shared sections grouped clearly:
   - root tokens
   - theme tokens
   - accent tokens
   - typography and body defaults
   - controls
   - shell/panel primitives
   - auth primitives
3. Put MiniAssets-specific additions below the shared foundation.
4. Avoid changing shared token names unless both apps are updated together.

If a later shared package is created, these shared sections are the parts that should move first.

## Recommended Extraction Boundary

If MiniTickets and MiniAssets later share a real stylesheet asset layer, the first shared extract should include:

- root design tokens
- theme and accent token maps
- base typography
- button/input/select/textarea primitives
- panel/card primitives
- auth-page primitives
- common responsive breakpoints used by both apps

Keep app-specific selectors out of the shared layer:

- ticket-specific detail layouts
- asset-specific inventory/location layouts
- one-off admin pages
- domain-specific widgets

## Anti-Patterns To Avoid

Avoid:

- creating a second token set with almost the same values
- renaming MiniTickets concepts without improving anything
- changing only one app’s button radius, shadows, or input treatment
- using different accent semantics in each app
- drifting into slightly different auth layouts
- making one app more cluttered just because its domain is different

The goal is not sameness everywhere.

The goal is one recognizably shared system with domain-specific surfaces layered on top.

## Migration Checklist For MiniAssets

When updating MiniAssets, check:

- root tokens match MiniTickets
- theme and accent enums map the same way
- body background treatment feels like the same family
- controls look and focus the same way
- auth page structure matches MiniTickets
- panel spacing and radius feel the same
- mobile spacing and card width behavior feel the same
- Chinese and English typography rules match
- only truly domain-specific UI is visually distinct

## Final Rule

MiniTickets should be treated as the visual base.

MiniAssets should inherit that base and only add domain-specific layers for asset-management workflows.

If a MiniAssets style decision feels “slightly off,” prefer bringing it back toward MiniTickets rather than defending the drift.
