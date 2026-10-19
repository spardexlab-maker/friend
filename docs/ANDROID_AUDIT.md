# Android audit — 2026-10-19

## Verified

- Phone and Wear OS debug APKs compile successfully.
- Android Lint completes for both modules with no errors. Non-blocking warnings remain (including generated resources and backup declarations).
- Browser regression suite: 26 passed, one opt-in live Gemini test skipped. Includes keyboard focus containment/restoration and message/form persistence regressions.
- Installed the actual phone debug APK on a clean, isolated Android 15 / API 35 emulator. Used a temporary synthetic Supabase account, then deleted that account and cleared the emulator app data.
- Actual Android WebView: cloud login, meal entry, persistence after reload and navigation across five main screens passed, without JavaScript runtime errors or horizontal overflow.
- Gradle unit-test tasks complete; Wear currently has no unit test sources. These tasks do not verify sensors or cross-device delivery.

## Fixes made

- A failed local message save retains the draft and prevents sending an unsaved message to Gemini. Retry saves the draft before sending.
- An assistant reply that cannot be persisted stays visible and can be saved again without another AI request.
- Reentrant form submission cannot create two copies of one meal.
- The watch pulse screen uses the named `Typeface.NORMAL` constant, resolving its lint error.
- Corrected the machine-local SDK properties escaping (ignored development configuration).
- Isolated number/date input direction and mixed Arabic/English message paragraphs. Simplified account error and email confirmation text.
- Increased watch navigation labels and action touch areas; action height expands with wrapped text. Reused drawing objects and cancelled detached ring animations.
- Dialogs lock background scrolling, contain keyboard focus and restore focus to their trigger.

## Remaining device and IDE checks

- Installed the official portable Android Studio distribution after SHA-256 verification and user approval. Opened the Android project in the IDE, using the existing Java 21 toolchain for Gradle. IDE Gradle sync completed successfully. The user handled privacy, project trust and Google authentication prompts.
- No physical phone or watch was attached during this audit. Samsung Health permissions/data, physical microphone behavior, watch sensor accuracy, background behavior, battery impact and paired-device acknowledgement delivery were not verified in this run.
- Capturing the Android WebView through CDP failed; the successful navigation/persistence round was rerun without screenshots. No visual screenshot approval is claimed.
- The optional Playwright live Gemini test remained skipped. A separate real cloud check passed: authenticated Gemini reply, configured model availability, document save, cross-account RLS isolation and optimistic version conflict rejection. Temporary synthetic accounts were deleted afterwards. The final 1.4.1 phone APK passed the emulator round again.

These results are not a claim that every feature or hardware capability is complete.
