import { gameExportText, gameExportJson, type GameExport } from './game-export.ts';
import { handReportText, REPORT_STORAGE_NOTICE, type HandReportStore } from './hand-report.ts';

/** Native, user-activated controls. No live announcements, autoplay or automatic focus. */
export function createHandReportPanel(document: Document, store: HandReportStore, pause: () => void, readGames: () => GameExport[] = () => []) {
  const get = <T extends HTMLElement>(id: string) => document.querySelector<T>(`#${id}`)!;
  const open = get<HTMLButtonElement>('saved-hand-report');
  const panel = get<HTMLElement>('hand-report-panel');
  const title = get<HTMLElement>('hand-report-title');
  const selection = get<HTMLSelectElement>('hand-report-selection');
  const text = get<HTMLTextAreaElement>('hand-report-text');
  const status = get<HTMLElement>('hand-report-status');
  const copy = get<HTMLButtonElement>('hand-report-copy');
  const copyGame = get<HTMLButtonElement>('hand-report-copy-game');
  const downloadGame = get<HTMLButtonElement>('hand-report-download-game');
  let games: GameExport[] = [];
  const selectedGame = () => { const report = store.reports().find(r => r.id === selection.value); return games.find(g => g.gameId === (report?.gameId ?? (selection.value.startsWith('game:') ? selection.value.slice(5) : ''))); };
  let displayedGame = false;
  const selectAll = get<HTMLButtonElement>('hand-report-select-all');
  let copyEpoch = 0;
  document.addEventListener('focusin', () => { copyEpoch++; });
  function renderText() {
    const report = store.reports().find(r => r.id === selection.value);
    const game = selectedGame();
    text.value = report ? handReportText(report,store.persistence()) : game ? gameExportText(game) : `No readable hand report is available.\n\n${store.persistence()}\n\n${REPORT_STORAGE_NOTICE}`;
    copy.disabled = !report; selectAll.disabled = !report && !game;
    copyGame.disabled = downloadGame.disabled = !selectedGame();
    displayedGame = !report && !!game;
    status.textContent = game && !report ? game.coverage.join(' ') : report ? `${report.status === 'completed' ? 'Completed hand' : 'In progress at last checkpoint'}. ${store.persistence()}` : store.persistence();
  }
  function hide(focusTarget?: HTMLElement) {
    copyEpoch++;
    if (panel.contains(document.activeElement) && focusTarget) focusTarget.focus();
    panel.hidden = true; open.setAttribute('aria-expanded','false');
  }
  function selectText() { text.focus(); text.select(); text.setSelectionRange(0,text.value.length); }
  open.onclick = () => {
    copyEpoch++;
    pause(); // Cancel speech and automatic focus before moving into the report.
    const reports = store.reports();
    games = readGames();
    selection.replaceChildren(...reports.map((r,i) => {
      const option = document.createElement('option'); option.value = r.id;
      option.textContent = `${i === 0 ? 'Newest: ' : ''}Hand ${r.state.handNumber}, ${r.status === 'completed' ? 'completed' : 'in progress'}, ${r.updatedAt}${!r.state.completedTricks.length && !r.state.trick.length ? ', no cards played' : ''}`;
      return option;
    }), ...games.filter(g => !reports.some(r => r.gameId === g.gameId)).map(g => {
      const option = document.createElement('option'); option.value = `game:${g.gameId}`;
      option.textContent = `Completed game: ${g.score.join(' to ')}, ${g.expectedHands} hands, ${g.completedAt}, ${g.gameId}`;
      return option;
    }));
    // A fresh deal must not hide the useful report from the hand just played.
    selection.value = reports.find(r => r.state.completedTricks.length || r.state.trick.length)?.id ?? reports[0]?.id ?? (games[0] ? `game:${games[0].gameId}` : '');
    selection.disabled = reports.length === 0 && games.length === 0;
    renderText(); panel.hidden = false; open.setAttribute('aria-expanded','true'); title.focus();
  };
  selection.onchange = () => { copyEpoch++; renderText(); };
  selectAll.onclick = () => { copyEpoch++; status.textContent = 'All report text selected. Use your device’s Copy command, then paste it into your conversation.'; selectText(); };
  async function copyText(wholeGame: boolean) {
    if (wholeGame) {
      const game = selectedGame(); if (!game) return;
      text.value = gameExportText(game); displayedGame = true;
    } else renderText();
    const content = text.value, epoch = ++copyEpoch;
    let copied = false;
    try {
      const clipboard = document.defaultView?.navigator.clipboard;
      if (clipboard?.writeText) { await clipboard.writeText(content); copied = true; }
    } catch { /* Native selection/copy is the offline permission-free fallback. */ }
    if (epoch !== copyEpoch || panel.hidden) return;
    if (!copied) {
      selectText();
      try { copied = document.execCommand?.('copy') === true; } catch {}
    }
    if (copied) { status.textContent = displayedGame ? 'Whole game report copied. Paste it into your conversation. Any missing evidence is listed in the report.' : 'Report copied. Paste it into your conversation.'; status.focus(); }
    else { status.textContent = 'Automatic copy is unavailable. All report text is selected in the read-only field. Use your device’s Copy command, then paste it into your conversation. The Select all report text button can select it again.'; selectText(); }
  };
  copy.onclick = () => { void copyText(false); };
  copyGame.onclick = () => { void copyText(true); };
  downloadGame.onclick = () => {
    const game = selectedGame(); if (!game) return;
    try {
      const win = document.defaultView!;
      const url = win.URL.createObjectURL(new win.Blob([gameExportJson(game)], {type:'application/json'}));
      const link = document.createElement('a'); link.href = url;
      link.download = `euchre-game-${game.gameId.replace(/[^a-zA-Z0-9-]/g,'_')}.json`;
      document.body.append(link); link.click(); link.remove(); win.setTimeout(() => win.URL.revokeObjectURL(url),60000);
      status.textContent = 'Evidence file requested. Use your browser’s download or share controls to save it, then attach it to your conversation. Nothing was uploaded.'; status.focus();
    } catch { status.textContent = 'This browser could not create the evidence file. Use Copy whole game, or Select all report text after choosing Copy whole game.'; status.focus(); }
  };
  get<HTMLButtonElement>('hand-report-close').onclick = () => hide(open);
  return {hide};
}
