import type { Bid, Card, HandResult, Phase, Play, Seat, Suit, Team, Trick } from '../types.ts';
/** Referee-only data. Never spread this object into a player view. */
export interface State {
  rng: number;
  hands: Card[][];
  kitty: Card[];
  phase: Phase;
  handNumber: number;
  dealer: Seat;
  turn: Seat | null;
  biddingRound: 1 | 2;
  passes: number;
  upCard: Card;
  upCardStatus: 'face-up' | 'ordered' | 'turned-down';
  bids: Bid[];
  trump: Suit | null;
  caller: Seat | null;
  alone: boolean;
  sittingOut: Seat | null;
  trick: Play[];
  completedTricks: Trick[];
  score: [number, number];
  result: HandResult | null;
  winner: Team | null;
}
