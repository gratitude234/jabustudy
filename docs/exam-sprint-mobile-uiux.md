# Exam Sprint mobile UX direction

## Product principle

Exam Sprint is a CBT preparation tool, not a marketing microsite. Every screen should help a learner answer one of four questions quickly:

1. What can I practise now?
2. What should I do next?
3. Is my answer safely saved?
4. What should I revise after this attempt?

The interface is designed from a 360 px mobile viewport outward. Desktop adds space and a persistent question map, but it does not introduce a different workflow.

## Page architecture

### Exam home

- Starts with a compact campaign and access summary.
- Surfaces an active timed attempt before every other action.
- Keeps search and Ready/All/Soon controls sticky on mobile.
- Treats every ready course row as one large tap target.
- Keeps unpublished courses visually quiet and out of the default view.

### Course page

- Shows course identity, official date, best score, question coverage and available mocks in one header.
- Recommends exactly one next action based on learner state.
- Keeps that action reachable in a mobile bottom bar.
- Places recent results before the full mock bank so progress is easy to continue.
- Uses one list surface for mock papers instead of separate cards.

### Attempt runner

- Removes normal site navigation and makes the question the visual focus.
- Shows remaining time, answered progress and save state at all times.
- Uses large answer targets with permanent A–D labels and an explicit selected state.
- Lets learners clear an accidental choice or flag a question for review.
- Changes the last-question action to “Review your answers” instead of disabling Next.
- Provides a question map, first-unanswered shortcut and honest offline state.
- Warns that the timer continues before a learner leaves the runner.

### Results and corrections

- Leads with score, readiness and the recommended next action.
- Combines correct, wrong, unanswered and pacing into one performance surface.
- Places weak topics before the detailed paper review.
- Opens corrections in a single expandable list with mistakes selected by default.
- Keeps only one correction expanded at a time to reduce scrolling and cognitive load.

### Checkout

- Uses a focused Exam Sprint purchase header and one plan.
- Explains duration, coverage and included benefits before payment.
- Keeps the payment action visible at the bottom of a phone screen.
- Removes unrelated Study billing navigation during the focused checkout.

## Visual and interaction rules

- Indigo is reserved for primary actions and current state.
- Emerald means answered, saved or successful.
- Amber means flagged, low time or an action that still needs attention.
- Rose means wrong, failed or critically low time.
- Large elevation is limited to the campaign header and active-attempt surface.
- Related rows share one bordered container; they are not rendered as separate floating cards.
- Primary touch targets are at least 48 px high.
- Important text remains readable without relying on colour alone.
- Safe-area padding is used for sticky headers, sheets and bottom actions.
