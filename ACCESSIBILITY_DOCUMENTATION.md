# BrandPillar AI Accessibility Documentation

## Overview

BrandPillar AI is built with accessibility as a core principle, following WCAG 2.1 AA guidelines to ensure our platform is usable by everyone, including people with disabilities.

## Accessibility Features

### 1. Keyboard Navigation
- **Full keyboard support**: Navigate the entire application without a mouse
- **Tab order**: Logical tab order through all interactive elements
- **Skip links**: Quick navigation to main content areas
- **Keyboard shortcuts**: 
  - `/` - Focus search
  - `Ctrl+G` - Go to dashboard
  - `Ctrl+N` - Create new content
  - `Ctrl+W` - Go to workshop
  - `?` - Show keyboard shortcuts help

### 2. Screen Reader Support
- **Semantic HTML**: Proper heading hierarchy and landmark regions
- **ARIA labels**: Descriptive labels for all interactive elements
- **Live regions**: Dynamic content changes announced to screen readers
- **Alt text**: Meaningful descriptions for all images and icons

### 3. Visual Accessibility
- **High contrast mode**: Automatic support for system high contrast settings
- **Focus indicators**: Clear visual focus indicators for keyboard navigation
- **Color contrast**: All text meets WCAG AA contrast requirements
- **Resizable text**: Content remains readable when zoomed to 200%
- **No color-only information**: Information not conveyed by color alone

### 4. Motion and Animation
- **Reduced motion**: Respects user's reduced motion preferences
- **Pausable animations**: Users can pause or disable animations
- **No auto-playing content**: No content plays automatically

### 5. Forms and Inputs
- **Label associations**: All form fields have associated labels
- **Error messages**: Clear, descriptive error messages linked to fields
- **Field descriptions**: Help text for complex fields
- **Required field indicators**: Visual and programmatic indicators

## Component-Specific Accessibility

### Workshop Flow
- **Progress announcements**: Step changes announced to screen readers
- **Keyboard navigation**: Navigate between steps with arrow keys
- **Save confirmation**: Status updates for auto-save functionality
- **Error recovery**: Clear guidance when errors occur

### Modals and Dialogs
- **Focus trapping**: Focus stays within modal when open
- **Escape key**: Close modals with Escape key
- **Focus restoration**: Focus returns to trigger element on close
- **Accessible titles**: All modals have descriptive titles

### Data Tables
- **Table headers**: Proper header associations
- **Row/column relationships**: Clear data relationships
- **Sortable columns**: Keyboard accessible sorting
- **Pagination**: Accessible page navigation

## Testing Accessibility

### Development Tools
1. **Accessibility Audit Component**: Press `Ctrl+Shift+A` in development to run audit
2. **axe DevTools**: Browser extension for accessibility testing
3. **Keyboard testing**: Test all features using only keyboard
4. **Screen reader testing**: Test with NVDA (Windows) or VoiceOver (Mac)

### Manual Testing Checklist
- [ ] Can navigate entire app with keyboard only
- [ ] All interactive elements are reachable and usable
- [ ] Focus indicators are visible
- [ ] Content is readable at 200% zoom
- [ ] Color contrast passes WCAG AA
- [ ] Forms have proper labels and error messages
- [ ] Dynamic content changes are announced
- [ ] Images have appropriate alt text

## Implementation Guidelines

### For Developers

#### Using Accessible Components
```tsx
// Use the accessible form components
import { TextInput, TextArea, Select, RadioGroup } from '@/components/accessibility/FormField';

<TextInput
  label="Email Address"
  type="email"
  required
  error={errors.email}
  description="We'll never share your email"
/>
```

#### Adding ARIA Labels
```tsx
// Interactive elements without visible text
<button aria-label="Close dialog">
  <X className="w-5 h-5" aria-hidden="true" />
</button>

// Complex widgets
<div role="tablist" aria-label="Account settings">
  <button role="tab" aria-selected="true" aria-controls="panel-1">
    Profile
  </button>
</div>
```

#### Announcing Dynamic Changes
```tsx
import { useAnnounce } from '@/hooks/useAccessibility';

const announce = useAnnounce();

// Announce status changes
announce('File uploaded successfully');
announce('Error: Invalid file format', 'assertive');
```

#### Focus Management
```tsx
import { useFocusRestore, useFocusTrap } from '@/hooks/useAccessibility';

// In a modal component
const modalRef = useRef<HTMLDivElement>(null);
const { saveFocus, restoreFocus } = useFocusRestore();

useFocusTrap(modalRef, isOpen);

useEffect(() => {
  if (isOpen) saveFocus();
  else restoreFocus();
}, [isOpen]);
```

### Best Practices

1. **Semantic HTML First**: Use proper HTML elements (`<button>`, `<nav>`, `<main>`)
2. **Meaningful Text**: Write descriptive link text and button labels
3. **Error Prevention**: Provide clear instructions and validate input
4. **Consistent Navigation**: Keep navigation consistent across pages
5. **Testing**: Test with real assistive technologies

## Resources

### External Resources
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [WebAIM](https://webaim.org/)
- [MDN Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)

### Internal Utilities
- `/src/utils/accessibility.ts` - Accessibility utility functions
- `/src/hooks/useAccessibility.ts` - React hooks for accessibility
- `/src/components/accessibility/` - Accessible component library
- `/src/styles/accessibility.css` - Accessibility-specific styles

## Reporting Accessibility Issues

If you encounter any accessibility barriers:
1. Open an issue on GitHub with the `accessibility` label
2. Include:
   - Description of the barrier
   - Steps to reproduce
   - Assistive technology used
   - Expected behavior
   - Screenshots if applicable

## Compliance

BrandPillar AI aims to meet:
- WCAG 2.1 Level AA
- Section 508 (US)
- EN 301 549 (EU)
- ADA compliance

Regular accessibility audits are conducted to maintain compliance.