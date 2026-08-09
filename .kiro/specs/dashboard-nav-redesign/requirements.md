# Requirements Document

## Introduction

This feature redesigns two navigation UI components in the Expezplit frontend (React/TypeScript/Vite):

1. **Mobile Bottom Navigation Bar** — visible to signed-in users on mobile viewports (≤768px). Replaces the basic active-highlight style with a pill/rounded-rect active indicator that wraps both the icon and label of the selected tab.

2. **FAB (Floating Action Button) Menu** — visible to signed-out users on the landing page. Redesigns the expandable navigation stack to display a condensed set of three primary items (Live Split Calc, Simulator, Features) with the currently-active item highlighted in yellow with a glow effect, plus a dedicated yellow close button beneath the stack.

No new libraries are introduced. Changes are limited to CSS rewrites and minor JSX tweaks in `frontend/src/style.css` and `frontend/src/App.tsx`.

---

## Glossary

- **MobileBottomNav**: The fixed bottom navigation bar rendered on mobile (`≤768px`) for signed-in users, identified by CSS class `mobile-bottom-nav`.
- **NavItem**: A single tab button inside MobileBottomNav, identified by CSS class `mobile-nav-item`.
- **ActivePill**: The yellow rounded-rect background (`border-radius: 16px`, `background: #FFE600`) that wraps the icon and label of the currently selected NavItem.
- **FAB**: Floating Action Button navigation component rendered only for signed-out users on the landing page, identified by CSS class `fab-nav-wrapper`.
- **FABTrigger**: The circular button that opens/closes the FAB menu, identified by CSS class `fab-trigger-btn`.
- **FABMenu**: The vertical stack of pill navigation items that appears when the FAB is open, identified by CSS class `fab-menu-stack`.
- **FABPill**: A single navigation item within FABMenu, identified by CSS class `fab-pill-item`.
- **FABCloseButton**: A dedicated yellow circular close button displayed at the bottom of FABMenu when open, replacing the close affordance on FABTrigger.
- **AccentYellow**: The app accent colour `#FFE600` (also `#FDE406` per CSS variable `--accent`).
- **ActiveNav**: The `activeNav` state variable in `App.tsx` that tracks the current landing page section visible in the viewport via scroll-spy.

---

## Requirements

### Requirement 1: Mobile Bottom Nav — Active Tab Visual Treatment

**User Story:** As a signed-in mobile user, I want the active dashboard tab to stand out with a clear visual indicator, so that I can immediately see which section I am viewing.

#### Acceptance Criteria

1. WHEN a NavItem is the active tab, THE MobileBottomNav SHALL display an ActivePill background behind that NavItem's icon and label, using `background: #FFE600`, `color: #000000`, and `border-radius: 16px`.
2. WHEN a NavItem is the active tab, THE MobileBottomNav SHALL render the NavItem's label in bold weight (`font-weight: 700` or higher).
3. WHEN a NavItem is not the active tab, THE MobileBottomNav SHALL display the NavItem's icon and label in a muted grey colour (`rgba(255,255,255,0.50)` in dark mode; `rgba(15,23,42,0.45)` in light mode) with no background.
4. THE MobileBottomNav SHALL stack each NavItem's icon above its text label (column flex direction) for all three tabs: Expenses, Analytics, and Splitwise.
5. THE MobileBottomNav SHALL use a light/white background (`rgba(255,255,255,0.96)` with a top border) in light mode and a dark translucent background in dark mode.
6. WHEN a NavItem is the active tab, THE MobileBottomNav SHALL NOT display a glow `box-shadow` on the ActivePill that causes the pill to overflow the nav bar's visible height, keeping the pill contained within the bar.

---

### Requirement 2: Mobile Bottom Nav — Layout and Sizing

**User Story:** As a signed-in mobile user, I want the bottom nav bar to feel spacious and touch-friendly, so that I can tap tabs accurately without accidental misfires.

#### Acceptance Criteria

1. THE MobileBottomNav SHALL render with a minimum height of `60px` (excluding `safe-area-inset-bottom` padding) on all viewports at or below `768px`.
2. THE MobileBottomNav SHALL distribute its three NavItems equally across the full width of the screen using a three-column equal grid.
3. THE NavItem SHALL have a minimum touch target of `48px × 48px` per WCAG 2.5.8 guidelines.
4. THE MobileBottomNav SHALL add bottom padding equal to `env(safe-area-inset-bottom, 0px)` to avoid overlap with iOS home indicator.
5. WHERE the device is in light mode (`[data-theme="light"]`), THE MobileBottomNav SHALL render with a white background and a subtle grey top border so the bar is visually distinct from the page content below it.

---

### Requirement 3: FAB Menu — Condensed Item Set

**User Story:** As a signed-out landing page visitor, I want the FAB navigation menu to show the three most important sections, so that the menu is immediately scannable and not overwhelming.

#### Acceptance Criteria

