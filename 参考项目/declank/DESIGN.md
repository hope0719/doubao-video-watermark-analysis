---
name: Declank
description: Minimal dark workspace for cleaning watermarks out of image files
colors:
  accent: "#75d083"
  accent-ink: "#07180c"
  accent-quiet: "#75d0832b"
  bg: "#101112"
  shell: "#141618"
  panel: "#181a1d"
  panel-2: "#1d2024"
  panel-3: "#252930"
  field: "#111315"
  border: "#2b3036"
  border-strong: "#3c434c"
  text: "#f4f1ea"
  soft: "#d7d1c6"
  muted: "#aaa79f"
  warning: "#e4bd5c"
  danger: "#ff9b9b"
  focus: "#94b7ff"
typography:
  headline:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "17px"
    fontWeight: 720
    lineHeight: 1.1
    letterSpacing: "0"
  title:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "13px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "0"
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "12px"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "0"
  badge:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "11px"
    fontWeight: 750
    lineHeight: 1
    letterSpacing: "0"
rounded:
  img: "4px"
  control: "6px"
  panel: "8px"
  pill: "999px"
spacing:
  xs: "6px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "46px"
  button-primary-disabled:
    backgroundColor: "{colors.panel-3}"
    textColor: "{colors.muted}"
    rounded: "{rounded.control}"
  segment:
    backgroundColor: "{colors.field}"
    textColor: "{colors.soft}"
    rounded: "{rounded.control}"
    padding: "8px 10px"
    height: "42px"
  segment-selected:
    backgroundColor: "{colors.accent-quiet}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
  input:
    backgroundColor: "{colors.field}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "0 11px"
    height: "40px"
  badge:
    backgroundColor: "#e4bd5c17"
    textColor: "{colors.warning}"
    rounded: "{rounded.pill}"
    padding: "0 9px"
    height: "24px"
---

# Design System: Declank

## 1. Overview

**Creative North Star: "The Bench Tool"**

Declank is a dark, fixed-height workspace that behaves like a piece of bench equipment: it stays put, says exactly what it does, and gets out of the way of the thing being worked on. The chrome is a near-black neutral ramp; the only saturated color is a single green that reads like a status LED, never decoration. There is no hero, no marketing surface, no narrative scroll. The whole app is one screen that never scrolls on desktop: a control rail on the left, the image on the right.

This system is deliberately minimal and utilitarian. No frills. Depth comes from tonal layering of near-black panels, not from shadows or glass. Type is one family (Inter) in a tight set of small sizes; hierarchy comes from weight and color, not from scale. The image is always the brightest, most contrasted thing on screen; every surface around it is dimmer on purpose so the user can judge the result honestly.

It explicitly rejects the flashy AI-SaaS look its anti-references name: no neon glass effects, no over-animated demos, no gradient heroes, no "transform your workflow" copy. If a surface looks like a landing page or a crypto dashboard, it is wrong.

**Key Characteristics:**
- One screen, no scroll on desktop; the image is the focus, the controls are the surround.
- Near-black tonal layering for depth; shadows are reserved for the image alone.
- A single green accent used only for primary action, current selection, and ready-state. Everything else is neutral.
- One typeface, small sizes, hierarchy through weight and color.
- Honest system state: ready, processing, complete, error each have a plain, specific treatment.

## 2. Colors

A near-black neutral ramp carries the entire interface; one green accent is the only saturated voice, and three semantic colors handle state.

### Primary
- **Signal Green** (`#75d083`): The one accent. Used for the primary "Clean image" button, the selected mode segment (as a 17%-alpha tint, `#75d0832b`), the ready-state dot, and the download link. Nowhere else. On the button it pairs with **Accent Ink** (`#07180c`), a near-black green used only as text/icon color on top of the accent so the label reads as part of the same material.

