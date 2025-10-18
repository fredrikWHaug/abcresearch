LATEST UPDATE: 10/17/25, 11:45AM

# ABCresearch - Design Scheme Documentation

## Design Philosophy

ABCresearch follows a **professional research tool** aesthetic with emphasis on:
- **Clarity**: Information-dense layouts without clutter
- **Efficiency**: Quick access to key data points
- **Professionalism**: Suitable for biotech equity research
- **Consistency**: Unified visual language across all views

## Design Principles

### 1. Data-First Approach
- Prioritize content over decorative elements
- Maximize information density while maintaining readability
- Clear visual hierarchy for scanning

### 2. Progressive Disclosure
- Show summary information first
- Reveal details on interaction (expand, modal)
- Reduce cognitive load with layered information

### 3. Action-Oriented
- Clear call-to-action buttons
- Contextual actions appear on hover
- Reduced friction for common workflows

### 4. Responsive Feedback
- Loading states for all async operations
- Success/error messaging
- Visual confirmation of user actions

## Color System

### Primary Colors

**Neutrals** (Gray Scale)
```css
--gray-50:  #F9FAFB   /* Backgrounds, subtle highlights */
--gray-100: #F3F4F6   /* Card backgrounds, dividers */
--gray-200: #E5E7EB   /* Borders, separators */
--gray-300: #D1D5DB   /* Input borders */
--gray-400: #9CA3AF   /* Placeholder text */
--gray-500: #6B7280   /* Secondary text */
--gray-600: #4B5563   /* Body text */
--gray-700: #374151   /* Headings, important text */
--gray-800: #1F2937   /* Primary buttons, dark text */
--gray-900: #111827   /* Darkest elements */
```

**Usage**:
- Gray-50/100: Page backgrounds, card backgrounds
- Gray-200/300: Borders, dividers
- Gray-600/700: Primary text
- Gray-800/900: Headers, primary buttons

### Semantic Colors

**Blue** (Information, Links)
```css
--blue-50:  #EFF6FF   /* Info backgrounds */
--blue-100: #DBEAFE   /* Info highlights */
--blue-600: #2563EB   /* Primary links */
--blue-700: #1D4ED8   /* Link hover */
```

**Green** (Success, Positive Actions)
```css
--green-50:  #F0FDF4   /* Success backgrounds */
--green-100: #DCFCE7   /* Success highlights */
--green-600: #16A34A   /* Success buttons */
--green-700: #15803D   /* Success hover */
```

**Amber/Yellow** (Warning, Guest Mode)
```css
--amber-50:  #FFFBEB   /* Warning backgrounds */
--amber-200: #FDE68A   /* Warning borders */
--amber-600: #D97706   /* Warning icons */
--amber-700: #B45309   /* Warning text */
```

**Red** (Error, Destructive Actions)
```css
--red-50:  #FEF2F2   /* Error backgrounds */
--red-100: #FEE2E2   /* Error highlights */
--red-600: #DC2626   /* Error buttons */
--red-700: #B91C1C   /* Error hover */
```

### Color Usage Guidelines

**Buttons**:
- Primary action: Gray-800/900
- Success action: Green-600/700
- Destructive action: Red-600/700
- Secondary action: White with gray border

**Badges/Tags**:
- Phase 3: Green-100 background, Green-700 text
- Phase 2: Blue-100 background, Blue-700 text
- Phase 1: Yellow-100 background, Yellow-700 text
- Status badges: Semantic colors based on status

**Backgrounds**:
- Page: Gray-50
- Cards: White
- Sidebar: Gray-50
- Modal overlay: Black with 50% opacity

## Typography

### Font Stack

**Primary Font**: System Font Stack
```css
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, 
             "Helvetica Neue", Arial, sans-serif;
```

**Benefits**:
- Native feel on each platform
- Optimal rendering
- Zero loading time
- Excellent readability

### Type Scale

