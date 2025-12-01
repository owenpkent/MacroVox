# MacroVox Style Guide

## Design Philosophy

MacroVox adopts a **futuristic, minimalist aesthetic** inspired by *The Expanse* MCRN aesthetic. The design prioritizes clarity, functionality, and visual hierarchy through bold color contrasts and clean typography.

---

## Color Palette

### Primary Colors
- **Cyan/Teal** (`#00d4aa`, `#00ffff`) - Primary accent, energy, action
- **Dark Navy** (`#0a0e27`) - Primary background, depth
- **Bright Red** (`#ff3333`, `#ff6b35`) - Alerts, recording state, urgency
- **Purple** (`#9d4edd`, `#7209b7`) - Secondary accent, meetings
- **Gold/Yellow** (`#ffd60a`, `#ffc300`) - Tertiary accent, personal items

### Secondary Colors
- **Dark Gray** (`#1a1f3a`) - Secondary background, panels
- **Medium Gray** (`#4a5568`) - Borders, disabled states
- **Light Gray** (`#a0aec0`) - Text secondary, hints

### Text Colors
- **Bright Cyan** (`#00ffff`) - Primary headings, emphasis
- **Light Gray** (`#d0d0d0`) - Body text
- **Muted Gray** (`#808080`) - Secondary text, metadata

---

## Typography

### Font Stack
```
Primary: 'Inter', 'Segoe UI', sans-serif
Monospace: 'Courier New', 'Consolas', monospace
```

### Type Scale
- **Display** - 48px, Bold, Cyan (`#00ffff`)
- **Heading 1** - 32px, Bold, Cyan
- **Heading 2** - 24px, Semi-bold, Light Gray
- **Body** - 14px, Regular, Light Gray
- **Caption** - 12px, Regular, Muted Gray
- **Monospace** - 13px, Regular, Cyan (for timestamps, filenames)

### Examples
- **Recording Duration**: 48px, Bold, Bright Cyan (`01:11`)
- **Filename**: 12px, Monospace, Muted Gray (`SAVED: 20251130_141925_MEMO.WAV`)
- **Metadata**: 12px, Regular, Muted Gray (`# MICROPHONE (5- SHURE MV7+)`)

---

## Component Styles

### Tag Buttons
- **Dimensions**: 40px height, 16px horizontal padding
- **Border**: 2px solid (color-specific)
- **Border Radius**: 4px
- **Font**: 12px, Semi-bold, uppercase
- **States**:
  - **Default**: Border only, transparent background
  - **Active**: Filled background with matching border
  - **Hover**: Increased opacity, subtle glow

#### Tag Colors
| Tag | Border Color | Active Background | Text Color |
|-----|--------------|-------------------|-----------|
| IDEA | `#00d4aa` | `#00d4aa` | `#00d4aa` / White |
| TODO | `#ff6b35` | `#ff6b35` | `#ff6b35` / White |
| NOTE | `#4a90e2` | `#4a90e2` | `#4a90e2` / White |
| URGENT | `#ff3333` | `#ff3333` | `#ff3333` / White |
| MEETING | `#9d4edd` | `#9d4edd` | `#9d4edd` / White |
| PERSONAL | `#ffd60a` | `#ffd60a` | `#ffd60a` / Black |

### Primary Button (REC)
- **Dimensions**: Full width, 56px height
- **Border**: 3px solid `#ff3333`
- **Border Radius**: 4px
- **Background**: Transparent (default), `#ff3333` (active/recording)
- **Text**: 18px, Bold, `#ff3333` (default) / White (active)
- **Animation**: Pulsing glow when recording

### Secondary Buttons (Pause, Stop)
- **Dimensions**: 48px × 48px
- **Border**: 2px solid `#4a5568`
- **Border Radius**: 4px
- **Background**: Transparent
- **Icon Color**: `#4a5568`
- **Hover**: Border color → `#00d4aa`

### Input Fields
- **Border**: 1px solid `#4a5568`
- **Border Radius**: 4px
- **Background**: `#1a1f3a`
- **Text Color**: `#d0d0d0`
- **Placeholder**: `#808080`
- **Focus**: Border color → `#00d4aa`, subtle glow

### Panels & Containers
- **Background**: `#0a0e27` (primary), `#1a1f3a` (secondary)
- **Border**: 1px solid `#4a5568`
- **Border Radius**: 4px
- **Padding**: 16px (standard), 24px (large)

---

## Spacing & Layout

### Spacing Scale
- **xs**: 4px
- **sm**: 8px
- **md**: 16px
- **lg**: 24px
- **xl**: 32px
- **2xl**: 48px

### Grid
- **Base**: 8px grid
- **Container Width**: 800px (default)
- **Gutter**: 16px

---

## Effects & Animations

### Glows & Shadows
- **Cyan Glow**: `0 0 12px rgba(0, 212, 170, 0.4)`
- **Red Glow**: `0 0 12px rgba(255, 51, 51, 0.4)`
- **Subtle Shadow**: `0 4px 8px rgba(0, 0, 0, 0.3)`

### Transitions
- **Standard**: 200ms ease-in-out
- **Hover**: 150ms ease-out
- **Recording Pulse**: 1s infinite

### Recording Indicator
```css
@keyframes pulse {
  0%, 100% { opacity: 1; box-shadow: 0 0 12px rgba(255, 51, 51, 0.4); }
  50% { opacity: 0.7; box-shadow: 0 0 24px rgba(255, 51, 51, 0.6); }
}
```

---

## Dark Mode (Default)

All colors listed above are for dark mode. This is the primary theme.

---

## Light Mode (Optional)

When implemented, invert the palette:
- **Background**: `#f5f5f5` → `#ffffff`
- **Text**: `#d0d0d0` → `#1a1a1a`
- **Accents**: Maintain saturation, adjust brightness

---

## Accessibility

- **Contrast Ratio**: Minimum 4.5:1 for text
- **Focus States**: Always visible, use cyan border + glow
- **Color Blindness**: Don't rely on color alone; use icons + text labels
- **Motion**: Provide `prefers-reduced-motion` alternatives

---

## Usage Examples

### Recording State
```
Background: #0a0e27
REC Button: 3px border #ff3333, pulsing glow
Duration: 48px bold cyan #00ffff
Tags: Selected tags with filled backgrounds
```

### Idle State
```
Background: #0a0e27
REC Button: 3px border #ff3333, no glow
Duration: Hidden or reset
Tags: Border only, transparent background
```

### Settings Panel
```
Background: #1a1f3a
Inputs: 1px border #4a5568, focus → #00d4aa
Labels: 12px muted gray
Buttons: Secondary button style
```

---

## Implementation Notes

- Use CSS variables for colors to enable theme switching
- Apply consistent 4px border radius across all components
- Maintain 16px padding in all panels
- Use monospace font for technical data (timestamps, filenames)
- Ensure all interactive elements have visible focus states
- Test all color combinations for WCAG AA compliance
