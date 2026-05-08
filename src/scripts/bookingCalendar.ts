type DayStatus = 'reserved' | 'available' | 'unavailable';
type SelectionState = 'idle' | 'selecting' | 'selected';

interface DayInfo {
  date: string;
  status: DayStatus;
  price?: number;
}

interface CalI18n {
  selectionRangeStart: string;
  selectionRangeComplete: string;
  selectionClear: string;
  selectionErrorBlocked: string;
  modalTitle: string;
  modalDatesLabel: string;
  modalTotalLabel: string;
  modalCancel: string;
  modalConfirm: string;
}

const WA_MSG_PREFIX = 'Hola, me gustaría reservar la autocaravana para los siguientes días: ';

const selectedDates = new Map<string, number | undefined>();
let selectionState: SelectionState = 'idle';
let rangeStart: string | null = null;

document.addEventListener('DOMContentLoaded', () => {
  const frame = document.getElementById('cal-frame');
  if (!frame) return;

  const MONTHS: string[] = JSON.parse(frame.dataset.months ?? '[]');
  const i18n: CalI18n = JSON.parse(frame.dataset.i18n ?? '{}');
  const whatsappBase = frame.dataset.whatsapp ?? '';

  const grid = document.getElementById('cal-grid');
  const label = document.getElementById('cal-label');
  const loading = document.getElementById('cal-loading');
  const errorEl = document.getElementById('cal-error');
  const prev = document.getElementById('cal-prev');
  const next = document.getElementById('cal-next');
  if (!grid || !label || !loading || !errorEl || !prev || !next) return;

  const todayBtn = document.getElementById('cal-today') as HTMLButtonElement | null;
  const selectionBar = document.getElementById('cal-selection-bar');
  const selectionText = document.getElementById('cal-selection-text');
  const selectionClear = document.getElementById('cal-selection-clear');
  const rangeErrorEl = document.getElementById('cal-range-error');
  const rangeErrorText = document.getElementById('cal-range-error-text');
  const whatsappBtn = document.getElementById('cal-whatsapp-btn');
  const modal = document.getElementById('cal-modal') as HTMLDialogElement | null;
  const modalTitle = document.getElementById('cal-modal-title');
  const modalDatesLabel = document.getElementById('cal-modal-dates-label');
  const modalDatesList = document.getElementById('cal-modal-dates-list');
  const modalTotal = document.getElementById('cal-modal-total');
  const modalCancel = document.getElementById('cal-modal-cancel');
  const modalConfirm = document.getElementById('cal-modal-confirm');

  if (modalTitle) modalTitle.textContent = i18n.modalTitle;
  if (modalDatesLabel) modalDatesLabel.textContent = i18n.modalDatesLabel + ':';
  if (selectionClear) selectionClear.textContent = i18n.selectionClear;
  if (modalCancel) modalCancel.textContent = i18n.modalCancel;
  if (modalConfirm) modalConfirm.textContent = i18n.modalConfirm;

  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth();
  let dayMap = new Map<string, DayInfo>();

  let rangeErrorTimer: ReturnType<typeof setTimeout> | null = null;

  prev.addEventListener('click', () => shift(-1));
  next.addEventListener('click', () => shift(1));
  todayBtn?.addEventListener('click', () => {
    year = now.getFullYear();
    month = now.getMonth();
    if (selectionState === 'selecting') {
      rangeStart = null;
      selectionState = 'idle';
      updateSelectionBar();
    }
    render();
  });
  selectionClear?.addEventListener('click', clearSelection);
  whatsappBtn?.addEventListener('click', handleWhatsappClick);
  modalCancel?.addEventListener('click', () => modal?.close());
  modalConfirm?.addEventListener('click', handleConfirm);
  modal?.addEventListener('click', (e) => { if (e.target === modal) modal.close(); });

  updateSelectionBar();

  function shift(delta: number) {
    if (selectionState === 'selecting') {
      rangeStart = null;
      selectionState = 'idle';
      updateSelectionBar();
    }
    month += delta;
    if (month > 11) { month = 0; year++; }
    if (month < 0)  { month = 11; year--; }
    render();
  }

  function pad(n: number) { return String(n).padStart(2, '0'); }

  function toDisplayDate(key: string) {
    const [y, m, d] = key.split('-');
    return `${d}/${m}/${y}`;
  }

  function resetGrid() {
    const headers = Array.from(grid!.children).slice(0, 7);
    grid!.innerHTML = '';
    headers.forEach((h) => grid!.appendChild(h));
  }

  function updateSelectionBar() {
    if (!selectionBar || !selectionText) return;

    if (selectionState === 'idle') {
      selectionBar.hidden = true;
      return;
    }

    selectionBar.hidden = false;

    if (selectionState === 'selecting' && rangeStart) {
      selectionText.textContent = i18n.selectionRangeStart.replace('%start', toDisplayDate(rangeStart));
      return;
    }

    if (selectionState === 'selected' && selectedDates.size > 0) {
      const sortedKeys = Array.from(selectedDates.keys()).sort();
      const start = sortedKeys[0];
      const end = sortedKeys[sortedKeys.length - 1];
      const count = sortedKeys.length;
      selectionText.textContent = i18n.selectionRangeComplete
        .replace('%start', toDisplayDate(start))
        .replace('%end', toDisplayDate(end))
        .replace('%n', String(count));
    }
  }

  function showRangeError(msg: string) {
    if (!rangeErrorEl || !rangeErrorText) return;
    if (rangeErrorTimer) clearTimeout(rangeErrorTimer);
    rangeErrorText.textContent = msg;
    rangeErrorEl.hidden = false;
    rangeErrorTimer = setTimeout(() => {
      if (rangeErrorEl) rangeErrorEl.hidden = true;
    }, 3000);
  }

  function clearSelection() {
    selectedDates.clear();
    rangeStart = null;
    selectionState = 'idle';
    updateSelectionBar();
    resetGrid();
    paint();
  }

  function fillRange(a: string, b: string): boolean {
    const [start, end] = [a, b].sort();
    const startDate = new Date(start + 'T00:00:00');
    const endDate = new Date(end + 'T00:00:00');

    const range: Array<{ key: string; price?: number }> = [];
    const cur = new Date(startDate);

    while (cur <= endDate) {
      const key = `${cur.getFullYear()}-${pad(cur.getMonth() + 1)}-${pad(cur.getDate())}`;
      const info = dayMap.get(key);

      if (!info || info.status !== 'available') {
        return false;
      }

      range.push({ key, price: info.price });
      cur.setDate(cur.getDate() + 1);
    }

    selectedDates.clear();
    for (const { key, price } of range) {
      selectedDates.set(key, price);
    }
    return true;
  }

  function handleDayClick(key: string, price?: number) {
    if (selectionState === 'idle') {
      rangeStart = key;
      selectionState = 'selecting';
      updateSelectionBar();
      resetGrid();
      paint();
      return;
    }

    if (selectionState === 'selecting') {
      if (key === rangeStart) {
        rangeStart = null;
        selectionState = 'idle';
        updateSelectionBar();
        resetGrid();
        paint();
        return;
      }

      const valid = fillRange(rangeStart!, key);
      if (valid) {
        selectionState = 'selected';
        rangeStart = null;
      } else {
        selectionState = 'idle';
        rangeStart = null;
        showRangeError(i18n.selectionErrorBlocked);
      }
      updateSelectionBar();
      resetGrid();
      paint();
      return;
    }

    if (selectionState === 'selected') {
      selectedDates.clear();
      rangeStart = key;
      selectionState = 'selecting';
      updateSelectionBar();
      resetGrid();
      paint();
    }
  }

  function handleWhatsappClick() {
    if (selectedDates.size === 0) {
      window.open(whatsappBase, '_blank', 'noopener,noreferrer');
      return;
    }
    openModal();
  }

  function openModal() {
    if (!modal || !modalDatesList || !modalTotal) return;
    const sortedKeys = Array.from(selectedDates.keys()).sort();

    modalDatesList.innerHTML = '';
    for (const key of sortedKeys) {
      const li = document.createElement('li');
      li.textContent = toDisplayDate(key);
      modalDatesList.appendChild(li);
    }

    let total = 0;
    let partialPrices = false;
    for (const key of sortedKeys) {
      const price = selectedDates.get(key);
      if (typeof price === 'number') {
        total += price;
      } else {
        partialPrices = true;
      }
    }

    if (total > 0) {
      modalTotal.hidden = false;
      modalTotal.textContent = `${i18n.modalTotalLabel}: ${total}€${partialPrices ? ' +' : ''}`;
    } else {
      modalTotal.hidden = true;
    }

    modal.showModal();
  }

  function handleConfirm() {
    modal?.close();
    const sortedKeys = Array.from(selectedDates.keys()).sort();
    const datesText = sortedKeys.map(toDisplayDate).join(', ');
    const msg = `${WA_MSG_PREFIX}${datesText}.`;
    window.open(`${whatsappBase}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
  }

  async function render() {
    label!.textContent = `${MONTHS[month]} ${year}`;
    const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
    if (todayBtn) todayBtn.hidden = isCurrentMonth;
    resetGrid();
    loading!.style.display = 'block';
    errorEl!.hidden = true;
    dayMap = new Map();

    try {
      const res = await fetch(`/api/availability?year=${year}&month=${month + 1}`);
      if (!res.ok) throw new Error('fetch_failed');
      const data = await res.json();
      const days = (data.days as DayInfo[]) ?? [];
      for (const d of days) dayMap.set(d.date, d);
    } catch {
      errorEl!.hidden = false;
      loading!.style.display = 'none';
      paint();
      return;
    }

    loading!.style.display = 'none';
    paint();
  }

  function paint() {
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const daysInMonth = last.getDate();

    let startDow = first.getDay() - 1;
    if (startDow < 0) startDow = 6;

    const today = new Date();
    const todayKey = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    for (let i = 0; i < startDow; i++) {
      const cell = document.createElement('div');
      cell.className = 'cal__cell cal__cell--empty';
      grid!.appendChild(cell);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${year}-${pad(month + 1)}-${pad(d)}`;
      const info = dayMap.get(key);
      const isToday = key === todayKey;
      const isPast = new Date(year, month, d) < startOfToday;
      const isSelected = selectedDates.has(key);
      const isRangeStart = key === rangeStart;

      const cell = document.createElement('div');
      cell.className = 'cal__cell';
      cell.dataset.dateKey = key;

      if (isPast) {
        cell.classList.add('cal__cell--past');
        cell.addEventListener('click', () => {
          cell.classList.remove('cal__cell--shake');
          void cell.offsetWidth;
          cell.classList.add('cal__cell--shake');
        });
      } else if (isRangeStart) {
        cell.classList.add('cal__cell--range-start');
        cell.addEventListener('click', () => handleDayClick(key, info?.price));
      } else if (isSelected) {
        cell.classList.add('cal__cell--selected');
        cell.addEventListener('click', () => handleDayClick(key, info?.price));
      } else if (info?.status === 'reserved') {
        cell.classList.add('cal__cell--reserved');
      } else if (info?.status === 'available') {
        cell.classList.add('cal__cell--available');
        cell.addEventListener('click', () => handleDayClick(key, info?.price));
      } else {
        cell.classList.add('cal__cell--unavailable');
        cell.addEventListener('click', () => {
          cell.classList.remove('cal__cell--shake');
          void cell.offsetWidth;
          cell.classList.add('cal__cell--shake');
        });
      }

      const num = document.createElement('span');
      num.className = 'cal__num';
      num.textContent = String(d);
      cell.appendChild(num);

      if (!isPast && info?.status === 'available' && typeof info.price === 'number') {
        const priceEl = document.createElement('span');
        priceEl.className = 'cal__price';
        priceEl.textContent = `${info.price}€`;
        cell.appendChild(priceEl);
      }

      if (isToday) {
        const dot = document.createElement('span');
        dot.className = 'cal__today-dot';
        cell.appendChild(dot);
      }
      grid!.appendChild(cell);
    }

    const totalCells = startDow + daysInMonth;
    const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (let i = 0; i < remaining; i++) {
      const cell = document.createElement('div');
      cell.className = 'cal__cell cal__cell--empty';
      grid!.appendChild(cell);
    }
  }

  render();
});