```css
/* Headings */
--text-3xl: 1.875rem  /* 30px - Page titles */
--text-2xl: 1.5rem    /* 24px - Section headers */
--text-xl:  1.25rem   /* 20px - Card titles */
--text-lg:  1.125rem  /* 18px - Large body text */

/* Body */
--text-base: 1rem     /* 16px - Default body text */
--text-sm:   0.875rem /* 14px - Secondary text, labels */
--text-xs:   0.75rem  /* 12px - Captions, metadata */
```

### Font Weights

```css
--font-normal:    400  /* Body text, descriptions */
--font-medium:    500  /* Emphasized text, labels */
--font-semibold:  600  /* Subheadings, card titles */
--font-bold:      700  /* Section headers, page titles */
```

### Line Heights

```css
--leading-tight:  1.25   /* Headings */
--leading-normal: 1.5    /* Body text */
--leading-relaxed: 1.625 /* Long-form content */
```

### Typography Usage

**Page Titles**:
```css
font-size: 1.875rem (30px)
font-weight: 700 (bold)
color: gray-800
margin-bottom: 0.5rem (8px)
```

**Section Headers**:
```css
font-size: 1.5rem (24px)
font-weight: 700 (bold)
color: gray-800
margin-bottom: 1rem (16px)
```

**Card Titles**:
```css
font-size: 1.125rem (18px)
font-weight: 600 (semibold)
color: gray-900
line-height: 1.25
```

**Body Text**:
```css
font-size: 1rem (16px)
font-weight: 400 (normal)
color: gray-700
line-height: 1.5
```

**Secondary Text**:
```css
font-size: 0.875rem (14px)
font-weight: 400 (normal)
color: gray-500
```

**Metadata/Captions**:
```css
font-size: 0.75rem (12px)
font-weight: 400 (normal)
color: gray-500
```

## Spacing System

TailwindCSS default spacing scale (4px increments):

```css
--spacing-0:  0px
--spacing-1:  0.25rem  /* 4px */
--spacing-2:  0.5rem   /* 8px */
--spacing-3:  0.75rem  /* 12px */
--spacing-4:  1rem     /* 16px */
--spacing-5:  1.25rem  /* 20px */
--spacing-6:  1.5rem   /* 24px */
--spacing-8:  2rem     /* 32px */
--spacing-10: 2.5rem   /* 40px */
--spacing-12: 3rem     /* 48px */
--spacing-16: 4rem     /* 64px */
```

### Spacing Usage

**Component Padding**:
- Cards: 1rem (16px)
- Buttons: 0.5rem 1rem (8px 16px)
- Inputs: 0.5rem (8px)
- Modal: 1.5rem (24px)

**Component Margins**:
- Between sections: 2rem (32px)
- Between elements: 1rem (16px)
- Between related items: 0.5rem (8px)

**Layout Spacing**:
- Page padding: 1.5rem (24px)
- Header height: 4rem (64px)
- Sidebar width: 16rem (256px)

## Layout System

### Grid System

**12-Column Grid** (TailwindCSS)
```css
.grid-cols-1    /* Mobile: Full width */
.grid-cols-2    /* Tablet: 2 columns */
.grid-cols-3    /* Desktop: 3 columns */
.grid-cols-4    /* Wide: 4 columns */
```

**Usage**:
- Drug cards: 3 columns on desktop, 2 on tablet, 1 on mobile
- Saved maps: 3 columns on desktop, 2 on tablet, 1 on mobile

### Breakpoints

```css
/* Mobile-first approach */
sm: 640px   /* Small devices */
md: 768px   /* Tablets */
lg: 1024px  /* Laptops */
xl: 1280px  /* Desktops */
2xl: 1536px /* Large desktops */
```

### Layout Patterns

#### 1. Centered Search (Initial State)
```
┌─────────────────────────────────────────┐
│              Header Bar                  │
├─────────────────────────────────────────┤
│                                          │
│                                          │
│           ┌───────────────┐              │
│           │  Search Input │              │
│           └───────────────┘              │
│                                          │
│                                          │
└─────────────────────────────────────────┘
```

