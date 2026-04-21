# Cronix — Design System Implementation Prompt

## Context
The file `cronix-full.html` in this project is the reference UI.
It contains the complete design system for Cronix.
Your job is to extract every design decision from that file and implement
it identically in the actual application using Tailwind CSS.
Do not invent anything. Copy everything exactly.

---

## Step 1 — Read the reference file first

Before writing a single line of code open and read `cronix-full.html` completely.
Study every CSS variable, every color value, every spacing value, every component.
Understand the structure before implementing anything.

---

## CSS Variables to Extract and Apply

Read the `:root` block in `cronix-full.html` and copy every variable.
In the actual app these go into your global CSS file or Tailwind config.

The key variables you will find:
- `--ac` — the orange accent color used everywhere
- `--acd` — transparent version of accent for backgrounds
- `--bg` through `--bg5` — five levels of dark background
- `--b` through `--b3` — three levels of border opacity
- `--t` through `--t3` — three levels of text opacity
- `--ok` `--er` `--warn` `--info` — status colors
- `--ok-d` `--er-d` `--info-d` — transparent versions of status colors
- `--radius` `--radius-lg` `--radius-xl` — border radius scale
- `--font` — Space Grotesk for UI text
- `--mono` — JetBrains Mono for commands and code

Add these as Tailwind CSS custom properties in `tailwind.config.js` under `theme.extend.colors`
and `theme.extend.fontFamily` so they can be used as Tailwind classes throughout the app.

Also add them to your global CSS as CSS variables so existing non-Tailwind styles still work.

---

## Fonts to Load

The reference uses two Google Fonts. Add these to your HTML head or global CSS:

```
Space Grotesk — weights 300, 400, 500, 600, 700
JetBrains Mono — weights 300, 400, 500, 600
```

Space Grotesk is for all UI text — labels, buttons, nav items, headings.
JetBrains Mono is for commands, cron expressions, file paths, terminal output, code values.

Every element that shows a command, a cron schedule, a hostname, a file path,
a terminal line, or any technical value must use JetBrains Mono.
Everything else uses Space Grotesk.

---

## Color Palette — Exact Values

Copy these exactly. Do not substitute with Tailwind's built-in colors.

```
Background levels:
bg:   #09090E  — deepest, used for page background
bg2:  #0F0F17  — used for sidebar, topbar
bg3:  #14141E  — used for cards
bg4:  #1A1A26  — used for inputs, hover states
bg5:  #20202E  — used for badges, secondary elements

Borders:
b:  rgba(255,255,255,0.055)  — very subtle, default border
b2: rgba(255,255,255,0.10)   — slightly visible, hover borders
b3: rgba(255,255,255,0.16)   — visible, focus borders

Text:
t:  #E8E8F0  — primary text, headings
t2: #8888A0  — secondary text, labels, placeholders
t3: #4A4A62  — tertiary text, muted, timestamps

Accent:
ac:  #F97316  — orange, used for active states, primary buttons, highlights
acd: rgba(249,115,22,0.12)  — orange tint for active backgrounds

Status:
ok:   #22C55E  — success, online
er:   #EF4444  — error, offline, failed
warn: #F59E0B  — warning, slow
info: #3B82F6  — informational, blue

Status backgrounds:
ok-d:   rgba(34,197,94,0.12)
er-d:   rgba(239,68,68,0.12)
info-d: rgba(59,130,246,0.12)
warn-d: rgba(245,158,11,0.12)
```

---

## Layout Structure — The App Shell

The app uses a three-column grid layout. Copy this exactly.

```
App shell = grid with three columns:
Column 1: 52px fixed  — icon rail (never changes width)
Column 2: 200px fixed — context panel (can be collapsed)
Column 3: 1fr         — main content area

Height: 100vh
Overflow: hidden on the shell (each section scrolls internally)
```

When the context panel is collapsed the grid becomes two columns: 52px and 1fr.

---

## Icon Rail — Left Strip

Width: exactly 52px. Never grows.
Background: bg2 color.
Right border: 1px solid the b color.
All icons centered horizontally with no text labels.

