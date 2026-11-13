---
name: Clinical Precision AI
colors:
  surface: '#faf8ff'
  surface-dim: '#d2d9f4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3ff'
  surface-container: '#eaedff'
  surface-container-high: '#e2e7ff'
  surface-container-highest: '#dae2fd'
  on-surface: '#131b2e'
  on-surface-variant: '#3d4947'
  inverse-surface: '#283044'
  inverse-on-surface: '#eef0ff'
  outline: '#6d7a77'
  outline-variant: '#bcc9c6'
  surface-tint: '#006a61'
  primary: '#00685f'
  on-primary: '#ffffff'
  primary-container: '#008378'
  on-primary-container: '#f4fffc'
  inverse-primary: '#6bd8cb'
  secondary: '#00687a'
  on-secondary: '#ffffff'
  secondary-container: '#57dffe'
  on-secondary-container: '#006172'
  tertiary: '#00685d'
  on-tertiary: '#ffffff'
  tertiary-container: '#008376'
  on-tertiary-container: '#f4fffb'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#89f5e7'
  primary-fixed-dim: '#6bd8cb'
  on-primary-fixed: '#00201d'
  on-primary-fixed-variant: '#005049'
  secondary-fixed: '#acedff'
  secondary-fixed-dim: '#4cd7f6'
  on-secondary-fixed: '#001f26'
  on-secondary-fixed-variant: '#004e5c'
  tertiary-fixed: '#71f8e4'
  tertiary-fixed-dim: '#4fdbc8'
  on-tertiary-fixed: '#00201c'
  on-tertiary-fixed-variant: '#005048'
  background: '#faf8ff'
  on-background: '#131b2e'
  surface-variant: '#dae2fd'
typography:
  display:
    fontFamily: Plus Jakarta Sans
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  display-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 38px
    letterSpacing: -0.015em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  title-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.005em
  title-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0em
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.04em
  disclaimer:
    fontFamily: Inter
    fontSize: 10px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.02em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-sm: 1rem
  gutter-lg: 2rem
  margin: 2rem
  margin-sm: 1rem
  margin-lg: 3rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system establishes an environment of surgical precision, calm authority, and clinical dependability. Designed for diagnosticians, clinical researchers, and healthcare operators, the visual aesthetic fuses high-tech diagnostic intelligence with institutional rigor.

The aesthetic direction blends **Minimalism** with subtle **Glassmorphic Precision**:
- Pristine, sterile canvas tones that alleviate cognitive load during high-stakes data analysis.
- Luminescent teal and cyan indicators that direct gaze toward vital differential markers without inducing alarm fatigue.
- Restrained data density paired with razor-sharp alignment and translucent layered containment.
- Clear structural division between definitive diagnostic parameters and probabilistic AI recommendations, supported by persistent clinical disclaimer framing.

## Colors

The palette leverages a clinical daylight baseline paired with deep oceanic neutrals and biophotonic cyan-teal highlights.

- **Primary Canvas & Surfaces**: Clean daylight `#F8FAFC` serves as the primary canvas. Subtle algorithmic surfaces use `#F0FDF4` (success/confirmed stability) and `#F0F9FF` (active diagnostic observation).
- **Typography & High-Contrast Structure**: Deep Navy `#0F172A` delivers authoritative readability for primary metrics and diagnostic headers, supported by slate `#1E293B` for supporting clinical copy and metadata.
- **AI & Active Focus Accents**: `#0D9488` (Deep Teal) provides grounded interactive prominence. `#06B6D4` (Luminous Cyan) and `#14B8A6` (Electric Teal) illuminate machine learning inferences, timeline telemetry, and model confidence ratings.
- **Clinical Triage Alerts**: `#F59E0B` (Soft Alert Amber) signifies borderline abnormalities or pending pathologist reviews. `#EF4444` (Subdued Crimson) highlights urgent physiological warnings or critical model anomalies without visual screeching.

## Typography

The type system pairs **Plus Jakarta Sans** for headlines with **Inter** for dense diagnostic body data, form metrics, and clinical labeling.

- **Plus Jakarta Sans** provides a contemporary, clean, and optimistic structural presence for display headlines, dashboard panel names, and patient summary headers.
- **Inter** handles all tabular figures, medical readings, parameters, and telemetry data. Its neutral letterforms eliminate ambiguity between numbers and letters (`1`, `l`, `I`, `0`, `O`) in diagnostic metrics.
- High-priority metric readouts, AI model probabilities, and clinical disclaimers employ explicit line heights and tracked weights to prevent visual bleed in low-light hospital environments or mobile workstation rounds.

## Layout & Spacing

