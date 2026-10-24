# Ajson Studio — Frontend Design System

## 1. Brand Identity & Vision
Ajson Studio is an AI-native desktop software development environment. The brand is represented by an original geometric isometric cube/glyph with hyper-cyan electric accents, signifying high-precision code cognition and real-time agent orchestration.

---

## 2. Color Palette & Accessibility

| Token | Dark Theme | Light Theme (Contrast ≥ 4.5:1) | High Contrast | Role |
| :--- | :--- | :--- | :--- | :--- |
| `--accent` | `#00F2FE` (Hyper-Cyan) | `#0D9488` (Teal 600, 4.54:1 on `#FFF`) | `#00F2FE` | Brand accent, active tabs, focus ring |
| `--accent-hover` | `#38F9D7` | `#0F766E` | `#38F9D7` | Hover states on interactive accent elements |
| `--accent-contrast`| `#06080E` | `#FFFFFF` | `#000000` | Text/icons placed over accent fills |
| `--bg-0` | `#06080E` | `#F1F5F9` | `#000000` | Stage background, editor canvas |
| `--bg-1` | `#0B0F19` | `#F8FAFC` | `#000000` | Titlebar, ActivityBar, SideBar, StatusBar |
| `--bg-2` | `#111827` | `#FFFFFF` | `#050505` | Cards, modals, inputs, dropdown menus |
| `--bg-3` | `#1B2234` | `#E2E8F0` | `#121212` | Hovered rows, pressed tabs |
| `--fg-0` | `#FFFFFF` | `#0F172A` | `#FFFFFF` | Primary headers, active titles |
| `--fg-1` | `#E5E7EB` | `#1E293B` | `#FFFFFF` | Body text, editor code |
| `--fg-2` | `#9CA3AF` | `#475569` | `#E0E0E0` | Subtitle text, inactive tabs |
| `--fg-3` | `#64748B` | `#64748B` | `#B0B0B0` | Muted hints, breadcrumb arrows |

---

## 3. Spacing Grid (4px Base)
- `--space-1`: 4px
- `--space-2`: 8px
- `--space-3`: 12px
- `--space-4`: 16px
- `--space-6`: 24px
- `--space-8`: 32px

---

## 4. Typography
- **UI Stack**: `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
- **Code Stack**: `'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace`
- **Scale**:
  - `text-2xs`: 10px (badges, kbd)
  - `text-xs`: 11px (status bar, breadcrumbs, sidebar headers)
  - `text-sm`: 12px (file tree items, tab labels, menus)
  - `text-base`: 13px (standard UI, dialog text)
  - `text-md`: 14px (panel headers, modal titles)
  - `text-lg`: 16px (card headings)
  - `text-xl`: 18px (welcome title)

---

## 5. Layout Architecture & Panel Hierarchy
- **TitleBar** (38px height): Global application menu, Quick Search / Command Palette trigger (`F1` / `Ctrl+Shift+P`), View Switcher (`Ctrl+Shift+M`), Theme toggle, window controls.
- **ActivityBar** (48px width): Vertical primary icon dock for Explorer, Search, Git, Debug, Tests, Extensions, Settings, and Mission Control.
- **SideBar** (Resizable, default 20%): Primary sidebar container for active tool panels.
- **EditorArea** (Central stage): Multi-tab bar, breadcrumb navigation, code buffer surface, and welcome center.
- **BottomPanel** (Resizable, default 28%): Collapsible dock for Terminal, Task Output, and Problems diagnostics.
- **RightPanel** (Resizable, default 25%): AI Assistant sidebar for interactive cognitive agent chat, mode switching, and token context meters.
- **StatusBar** (24px height): Branch indicator, problem count, AI engine readiness, cursor location, encoding, language mode, active model, and notifications.

---

## 6. Base Component Library
1. `Button` & `IconButton`: Accessible button primitives with variants (`primary`, `secondary`, `ghost`, `danger`) and loading state.
2. `Input`: Accessible text input with icon prefix/suffix slots and error validation state.
3. `Badge`: Status and counter pill with semantic color variants (`default`, `accent`, `success`, `warning`, `danger`).
4. `Tooltip`: Hover/focus tooltip with delay timer and directional positioning (`top`, `bottom`, `left`, `right`).
5. `Modal`: Accessible dialog overlay with backdrop blur, focus trap, and keyboard escape dismiss.
6. `Tabs`: Tab bar with active indicators and ARIA roles (`role="tablist"` / `role="tab"`).
7. `Dropdown`: Accessible popover menu with keyboard navigation and divider items.
8. `Toast`: Real-time toast alert notifications with auto-dismiss timers.
9. `Spinner`: Micro-animation loading indicator.
10. `Kbd`: Visual keyboard shortcut badge.
11. `EmptyState`: Clean placeholder state with icon, title, description, and action button.
12. `Splitter`: Thin wrapper around `react-resizable-panels` `PanelResizeHandle` with double-click reset.
13. `CommandPalette`: `cmdk`-powered fuzzy search modal with shortcut chips and categories (`F1` / `Ctrl+Shift+P`).
