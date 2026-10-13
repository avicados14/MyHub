# Grocery sharing and cooking mode

## Share a shopping list

1. Plan your meals in Food and generate the list in Grocery.
2. Review pantry amounts and staples, then start shopping for final purchase quantities. You can also share a draft; the preview labels it as a draft.
3. Select **Share grocery list**. Purchased items are excluded unless you enable **Include purchased items**.
4. Select **Email list**, **Text list**, **More sharing options** (supported devices), or **Copy list**.
5. In your mail or messaging app, choose yourself as the recipient, review the draft and send it.

Email and text prepare drafts, not automatic deliveries. Installed apps and operating-system support determine which app opens. For long lists, or when a mail/text app does not open, copy the preview and paste it into your preferred app. Clipboard denial leaves the preview available for manual selection and copying.

The shared text contains list content and meal-plan dates, without private access links, recipe IDs or connection credentials. No delivery service or Supabase schema change is required.

## Cook a recipe

Open a recipe and select **Start cooking**, or select **Cook recipe** on a planned recipe meal. Planner links use prepared servings (falling back to planned servings). The recipe page uses its currently selected yield.

Cooking mode provides scaled ingredients in your measurement system, ingredient checkboxes, large step text, previous/next controls, all instructions and recipe notes. Change **Cooking servings** to scale the displayed ingredients without changing the saved recipe or meal plan.

**Keep screen awake** requests a browser screen wake lock while cooking mode is visible. Browser support, battery settings and operating-system restrictions can prevent it; the status tells you whether it worked. Leaving cooking mode releases the lock. Cooking progress resets when you leave and does not log consumption or alter leftover balances.

## Validation

Automated checks cover grocery pantry deductions, purchased-item filtering, metadata exclusion and wake-lock cleanup/failures. Browser tests cover cooking scale/navigation and grocery previews, encoded drafts and clipboard-denial fallback on desktop/tablet/mobile configurations.

Physical-device acceptance still needed: open email/SMS drafts using the owner's installed apps and confirm wake-lock behavior on their phone. Automated tests do not send real messages.
