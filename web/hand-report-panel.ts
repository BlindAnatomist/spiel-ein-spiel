import { handReportText, REPORT_STORAGE_NOTICE, type HandReportStore } from './hand-report.ts';

/** Native, user-activated controls. No live announcements, autoplay or automatic focus. */
export function createHandReportPanel(document: Document, store: HandReportStore, pause: () => void) {
  const get = <T extends HTMLElement>(id: string) => document.querySelector<T>(`#${id}`)!;
  const open = get<HTMLButtonElement>('saved-hand-report');
  const panel = get<HTMLElement>('hand-report-panel');
  const title = get<HTMLElement>('hand-report-title');
  const selection = get<HTMLSelectElement>('hand-report-selection');
  const text = get<HTMLTextAreaElement>('hand-report-text');
  const status = get<HTMLElement>('hand-report-status');
  const copy = get<HTMLButtonElement>('hand-report-copy');
  const selectAll = get<HTMLButtonElement>('hand-report-select-all');
  let copyEpoch = 0;
  document.addEventListener('focusin', () => { copyEpoch++; });
  function renderText() {
    const report = store.reports().find(r => r.id === selection.value);
    text.value = report ? handReportText(report,store.persistence()) : `No readable hand report is available.\n\n${store.persistence()}\n\n${REPORT_STORAGE_NOTICE}`;
    copy.disabled = !report; selectAll.disabled = !report;
    status.textContent = report ? `${report.status === 'completed' ? 'Completed hand' : 'In progress at last checkpoint'}. ${store.persistence()}` : store.persistence();
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
    selection.replaceChildren(...reports.map((r,i) => {
      const option = document.createElement('option'); option.value = r.id;
      option.textContent = `${i === 0 ? 'Newest: ' : ''}Hand ${r.state.handNumber}, ${r.status === 'completed' ? 'completed' : 'in progress'}, ${r.updatedAt}${!r.state.completedTricks.length && !r.state.trick.length ? ', no cards played' : ''}`;
      return option;
    }));
    // A fresh deal must not hide the useful report from the hand just played.
    selection.value = reports.find(r => r.state.completedTricks.length || r.state.trick.length)?.id ?? reports[0]?.id ?? '';
    selection.disabled = reports.length === 0;
    renderText(); panel.hidden = false; open.setAttribute('aria-expanded','true'); title.focus();
  };
  selection.onchange = () => { copyEpoch++; renderText(); };
  selectAll.onclick = () => { copyEpoch++; renderText(); status.textContent = 'All report text selected. Use your device’s Copy command, then paste it into your conversation.'; selectText(); };
  copy.onclick = async () => {
    renderText();
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
    if (copied) { status.textContent = 'Report copied. Paste it into your conversation.'; status.focus(); }
    else { status.textContent = 'Automatic copy is unavailable. All report text is selected in the read-only field. Use your device’s Copy command, then paste it into your conversation. The Select all report text button can select it again.'; selectText(); }
  };
  get<HTMLButtonElement>('hand-report-close').onclick = () => hide(open);
  return {hide};
}
