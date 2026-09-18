// Compile-only regressions: policies see player data, not the referee capability.
import type { DecisionPolicy, PlayerPort } from '@spiel-ein-spiel/euchre';
const policy: DecisionPolicy = view => {
  // @ts-expect-error Hidden hands are not a player field.
  void view.hands;
  // @ts-expect-error RNG state is private.
  void view.rng;
  // @ts-expect-error Kitty is private.
  void view.kitty;
  // @ts-expect-error Player cards are readonly.
  view.hand.push('clubs:A');
  return view.legalActions[0]!;
};
function boundary(port: PlayerPort) {
  // @ts-expect-error A player cannot request a different seat.
  port.view(2);
  // @ts-expect-error A player cannot read the diagnostic snapshot.
  port.snapshot();
  return policy(port.view());
}
void boundary;
