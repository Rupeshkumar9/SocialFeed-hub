# SocialFeed UI/UX Completion Handoff

## Goal

Keep the existing Pinterest-style bookmark feed and card layouts. Simplify the top navigation, make the sidebar the primary place for filtering and secondary tools, and add a compact action toolbar inspired by the supplied InstaVault references.

Do not add AI categorisation in this task. Do not change the bookmark card layout, database schema, import workflow, or feed pagination unless needed to keep the controls below working.

## Current code locations

| Area | Current files |
| --- | --- |
| Page structure | `client/index.html` |
| Application state, filtering, actions | `client/js/app.js` |
| Layout, sidebar, responsive styling | `client/css/styles.css` |

## 1. Repair the sidebar counters

### Observed cause

The sidebar markup already contains count elements such as `#count-platform-instagram`. `client/js/app.js` also contains `updateSidebarNavigation()`, which calculates the counts and updates those elements. However, the current data lifecycle does not call that function after bookmarks are loaded or after the feed state changes. The counts therefore remain at their initial `0` values.

### Required implementation

1. Call `updateSidebarNavigation()` once after bookmark data has loaded and after `processCollections()` and `processTags()` have completed.
2. Call it whenever a filter is applied, so the active sidebar item and the hidden/mobile select values stay in sync.
3. Call it after any mutation that can change the data set or collections: successful import, add link, edit, delete, bulk delete, and successful server refresh.
4. Counts must always use the complete `AppState.bookmarks` data set, not `filteredBookmarks`. A platform count represents the total saved posts for that platform.
5. Normalise platform values before counting. Treat legacy values such as `twitter` as `x` if such data exists. Unknown platforms should not break the counter update.
6. Retain a zero count for supported platforms with no posts: Threads, Reddit, and Facebook should display `0`, not disappear.

### Acceptance checks

- With the current data set, “All Platforms” equals the total bookmark count shown in the title/subtitle.
- Instagram and X show their actual totals immediately after the first load, without a manual click or refresh.
- Clicking Instagram makes it active, filters the feed, and leaves the Instagram total unchanged.
- Importing a new Reddit bookmark updates “All Platforms” and “Reddit” without a page reload.

## 2. Remove the duplicate logo/home region

### Current issue

Desktop shows the SocialFeed brand twice: once in the sidebar header and again in the main header. The main-header brand is the useful one because it links to `/`; it should occupy the leftmost position(sidebar header position), while the duplicate sidebar header should be removed.

### Required implementation

1. Remove the entire `.sidebar-header` block from `#sidebar`, including its logo icon and text.
2. Keep the linked `.logo-link` in `.main-header .header-left`.
3. Position that linked brand at the far left edge of the top header, in the visual location freed by removing the sidebar brand. It must still navigate to `/`.
4. Desktop sidebar content should begin with the Platform section, aligned with a little top padding. Do not leave an empty logo-sized gap.
5. On mobile, retain only the existing hamburger button plus the single linked brand. There must never be two brand/home icons on the same screen.

### Acceptance checks

- There is one SocialFeed brand/home link on desktop and mobile.
- Clicking it navigates to the homepage.
- The sidebar gains usable vertical space and begins with Platform.

## 3. Make the browser scrollbar visible

### Current issue

The pink scrollbar thumb is too pale against the page background, especially in Chromium browsers.

### Required implementation

1. Find the global scrollbar styling in `client/css/styles.css` (`::-webkit-scrollbar`, track, and thumb rules).
2. Keep the product palette but increase contrast materially:
   - Track: very pale pink/neutral background.
   - Thumb default: a clearly visible medium rose/magenta from the existing brand palette.
   - Thumb hover/active: a darker, high-contrast version of that thumb colour.
3. Make the thumb at least 10–12px wide on desktop, with a modest radius. It should be easy to grab without looking visually heavy.
4. Add a Firefox `scrollbar-color` fallback with the same contrast intent.
5. Do not style a scrollbar so aggressively that it obscures content or causes horizontal overflow.

### Acceptance checks

- In Chrome/Edge, the thumb is obvious at a glance on a light page.
- The hover state is visibly darker.
- Firefox shows a similarly readable scrollbar.

## 4. Move Tags into Categories in the sidebar

### Required information architecture

The sidebar’s Categories section should contain, in this order:

1. All
2. Uncategorized
3. Existing user collections/folders
4. Tags expandable group

### Required implementation

