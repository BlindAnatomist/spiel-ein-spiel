import { cardFace, rabbitHat, renderVisualTable } from './visuals.ts';
import { suitOf, teamOf } from '../src/index.ts';
import type { Action, Card, PlayerView } from '../src/index.ts';
import { actionName, cardName, currentState, names, resultText } from './presentation.ts';
import type { SeatNames } from './presentation.ts';
export interface Handlers { act(action: Action): void; next(): void; repeat?(): void; review?(): void }
/** No host/referee imports or capabilities. Receives only a seat-zero view. */
export function createTable(root: HTMLElement, handlers: Handlers, seatNames: SeatNames = names) {
  const d = root.ownerDocument;
  root.innerHTML = `<p id="score" class="sr-only" aria-hidden="true"></p><div class="table">
    <p class="partner seat" data-seat="2" aria-hidden="true">Val</p><p class="west seat" data-seat="1" aria-hidden="true">West</p><p class="east seat" data-seat="3" aria-hidden="true">East</p><p class="you seat" data-seat="0" aria-hidden="true">You</p>
    <div class="center"><h2 class="sr-only" aria-hidden="true">Table</h2><p id="facts" class="sr-only" aria-hidden="true"></p><p id="trump" class="sr-only" aria-hidden="true"></p><p id="upcard" class="sr-only" aria-hidden="true"></p><h2 class="sr-only">Current trick</h2><ul id="trick" class="sr-only"></ul><p id="tricks" aria-hidden="true"></p></div>
    <div class="visual-table" aria-hidden="true"><div class="suit-summary"><p id="visual-suit"></p><p id="visual-caller"></p></div><div id="visual-cards"></div><p id="visual-held"></p></div>
    </div><h2 id="turn" tabindex="-1">Game actions</h2><div id="current-state-panel" aria-hidden="true" hidden></div><div id="result" tabindex="-1"></div><button id="next" type="button" hidden>Deal next hand</button><h2 class="hand-heading sr-only">Your hand</h2><div id="hand" class="hand"></div><div id="bids" class="actions"></div><div id="after-hand" class="actions"><button id="pass" type="button" hidden>Pass</button><button id="repeat-state" class="icon-button" aria-label="Repeat current state. Suit not called yet." type="button"><span class="sr-only">Repeat current state</span><span class="state-icon" data-glyph="◎" aria-hidden="true"></span></button><button id="review-trick" class="icon-button" aria-label="Review last trick" type="button" hidden><span class="sr-only">Review last trick</span>${rabbitHat}</button></div>`;
  root.querySelector<HTMLElement>('.partner')!.textContent = seatNames[2];
  root.querySelector<HTMLElement>('.west')!.textContent = seatNames[1];
  root.querySelector<HTMLElement>('.east')!.textContent = seatNames[3];
  const get = (id: string) => root.querySelector<HTMLElement>(`#${id}`)!;
  const hand = get('hand');
  const cards = new Map<Card, HTMLButtonElement>();
  let current: PlayerView;
  let ready = false;
  let focusKey = '';
  let panelKey = '';
  const publicKey = (v: PlayerView) => JSON.stringify([v.handNumber,v.phase,v.turn,v.biddingRound,v.trump,v.caller,v.alone,v.sittingOut,v.upCardStatus,v.score,v.completedTricks,v.trick,v.result]);
  get('repeat-state').onclick = () => {
    const panel = get('current-state-panel');
    if (panel.hidden) {
      panel.textContent = currentState(current, seatNames);
      panel.hidden = false;
      panelKey = publicKey(current);
    } else {
      panel.hidden = true;
      panelKey = '';
    }
    handlers.repeat?.();
  };
  get('review-trick').onclick = () => handlers.review?.();
  get('next').onclick = () => handlers.next();
  function render(v: PlayerView, interactive = true) {
    if (v.seat !== 0) throw new Error('Human presentation requires seat zero');
    if (current && current.handNumber !== v.handNumber) { hand.replaceChildren(); cards.clear(); }
    const nextKey = publicKey(v);
    if (!get('current-state-panel').hidden && panelKey && panelKey !== nextKey) {
      get('current-state-panel').hidden = true;
      panelKey = '';
    }
    current = v; ready = interactive;
    renderVisualTable(root, v, seatNames);
    get('review-trick').hidden = v.completedTricks.length === 0;
    get('repeat-state').setAttribute('aria-label', v.trump
      ? `Repeat current state. Called suit: ${v.trump[0]!.toUpperCase()}${v.trump.slice(1)}.`
      : 'Repeat current state. Suit not called yet.');
    get('score').textContent = `You & Val ${v.score[0]} — Opponents ${v.score[1]} · First to 10`;
    get('facts').textContent = `Hand ${v.handNumber}. Dealer: ${seatNames[v.dealer]}.`;
    get('trump').textContent = `Called suit: ${v.trump ?? 'not yet called'}.${v.caller !== null ? ` Caller: ${seatNames[v.caller]}.${v.alone ? ' Going alone.' : ''}` : ''}`;
    // Keep historical up-card individually accessible when the phase summary omits it.
    get('upcard').setAttribute('aria-hidden', String(v.phase === 'bidding' || v.phase === 'discarding'));
    get('upcard').textContent = `Up-card: ${cardName(v.upCard)} (${v.upCardStatus}).`;
    const ourTricks = v.completedTricks.filter(trick => teamOf(trick.winner) === 0).length;
    const trickText = `Tricks: You and Val ${ourTricks}, opponents ${v.completedTricks.length - ourTricks}. ${v.completedTricks.length} of 5 complete.${v.sittingOut !== null ? ` ${seatNames[v.sittingOut]} sits out this hand.` : ''}`;
    get('tricks').innerHTML = '<span class="sr-only"></span><span class="trick-tally" aria-hidden="true"></span>';
    get('tricks').firstElementChild!.textContent = trickText;
    (get('tricks').lastElementChild as HTMLElement).dataset.tally = `${ourTricks} – ${v.completedTricks.length - ourTricks}`;
    get('trick').replaceChildren(...v.trick.map(p => { const li = d.createElement('li'); li.textContent = `${seatNames[p.seat]}: ${cardName(p.card, v.trump)}`; return li; }));
    get('turn').textContent = v.result ? 'Hand complete' : v.turn === 0 ? v.phase === 'bidding' ? `Your bid — round ${v.biddingRound}` : v.phase === 'discarding' ? 'Discard one card' : 'Your turn to play' : `${seatNames[v.turn!]}${v.phase === 'bidding' ? ` bids — round ${v.biddingRound}` : v.phase === 'discarding' ? ' must discard' : ' to play'}`;
    const pass = v.legalActions.find(a => a.type === 'pass');
    get('pass').hidden = !pass;
    get('pass').setAttribute('aria-disabled', String(!interactive));
    get('pass').onclick = () => { if (ready && pass) handlers.act(pass); };
    const bids = get('bids'); bids.replaceChildren();
    for (const action of v.legalActions.filter(a => a.type === 'order-up' || a.type === 'call')) {
      const button = d.createElement('button'); button.type = 'button'; button.setAttribute('aria-label', actionName(action, v.upCard));
      const suit = action.type === 'call' ? action.suit : suitOf(v.upCard);
      button.className = 'suit-bid';
      const symbol = d.createElement('span');
      symbol.setAttribute('aria-hidden', 'true');
      symbol.className = action.alone ? 'suit-symbol alone' : 'suit-symbol';
      symbol.textContent = {hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠'}[suit];
      button.append(symbol);
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
      const spoken = d.createElement('span'); spoken.className = 'sr-only'; spoken.textContent = label;
      button.replaceChildren(spoken, cardFace(d, card));
      button.setAttribute('aria-label', label);
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