Each rail icon button:
- Size: 38x38px
- Border radius: 10px
- Default color: t3 (muted)
- Hover: background bg4, color t2
- Active: background acd (orange tint), color ac (orange)

Status dots on icons:
- Size: 6px circle
- Position: absolute top-right of icon button
- Border: 1.5px solid bg2 color to create a separation gap
- ok dot: green
- er dot: red
- warn dot: orange

App logo at top of rail:
- 32px square
- Background: ac (orange)
- Border radius: 9px
- White SVG icon centered inside

Settings icon pinned to bottom using margin-top auto.

Separator lines between icon groups:
- Width: 30px centered
- Height: 1px
- Color: b2

---

## Context Panel — Second Column

Width: 200px.
Background: bg2.
Right border: 1px solid b.

Section title at top:
- Padding: 14px 14px 8px
- Font size: 10px
- Color: t3
- Letter spacing: 0.1em
- Text transform: uppercase
- Font weight: 600

Navigation items:
- Display: flex, align items center, gap 8px
- Padding: 7px 10px
- Border radius: 8px
- Default color: t2
- Hover: background bg4, color t
- Active: background acd, color ac, font weight 500
- Font size: 12.5px
- Icons: 13x13px stroke icons, stroke width 1.8

Badges on nav items (right side):
- Font size: 9.5px
- Padding: 2px 6px
- Border radius: 20px (pill shape)
- Font weight: 600
- ok badge: ok-d background, ok color
- er badge: er-d background, er color
- gray badge: bg5 background, t3 color
- ac badge: acd background, ac color

---

## Topbar

Height: 48px.
Background: bg2.
Bottom border: 1px solid b.
Padding: 0 18px.
Display: flex, align items center, gap 10px.

Breadcrumb:
- Font size: 12.5px
- Root segment: t3 color, clickable
- Separator: t3 color, font size 14px, character /
- Current segment: t color, font weight 500

Search button (center):
- Background: bg4
- Border: 1px solid b2
- Border radius: 8px
- Padding: 5px 11px
- Color: t3
- Font size: 12px
- Hover: border color b3, color t2
- Shows keyboard shortcut kbd element inside

Icon buttons on right:
- Size: 30x30px
- Border radius: 8px
- Border: 1px solid b
- Default color: t3
- Hover: background bg4, color t2

Primary button (Add job):
- Background: ac (orange)
- No border
- Border radius: 8px
- Padding: 6px 13px
- Color: white
- Font size: 12.5px
- Font weight: 500
- Hover: opacity 0.9

---

## Stat Cards

Grid: 4 columns, gap 12px.
Each card:
- Background: bg3
- Border: 1px solid b
- Border radius: radius-lg (12px)
- Padding: 16px 18px

Label:
- Font size: 11px
- Color: t3
- Text transform: uppercase
- Letter spacing: 0.06em
- Font weight: 500
- Margin bottom: 8px

Value:
- Font size: 28px
- Font weight: 700
- Line height: 1
- Font family: JetBrains Mono

Subtext:
- Font size: 11px
- Color: t3
- Margin top: 5px

Color accent for each stat:
- Orange stat: value color ac
- Green stat: value color ok
- Red stat: value color er
- Blue stat: value color info

---

## Card Component

Background: bg3.
Border: 1px solid b.
Border radius: radius-lg (12px).
Overflow: hidden.

Card header:
- Padding: 12px 16px
- Border bottom: 1px solid b
- Display: flex, align items center, justify between
- Font size: 12.5px
- Font weight: 500

Card body:
- Padding: 14px 16px

---

## Tables

Full width, border collapse.

Header cells:
- Padding: 8px 12px
- Text align: left
- Font size: 10.5px
- Color: t3
- Font weight: 600
- Text transform: uppercase
- Letter spacing: 0.06em
- Border bottom: 1px solid b

Data cells:
- Padding: 10px 12px
- Border bottom: 1px solid b
- Font size: 12.5px
- Color: t2

First column of data cells: color t (brighter).

Row hover: background bg4, color t.

Last row: no border bottom.

---

## Status Badges

Display: inline-flex, align items center, gap 4px.
Padding: 2px 8px.
Border radius: 20px (pill).
Font size: 10.5px.
Font weight: 600.

