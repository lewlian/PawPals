---
status: testing
phase: 04-session-automation
source: [04-01-SUMMARY.md, 04-02-SUMMARY.md]
started: 2026-01-30T08:15:00Z
updated: 2026-01-30T08:15:00Z
---

## Current Test

number: 1
name: Check-in and Wait for Reminder
expected: |
  Check in at a dog run with a 15-minute duration. About 10 minutes later (~5 min before expiry), you should receive a Telegram notification with:
  - Casual message: "Hey! Your session at [Park Name] ends in X mins"
  - Your dog's name(s) listed
  - Inline keyboard with: "15 min", "30 min", "60 min" extend buttons
  - "Checkout now" button
awaiting: user response

## Tests

### 1. Check-in and Wait for Reminder
expected: Check in at a dog run with 15-minute duration. About 10 minutes later (~5 min before expiry), receive a Telegram notification with casual message, dog names, and inline extend/checkout buttons.
result: [pending]

### 2. Extend Session via Button
expected: Tap one of the extend buttons (15/30/60 min). Message updates to show "Session extended by X minutes!" with new end time. You should receive another reminder ~5 min before the new expiry.
result: [pending]

### 3. Checkout via Button
expected: Tap "Checkout now" button from a reminder. Message updates to show checkout confirmation with location, dog(s), and total duration. Session ends.
result: [pending]

### 4. Session Auto-Expiry
expected: Let a session expire without action. After the duration ends, receive a notification: "Your session at [Park Name] has ended." with dog names, total duration, and friendly sign-off.
result: [pending]

### 5. Extend After Expiry
expected: If you tap an extend button after the session has already expired, message should update to say the session has ended and guide you to use /checkin to start a new one.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0

## Gaps

[none yet]