1. WHEN the FABMenu is open, THE FAB SHALL display exactly three FABPill items in the following top-to-bottom order: **Live Split Calc**, **Simulator**, **Features**.
2. WHEN a FABPill corresponds to the section currently active in `activeNav`, THE FAB SHALL apply AccentYellow background (`#FFE600`) and `color: #000000` to that FABPill.
3. WHEN a FABPill is not the active section, THE FAB SHALL render it with a white/light pill background and dark text (`#18181B`) in dark mode, and a white background with `#18181B` text in light mode.
4. THE FABPill for the "Features" section SHALL map to the `features` section ID (i.e., match `activeNav === "features"`).
5. THE FABPill for the "Live Split Calc" section SHALL map to the `calculator` section ID (i.e., match `activeNav === "calculator"`).
6. THE FABPill for the "Simulator" section SHALL map to the `demo` section ID (i.e., match `activeNav === "demo"`).

---

### Requirement 4: FAB Menu — Active Item Glow

**User Story:** As a signed-out visitor, I want the currently active section's FAB pill to have a visible glow, so that the active item is immediately distinguishable.

#### Acceptance Criteria

1. WHEN a FABPill has the `active` class, THE FAB SHALL render a yellow glow `box-shadow` of at least `0 0 28px rgba(255, 230, 0, 0.65)` on that pill.
2. THE FABPill glow SHALL be visible against the dark semi-transparent backdrop that overlays the page when the FABMenu is open.
3. WHEN the active FABPill is in light mode, THE FAB SHALL maintain the yellow glow `box-shadow` so the active item remains distinguishable against a light background.

---

### Requirement 5: FAB Menu — Close Button

**User Story:** As a signed-out visitor, I want a dedicated close button at the bottom of the FAB menu, so that I can close the menu without navigating away.

#### Acceptance Criteria

1. WHEN the FABMenu is open, THE FAB SHALL render a FABCloseButton below the lowest FABPill item in the stack.
2. THE FABCloseButton SHALL be a circular button (`border-radius: 50%`) with AccentYellow background (`#FFE600`) and a dark `×` icon.
3. THE FABCloseButton SHALL have a minimum diameter of `52px` to meet touch-target accessibility requirements.
4. WHEN the FABCloseButton is clicked, THE FAB SHALL close the FABMenu (set `isBubbleOpen` to `false`).
5. THE FABCloseButton SHALL be positioned at the same horizontal right-alignment as the other FABPill items in the stack.

---

### Requirement 6: FAB Menu — Animation

**User Story:** As a signed-out visitor, I want the FAB menu items to animate in smoothly when opened, so that the interaction feels polished.

#### Acceptance Criteria

1. WHEN the FABMenu opens, THE FAB SHALL animate each FABPill from `opacity: 0; transform: translateY(20px)` to `opacity: 1; transform: translateY(0)` using a cubic-bezier ease.
2. WHEN the FABMenu opens, THE FAB SHALL stagger each FABPill's animation with an increasing `animation-delay` from bottom to top (bottom item animates first, top item last).
3. WHEN the FABMenu opens, THE FAB SHALL animate the backdrop from `opacity: 0` to `opacity: 1` using a short fade-in (approximately `220ms`).
4. IF the `prefers-reduced-motion` media query is set to `reduce`, THEN THE FAB SHALL disable all transform animations and reduce transition durations to `0ms` for FABPill entrance animations.

---

### Requirement 7: FAB Trigger Button — State

**User Story:** As a signed-out visitor, I want the FAB trigger button to visually communicate whether the menu is open or closed, so that I know what tapping it will do.

#### Acceptance Criteria

1. WHEN the FABMenu is closed, THE FABTrigger SHALL display a hamburger/menu icon and render with a dark background and yellow border.
2. WHEN the FABMenu is open, THE FABTrigger SHALL continue to show a menu icon (the close affordance is delegated to FABCloseButton) without rotating or changing to an `×` icon.
3. THE FABTrigger SHALL maintain its fixed bottom-right position at all times when the signed-out landing page is rendered.
4. IF the user taps the FABTrigger while the FABMenu is open, THEN THE FAB SHALL close the FABMenu.

---

### Requirement 8: Theme Compatibility

**User Story:** As a user in light mode, I want the redesigned navigation components to look correct against a white background, so that the visual design is consistent across themes.

#### Acceptance Criteria

1. WHERE the app is in light mode (`[data-theme="light"]`), THE MobileBottomNav SHALL use `background: rgba(255, 255, 255, 0.96)` and a `border-top: 1px solid rgba(0, 0, 0, 0.08)`.
2. WHERE the app is in light mode, THE FABPill inactive items SHALL use `background: #FFFFFF` with `color: #18181B` and a `border: 1px solid rgba(0,0,0,0.10)`.
3. WHERE the app is in light mode, THE FABPill active item SHALL retain `background: #FFE600` and `color: #000000` with the yellow glow.
4. WHERE the app is in dark mode (`[data-theme="dark"]` / default), THE MobileBottomNav SHALL use a dark translucent background and a subtle light top border.
5. WHERE the app is in dark mode, THE FABPill inactive items SHALL use `background: #FFFFFF` with `color: #18181B` (white pill on dark backdrop).