#### 2. Split Screen (Research View)
```
┌─────────────────────────────────────────┐
│              Header Bar                  │
├─────────────┬───────────────────────────┤
│             │                            │
│    Chat     │      Drug Results          │
│  Interface  │      (Scrollable)          │
│ (Messages + │                            │
│   Input)    │                            │
│             │                            │
└─────────────┴───────────────────────────┘
   50% width          50% width
```

#### 3. Full Screen (Market Map View)
```
┌─────────────────────────────────────────┐
│              Header Bar                  │
├─────────────────────────────────────────┤
│                                          │
│        Ranked Trials List                │
│        (Full Width, Scrollable)          │
│                                          │
│                                          │
└─────────────────────────────────────────┘
```

#### 4. Modal Overlay
```
┌─────────────────────────────────────────┐
│  ┌───────────────────────────────────┐  │
│  │         Modal Header       [X]    │  │
│  ├───────────────────────────────────┤  │
│  │                                   │  │
│  │         Modal Content             │  │
│  │         (Scrollable)              │  │
│  │                                   │  │
│  ├───────────────────────────────────┤  │
│  │      [Cancel]  [Confirm]          │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
    Backdrop: rgba(0,0,0,0.5)
```

## Component Design Specifications

### 1. Buttons

**Primary Button**:
```css
background: gray-800
color: white
padding: 0.5rem 1rem (8px 16px)
border-radius: 0.375rem (6px)
font-weight: 500 (medium)
font-size: 0.875rem (14px)
transition: background 0.2s

hover:
  background: gray-900

disabled:
  background: gray-300
  cursor: not-allowed
```

**Secondary Button**:
```css
background: white
color: gray-700
border: 1px solid gray-300
padding: 0.5rem 1rem
border-radius: 0.375rem
font-weight: 500
font-size: 0.875rem

hover:
  background: gray-50
```

**Icon Button**:
```css
width: 2rem (32px)
height: 2rem (32px)
border-radius: 9999px (full circle)
display: flex
align-items: center
justify-content: center
background: gray-800

hover:
  background: gray-900
```

**Button Sizes**:
- Small: h-9 px-3 (36px height, 12px horizontal padding)
- Default: h-10 px-4 (40px height, 16px horizontal padding)
- Large: h-11 px-8 (44px height, 32px horizontal padding)

### 2. Cards

**Basic Card**:
```css
background: white
border: 1px solid gray-200
border-radius: 0.5rem (8px)
padding: 1rem (16px)
box-shadow: 0 1px 2px rgba(0,0,0,0.05)

hover:
  box-shadow: 0 4px 6px rgba(0,0,0,0.1)
  transition: box-shadow 0.2s
```

**Card Structure**:
```tsx
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent>
    Content goes here
  </CardContent>
  <CardFooter>
    Action buttons
  </CardFooter>
</Card>
```

**Drug Card Example**:
```css
min-height: 10rem (160px)
cursor: pointer
transition: all 0.2s

hover:
  border-color: blue-300
  transform: translateY(-2px)
  box-shadow: 0 10px 15px rgba(0,0,0,0.1)
```

### 3. Input Fields

**Text Input**:
```css
width: 100%
height: 2.5rem (40px)
padding: 0.5rem (8px)
border: 1px solid gray-300
border-radius: 0.375rem (6px)
font-size: 1rem (16px)
background: white

focus:
  outline: none
  border-color: blue-500
  ring: 2px blue-500 with 0.2 opacity
```

**Search Input (Large)**:
```css
height: 3.75rem (60px)
padding-left: 1rem (16px)
padding-right: 4rem (64px) /* Space for button */
font-size: 1.125rem (18px)
border-radius: 0.375rem
```

### 4. Badges

**Badge Variants**:

Default:
```css
background: gray-100
color: gray-700
padding: 0.25rem 0.75rem (4px 12px)
border-radius: 9999px
font-size: 0.75rem (12px)
font-weight: 500
```

