# Saved Message Guidelines

## Purpose

Use one calm, consistent success message across MiniTickets and related apps after a settings or record-edit action succeeds.

## Standard Copy

Use:

- Chinese: `你的更改已保存。`
- English: `Your changes have been saved.`

Do not create page-specific variations such as:

- `设置已保存。`
- `工作区已保存。`
- `Ticket updated.`

The action already gives the context. The follow-up message should stay short and reusable.

## Standard Visual Treatment

Use the existing green success badge treatment already used in MiniTickets:

- success tone
- green text
- soft light background
- no extra icon unless the whole app later adopts icons consistently for all status notices

In MiniTickets this is currently rendered through:

- `StatusNotice` in `components/ui.tsx`
- `Badge` with `tone="success"`

## Standard Placement

Placement rule:

- show the saved message once per page
- place it immediately below the page header
- place it above the first primary panel or content section

This keeps the confirmation visible without burying it inside a form or repeating it in multiple sections.

## Placement Examples

- ticket detail page:
  - below the ticket page header
  - above the editable detail column
- settings page:
  - below the settings header
  - above the appearance/settings panel
- admin workspaces page:
  - below the page header
  - above the first grid of workspace panels

## When To Use

Use this message for successful save-style actions such as:

- settings updates
- ticket edits
- event create/update/delete flows that return to the same page
- workspace edits

If the action has a more specific outcome that genuinely matters, use a different message only when the extra specificity changes what the user needs to do next.

## When Not To Use

Do not reuse this message for:

- file upload success if the file-specific action is the important result
- destructive actions such as delete/archive
- authentication or session state changes
- background sync or maintenance jobs

## Cross-App Rule

MiniAssets should adopt the same:

- copy
- success tone
- placement

If MiniAssets needs its own success-notice component, it should still match this behavior so the two apps feel like one product family.