1. Remove the complete `#tags-dropdown` from the main header. Remove its header-specific event handling and CSS only after moving the filtering behavior.
2. In the sidebar Categories section, add one expandable “Tags” row with a tag icon, a chevron, and an optional count badge showing the number of distinct tags.
3. The group must be collapsed by default. Clicking the Tags row expands/collapses it; keyboard Enter/Space must work, and `aria-expanded` must reflect the state.
4. When expanded, show:
   - “All Tags” first.
   - Existing tags alphabetically below it.
   - A visible active state for the selected tag.
   - Long tag names truncated with a tooltip/title rather than breaking the sidebar width.
5. Reuse the existing tag filtering state (`AppState.activeTag`) and filtering behavior. Do not create a second independent tag filter.
6. After tag data changes, rerender the sidebar tag list and preserve the selected tag when it still exists. If a selected tag no longer exists, reset to All Tags.
7. On mobile, the Tags group must appear inside the mobile drawer, not reappear in the top header.

### Acceptance checks

- No Tags control remains in the navbar.
- Selecting a tag changes the feed exactly as it did before.
- Selecting All Tags removes only the tag filter, keeping platform, category, search, and sort filters intact.

## 5. Move Analytics to the sidebar

### Required implementation

1. Remove `#btn-toggle-stats` from the feed header beside the layout switcher.
2. Add an “Analytics” sidebar item, preferably below the Categories/Tags block and above Quick Actions, using the existing chart-line icon.
3. Reuse the existing `#stats-panel`, `updateStatsAnalytics()`, and open/close logic. Do not duplicate the analytics calculation.
4. The Analytics sidebar item must have an active state while the statistics panel is visible.
5. When Analytics opens, show the current stats panel above the bookmark feed as it does now. Preserve the existing panel content.
6. In the mobile drawer, Analytics remains accessible and closes the drawer after activation.

### Acceptance checks

- The feed header has no Analytics button.
- The sidebar Analytics item opens and closes the existing dashboard.
- The dashboard refreshes after bookmark changes while open.

## 6. Replace scattered actions with a compact expandable toolbar

### Placement

Create a single action-and-view toolbar at the right side of `.feed-section-header`, beside the feed title. It replaces the current standalone layout switcher and the actions currently hidden in Feed Manager or Sidebar Quick Actions.

### Actions and order

Place these controls in this exact order:

1. Select mode
2. Add link
3. Import
4. Export JSON
5. Filter/sort
6. Grid view
7. List view
8. Compact view

The view controls must be the final controls in the row.

Use the existing icon language where possible:

| Action | Suggested Font Awesome icon |
| --- | --- |
| Select | `fa-square-check` |
| Add link | `fa-plus` |
| Import | `fa-file-import` |
| Export JSON | `fa-file-export` or `fa-download` |
| Filter/sort | `fa-arrow-down-up-across-line` or `fa-arrow-down-wide-short` |
| Grid | `fa-grip` |
| List | `fa-list` |
| Compact | `fa-bars` |

### Compact/expanded behavior

1. At rest, all toolbar actions are fixed-size icon buttons with tooltips. They must not shift the surrounding layout.
2. On pointer hover or keyboard focus within a single action, its button expands smoothly to reveal the label. Only the hovered/focused action expands.
3. On touch devices, a tap toggles the label or activates the action directly; do not make a touch user perform a hover-only interaction. Tooltips remain useful for icon-only controls.
4. Use a short, restrained transition (roughly 160–220ms) for width, background, and border. Respect `prefers-reduced-motion`.
5. Do not make the icon buttons pill-shaped. Use the project’s existing small-radius control style and fixed height.
6. Active controls (Select mode and current view) should have an obvious active border/background, not rely only on colour.
7. The toolbar must wrap cleanly below the title on narrow desktop/tablet widths and stack or horizontally scroll safely on mobile. No controls may overlap the title, feed cards, or each other.

### Action behavior

- **Select**: reuses existing select-mode behavior. Its active state persists while selection mode is on.
- **Add link**: opens the existing manual bookmark modal.
- **Import**: opens the existing import modal.
- **Export JSON**: invokes the existing JSON download action.
- **Grid/List/Compact**: reuse the existing `changeLayout()` behavior and active state.

### Remove original copies

After the toolbar works, remove the original triggers so every action has only one visible home:

| Action | Remove original location |
| --- | --- |
| Select | Sidebar Quick Actions and Feed Manager |
| Add Link | Sidebar Quick Actions and Feed Manager |
| Import | Sidebar Quick Actions and Feed Manager |
| Export JSON | Feed Manager |
| Grid/List/Compact | Existing standalone layout switcher container |