Variants:
- ok: background ok-d, color ok (green)
- er: background er-d, color er (red)
- warn: background warn-d, color warn (orange/amber)
- info: background info-d, color info (blue)
- gray: background bg5, color t3

Each badge has a tiny filled circle SVG icon before the text, same color as text.

---

## Toggle Switch

Width: 32px, height: 17px.
Background when off: bg5.
Background when on: ac (orange).
Border radius: 20px.
Border: 1px solid b2 when off, ac when on.
Transition: background 0.2s.

Thumb (white circle):
- Size: 11x11px
- Background: white
- Border radius: 50%
- Position: absolute, 2px from top, 2px from left
- Transition: transform 0.2s
- When on: translateX(15px)

---

## Server Cards Grid

Grid: 3 columns, gap 12px.

Each card:
- Background: bg3
- Border: 1px solid b
- Border radius: radius-lg (12px)
- Padding: 16px
- Cursor: pointer
- Hover: border color b2

Online cards: top border 2px solid ok (green).
Offline cards: top border 2px solid er (red).

Card header:
- Display: flex, align items flex-start, justify between
- Margin bottom: 12px

Server name: font size 13.5px, font weight 600.
Server host: font size 11px, color t3, font family JetBrains Mono.

Stats grid inside card: 2 columns, gap 8px.
Each stat box:
- Background: bg4
- Border radius: 7px
- Padding: 7px 9px
- Label: font size 9.5px, color t3
- Value: font size 13px, font weight 600, JetBrains Mono

Action buttons row:
- Gap 5px

Small action button:
- Padding: 5px 10px
- Border radius: 6px
- Border: 1px solid b2
- Background: transparent
- Color: t2
- Font size: 11.5px
- Hover: background bg4, color t

Primary small button (Terminal):
- Background: acd
- Border color: rgba(249,115,22,0.3)
- Color: ac

---

## SSH Terminal

The terminal section has three columns:
- Left 220px: server list
- Center flexible: xterm terminal
- Right 300px: saved commands

Terminal background: #0D1117 (not the app bg, this is darker and more blue-black).

Tab bar above terminal:
- Background: #0F131A
- Border bottom: 1px solid rgba(255,255,255,0.06)
- Height: 36px

Active tab:
- Background: rgba(255,255,255,0.06)
- Color: rgba(255,255,255,0.85)

Inactive tab:
- Color: rgba(255,255,255,0.4)

Terminal output:
- Font family: JetBrains Mono
- Font size: 12.5px
- Line height: 1.75
- Padding: 14px 16px

Terminal color scheme:
- Prompt (username@server): #22C55E
- Path (~, /var/www): #58A6FF
- Dollar sign: #444
- Command text: #E6EDF3
- Output text: #8B949E
- Error/warning output: #F97316 (orange)
- Success output: #22C55E

Cursor: 8x13px solid rectangle, color ac (orange), blinking animation.

Terminal input row:
- Padding: 8px 16px 12px
- Border top: 1px solid rgba(255,255,255,0.04)
- Input transparent background, no border, no outline

Status bar below terminal:
- Background: #111827
- Border top: 1px solid rgba(255,255,255,0.04)
- Font family: JetBrains Mono
- Font size: 10.5px
- Color: rgba(255,255,255,0.3)

---

## Suggestion Dropdown (Terminal)

Appears above the terminal input when user types.
Background: #111118.
Border: 1px solid rgba(249,115,22,0.3) — orange tint.
Border radius: 9px.
Overflow hidden.
Font family: JetBrains Mono.

Header row: padding 5px 12px, font size 10px, color t3.

Each suggestion:
- Display: flex, align items center, gap 8px
- Padding: 7px 12px
- Hover: background rgba(249,115,22,0.08)

Badge types:
- history: green background tint, green text
- tldr: orange background tint, orange text

---

## S3 File Browser Toolbar

Background: bg3.
Border bottom: 1px solid b.
Padding: 10px 16px.
Display: flex, align items center, gap 8px.