### Neutral
The interface is built almost entirely from this dark ramp, layered tonally from back to front:
- **Base** (`#101112`): The body background, the darkest layer.
- **Shell** (`#141618`): The app frame behind the workspace.
- **Panel** (`#181a1d`): The control rail surface.
- **Panel-2 / Panel-3** (`#1d2024` / `#252930`): Raised neutral fills, including the disabled button.
- **Field** (`#111315`): Recessed input, select, segment, and drop-zone fills; reads as a well cut into the panel.
- **Border** (`#2b3036`) and **Border-Strong** (`#3c434c`): Hairline dividers and the dashed drop-zone stroke.
- **Text** (`#f4f1ea`): Primary text, a warm off-white (not pure white) for a calmer read on black.
- **Soft** (`#d7d1c6`): Secondary text on controls and headings within panels.
- **Muted** (`#aaa79f`): Tertiary text: field labels, meta, placeholders. Still clears AA on the dark fills.

### Tertiary (semantic state)
- **Warning Amber** (`#e4bd5c`): Mode/status badge text and the badge's tinted pill background. Communicates an in-between or advisory state.
- **Danger Rose** (`#ff9b9b`): Error message text only. A desaturated rose, not a fire-engine red, so failure reads as serious but not alarming on the dark ground.
- **Focus Blue** (`#94b7ff`): The focus-visible outline and glow on every interactive element. Deliberately a different hue from the green accent so focus is never confused with selection.

### Named Rules
**The One Green Rule.** Signal Green appears only on the primary action, the current selection, the ready dot, and the download link. It is never used as a heading color, a border for decoration, or a background fill at full saturation. Its scarcity is what makes it read as "go".

**The Off-White Rule.** Primary text is `#f4f1ea`, never `#ffffff`. Pure white on near-black vibrates; the warm off-white sits calmly and matches the bench-tool restraint.

**The Two-Hue Focus Rule.** Selection is green; focus is blue. Never collapse them into one color. A keyboard user must be able to tell "this is focused" from "this is chosen" at a glance.

## 3. Typography

**Body / UI Font:** Inter (with `ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif` fallback)

**Character:** One neutral, highly legible humanist sans does all the work: headings, labels, data, body. No display face, no mono, no pairing. The bench-tool voice is plain, so the type is plain. Hierarchy is carried by weight (400 → 650 → 700 → 720+) and color (muted → soft → text), never by dramatic size jumps.

### Hierarchy
- **Headline** (Inter 720, 17px, line-height 1.1): The app title "Declank" in the top bar. The single largest text on the screen, and even it is small.
- **Title** (Inter 700, 13px, line-height 1.2): Section labels in the control rail ("Mode") and viewport headers ("After"). Quiet structural signposts.
- **Body** (Inter 400, 14px, line-height 1.45): The base size for status text, meta, and copy. Prose is rare here; keep any of it under 65–75ch.
- **Label** (Inter 650, 12px): Field labels and segment text. Sentence case.
- **Badge** (Inter 750, 11px): The status pill ("Idle", mode name, size). Sentence/lower case, not uppercase.

### Named Rules
**The Fixed-Scale Rule.** All sizes are fixed px, never `clamp()` or fluid. This is product UI viewed at a consistent DPI; a heading that shrinks inside a sidebar looks broken, not responsive.

**The No-Caps Rule.** Labels and badges stay in sentence/lower case with zero tracking. No all-caps tracked eyebrows; they would fight the calm, utilitarian voice.

## 4. Elevation

This system is flat. Depth is conveyed entirely by tonal layering of the near-black neutral ramp (base → shell → panel → field), reinforced by hairline `#2b3036` borders, not by shadows. Surfaces sit at rest with no ambient shadow.

### Shadow Vocabulary
- **Image Lift** (`box-shadow: 0 10px 24px rgba(0, 0, 0, .38)`): The only shadow in the system, applied solely to the rendered image inside the viewport. It lifts the print off the checkered canvas so the user reads it as the object of attention.
- **Focus Glow** (`box-shadow: 0 0 0 5px rgba(148, 183, 255, .14)`): A soft blue halo paired with the focus outline. Functional, not decorative.

### Named Rules
**The Image-Only Shadow Rule.** Shadows belong to the image and to focus, nothing else. Cards, panels, buttons, and inputs are flat. If a panel has a drop shadow, delete it; use a border or a tonal step instead.

## 5. Components

Familiar controls, standard affordances. Nothing here is invented for flavor; every control looks like what it is.

