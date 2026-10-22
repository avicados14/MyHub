# Calendar-aware outfit planning

## Goal

Use weather during likely outdoor activity, instead of the overnight low, while preserving personal temperature bands, kept garments, laundry rules, and manual outfit creation.

## Decisions

- Use visible MyHub calendar events, including TA classes; do not use the homework filter.
- Start with 15 minutes before/after timed events. These are estimates, not route calculations or evidence the user is walking.
- Per Avi's preference, assume walking across the entire positive gap between consecutive events when it is strictly less than 30 minutes, especially on the Mines campus. Apply even when locations are missing or abbreviated; do not require campus address matching. Exactly 30 minutes does not trigger this rule. Clip default buffers to event boundaries, combine overlapping events before finding gaps, and retain manual corrections. Setting estimated duration to zero disables automatic walking windows.
- Ignore all-day, assignment-linked, generated study/meal-prep and explicitly online events. Unknown locations remain estimates requiring review.
- Provide per-event include/exclude, editable window duration, and custom outdoor windows. Merge overlapping windows; never count a whole class as outdoors by default.
- Use an explicit calendar timezone for both stored wall-clock event times and hourly forecast labels. Show it in the UI. Golden is the initial weather location; device location is optional. No automatic address geocoding or inferred travel between cities.
- Fetch hourly apparent_temperature, precipitation_probability, wind_speed_10m and daily apparent_temperature_min from Open-Meteo; Fahrenheit and mph. Timestamp requests and cache briefly by coordinates/timezone/date; abort stale requests.
- Conservatively cover every forecast hour touched by an outdoor interval. A missing/nonfinite temperature in any required hour invalidates the schedule-based low. Missing rain/wind stays unknown, not zero.
- Apply existing temperature bands to the outdoor minimum. Show high/low and changing conditions. A jacket remains an explicit removable-layer choice, never a silent replacement for a required warm base.
- Rain/wind prompts must not claim garments are waterproof or windproof without garment metadata.
- No calendar titles, descriptions, addresses, raw events, or exact time windows sent to Gemini. Append a bounded numeric weather summary to the existing authenticated styling-note input (already limited to 1,000 characters by the server); no backend deployment or new input contract is needed.
- Keep daily-low and manual temperature modes. Empty schedules, excluded events, incomplete/out-of-range forecasts and timezone ambiguity must display a reason and fall back visibly.

## Action checklist

- [x] Inspect current calendar visibility, event schema, weather request and Smart Suggest validator.
- [x] Define initial assumptions, privacy boundary and fallback behavior.
- [x] Build and test pure outdoor-window and hourly-weather calculations (including visible calendar feeds).
- [x] Add hourly API fetch/cache with explicit timezone and request cancellation.
- [x] Add calendar mode, reviewable event selections and custom outdoor windows to Closet Planner.
- [x] Connect effective temperature and weather context to regular and Smart suggestions; preserve manual mode and invalidate stale recommendations.
- [x] Reuse existing server-validated styling notes for minimal numeric weather context and Gemini explanations.
- [x] Test desktop/mobile controls, reload/settings behavior, weather failure and stale-response handling. Pre-merge CI passed 192 unit tests, 160 browser tests, and 2 installed-app offline tests (run 39705622480).
- [ ] Run release checks, deploy frontend and verify production without saving an outfit.

## Acceptance checks

- 8 a.m. class uses the estimated morning walk, not a 3 a.m. low.
- Transitions across hourly boundaries include both relevant forecast hours.
- Hidden feeds, all-day events and online events do not add walks.
- Overlapping/adjacent windows merge; multi-day event interiors do not fabricate arrivals/departures.
- No calendar/weather input is mutated; titles stay local.
- Missing hourly data never silently produces a warmer recommendation.
- Existing exact temperature boundaries, kept-item validation, clean clothing, available shoes/jackets, fallback and manual outfits remain intact.
- Calendar mode is the default. Outdoor corrections are local to the selected date and reset when leaving the planner; the calendar timezone comes from Settings. Release requires browser checks to pass.

Weather API reference: https://open-meteo.com/en/docs

## Release progress

PR #40 merged as `0b5f7be57f6e96f1bd429fdcd9c6b39b2dfe07d2`. The initial publish run (39785846631) stalled in browser-engine installation before application validation. This checklist update starts a fresh publish run with unchanged application code; all release checks remain enabled.

The cancelled run showed very slow package downloads from `azure.archive.ubuntu.com` during Playwright dependency installation. The publish workflow now uses Ubuntu’s main archive for those signed packages and limits browser setup to 10 minutes. Application checks and browser coverage are unchanged.

Run 39789425935 confirmed that this runner resolves Ubuntu packages through `/etc/apt/apt-mirrors.txt`; changing only sources.list and ubuntu.sources left the slow Azure mirror active. The workflow now also rewrites that mirror-list file before installing dependencies. The 10-minute setup timeout and all validation gates remain enabled.