Phase 3:
```css
background: green-100
color: green-700
```

Phase 2:
```css
background: blue-100
color: blue-700
```

Phase 1:
```css
background: yellow-100
color: yellow-700
```

Recruiting:
```css
background: green-100
color: green-700
```

Completed:
```css
background: gray-100
color: gray-700
```

### 5. Modal/Dialog

**Modal Overlay**:
```css
position: fixed
top: 0
left: 0
right: 0
bottom: 0
background: rgba(0, 0, 0, 0.5)
backdrop-filter: blur(4px)
z-index: 50
display: flex
align-items: center
justify-content: center
```

**Modal Content**:
```css
background: white
border-radius: 0.5rem (8px)
padding: 1.5rem (24px)
max-width: 32rem (512px)
width: 90%
max-height: 90vh
overflow-y: auto
box-shadow: 0 20px 25px rgba(0,0,0,0.15)
```

### 6. Headers

**Main Header**:
```css
height: 4rem (64px)
background: white
border-bottom: 1px solid gray-200
display: flex
align-items: center
justify-content: space-between
padding: 0 1.5rem (0 24px)
position: sticky
top: 0
z-index: 50
```

**Toggle Buttons (View Mode)**:
```css
display: flex
background: gray-100
padding: 0.25rem (4px)
border-radius: 0.5rem (8px)
gap: 0.25rem (4px)

button (active):
  background: white
  color: gray-900
  box-shadow: 0 1px 2px rgba(0,0,0,0.05)

button (inactive):
  color: gray-600
  hover: color: gray-900
```

### 7. Trial/Paper Cards

**Trial Card**:
```css
background: white
border-left: 1px solid gray-200
border-right: 1px solid gray-200
border-bottom: 1px solid gray-200
padding: 1rem (16px)

first-child:
  border-top: 1px solid gray-200

last-child:
  border-bottom-left-radius: 0.375rem
  border-bottom-right-radius: 0.375rem

hover:
  background: gray-50
  box-shadow: 0 4px 6px rgba(0,0,0,0.1)
```

**Ranking Badge**:
```css
width: 3rem (48px)
height: 3rem (48px)
border-radius: 9999px
display: flex
align-items: center
justify-content: center
font-weight: 700
font-size: 0.875rem (14px)

#1 (Gold):
  background: yellow-100
  color: yellow-700

#2 (Silver):
  background: gray-100
  color: gray-700

#3 (Bronze):
  background: orange-100
  color: orange-700

#4+:
  background: gray-50
  color: gray-600
```

### 8. Guest Mode Indicator

**Collapsed State**:
```css
width: 3rem (48px)
height: 3rem (48px)
background: amber-50
border: 1px solid amber-200
border-radius: 0.5rem (8px)
display: flex
align-items: center
justify-content: center
cursor: pointer
box-shadow: 0 4px 6px rgba(0,0,0,0.1)

icon:
  width: 1.5rem (24px)
  height: 1.5rem (24px)
  color: amber-600
```

**Expanded State**:
```css
max-width: 20rem (320px)
padding: 0.75rem (12px)
background: amber-50
border: 1px solid amber-200
border-radius: 0.5rem (8px)
position: relative

close-button:
  position: absolute
  top: -0.25rem (-4px)
  right: -0.25rem (-4px)
  width: 1.25rem (20px)
  height: 1.25rem (20px)
  background: gray-200
  border-radius: 9999px
  hover: background: gray-300
```

## Iconography

**Icon Library**: Lucide React

**Commonly Used Icons**:
- `LogOut`: Sign out button
- `Send`: Send message button
- `Menu`: Hamburger menu
- `ArrowUp`: Submit search
- `Upload`: File upload
- `Download`: Download Excel
- `CheckCircle`: Success state
- `AlertCircle`: Error/warning state
- `Loader2`: Loading spinner (with animate-spin)
- `Save`: Save project
- `X`: Close modal
- `FileText`: Generate slide
- `Building2`: Company/sponsor
- `Calendar`: Date
- `Users`: Enrollment count
- `MapPin`: Location
- `Activity`: Trial status