The layout philosophy follows a responsive **fluid grid** calibrated to 8px spatial multiples, prioritizing immediate scanability across 12 columns on desktop (`>=1280px`), 8 columns on tablet (`768px-1279px`), and 4 columns on mobile (`<768px`).

- Multi-pane clinical layouts anchor persistent patient metadata and global disclaimers to fixed zones, allowing dynamic center panels to flex for scan imagery, waveform streams, or lab matrices.
- Internal component density is modulated strictly via the `space-*` scale to maintain comfortable optical rhythm even when complex multi-source diagnostics are presented simultaneously.

## Elevation & Depth

Visual hierarchy uses a refined hybrid of **tonal layering** and **low-contrast gradient mesh borders** instead of heavy, muddy drop shadows.

- **Surface Level 0 (Canvas)**: Solid `#F8FAFC`.
- **Surface Level 1 (Card/Container)**: Pure `#FFFFFF` with a crisp, hairline outer border (`rgba(226, 232, 240, 0.8)`).
- **Surface Level 2 (AI Inference Panels & Overlays)**: Backdropped with `#FFFFFF` at 92% opacity, supported by a 12px blur (`backdrop-filter: blur(12px)`) and a delicate gradient mesh stroke blending from `rgba(13, 148, 136, 0.25)` to `rgba(6, 182, 212, 0.1)`.
- **Ambient Shadows**: Restricted strictly to contextual dropdowns, critical alerts, and elevated modals. Built using ultra-diffuse dual offsets: `0 4px 20px -2px rgba(15, 23, 42, 0.04), 0 12px 32px -4px rgba(13, 148, 136, 0.08)`.

## Shapes

The geometric signature uses **Rounded** geometry (`0.5rem` / `8px` baseline) for structural components, containers, and data grids, ensuring an architectural, disciplined feel. 

Pill rounding (`9999px`) is reserved specifically for status tags, clinical confidence indicators, telemetry chips, and filter toggles. This distinct contrast allows high-priority categorical metadata to visually separate from data panels and structural card wrappers.

## Components

### Buttons
- **Primary**: Solid Deep Teal (`#0D9488`) fill, white text, subtle cyan glow on hover (`box-shadow: 0 0 16px rgba(6, 182, 212, 0.35)`). Height 40px, rounded to `0.5rem`.
- **Secondary / Ghost**: Pure white background with hairline border (`#CBD5E1`) and deep navy text (`#0F172A`). Interactive state transitions to soft cyan tint (`#F0F9FF`) with `#0D9488` border.
- **Destructive**: Transparent background with `#EF4444` border and text; active hover fills with `#FEF2F2`.

### Badges & Pill Chips
- **AI Decision-Support Badge**: Full pill border (`rounded-full`), padded with `0.25rem 0.75rem`. Gradient hairline border with a soft cyan background (`#F0F9FF`), displaying a pulsing 6px teal node adjacent to confidence percentages (e.g., `98.4% Confidence`).
- **Clinical Triage Badges**:
  - *Stable*: `#F0FDF4` surface, `#15803D` text.
  - *Observation*: `#F0F9FF` surface, `#0284C7` text.
  - *Review Needed*: `#FFFBEB` surface, `#B45309` text.
  - *Critical Action*: `#FEF2F2` surface, `#B91C1C` text.

### Clinical Decision-Support Cards
- Built on Surface Level 1 (`#FFFFFF`) with `rounded-lg` corners.
- Header integrates a distinct top-right AI model lineage indicator and validation stamp.
- Embedded telemetry charts feature cyan-teal gradients over crisp hairline gridlines.

### Input Fields & Controls
- **Inputs**: 40px height, `#FFFFFF` fill, `#CBD5E1` border, inset soft shadow (`inset 0 1px 2px rgba(15, 23, 42, 0.03)`). Focus state transitions border to `#0D9488` with a 3px ring of `rgba(13, 148, 136, 0.15)`.
- **Checkboxes & Radios**: 18px bounding box with `0.25rem` or full circular rounding. Active fill `#0D9488` with clean white micro-icons.

### Lists & Data Grids
- Alternating subtle rows (`#FFFFFF` to `#F8FAFC`).
- 48px standard row height for dense clinical charts; sticky column headers in uppercase `label-sm` slate text (`#64748B`).
- Hover state highlights rows with an ultra-subtle tint (`#F0F9FF`).

### Clinical Disclaimers
- Persistent low-profile banner pinned to diagnostic panels or footer viewports.
- Neutral slate border with translucent background (`rgba(248, 250, 252, 0.95)`), uppercase micro-headline (`disclaimer` token), and high-contrast icon declaring regulatory status (e.g., "Investigational Use / Clinical Decision Support Tool — Verification Required by Licensed Clinician").