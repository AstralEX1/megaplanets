# Drawing state and lifecycle

Source: https://llms.megapot.io/tasks/read-state

The active drawing is obtained from `currentDrawingId()`. Read its state with
`getDrawingState(drawingId)` and derive UI behavior from `drawingTime`,
`winningTicket`, `ballMax`, `bonusballMax`, and `jackpotLock`.

Lifecycle:

1. `open`: purchases are available before `drawingTime` while unlocked.
2. `awaiting`: drawing time passed; settlement has not locked yet.
3. `settling`: Jackpot is locked and awaiting the entropy callback.
4. `settled`: `winningTicket` is non-zero and the next drawing is initialized.

Watch `JackpotLocked`, `JackpotSettled`, `JackpotUnlocked`, and
`NewDrawingInitialized` to invalidate live state. Keep phase-aware polling as a
fallback: approximately 30 seconds while open and 5 seconds while awaiting or
settling. Settled historical state is immutable.
