LATEST UPDATE: 11/30/25

# ABCresearch - Design Scheme Documentation

## Design Philosophy

ABCresearch adopts a **Premium, Apple-Inspired** aesthetic (Nov 2025 Redesign) characterized by:
- **Glassmorphism**: Deep layered depth using backdrop blurs, translucency, and subtle borders (`border-white/20`).
- **Soft Geometry**: Pill-shaped buttons (`rounded-full`), highly rounded cards (`rounded-2xl`), and smooth corners.
- **Sophisticated Typography**: Clean, antialiased sans-serif type with optimized font feature settings.
- **Fluid Motion**: Staggered animations, smooth scale/fade transitions, and responsive micro-interactions.
- **Light/Dark Balance**: A soft off-white base for light mode and deep blue-gray for dark mode, moving away from stark high-contrast defaults.

## Design Principles

### 1. Depth & Texture
- Use translucency to show context.
- Layer UI elements with soft shadows (`shadow-sm`, `shadow-xl`).
- Avoid harsh borders; use `border-black/5` or `border-white/20`.

### 2. Fluidity
- Animations should be felt but not seen (smooth `ease-out` curves).
- Interactive elements respond to hover with scale and shadow lifts.
- Layouts transition smoothly between states.

### 3. Clarity & Focus
- Information density remains high but "breathable" via increased padding.
- Content uses `backdrop-blur` to separate from background noise.
- Primary actions use vibrant but professional gradients or solid HSL colors.

## Color System

The system uses HSL variables for dynamic runtime theming.

### Root Variables (Light Mode)
```css
:root {
  /* Soft off-white/gray background */
  --background: 210 20% 98%;
  
  /* Softer black for text */
  --foreground: 220 15% 15%;
  
  /* Pure white cards */
  --card: 0 0% 100%;
  --card-foreground: 220 15% 15%;
  
  /* Vivid but professional blue */
  --primary: 220 90% 56%;
  --primary-foreground: 0 0% 100%;
  
  /* Very light gray for secondary elements */
  --secondary: 210 20% 94%;
  --secondary-foreground: 220 15% 15%;
  
  /* Muted text/backgrounds */
  --muted: 210 20% 94%;
  --muted-foreground: 220 10% 55%;
  
  /* Subtle borders */
  --border: 220 15% 90%;
  
  /* Increased radius for softer look */
  --radius: 1rem;
}
```

### Semantic Colors

**Primary Blue (Action/Highlight)**
- Used for main buttons, active states, and links.
- `hsl(220 90% 56%)`

**Soft Gray (Surface/Structure)**
- Used for app shells, sidebars, and secondary backgrounds.
- `hsl(210 20% 98%)`

**Glass White (Overlays/Panels)**
- Used for headers, sticky navs, and floating panels.
- `bg-white/70` to `bg-white/90` with `backdrop-blur-xl`.

## Typography

**Primary Font**: System Stack (`-apple-system`, `BlinkMacSystemFont`, etc.)
- `antialiased`
- `font-feature-settings: "rlig" 1, "calt" 1`

### Styles
- **Headings**: `tracking-tight`, `font-bold` or `font-semibold`.
- **Body**: `text-base` or `text-sm`, `leading-relaxed`.
- **Gradients**: Often used on main page titles (`bg-gradient-to-r from-gray-900 to-gray-700`).

## Spacing & Layout

### Grid & Container
- **Max Width**: `max-w-7xl` (1280px) for main content.
- **Container**: Centered with responsive padding (`px-6`).

### Spacing
- Generous padding inside cards (`p-6` or `p-8`).
- Gap between flex items usually `gap-3` or `gap-4`.

## Component Design Specifications

### 1. Buttons
**Style**: Pill-shaped (`rounded-full`).
**Primary**:
```css
bg-primary text-primary-foreground 
shadow-lg hover:shadow-xl 
hover:bg-primary/90 
transition-all duration-300
```
**Glass Variant**:
```css
bg-white/50 backdrop-blur-md 
border border-white/20 
hover:bg-white/80
```

### 2. Cards
**Style**: Highly rounded (`rounded-2xl`).
**Border**: Minimal (`border border-black/5`).
**Shadow**: Soft (`shadow-sm` -> `shadow-md` on hover).
**Background**: `bg-card` or `bg-white/80` (glass).

### 3. Inputs
**Style**: `rounded-full` or `rounded-xl`.
**Background**: `bg-background/50` or `bg-white`.
**Focus**: `ring-4 ring-blue-50` (soft glow) instead of harsh outline.
**Height**: Larger touch targets (`h-10` to `h-16`).

### 4. Navigation Bar (AppShell)
**Style**: Sticky, floating glass.
```css
bg-white/70 backdrop-blur-xl 
border-b border-white/20 
shadow-sm z-50 sticky top-0
```

### 5. Chat Interface
**Bubbles**:
- **User**: `bg-primary text-white rounded-2xl rounded-br-sm shadow-md`.
- **AI**: `bg-white border border-gray-100 rounded-2xl rounded-bl-sm shadow-sm`.
**Input**:
- Floating bar at bottom.
- `rounded-full`, `shadow-[0_-4px_30px_rgba(0,0,0,0.03)]`.

## Animation & Transitions

### Keyframes
**Fade In**:
```css
@keyframes fade-in {
  0% { opacity: 0; transform: translateY(10px); }
  100% { opacity: 1; transform: translateY(0); }
}
```

**Scale In**:
```css
@keyframes scale-in {
  0% { transform: scale(0.95); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}
```

**Slide In Right**:
```css
@keyframes slide-in-from-right {
  0% { transform: translateX(100%); }
  100% { transform: translateX(0); }
}
```

### Usage
- **Page Load**: `animate-fade-in` on main content wrappers.
- **Dropdowns**: `animate-scale-in origin-top`.
- **Context Panels**: `animate-scale-in origin-bottom`.
- **Hover**: `transition-all duration-300 hover:scale-105`.

## Iconography
- **Library**: Lucide React.
- **Style**: Thin strokes (often `stroke-[1.5]`), sized `w-4 h-4` or `w-5 h-5`.
- **Color**: Often `text-gray-500` changing to `text-gray-900` or `text-primary` on hover.

## CSS Utilities (Custom)
- `.glass`: `background: rgba(255, 255, 255, 0.7); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.3);`
- `.glass-dark`: Dark mode equivalent.
- `.no-scrollbar`: Utility to hide scrollbars.
