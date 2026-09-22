# MyHub Architecture

## Architectural Summary

MyHub 0.1.0 is a static React and TypeScript application with local IndexedDB persistence. The architecture separates the interface, business rules, persistence, and external integration boundaries so that a future backend or native client does not require the core product behavior to be reinvented.

```text
React feature screens
        ↓
Application data provider and commands
        ↓
Pure TypeScript domain functions
        ↓
Typed IndexedDB and backup boundary

External sources → adapter boundary → reviewed local records
```

The Vite production base is `/MyHub/` in GitHub Actions and `/` in local development. `HashRouter` makes deep application routes safe on static GitHub Pages without rewrite rules.[1]

## Frontend Architecture

`AppShell` owns the responsive navigation, universal search, local-storage status, route viewport, and keyboard skip link. Desktop uses a persistent sidebar. Tablet uses an accessible off-canvas sidebar. Mobile uses a labeled bottom navigation and intentionally changes dense weekly layouts into vertical task flows.

Feature routes are lazy-loaded. Each route composes shared primitives from `src/components/ui.tsx` and reads or updates application state through `AppContext`. Feature screens do not open IndexedDB directly.

The design system uses semantic CSS variables. Raw colors are mapped to roles such as canvas, surface, ink, line, study, meal, attention, success, and danger. The visual direction combines a deep navy frame, mineral blue, pale mint, butter yellow, soft lilac, and restrained pink. Cards use different radii and elevation by hierarchy rather than applying one generic card style everywhere.

## Domain Modules

### School

The school domain contains `CalendarEvent`, `HomeworkAssignment`, `HomeworkSubtask`, and `StudySettings`.

The deterministic study planner performs these steps:

1. Rank incomplete assignments by due date, then priority, then stable identifier.
2. Calculate remaining work from the estimate and progress.
3. Subtract existing study time for the assignment.
4. Search each available day between the configured earliest and latest study times.
5. Reject intervals that overlap calendar events or preserved study blocks.
6. Allocate chunks no longer than the configured default or maximum duration.
7. Preserve the configured break after each planned block.
8. Return both blocks and any minutes that could not fit.

Completed, locked, or manually adjusted study blocks are preserved when the user regenerates a plan. The current web interface exposes explicit buttons and forms instead of making drag-and-drop the only input method.

### Food

A recipe stores its original yield and ingredients. Scaling is always derived as:

```text
scale factor = requested servings / original yield
```

The base recipe is never repeatedly multiplied, which avoids accumulated rounding drift. Unquantified ingredients such as “salt to taste” stay unquantified. Common cooking fractions are formatted at the display edge.

Food-log entries store nutrition snapshots. Later recipe edits therefore do not rewrite historical nutrition. Prepared and consumed servings remain separate, and remaining servings cannot become negative.

### Pantry and Grocery

Grocery generation traces planned meals to recipe ingredients. Aggregation is conservative: it combines only matching canonical ingredient names with compatible units. The current conversion table combines ounces and pounds. Other mass, volume, count, cooked-versus-dry, and ambiguous cross-family conversions remain separate until the user resolves them.

Pantry Check records the user’s decision for every requirement. Generating a list does not silently subtract inventory. A completed trip is copied into an immutable history record. Purchased items enter the pantry only through an explicit post-trip action.

## Data Model

All persistent records use stable string identifiers, ISO timestamps, and explicit source labels. Local calendar dates and meal dates use `YYYY-MM-DD` so they do not shift across midnight because of UTC conversion.

The main aggregate is `AppData`:

| Area | Records |
|---|---|
| School | Calendar events, homework assignments, subtasks, study settings |
| Food | Recipes, ingredients, steps, meal entries, food-log snapshots |
| Inventory | Pantry items, active grocery list, immutable grocery history |
| Preferences | Appearance, measurement system, nutrition targets, Canvas status |

`AppData.schemaVersion` is currently `1`. The backup envelope adds its own `formatVersion`, application version, and export timestamp.

## Persistence

`src/storage/database.ts` owns IndexedDB access. Feature modules cannot depend on the browser database API. The current implementation persists one transactionally replaced application aggregate in the `application` object store. This keeps connected state coherent during Phase 1 and leaves a clear migration path to indexed aggregate stores if data volume or query complexity grows.

Loading invalid or missing state produces removable demo data. Persistence errors are announced in an accessible live region. JSON imports validate the backup format and schema before replacement.

## Integration Boundaries

GitHub Pages cannot hold secrets or provide a private proxy. External features therefore follow four rules:

1. Core behavior must still work manually.
2. User input and provenance must be preserved.
3. Failure must be explicit and actionable.
4. Missing values must never be fabricated.

Canvas supports a direct best-effort ICS URL request and a reliable local `.ics` file import. Recipe URL extraction, nutrition lookup, barcode lookup, OCR, image interpretation, and social-media intake remain future adapters rather than hard-coded dependencies.

## Historical Snapshots

Food logs and grocery history store copies of the relevant facts at the time of the action. Editing a recipe later does not alter a logged meal or completed grocery trip. This rule must remain true in future web migrations, backend APIs, and SwiftData models.

## Testing Strategy

Vitest validates pure domain functions and IndexedDB behavior. The suite currently covers recipe scaling, fraction formatting, nutrition sums, leftover limits, unit normalization, grocery aggregation, pantry subtraction, due ordering, conflict-aware study planning, ICS parsing, persistence, and backup validation.

Playwright runs critical workflows in Chromium at desktop, tablet, and mobile sizes. Tests use semantic role and label locators. CI runs linting, strict type checking, unit tests, browser tests, and the production build before deployment.

## Future Backend

A backend should be added only when a concrete capability needs it, such as secure recipe extraction, nutrition lookups requiring credentials, backups, or device synchronization. When added, both web and native clients should call the same documented API. The domain layer and adapter interfaces should remain independent of the transport.

## Future iOS Architecture

The native app will be a SwiftUI implementation, not a WebView. The web shell maps conceptually to `NavigationSplitView` on iPad and `TabView` plus `NavigationStack` on iPhone. Focused edits map to sheets and confirmation dialogs. The business rules should be reimplemented against golden fixtures using `UUID`, `Decimal`, explicit local-date types, and versioned `Codable` payloads.

EventKit, SwiftData, Vision, PhotosPicker, AVFoundation, Share Extensions, App Groups, CloudKit, and any private backend are native or server adapters. They must not leak into shared domain semantics.

## References

[1]: https://vite.dev/guide/static-deploy.html "Vite — Deploying a Static Site"
[2]: https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages "GitHub Docs — Using Custom Workflows with GitHub Pages"
