# Calendar-aware outfit planning

## Goal

Use weather during likely outdoor activity, instead of the overnight low, while preserving personal temperature bands, kept garments, laundry rules, and manual outfit creation.

## Decisions

- Use visible MyHub calendar events, including TA classes; do not use the homework filter.
- Start with 15 minutes before/after timed events. These are estimates, not route calculations or evidence the user is walking.
- Ignore all-day, assignment-linked, generated study/meal-prep and explicitly online events. Unknown locations remain estimates requiring review.
- Provide per-event include/exclude, editable window duration, and custom outdoor windows. Merge overlapping windows; never count a whole class as outdoors by default.
- Use an explicit calendar timezone for both stored wall-clock event times and hourly forecast labels. Show it in the UI. Golden is the initial weather location; device location is optional. No automatic address geocoding or inferred travel between cities.
- Fetch hourly apparent_temperature, precipitation_probability, wind_speed_10m and daily apparent_temperature_min from Open-Meteo; Fahrenheit and mph. Timestamp requests and cache briefly by coordinates/timezone/date; abort stale requests.
- Conservatively cover every forecast hour touched by an outdoor interval. A missing/nonfinite temperature in any required hour invalidates the schedule-based low. Missing rain/wind stays unknown, not zero.
- Apply existing temperature bands to the outdoor minimum. Show high/low and changing conditions. A jacket remains an explicit removable-layer choice, never a silent replacement for a required warm base.
- Rain/wind prompts must not claim garments are waterproof or windproof without garment metadata.
- No calendar titles, descriptions, addresses, or raw events sent to Gemini. Send only bounded numeric weather context and estimated time windows through the authenticated endpoint.
- Keep daily-low and manual temperature modes. Empty schedules, excluded events, incomplete/out-of-range forecasts and timezone ambiguity must display a reason and fall back visibly.

## Action checklist

- [x] Inspect current calendar visibility, event schema, weather request and Smart Suggest validator.
- [x] Define initial assumptions, privacy boundary and fallback behavior.
- [x] Build and test pure outdoor-window and hourly-weather calculations (including visible calendar feeds).
- [ ] Add hourly API fetch/cache with explicit timezone and request cancellation.
- [ ] Add calendar mode, reviewable event selections and custom outdoor windows to Closet Planner.
- [ ] Connect effective temperature and weather context to regular and Smart suggestions; preserve manual mode and invalidate stale recommendations.
- [ ] Extend server input validation and Gemini explanations with minimal numeric context.
- [ ] Test desktop/mobile controls, reload/settings behavior, weather failure and stale-response handling.
- [ ] Run release checks, deploy backend/frontend and verify production without saving an outfit.

## Acceptance checks

- 8 a.m. class uses the estimated morning walk, not a 3 a.m. low.
- Transitions across hourly boundaries include both relevant forecast hours.
- Hidden feeds, all-day events and online events do not add walks.
- Overlapping/adjacent windows merge; multi-day event interiors do not fabricate arrivals/departures.
- No calendar/weather input is mutated; titles stay local.
- Missing hourly data never silently produces a warmer recommendation.
- Existing exact temperature boundaries, kept-item validation, clean clothing, available shoes/jackets, fallback and manual outfits remain intact.
- Calendar integration is disabled until its UI and end-to-end tests are complete.

Weather API reference: https://open-meteo.com/en/docs
