# Mobile gameplay and verification

The direction pad and snap toggle live inside the game cabinet, directly below the game controls. They stay available on coarse-pointer devices, including tablets and landscape phones, and on narrow layouts. Touch targets are at least 44 CSS pixels. The pad supports held movement, release, cancellation and dragging away from a captured button.

Fullscreen keeps the 4:3 stage. Short landscape touch layouts place the pad beside the game to preserve playing space; portrait and taller tablet layouts keep it below. Browsers without native fullscreen use the existing viewport fallback. Exiting fullscreen restores the controls to the same cabinet.

## Automated checks

Run with an installed Playwright module and Chromium executable; no new dependencies are required:

```sh
node test/mobile-browser.mjs <playwright-module> <chromium-executable> <private-output-directory> [base-url]
node test/fullscreen-browser.mjs <playwright-module> <chromium-executable> <private-output-directory> [base-url]
```

The default base URL is `http://127.0.0.1:8767/`. A hosted project URL is also supported. `--profile=phone` selects one mobile profile. For pre-publication UI checks, append `--local-ui` after an explicit base URL: the isolated browser serves the working tree's `fullscreen.mjs` and `fullscreen.css` over the selected site's matching assets. This is a candidate-build check, not proof of deployment.

| Profile | Initial CSS viewport |
| --- | --- |
| Small phone | 320 x 568 |
| SE-sized phone | 375 x 667 |
| Phone | 390 x 844 |
| Android-sized phone | 412 x 915 |
| Landscape phone | 844 x 390 |
| Small landscape | 667 x 375 |
| Tablet | 768 x 1024 |
| Landscape tablet | 1024 x 768 |

Each profile also swaps viewport dimensions while fullscreen is active. Checks cover real CDP touch events, all directions, held input and release, drag/cancel, snap collection without movement, pause/resume, actual Echo history restoration, original-campaign play, restart, game visibility next to the controls, target bounds, overflow, and fullscreen aspect ratio. The phone profile additionally checks simultaneous touches/release-all, native Chromium fullscreen, and real post-mixer SID AC output after a sound tap. Sound-off must suspend the audio context. Because suspension freezes analyser data and parameter sampling, the isolated test briefly resumes that muted context to confirm zero gain and silent AC output, then suspends it again. This diagnostic resume is not a normal user action. A transparent test hook observes the original engine's consumed inputs and rewind result; it does not replace physics or fabricate state.

CDP `touchEnd`/`touchCancel` require an empty touch list. The multi-touch check covers simultaneous direction selection and release-all, not independently lifting one physical finger. Echo is compared with the actual selected history checkpoint, rather than assuming a wall-clock UI gesture always rewinds past a particular pickup. Native fullscreen checks wait for `fullscreenchange` synchronization before measuring.

Screenshots and detailed results are written only to the supplied private output directory. Every context starts with empty storage, so tests do not use or change the user's learning/replay archive. These are scripted control/regression checks, not completed mobile campaign playthroughs.

## Coverage limits

On 2026-11-02, all eight profiles passed on the local candidate, combining the full matrix with a focused phone retest after correcting the suspended-analyser measurement. All profiles passed gameplay/rotation/fullscreen and had no page errors or horizontal overflow. Native desktop fullscreen and the original-campaign UI regression (100 selectable variants, birth/pause, bonus continuation and prototype selection) also passed. The initial published build had off-screen controls on portrait phones and hidden controls on landscape phones/tablets; this change addresses those layout faults. Private initial/failure results remain separate from the verified retest results.

These checks use Chromium touch emulation. Viewport labels describe sizes, not tested physical device models. They do not establish physical iPhone/iPad Safari compatibility, Android hardware performance, OS audio routing, safe-area behavior, or touch latency. Native Safari/fullscreen policy and real-device behavior need hardware checks separately.
