import { rankOf, suitOf } from '../src/index.ts';
import type { Card } from '../src/index.ts';
/** Printed identity only. Every decorative descendant is hidden by this ancestor. */
export function cardFace(document: Document, card: Card): HTMLElement {
  const suit = suitOf(card);
  const symbols = { clubs: '♣', diamonds: '♦', hearts: '♥', spades: '♠' };
  const face = document.createElement('span');
  face.className = `card-face ${suit === 'diamonds' || suit === 'hearts' ? 'red-suit' : 'black-suit'}`;
  face.setAttribute('aria-hidden', 'true');
  for (const position of ['corner top', 'pip', 'corner bottom']) {
    const mark = document.createElement('span');
    mark.className = position;
    mark.dataset.rank = rankOf(card);
    mark.dataset.suit = symbols[suit];
    face.append(mark);
  }
  return face;
}
export function spokenText(document: Document, text: string): HTMLElement {
  const label = document.createElement('span');
  label.className = 'spoken-text'; label.textContent = text;
  return label;
}
