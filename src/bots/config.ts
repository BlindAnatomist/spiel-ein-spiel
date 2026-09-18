export type BotLevel = 'casual' | 'strong' | 'expert' | 'val';
export interface Strategy {
  readonly level: BotLevel;
  readonly orderThreshold: number;
  readonly callThreshold: number;
  readonly aloneThreshold: number;
  readonly trumpWeights: readonly number[]; // 9,10,Q,K,A,left,right
  readonly aceWeight: number;
  readonly lengthBonus: number;
  readonly voidBonus: number;
  readonly partnerDealerBonus: number;
  readonly opponentDealerPenalty: number;
  readonly trumpLead: number;
  readonly partnerReturn: number;
  readonly voidWeight: number;
  readonly conservation: number;
  readonly samples: number;
  readonly exactCards: number;
}
function config(value: Strategy): Strategy {
  Object.freeze(value.trumpWeights); return Object.freeze(value);
}
const strong: Strategy = {
  level: 'strong', orderThreshold: 3.0, callThreshold: 2.85, aloneThreshold: 4.25,
  trumpWeights: [0.2, 0.28, 0.4, 0.52, 0.7, 0.95, 1.2],
  aceWeight: 0.7, lengthBonus: 0.3, voidBonus: 0.12,
  partnerDealerBonus: 0.35, opponentDealerPenalty: 0.25,
  trumpLead: 1.2, partnerReturn: 0.7, voidWeight: 1.3, conservation: 0.16,
  samples: 0, exactCards: 2,
};
export const STRATEGIES: Readonly<Record<BotLevel, Strategy>> = Object.freeze({
  casual: config({ ...strong, level: 'casual', orderThreshold: 2.2, callThreshold: 2.0,
    aloneThreshold: 3.7, lengthBonus: 0, voidBonus: 0, partnerDealerBonus: 0,
    opponentDealerPenalty: 0, trumpLead: 0, partnerReturn: 0, voidWeight: 0 }),
  strong: config(strong),
  expert: config({ ...strong, level: 'expert', orderThreshold: 2.65, callThreshold: 2.55, samples: 24, exactCards: 3 }),
  val: config({ ...strong, level: 'val', partnerReturn: 1.15, voidWeight: 1.6,
    conservation: 0.22, partnerDealerBonus: 0.45 }),
});