Breadcrumb path inside a pill:
- Background: bg4
- Border: 1px solid b
- Border radius: 8px
- Padding: 5px 10px
- Font size: 12.5px
- Each segment clickable, inactive t3, active t

Type filter pills:
- Padding: 4px 10px
- Border radius: 20px
- Font size: 11.5px
- Default: border 1px solid b, background transparent, color t3
- Active: background acd, border rgba(249,115,22,0.3), color ac

---

## S3 File Cards (Grid View)

Grid: auto-fill, minimum 148px, gap 10px.

Each card:
- Background: bg3
- Border: 1px solid b
- Border radius: 10px
- Overflow: hidden
- Hover: border color b2
- Selected: border color ac, background acd with very low opacity

Thumbnail area: height 108px.
Image files: colored background with extension text at low opacity (18%).
Video files: dark purple background with play icon.
Document files: color-tinted background matching file type color.

Extension badge:
- Bottom right of thumbnail
- Background: rgba(0,0,0,0.6)
- Border radius: 4px
- Padding: 2px 6px
- Font size: 9px, white, bold
- Font family: JetBrains Mono

Hover action buttons (top right):
- Size: 22x22px each
- Border radius: 5px
- Background: rgba(0,0,0,0.65)
- Border: 1px solid rgba(255,255,255,0.1)
- Appear on hover, hidden by default
- Hover: background ac

Checkbox (top left):
- Size: 17x17px
- Border radius: 4px
- Hidden by default, visible on card hover or when selected
- Selected state: background ac, border ac

Card body:
- Padding: 8px 9px
- Filename: font size 11px, font weight 500, truncated with ellipsis
- Meta (size): font size 10px, color t3

---

## Redis Key Browser

Layout: two columns — 260px tree on left, flexible value viewer on right.

Key tree on left:
- Background: bg2
- Right border: 1px solid b

Type badges:
- STRING: blue tint background, blue text
- HASH: purple tint background, purple text
- LIST: orange tint background, orange text
- SET: green tint background, green text
- ZSET: teal tint background, teal text
- STREAM: red tint background, red text

Font size for badges: 9px, font weight 700, font family JetBrains Mono, letter spacing 0.04em.

Key rows in tree:
- Font family: JetBrains Mono
- Font size: 11px
- Color: t3
- Active: background acd, color ac
- Hover: background bg4, color t2
- TTL shown right-aligned in muted color

Namespace folders:
- Font size: 12px
- Font weight: 500
- Arrow icon rotates when expanded

---

## Settings Page

Layout: two columns — 200px settings nav on left, flexible content on right.

Settings nav items:
- Same style as context panel nav items
- Icons 13x13px

Settings content area:
- Padding: 24px
- Max width: 600px for form content

Form rows:
- Margin bottom: 18px

Labels:
- Font size: 11.5px
- Color: t2
- Font weight: 500
- Display block, margin bottom 6px

Inputs and selects:
- Width: 100%
- Background: bg4
- Border: 1px solid b2
- Border radius: 8px
- Color: t
- Font size: 12.5px
- Padding: 8px 12px
- Outline: none
- Focus: border color ac

Hint text below inputs:
- Font size: 11px
- Color: t3
- Margin top: 5px

Inline toggle rows (for boolean settings):
- Display: flex, align items center, justify between
- Padding: 12px 0
- Border bottom: 1px solid b

Left side of toggle row:
- Title: font size 12.5px, font weight 500
- Subtitle: font size 11px, color t3, margin top 2px

Save button:
- Same as primary button style but no SVG icon

Danger zone section:
- Card with border rgba(239,68,68,0.3) — red tint border

Danger buttons:
- Background: transparent
- Border: 1px solid rgba(239,68,68,0.4)
- Color: er (red)
- Same size as save button

---

## Color Swatch Picker (Appearance Settings)

Display: flex, gap 8px, flex wrap.
Each swatch:
- Size: 28x28px
- Border radius: 7px
- Cursor: pointer
- Border: 2px solid transparent by default
- Active: border 2px solid white, scale(1.15)
- Transition: all 0.15s

---

## Search Overlay

Position: fixed, full viewport.
Background: rgba(0,0,0,0.75).
Z-index: 1000.
Display: flex, align items flex-start, justify center.
Padding top: 80px.
Fade in transition.