**Icon Sizes**:
```css
--icon-xs:  0.75rem (12px)
--icon-sm:  1rem    (16px)
--icon-md:  1.25rem (20px)
--icon-lg:  1.5rem  (24px)
--icon-xl:  2rem    (32px)
```

## Animation & Transitions

### Standard Transitions

**Hover Effects**:
```css
transition: all 0.2s ease-in-out

/* Properties animated */
- background-color
- box-shadow
- transform
- border-color
```

**Loading Spinner**:
```css
animation: spin 1s linear infinite

@keyframes spin {
  from { transform: rotate(0deg) }
  to { transform: rotate(360deg) }
}
```

**Modal Enter/Exit**:
```css
/* Enter */
opacity: 0 → 1
transform: scale(0.95) → scale(1)
transition: all 0.2s ease-out

/* Exit */
opacity: 1 → 0
transform: scale(1) → scale(0.95)
transition: all 0.15s ease-in
```

**Button Press**:
```css
active:
  transform: scale(0.98)
```

### Micro-Interactions

**Card Hover**:
```css
transform: translateY(0) → translateY(-2px)
box-shadow: subtle → prominent
transition: all 0.2s
```

**Input Focus**:
```css
border-color: gray-300 → blue-500
ring: 0 → 2px blue-500 with 20% opacity
transition: all 0.15s
```

**Toggle Button**:
```css
/* Inactive → Active */
background: transparent → white
color: gray-600 → gray-900
box-shadow: none → 0 1px 2px rgba(0,0,0,0.05)
transition: all 0.15s
```

## Responsive Design Strategy

### Mobile-First Approach

**Base Styles** (Mobile):
```css
/* Default: Full width, vertical stacking */
.container {
  width: 100%;
  padding: 1rem;
}

.grid {
  grid-columns: 1;
  gap: 1rem;
}
```

**Tablet Breakpoint** (md: 768px):
```css
.container {
  padding: 1.5rem;
}

.grid {
  grid-columns: 2;
  gap: 1.5rem;
}
```

**Desktop Breakpoint** (lg: 1024px):
```css
.container {
  max-width: 1280px;
  margin: 0 auto;
  padding: 2rem;
}

.grid {
  grid-columns: 3;
  gap: 2rem;
}

/* Split screen layouts */
.split-view {
  display: flex;
  
  .left-panel {
    width: 50%;
  }
  
  .right-panel {
    width: 50%;
  }
}
```

### Key Responsive Patterns

**Navigation**:
- Mobile: Hamburger menu
- Desktop: Full horizontal menu

**Search Bar**:
- Mobile: Full width input
- Desktop: Centered with max-width

**Cards Grid**:
- Mobile: 1 column
- Tablet: 2 columns
- Desktop: 3 columns

**Split Screen**:
- Mobile: Tabs to switch views
- Desktop: Side-by-side 50/50 split

## Accessibility Considerations

### Color Contrast

All text meets WCAG 2.1 AA standards:
- Normal text: 4.5:1 contrast ratio
- Large text (18px+): 3:1 contrast ratio
- UI components: 3:1 contrast ratio

**Examples**:
- Gray-700 on white: 4.5:1 ✓
- Gray-600 on white: 4.5:1 ✓
- Gray-800 on white: 12:1 ✓

### Focus States

All interactive elements have visible focus indicators:
```css
focus-visible:
  outline: 2px solid blue-500
  outline-offset: 2px
```

### Semantic HTML

- Use proper heading hierarchy (h1 → h2 → h3)
- Button elements for actions
- Anchor tags for navigation
- Form labels for inputs
- ARIA labels where needed

### Keyboard Navigation

- Tab order follows visual order
- Escape closes modals
- Enter submits forms
- Arrow keys for lists (future enhancement)

## Design System Components Library

### Using Radix UI

