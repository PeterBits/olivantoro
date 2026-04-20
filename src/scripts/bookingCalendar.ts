type DayStatus = 'reserved' | 'available' | 'unavailable';

interface DayInfo {
  date: string;
  status: DayStatus;
  price?: number;
}

interface CalI18n {
  selectionCountSingular: string;
  selectionCountPlural: string;
  selectionClear: string;
  modalTitle: string;
  modalDatesLabel: string;
  modalTotalLabel: string;
  modalCancel: string;
  modalConfirm: string;
}

const WA_MSG_PREFIX = 'Hola, me gustaría reservar la furgoneta para los siguientes días: ';

const selectedDates = new Map<string, number | undefined>();

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

  const selectionBar = document.getElementById('cal-selection-bar');
  const selectionCount = document.getElementById('cal-selection-count');
  const selectionClear = document.getElementById('cal-selection-clear');
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

  prev.addEventListener('click', () => shift(-1));
  next.addEventListener('click', () => shift(1));
  selectionClear?.addEventListener('click', clearSelection);
  whatsappBtn?.addEventListener('click', handleWhatsappClick);
  modalCancel?.addEventListener('click', () => modal?.close());
  modalConfirm?.addEventListener('click', handleConfirm);
  modal?.addEventListener('click', (e) => { if (e.target === modal) modal.close(); });

  updateSelectionBar();

  function shift(delta: number) {
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
    if (!selectionBar || !selectionCount) return;
    const count = selectedDates.size;
    if (count === 0) {
      selectionBar.hidden = true;
      return;
    }
    selectionBar.hidden = false;
    selectionCount.textContent = count === 1
      ? i18n.selectionCountSingular
      : i18n.selectionCountPlural.replace('%n', String(count));
  }

  function clearSelection() {
    selectedDates.clear();
    updateSelectionBar();
    resetGrid();
    paint();
  }

  function toggleDate(key: string, price?: number) {
    if (selectedDates.has(key)) {
      selectedDates.delete(key);
    } else {
      selectedDates.set(key, price);
    }
    updateSelectionBar();
    resetGrid();
    paint();
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

    const prevLast = new Date(year, month, 0).getDate();
    for (let i = startDow - 1; i >= 0; i--) {
      const cell = document.createElement('div');
      cell.className = 'cal__cell cal__cell--muted';
      cell.textContent = String(prevLast - i);
      grid!.appendChild(cell);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${year}-${pad(month + 1)}-${pad(d)}`;
      const info = dayMap.get(key);
      const isToday = key === todayKey;
      const isPast = new Date(year, month, d) < startOfToday;
      const isSelected = selectedDates.has(key);

      const cell = document.createElement('div');
      cell.className = 'cal__cell';
      cell.dataset.dateKey = key;

      if (isPast) {
        cell.classList.add('cal__cell--past');
      } else if (isSelected) {
        cell.classList.add('cal__cell--selected');
        cell.addEventListener('click', () => toggleDate(key, info?.price));
      } else if (info?.status === 'reserved') {
        cell.classList.add('cal__cell--reserved');
      } else if (info?.status === 'available') {
        cell.classList.add('cal__cell--available');
        cell.addEventListener('click', () => toggleDate(key, info?.price));
      } else {
        cell.classList.add('cal__cell--unavailable');
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
    for (let i = 1; i <= remaining; i++) {
      const cell = document.createElement('div');
      cell.className = 'cal__cell cal__cell--muted';
      cell.textContent = String(i);
      grid!.appendChild(cell);
    }
  }

  render();
});