Modal:
- Background: bg3
- Border: 1px solid b2
- Border radius: 14px
- Width: 580px
- Overflow: hidden

Search input row:
- Padding: 14px 16px
- Border bottom: 1px solid b
- Display: flex, gap 10px, align items center

Results list:
- Max height: 380px
- Overflow-y: auto
- Padding: 8px

Group label:
- Font size: 10px, color t3, font weight 600
- Text transform: uppercase, letter spacing 0.08em
- Padding: 4px 10px

Result item:
- Display: flex, gap 10px, padding 8px 10px
- Border radius: 8px
- Hover: background bg4

Result icon:
- Size: 28x28px, border radius: 7px
- Background: bg5
- Icon: 13x13px, color t2

Result name: font size 12.5px, font weight 500.
Result meta: font size 11px, color t3.

Footer row:
- Padding: 10px 16px
- Border top: 1px solid b
- Keyboard shortcut hints in muted color

---

## Scrollbar Styling

Width: 4px.
Track: transparent.
Thumb: background bg5, border radius 2px.
Hover: slightly lighter.

---

## General Rules to Follow Throughout

1. Never use Inter, Roboto, or system fonts. Always Space Grotesk or JetBrains Mono.

2. Never use white backgrounds. The darkest bg (#09090E) is the page background.
   Every surface is a shade darker than its container.

3. Every border is rgba white at very low opacity, not solid gray.
   Never use gray borders like #333 or #444.

4. Font sizes: UI text 12-13px, labels 10-11px, values and code 12-13px in mono,
   headings 15-18px. Nothing larger for regular UI.

5. All technical values (commands, cron expressions, file paths, server addresses,
   Redis keys, JSON, log output) use JetBrains Mono.

6. Status colors are consistent throughout:
   - Green (#22C55E) for success, online, passing
   - Red (#EF4444) for error, offline, failing
   - Orange (#F59E0B) for warning, slow, degraded
   - Blue (#3B82F6) for informational, neutral status

7. The accent color (orange #F97316) is used for:
   - Active navigation items
   - Primary action buttons
   - Active tab underlines
   - Cron expressions in jobs table
   - Selected file cards
   - Toggle switches when on
   - The app logo background

8. Interactive elements (buttons, nav items, cards, rows) have hover states
   that slightly brighten the background. Never use opacity changes on the element itself.

9. Border radius: 8px for most elements, 12px for cards, 20px for pill badges,
   full for circles and dots.

10. All transitions are 0.15s or 0.2s. Nothing slower.

---

## Implementing in Tailwind

Add custom colors to tailwind.config.js:

```js
module.exports = {
  theme: {
    extend: {
      colors: {
        'bg': '#09090E',
        'bg2': '#0F0F17',
        'bg3': '#14141E',
        'bg4': '#1A1A26',
        'bg5': '#20202E',
        'ac': '#F97316',
        'ok': '#22C55E',
        'er': '#EF4444',
        'warn': '#F59E0B',
        'info': '#3B82F6',
        't1': '#E8E8F0',
        't2': '#8888A0',
        't3': '#4A4A62',
      },
      fontFamily: {
        'sans': ['Space Grotesk', 'system-ui', 'sans-serif'],
        'mono': ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        'xl2': '16px',
      }
    }
  }
}
```

For border colors that use rgba, use Tailwind's arbitrary value syntax:
- `border-[rgba(255,255,255,0.055)]` for the default border
- `border-[rgba(255,255,255,0.10)]` for hover borders

Or define them as CSS variables and reference with `border-[var(--b)]`.

The most practical approach is to keep the CSS variables from the reference file
in your global CSS and use them with Tailwind's arbitrary value syntax wherever needed.
This gives you the best of both worlds — Tailwind utilities where they work
cleanly, CSS variables for the complex rgba colors.

---

## Reference File Location

The file is: `cronix-full.html`

When implementing any page or component, open that file first.
Find the relevant section. Copy the exact values.
Do not approximate. Do not substitute with similar Tailwind colors.
The design only looks right when every value is exact.

