import { rankOf, suitOf } from '../src/index.ts';
import type { Card, PlayerView } from '../src/index.ts';
import { names, type SeatNames } from './presentation.ts';
export const suitGlyph = {hearts:'♥',diamonds:'♦',clubs:'♣',spades:'♠'} as const;
/** Decorative face only. The owning button/list retains its original semantic name. */
export function cardFace(d: Document, card: Card): HTMLElement {
  const face=d.createElement('span'); face.className='card-face';face.setAttribute('aria-hidden','true');
  face.dataset.rank=rankOf(card);face.dataset.suit=suitGlyph[suitOf(card)];
  face.classList.toggle('red',suitOf(card)==='hearts'||suitOf(card)==='diamonds');
  return face;
}
/** Geometric rabbit ears and top hat; no SVG title or spoken icon description. */
export const rabbitHat = '<svg aria-hidden="true" focusable="false" viewBox="0 0 40 40"><path class="rabbit" d="M16 22C9 12 9 3 13 3c4 0 5 9 6 13h2c1-4 2-13 6-13s4 9-3 19z"/><path class="hat" d="M9 22h22l-3 13H12z"/><path class="brim" d="M5 22h30"/><path class="band" d="M12 28h16"/></svg>';
/** Only seat-zero public view data enters this visual layer; never a referee or bot. */
export function renderVisualTable(root: HTMLElement, v: PlayerView, seatNames: SeatNames = names) {
  const d=root.ownerDocument;
  for(const seat of [0,1,2,3] as const) {
    const el=root.querySelector<HTMLElement>(`[data-seat="${seat}"]`)!;
    el.classList.toggle('dealer',v.dealer===seat);
    el.classList.toggle('active',v.turn===seat);
  }
  const score=d.querySelector('#top-score');
  if(score) score.innerHTML=`<span>You + Val <b>${v.score[0]}</b></span><span>Opponents <b>${v.score[1]}</b></span>`;
  const suit=root.querySelector<HTMLElement>('#visual-suit')!;
  suit.textContent=v.trump ? `${suitGlyph[v.trump]} ${v.trump[0]!.toUpperCase()}${v.trump.slice(1)}` : 'Suit not called';
  const caller=root.querySelector<HTMLElement>('#visual-caller')!;
  caller.textContent=v.caller===null ? `Round ${v.biddingRound}` : `${seatNames[v.caller]}${v.alone?' · alone':''}`;
  const area=root.querySelector<HTMLElement>('#visual-cards')!;area.replaceChildren();
  const last=v.completedTricks.at(-1);
  // Public completed plays persist visually only until the next trick's first play.
  const held=v.trick.length===0 && !!last && v.phase!=='bidding' && v.phase!=='discarding';
  root.querySelector<HTMLElement>('#visual-held')!.textContent=held ? 'Last trick' : '';
  if(v.phase==='bidding') {
    const card=d.createElement('div');card.className='table-card up-card';
    if(v.upCardStatus==='face-up')card.append(cardFace(d,v.upCard));
    else card.classList.add('card-back');
    area.append(card);
  } else {
    const plays=held ? last!.plays : v.trick;
    for(const play of plays) {
      const card=d.createElement('div');card.className=`table-card played seat-${play.seat}`;
      card.append(cardFace(d,play.card));area.append(card);
    }
  }
  root.dataset.phase=v.phase;
}
