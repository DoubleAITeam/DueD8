# DueD8 Theming System Guide

## Overview
This guide explains how to use the standardized theming system in DueD8. Following these guidelines ensures that all new pages and components automatically support both light and dark modes without additional CSS.

## CSS Variables

### Base Colors
```css
--bg          /* Main background color */
--card        /* Card/container background */
--ink         /* Primary text color */
--muted       /* Secondary text color */
--primary     /* Brand primary color (purple) */
--border-subtle /* Subtle borders and dividers */
```

### Component Colors
```css
--button-primary-bg      /* Primary button background */
--button-primary-text    /* Primary button text */
--button-primary-hover   /* Primary button hover state */
--button-secondary-bg    /* Secondary button background */
--button-secondary-text  /* Secondary button text */
--button-secondary-hover /* Secondary button hover state */

--container-bg          /* Card/container background */
--container-border      /* Card/container border */
--container-shadow      /* Card/container shadow */

--hover-bg             /* Hover state background */
--active-bg            /* Active state background */
--selected-bg          /* Selected state background */
--selected-text        /* Selected state text */
```

### Status Colors
```css
--success  /* Green for success states */
--warning  /* Yellow for warning states */
--error    /* Red for error states */
--info     /* Blue for info states */
```

## Standardized Component Classes

### Buttons
Use these classes for all buttons to ensure consistent theming:

```html
<!-- Primary button (purple background, white text) -->
<button class="btn btn-primary">Save Changes</button>

<!-- Secondary button (light purple background, purple text) -->
<button class="btn btn-secondary">Cancel</button>
```

### Cards & Containers
Use these classes for content containers:

```html
<!-- Standard card -->
<div class="card">
  <h3>Card Title</h3>
  <p>Card content...</p>
</div>

<!-- Small card -->
<div class="card card-sm">Compact content</div>

<!-- Large card -->
<div class="card card-lg">Spacious content</div>

<!-- Content section -->
<section class="content-section">
  Section content...
</section>
```

### Interactive Elements
Use these classes for clickable elements:

```html
<!-- Basic interactive element -->
<div class="interactive">Click me</div>

<!-- Active state -->
<div class="interactive active">Currently active</div>

<!-- Selected state -->
<div class="interactive selected">Currently selected</div>
```

### Form Elements
Use these classes for form inputs:

```html
<input type="text" class="form-input" placeholder="Enter text..." />
<select class="form-input">
  <option>Select option</option>
</select>
```

### Status Elements
Use these classes for status indicators:

```html
<span class="status-success">✓ Success message</span>
<span class="status-warning">⚠ Warning message</span>
<span class="status-error">✗ Error message</span>
<span class="status-info">ℹ Info message</span>
```

## Page Layout Structure

### Basic Page Structure
```html
<div class="page-container">
  <section class="content-section">
    <h2>Page Title</h2>
    
    <div class="card">
      <h3>Section Title</h3>
      <p>Content goes here...</p>
      
      <div style="display: flex; gap: 12px; margin-top: 16px;">
        <button class="btn btn-primary">Primary Action</button>
        <button class="btn btn-secondary">Secondary Action</button>
      </div>
    </div>
  </section>
</div>
```

## Creating New Components

### 1. Use CSS Variables
Always use CSS variables instead of hardcoded colors:

```css
/* ✅ Good - Uses variables */
.my-component {
  background: var(--container-bg);
  border: 1px solid var(--container-border);
  color: var(--text-primary);
  box-shadow: var(--container-shadow);
}

/* ❌ Bad - Hardcoded colors */
.my-component {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  color: #0f172a;
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
}
```

### 2. Use Standardized Classes
Prefer existing classes over custom CSS:

```html
<!-- ✅ Good - Uses standardized classes -->
<div class="card">
  <button class="btn btn-primary">Action</button>
</div>

<!-- ❌ Bad - Custom CSS needed -->
<div class="my-custom-card">
  <button class="my-custom-button">Action</button>
</div>
```

### 3. Extend When Necessary
If you need custom styling, extend the standard classes:

```css
.my-special-card {
  /* Inherit all card styles */
  @extend .card;
  
  /* Add custom styling */
  border-left: 4px solid var(--primary);
}

/* Or use composition */
.my-special-card {
  /* Custom styles using variables */
  background: var(--container-bg);
  border: 1px solid var(--primary);
  border-radius: 16px;
  padding: 20px;
}
```

## Color Palette

### Light Mode
- **Background**: `#f8fafc` (very light gray)
- **Cards**: `#ffffff` (white)
- **Text Primary**: `#0f172a` (very dark gray)
- **Text Secondary**: `#64748b` (medium gray)
- **Primary Purple**: `#6d28d9`
- **Button Primary**: `#6d28d9` background, `#ffffff` text

### Dark Mode
- **Background**: `#1a1a1a` (very dark gray)
- **Cards**: `#2a2a2a` (dark gray)
- **Text Primary**: `#f1f5f9` (very light gray)
- **Text Secondary**: `#94a3b8` (light gray)
- **Primary Purple**: `#c4b5fd` (light purple for text)
- **Button Primary**: `#7c3aed` background, `#ffffff` text

## Best Practices

1. **Always use CSS variables** for colors and spacing
2. **Use standardized classes** whenever possible
3. **Test in both light and dark modes** during development
4. **Follow the established color hierarchy** (primary purple, grays for text)
5. **Use semantic naming** for custom classes
6. **Maintain consistency** with existing components

## Adding New CSS Variables

If you need new variables, add them to both light and dark mode themes:

```css
:root {
  /* Light mode */
  --my-new-color: #value;
}

[data-theme="dark"] {
  /* Dark mode */
  --my-new-color: #different-value;
}
```

## Testing Theme Switching

The theme can be toggled using the profile menu in the top right corner. Always test:

1. **Initial load** in both themes
2. **Theme switching** while on your page
3. **Interactive states** (hover, active, selected)
4. **Form elements** and their focus states
5. **All button variants**

Following this system ensures that any new pages or components you create will automatically work with both light and dark themes without requiring additional CSS fixes.