Do not remove the underlying modal, action function, or export function. Rebind the new controls to them.

## 7. Replace the header sort select with the toolbar filter menu

### Required sort menu

Remove the header `#filter-sort` control and its entire navbar filter group. The toolbar Filter/sort button becomes the single sort entry point.

At rest, the icon-only Filter/sort button has a tooltip. On hover/focus it reveals the current choice, for example “Newest First.” On click/tap it opens a compact anchored menu.

Show exactly these options, in this order:

1. Newest First (default)
2. Oldest First
3. Author A–Z
4. Author Z–A

### State mapping

| Menu label | Existing state value |
| --- | --- |
| Newest First | `recent-desc` |
| Oldest First | `recent-asc` |
| Author A–Z | `author-asc` |
| Author Z–A | `author-desc` |

Remove the unused Original Saved Date and Oldest Original Saved choices (`date-desc`, `date-asc`) from the UI and no longer advertise them anywhere. Existing fallback code may remain if desired, but no visible control should expose it.

### Menu interaction requirements

1. Mark the current sort option with a checkmark or radio-like selected state.
2. Clicking an option updates `AppState.activeSort`, updates the label exposed by the collapsed control, applies filtering/sorting, and closes the menu.
3. Escape closes the menu and returns focus to the trigger.
4. Clicking outside closes it.
5. The default remains Newest First after first load. Preserve the user’s choice during the current session; optional localStorage persistence is acceptable only if it does not introduce regressions.

## 8. Remove Feed Manager and redistribute its remaining actions

### Required implementation

1. Remove the complete Feed Manager dropdown: trigger, menu, related header markup, and now-unused dropdown event handling.
2. Move **Admin Login** to a direct, clearly labelled navbar button. Keep its existing login behavior and show it only under the same conditions as today.
3. Move **Export MD** into the sidebar Quick Actions section, which becomes available after Select/Add/Import move to the toolbar.
4. The final Quick Actions section should contain only:
   - Export Markdown
   - Any future non-primary utility actions, if genuinely necessary
5. Do not leave invisible duplicate buttons whose IDs collide with the new controls. Each action should retain one DOM trigger ID and one behavior binding.

### Header end state

The desktop header should be intentionally sparse:

- Single linked SocialFeed brand at left
- Direct Admin Login button when applicable
- Sync button
- Server connection status
- Search input

There should be no Tags, Feed Manager, Recently Added sort select, collection select, platform select, Analytics button, or duplicated logo in the desktop header.

The category/platform selects may remain as hidden synchronization controls for mobile/backward compatibility only if needed by the JavaScript; they must not be visible in desktop navigation.

## 9. Accessibility and visual quality bar

1. Every icon-only button needs an accessible name (`aria-label`) and a tooltip.
2. Dropdown triggers need `aria-expanded` and appropriate menu semantics.
3. Ensure visible keyboard focus is not removed.
4. Use buttons for actions and anchors only for navigation.
5. Preserve contrast for normal, hover, focus, disabled, and active states.
6. Do not introduce large rounded cards, gradient backgrounds, decorative blobs, or a new visual theme. This is a density and clarity improvement to the existing product.
7. Validate at 1440px desktop, 1024px laptop, 768px tablet, and 390px mobile. Check that text never overflows controls and that the toolbar has a robust small-screen layout.

## 10. Completion checklist

- [ ] Sidebar platform counters populate correctly on first load and after data changes.
- [ ] Only one linked SocialFeed brand/home control remains.
- [ ] Scrollbar thumb is clearly visible in Chrome/Edge and readable in Firefox.
- [ ] Tags are an accessible collapsible group in sidebar Categories; no navbar Tags control remains.
- [ ] Analytics lives in the sidebar; no feed-header Analytics button remains.
- [ ] Select, Add Link, Import, Export JSON, Filter, Grid, List, and Compact are in one compact toolbar beside the feed title.
- [ ] Toolbar action labels expand on hover/focus without layout shifts; mobile remains usable without hover.
- [ ] The original action copies have been removed from the sidebar and Feed Manager.
- [ ] Feed Manager is fully removed.
- [ ] Admin Login is direct in the navbar.
- [ ] Export Markdown is in sidebar Quick Actions.
- [ ] Sort menu exposes only Newest First, Oldest First, Author A–Z, and Author Z–A; Newest First is default.
- [ ] Existing feed card styles and grid/list/compact modes still work.
- [ ] Test manually with the existing 344-bookmark data set and at least one freshly imported bookmark.