**Benefits**:
- Accessible by default (WCAG 2.1 compliant)
- Unstyled (full design control)
- Composable primitives
- Keyboard navigation built-in

**Components Used**:
- `@radix-ui/react-label`: Form labels
- `@radix-ui/react-slot`: Button composition

### Component Customization Pattern

```tsx
// Base Radix component
import * as LabelPrimitive from "@radix-ui/react-label"

// Add custom styles with TailwindCSS
const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(
      "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
      className
    )}
    {...props}
  />
))
```

## Design Tokens Reference

### Shadows

```css
--shadow-sm:  0 1px 2px rgba(0,0,0,0.05)
--shadow:     0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)
--shadow-md:  0 4px 6px rgba(0,0,0,0.1)
--shadow-lg:  0 10px 15px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.05)
--shadow-xl:  0 20px 25px rgba(0,0,0,0.15), 0 10px 10px rgba(0,0,0,0.04)
```

**Usage**:
- Cards: shadow-sm
- Card hover: shadow-md
- Modals: shadow-xl
- Dropdowns: shadow-lg

### Border Radius

```css
--rounded-none: 0
--rounded-sm:   0.125rem (2px)
--rounded:      0.25rem  (4px)
--rounded-md:   0.375rem (6px)
--rounded-lg:   0.5rem   (8px)
--rounded-xl:   0.75rem  (12px)
--rounded-full: 9999px   (Circle)
```

**Usage**:
- Buttons: rounded-md (6px)
- Cards: rounded-lg (8px)
- Badges: rounded-full
- Inputs: rounded-md (6px)
- Icon buttons: rounded-full

### Z-Index Layers

```css
--z-0:   0    /* Base layer */
--z-10:  10   /* Dropdowns */
--z-20:  20   /* Sticky headers */
--z-30:  30   /* Modals backdrop */
--z-40:  40   /* Modals content */
--z-50:  50   /* Tooltips, popovers */
```

## Future Design Enhancements

1. **Dark Mode**: Toggle between light and dark themes
2. **Custom Themes**: User-selectable color schemes
3. **Data Visualization**: Interactive charts and graphs (Recharts integration)
4. **Advanced Tables**: Sortable, filterable data tables
5. **Skeleton Loaders**: Better loading states
6. **Toast Notifications**: Non-intrusive success/error messages
7. **Timeline Views**: Visualize trial progression over time
8. **Network Graphs**: Visualize drug-trial-paper relationships
9. **Export Options**: PDF/PNG export of visualizations
10. **Collaborative Features**: Comments, annotations, sharing

## Design System Maintenance

### Component Documentation
- Storybook integration (recommended)
- Component usage examples
- Props documentation
- Accessibility notes

### Version Control
- Design tokens in version control
- Component changelog
- Breaking change documentation

### Design-Development Handoff
- Figma designs (if applicable)
- Design specifications document
- Component library alignment
- Regular design reviews

---

## Quick Reference

### Common Component Combinations

**Card with Badge**:
```tsx
<Card>
  <CardHeader>
    <div className="flex items-center justify-between">
      <CardTitle>Title</CardTitle>
      <Badge variant="success">Active</Badge>
    </div>
  </CardHeader>
  <CardContent>Content</CardContent>
</Card>
```

**Loading Button**:
```tsx
<Button disabled={loading}>
  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
  {loading ? 'Processing...' : 'Submit'}
</Button>
```

**Modal with Form**:
```tsx
<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
  <div className="bg-white rounded-lg p-6 max-w-md w-full">
    <h3 className="text-lg font-semibold mb-4">Modal Title</h3>
    <form onSubmit={handleSubmit}>
      <Label htmlFor="field">Field Label</Label>
      <Input id="field" placeholder="Enter value" />
      <div className="flex gap-3 justify-end mt-6">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit">Confirm</Button>
      </div>
    </form>
  </div>
</div>
```

This design system provides a comprehensive foundation for building consistent, accessible, and professional interfaces for ABCresearch.

