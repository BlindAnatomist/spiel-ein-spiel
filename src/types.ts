export type Seat = 0 | 1 | 2 | 3;
export type Team = 0 | 1;
export type Suit = 'clubs' | 'diamonds' | 'hearts' | 'spades';
export type Rank = '9' | '10' | 'J' | 'Q' | 'K' | 'A';
export type Card = `${Suit}:${Rank}`;
export type Phase = 'bidding' | 'discarding' | 'playing' | 'hand-over' | 'game-over';
export type Action =
  | { readonly type: 'pass' }
  | { readonly type: 'order-up'; readonly alone: boolean }
  | { readonly type: 'call'; readonly suit: Suit; readonly alone: boolean }
  | { readonly type: 'discard' | 'play'; readonly card: Card };
export interface Play { readonly seat: Seat; readonly card: Card }
export interface Trick { readonly plays: readonly Play[]; readonly winner: Seat }
export interface Bid {
  readonly seat: Seat;
  readonly round: 1 | 2;
  readonly action: Extract<Action, { type: 'pass' | 'order-up' | 'call' }>;
}
export interface HandResult {
  readonly makerTricks: number;
  readonly team: Team;
  readonly points: number;
  readonly reason: 'made' | 'march' | 'loner-march' | 'euchred';
}
export interface PlayerView {
  readonly seat: Seat;
  readonly hand: readonly Card[];
  readonly phase: Phase;
  readonly handNumber: number;
  readonly dealer: Seat;
  readonly turn: Seat | null;
  readonly biddingRound: 1 | 2;
  /** Historical public identity; does not assert the card's current location. */
  readonly upCard: Card;
  readonly upCardStatus: 'face-up' | 'ordered' | 'turned-down';
  readonly bids: readonly Bid[];
  readonly trump: Suit | null;
  readonly caller: Seat | null;
  readonly alone: boolean;
  readonly sittingOut: Seat | null;
  readonly trick: readonly Play[];
  readonly completedTricks: readonly Trick[];
  readonly knownVoids: readonly (readonly Suit[])[];
  readonly score: readonly [number, number];
  readonly result: HandResult | null;
  readonly winner: Team | null;
  readonly legalActions: readonly Action[];
}
/** The only capability to pass to a player or future policy. No seat selector. */
export interface PlayerPort {
  readonly view: () => PlayerView;
  readonly act: (action: unknown) => ActionResult;
}
export type ActionResult =
  | { readonly ok: true; readonly view: PlayerView }
  | { readonly ok: false; readonly error: 'illegal-action'; readonly view: PlayerView };
export type DecisionPolicy = (view: PlayerView) => Action;
