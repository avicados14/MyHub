# Multiple meal items and container portions

Each day/meal slot can contain several recipes, packaged foods, or custom foods. Use **Add another item** for drinks, snacks, sides, or desserts. Entries keep their own planned and consumed servings, nutrition snapshots, and leftover batches. Editing, deleting, moving, or copying one item preserves its neighbors. **+1 serving eaten** records an additional serving of that item; consumed nutrition updates with it. The dashboard includes every item in the slot.

## Container estimate

The meal editor offers **Use container estimate** for supported bowl-style recipes. Entered portions take priority; applying an estimate does not change recipe yield or per-serving nutrition.

- A 30 US fluid-ounce container has a nominal capacity of 887 mL (3.75 US cups), not 30 ounces of food weight.
- The estimate uses 85% of capacity: approximately 754 mL or 3.2 cups, leaving lid space. This is an adjustable-by-entry kitchen assumption, not a container manufacturer's specification.
- Ingredient quantities are converted to approximate cooked volumes. Rice/pasta expansion, meat cooking loss, and vegetable/cheese settling are approximate. Cooking and packing can change volume by 25% or more; the displayed range is illustrative, not a statistical confidence interval.
- Dry-grain cooking water is not counted twice. Brothy soups/stews with dry grains, unknown major ingredient quantities, and foods unsuited to this volume model require a measured portion instead.
- The estimate assumes the recipe occupies the container alone. Sides reduce available capacity. Measuring the cooked batch and portion is more accurate.

Capacity conversion reference: [NIST Guide to the SI, Appendix B.9](https://www.nist.gov/pml/special-publication-811/nist-guide-si-appendix-b-conversion-factors/nist-guide-si-appendix-b9). Ingredient density and cooking multipliers are rough household assumptions, not validated nutrition facts. Nutrition continues to use the recipe's existing per-serving values.

## Compatibility and verification

No database or portable-data schema change is required: existing meal IDs distinguish items. This change targets the web app. Unit tests cover independent entries, consumption, leftovers, moving/copying into occupied slots, and conservative container estimates. Browser coverage adds a recipe, drink, and dessert to one dinner, records seconds, reloads, and removes one item while preserving the others.