### Buttons
- **Shape:** Gently squared corners (6px, `{rounded.control}`).
- **Primary ("Clean image"):** Signal Green fill (`#75d083`) with Accent Ink text (`#07180c`), weight 760, full width, 46px tall. The single most prominent control in the rail.
- **Hover:** `filter: brightness(1.03)` and a 1px lift (`translateY(-1px)`), 120ms. Restrained.
- **Focus:** Blue outline (`#94b7ff`) offset 2px.
- **Disabled:** Drops to Panel-3 fill (`#252930`) with Muted text (`#aaa79f`) and a not-allowed cursor. Disabled is the default until a file is chosen.

### Segments (mode toggle)
- **Style:** A 2-column grid of equal buttons (All / Visible / Metadata / Invisible). Field fill (`#111315`), 1px border, Soft text, 42px tall.
- **State:** Selected uses `aria-pressed="true"` with the Signal Green tint background (`#75d0832b`), a green-ish border, and full Text color. Selection is communicated by color and `aria-pressed`, never color alone.

### Inputs / Fields
- **Style:** Recessed Field fill (`#111315`), 1px Border, 6px radius, 40px tall, for both `<select>` and numeric inputs. Labels sit above in Muted 12px.
- **Hover:** Border steps up to Border-Strong (`#3c434c`).
- **Focus:** Blue outline + glow, consistent with all controls.
- **Advanced block:** Optional fields live in a bordered, slightly-raised group that is hidden unless the mode needs it. Power without clutter.

### Drop Zone (signature component)
- **Style:** A large dashed Border-Strong rectangle on Field fill, minimum 184px tall, the whole thing is a single `<button>` so it is keyboard- and screen-reader-operable.
- **Hover / Drag:** Border shifts to Signal Green, fill warms slightly. 160ms transition.
- **Has-image state:** Switches to a solid border, fills with the uploaded preview on a checkered transparency canvas, and overlays the filename in a bottom gradient. The source image lives here; the result lives in the main viewport.

### Badge / Status
- **Style:** A small amber-tinted pill (`#e4bd5c17` fill, `#e4bd5c` text, 999px radius, 24px tall) for the result state ("Idle", mode name, output size). The top-bar run-state uses a colored dot plus a text word ("Ready", "Processing", "Complete", "Error"), never the dot alone.

### Viewport (signature component)
- **Style:** The main inspection surface: a bordered panel with a header strip ("After" + badge) and a body painted with a subtle checkered transparency pattern so PNG alpha is visible. The cleaned image sits centered with the Image Lift shadow.

## 6. Do's and Don'ts

### Do:
- **Do** keep the image the brightest, highest-contrast element on screen; dim every surrounding surface on purpose.
- **Do** reserve Signal Green (`#75d083`) for the primary action, current selection, the ready dot, and the download link, the One Green Rule.
- **Do** use `#f4f1ea` for primary text, never pure `#ffffff`.
- **Do** convey depth with the near-black tonal ramp (base → shell → panel → field) and 1px borders.
- **Do** keep type to Inter at fixed px sizes; build hierarchy from weight and color.
- **Do** state system status in plain words plus a non-color cue (dot, spinner, badge text); never rely on color alone.
- **Do** give every control a real focus-visible state in Focus Blue, distinct from green selection.
- **Do** write specific, recoverable error messages, especially for missing CLI or GPU dependencies.

### Don't:
- **Don't** build a flashy AI-SaaS dashboard, neon glass effects, or a marketing hero page (PRODUCT.md anti-references).
- **Don't** use glassmorphism, gradient text, or decorative blur anywhere.
- **Don't** add shadows to panels, cards, buttons, or inputs; shadows belong to the image and focus only (the Image-Only Shadow Rule).
- **Don't** use `clamp()` or fluid type; product UI is viewed at fixed DPI.
- **Don't** use all-caps tracked eyebrows or marketing copy like "transform your workflow".
- **Don't** let Signal Green leak into headings, decorative borders, or full-saturation backgrounds.
- **Don't** collapse selection (green) and focus (blue) into one color.
- **Don't** hide operational detail behind vague labels when a direct option name or error message would help the user act.
