# Planet Quantity Slider

## Goal

Replace the custom planet-quantity track in the Play expedition configurator
with the Material UI `Slider`, while keeping the existing exact-number input
for users who prefer manual entry.

## Scope

- Update `CompactPlanetDial` only; keep `Play` as the single owner of quantity
  state and preserve the existing `onChange` contract.
- Add Material UI and its required Emotion peer dependencies through pnpm.
- Keep the expedition quantity range at 1 through 50 with an integer step of 1.
- Preserve the current custom-entry affordance, including Enter and blur
  submission, and keep invalid values normalized by
  `clampExpeditionQuantity`.
- Preserve the visible label and quantity landmarks at 1, 5, 10, 25, and 50.

## Component behavior

The MUI Slider will be controlled by the `quantity` prop. Its `onChange`
handler will convert the MUI value to a number and forward it to the existing
callback. The slider will expose the accessible label `Planets to explore`,
announce values as `<count> planets`, and remain keyboard-operable through the
MUI component. Its value label will be visible while interacting so the
selected quantity is clear during dragging.

The number input will remain beside the current quantity display. It will use
the same 1--50 bounds and call the same clamping path on Enter or blur. Empty
input text will continue to avoid emitting a transient invalid quantity; the
displayed controlled value remains the last valid quantity.

The component will use MUI's `sx` styling rather than a separate global theme,
matching the repository's existing dark surface, border, rare/accent, and text
colors. Existing layout, custom button behavior, and planet-stack rendering
remain unchanged.

## Testing and verification

- Update `CompactPlanetDial.test.tsx` to assert the MUI slider's 1--50 range,
  current value, quantity announcement, visible 1/5/10/25/50 landmarks,
  keyboard update, pointer update, and manual input submission.
- Keep the existing configurator tests passing.
- Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` after the
  implementation.

## Out of scope

- No changes to purchase routing, quantity clamping rules, bulk thresholds,
  ticket coordinates, or expedition state management.
- No new design system or app-wide MUI theme.
