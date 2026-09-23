import { cardFace, spokenText } from './card-face.ts';
import { teamOf } from '../src/index.ts';
import type { Action, Card, PlayerView } from '../src/index.ts';
import { actionName, cardName, names, resultText } from './presentation.ts';
export interface Handlers { act(action: Action): void; next(): void }
/** No host/referee imports or capabilities. Receives only a seat-zero view. */
export function createTable(root: HTMLElement, handlers: Handlers) {
  const d = root.ownerDocument;
  root.innerHTML = `<p id="score"></p><div class="table"><p class="partner">Val · your partner</p><p class="west">West</p><p class="east">East</p><div class="center"><h2>Table</h2><p id="facts"></p><p id="trump"></p><p id="upcard"></p><h2>Current trick</h2><ul id="trick"></ul><p id="tricks"></p></div></div><h2 id="turn" tabindex="-1">Game actions</h2><div id="bids" class="actions"></div><div id="result" tabindex="-1"></div><button id="next" type="button" hidden>Deal next hand</button><h2>Your hand</h2><div id="hand" class="hand"></div>`;
  const get = (id: string) => root.querySelector<HTMLElement>(`#${id}`)!;
  const hand = get('hand');
  const cards = new Map<Card, HTMLButtonElement>();
  let current: PlayerView;
  let ready = false;
  let focusKey = '';
  get('next').onclick = () => handlers.next();
  function render(v: PlayerView, interactive = true) {
    if (v.seat !== 0) throw new Error('Human presentation requires seat zero');
    if (current && current.handNumber !== v.handNumber) { hand.replaceChildren(); cards.clear(); }
    current = v; ready = interactive;
    get('score').textContent = `You & Val ${v.score[0]} — Opponents ${v.score[1]} · First to 10`;
    get('facts').textContent = `Hand ${v.handNumber}. Dealer: ${names[v.dealer]}.`;
    get('trump').textContent = `Called suit: ${v.trump ?? 'not yet called'}.${v.caller !== null ? ` Caller: ${names[v.caller]}.${v.alone ? ' Going alone.' : ''}` : ''}`;
    get('upcard').textContent = `Up-card: ${cardName(v.upCard)} (${v.upCardStatus}).`;
    const ourTricks = v.completedTricks.filter(trick => teamOf(trick.winner) === 0).length;
    get('tricks').textContent = `Tricks: You and Val ${ourTricks}, opponents ${v.completedTricks.length - ourTricks}. ${v.completedTricks.length} of 5 complete.${v.sittingOut !== null ? ` ${names[v.sittingOut]} sits out this hand.` : ''}`;
    const plays = v.trick;
    get('trick').replaceChildren(...plays.map(p => { const li = d.createElement('li');
      li.className = `trick-seat seat-${p.seat}`;
      const face = cardFace(d, p.card);
      face.dataset.player = names[p.seat];
      li.append(spokenText(d, `${names[p.seat]}: ${cardName(p.card, v.trump)}`), face);
      return li; }));
    get('turn').textContent = v.result ? 'Hand complete' : v.turn === 0 ? v.phase === 'bidding' ? `Your bid — round ${v.biddingRound}` : v.phase === 'discarding' ? 'Discard one card' : 'Your turn to play' : `${names[v.turn!]}${v.phase === 'bidding' ? ` bids — round ${v.biddingRound}` : v.phase === 'discarding' ? ' must discard' : ' to play'}`;
    const bids = get('bids'); bids.replaceChildren();
    for (const action of v.legalActions.filter(a => a.type !== 'play' && a.type !== 'discard')) {
      const button = d.createElement('button'); button.type = 'button'; button.textContent = actionName(action);
      button.setAttribute('aria-disabled', String(!interactive));
      button.onclick = () => { if (ready) handlers.act(action); };
      if (!bids.childElementCount) button.setAttribute('aria-describedby', 'turn');
      bids.append(button);
    }
    get('result').textContent = resultText(v);
    get('result').hidden = !v.result;
    get('next').hidden = v.phase !== 'hand-over';
    get('next').setAttribute('aria-disabled', String(!interactive));
    for (const [card, button] of cards) if (!v.hand.includes(card)) { button.remove(); cards.delete(card); }
    for (const card of v.hand) {
      let button = cards.get(card);
      if (!button) {
        button = d.createElement('button'); button.type = 'button'; cards.set(card, button); hand.append(button);
        button.onclick = () => {
          const action = current.legalActions.find(a => (a.type === 'play' || a.type === 'discard') && a.card === card);
          if (ready && action) handlers.act(action);
        };
      }
      const legal = v.legalActions.some(a => (a.type === 'play' || a.type === 'discard') && a.card === card);
      const label = v.phase === 'discarding' && v.turn === 0 ? `Discard ${cardName(card, v.trump)}` : `${cardName(card, v.trump)}, ${legal && interactive ? 'playable' : 'not playable'}`;
      const face = cardFace(d, card);
      face.dataset.availability = v.phase === 'discarding' && v.turn === 0 ? 'Discard' : legal && interactive ? 'Playable' : 'Not playable';
      button.replaceChildren(spokenText(d, label), face);
      button.setAttribute('aria-disabled', String(!legal || !interactive));
      button.className = legal && interactive ? 'card playable' : 'card unavailable';
    }
  }
  function focus() {
    const v = current;
    const key = `${v.handNumber}/${v.phase}/${v.turn}/${v.bids.length}/${v.completedTricks.length}/${v.trick.length}`;
    if (focusKey === key) return;
    focusKey = key;
    if (v.result) get('result').focus();
    else if (v.turn === 0) {
      const cardAction = v.legalActions.find(a => a.type === 'play' || a.type === 'discard');
      if (cardAction && 'card' in cardAction) cards.get(cardAction.card)!.focus();
      else get('bids').querySelector('button')?.focus();
    }
  }
  // Move away from an activated control before it can be removed. This is not live text.
  function park() { get('turn').textContent = 'Game in progress'; get('turn').focus(); }
  return { render, focus, park };
}
