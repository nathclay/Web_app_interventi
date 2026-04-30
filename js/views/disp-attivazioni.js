/* ================================================================
   js/disp-attivazioni.js — Attivazioni view
   Depends on: dispositivo.js (DISP, helpers)
               rpc-dispositivo.js (DB calls)
================================================================ */

/* ── Local state ───────────────────────────────────────────────*/
const ATT = {
  dateMode:         'all',   // 'all' | 'specific' | 'until' | 'range'
  selectedSession:  null,    // for 'specific'
  untilSession:     null,    // for 'until'
  rangeFrom:        null,    // for 'range'
  rangeTo:          null,    // for 'range'
  competenzaFilter: null,    // 'SOP' | 'Sala_Roma' | 'SOR' | null
  showNonAttivati:  false,
  showNonComunicati: false,
  personnel:        [],      // all personnel for current filter
};

/* ================================================================
   MOUNT
================================================================ */
async function mountAttivazioni(container) {
  container.innerHTML = `
    <div class="att-view-header">
      <!-- Row 1: date filters -->
      <div class="att-filter-row att-filter-row-1">
        <div class="att-mode-btns">
          <button class="att-mode-btn active" data-mode="all">Tutte</button>
          <button class="att-mode-btn" data-mode="specific">Data specifica</button>
          <button class="att-mode-btn" data-mode="until">Fino a data</button>
          <button class="att-mode-btn" data-mode="range">Range</button>
        </div>
        <div class="att-date-inputs" id="att-date-inputs"></div>
      </div>
      <!-- Row 2: competenza + toggles + bulk -->
      <div class="att-filter-row att-filter-row-2">
        <div class="competenza-filter" id="att-comp-filter">
          <button class="comp-btn active" data-comp="">Tutti</button>
          <button class="comp-btn" data-comp="SOP">SOP</button>
          <button class="comp-btn" data-comp="Sala_Roma">Sala Roma</button>
          <button class="comp-btn" data-comp="SOR">SOR</button>
        </div>
        <div class="att-toggle-btns">
          <button class="att-toggle-btn" id="btn-non-attivati">Non attivati</button>
          <button class="att-toggle-btn" id="btn-non-comunicati">Non comunicati</button>
        </div>
        <div style="margin-left:auto">
          <button class="btn-secondary btn-sm" id="btn-bulk-attiva">
            Attiva selezionati
          </button>
        </div>
      </div>
    </div>
    <div id="att-body" class="view-body"></div>`;

  // Wire mode buttons
  document.querySelectorAll('.att-mode-btn').forEach(btn =>
    btn.addEventListener('click', () => {
      document.querySelectorAll('.att-mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      ATT.dateMode = btn.dataset.mode;
      renderDateInputs();
      loadAndRenderAttivazioni();
    })
  );

  // Wire competenza filter
  document.querySelectorAll('#att-comp-filter .comp-btn').forEach(btn =>
    btn.addEventListener('click', () => {
      document.querySelectorAll('#att-comp-filter .comp-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      ATT.competenzaFilter = btn.dataset.comp || null;
      renderAttivazioniTable();
    })
  );

  // Wire toggles
  document.getElementById('btn-non-attivati').addEventListener('click', () => {
    ATT.showNonAttivati = !ATT.showNonAttivati;
    document.getElementById('btn-non-attivati').classList.toggle('active', ATT.showNonAttivati);
    renderAttivazioniTable();
  });
  document.getElementById('btn-non-comunicati').addEventListener('click', () => {
    ATT.showNonComunicati = !ATT.showNonComunicati;
    document.getElementById('btn-non-comunicati').classList.toggle('active', ATT.showNonComunicati);
    renderAttivazioniTable();
  });

  // Bulk attiva — placeholder for now
  document.getElementById('btn-bulk-attiva').addEventListener('click', () => {
    const ids = getAttCheckedIds();
    if (!ids.length) { showToast('Nessuno selezionato', 'error'); return; }
    showToast(`${ids.length} selezionati — funzione in arrivo`, 'success');
  });

  // Init date inputs for default mode ('all')
  renderDateInputs();
  await loadAndRenderAttivazioni();
}

/* ================================================================
   DATE INPUT RENDERING
================================================================ */
function renderDateInputs() {
  const container = document.getElementById('att-date-inputs');
  if (!container) return;

  const sessionOpts = DISP.sessions.map(s =>
    `<option value="${s.session}">${s.label}</option>`
  ).join('');

  if (ATT.dateMode === 'all') {
    container.innerHTML = '';
    return;
  }

  if (ATT.dateMode === 'specific') {
    container.innerHTML = `
      <select id="att-session-single" class="session-select-sm">
        ${sessionOpts}
      </select>`;
    const sel = document.getElementById('att-session-single');
    if (ATT.selectedSession) sel.value = ATT.selectedSession;
    sel.addEventListener('change', () => {
      ATT.selectedSession = +sel.value;
      loadAndRenderAttivazioni();
    });
    ATT.selectedSession = ATT.selectedSession || DISP.sessions[0]?.session || 1;
    sel.value = ATT.selectedSession;
    return;
  }

  if (ATT.dateMode === 'until') {
    container.innerHTML = `
      <label class="att-date-label">Fino a:</label>
      <select id="att-session-until" class="session-select-sm">
        ${sessionOpts}
      </select>`;
    const sel = document.getElementById('att-session-until');
    if (ATT.untilSession) sel.value = ATT.untilSession;
    sel.addEventListener('change', () => {
      ATT.untilSession = +sel.value;
      loadAndRenderAttivazioni();
    });
    ATT.untilSession = ATT.untilSession || DISP.sessions[DISP.sessions.length - 1]?.session || 1;
    sel.value = ATT.untilSession;
    return;
  }

  if (ATT.dateMode === 'range') {
    container.innerHTML = `
      <label class="att-date-label">Da:</label>
      <select id="att-range-from" class="session-select-sm">${sessionOpts}</select>
      <label class="att-date-label">A:</label>
      <select id="att-range-to" class="session-select-sm">${sessionOpts}</select>`;

    const selFrom = document.getElementById('att-range-from');
    const selTo   = document.getElementById('att-range-to');

    ATT.rangeFrom = ATT.rangeFrom || DISP.sessions[0]?.session || 1;
    ATT.rangeTo   = ATT.rangeTo   || DISP.sessions[DISP.sessions.length - 1]?.session || 1;
    selFrom.value = ATT.rangeFrom;
    selTo.value   = ATT.rangeTo;

    selFrom.addEventListener('change', () => { ATT.rangeFrom = +selFrom.value; loadAndRenderAttivazioni(); });
    selTo.addEventListener('change',   () => { ATT.rangeTo   = +selTo.value;   loadAndRenderAttivazioni(); });
  }
}

/* ================================================================
   RESOLVE SESSIONS FOR CURRENT FILTER
================================================================ */
function getSessionsForCurrentMode() {
  const all = DISP.sessions.map(s => s.session);
  if (ATT.dateMode === 'all') return all;
  if (ATT.dateMode === 'specific') return [ATT.selectedSession || DISP.sessions[0]?.session || 1];
  if (ATT.dateMode === 'until') {
    const until = ATT.untilSession || DISP.sessions[DISP.sessions.length - 1]?.session;
    return all.filter(s => s <= until);
  }
  if (ATT.dateMode === 'range') {
    const from = ATT.rangeFrom || all[0];
    const to   = ATT.rangeTo   || all[all.length - 1];
    return all.filter(s => s >= from && s <= to);
  }
  return all;
}

/* ================================================================
   LOAD DATA
================================================================ */
async function loadAndRenderAttivazioni() {
  const body = document.getElementById('att-body');
  if (!body) return;
  body.innerHTML = '<div class="loading-spinner"><div class="spinner"></div><span>Caricamento...</span></div>';

  const sessions = getSessionsForCurrentMode();
  try {
    ATT.personnel = await fetchPersonnelForSessions(DISP.eventId, sessions);
    renderAttivazioniTable();
  } catch (err) {
    body.innerHTML = `<div class="empty-state">Errore: ${err.message}</div>`;
  }
}

/* ================================================================
   RENDER TABLE
================================================================ */
function renderAttivazioniTable() {
  const body = document.getElementById('att-body');
  if (!body) return;

  let people = ATT.personnel;

  // Competenza filter
  if (ATT.competenzaFilter) {
    people = people.filter(p => p.anagrafica?.competenza_attivazione === ATT.competenzaFilter);
  }

  // Toggle filters
  if (ATT.showNonAttivati)   people = people.filter(p => !p.mandata_attivazione);
  if (ATT.showNonComunicati) people = people.filter(p => !p.mandata_comunicazione);

  // Exclude cancelled
  people = people.filter(p => p.status !== 'cancelled');

  if (!people.length) {
    body.innerHTML = '<div class="empty-state">Nessun personale per i filtri selezionati.</div>';
    return;
  }

  const rows = people.map(p => {
    const ana      = p.anagrafica || {};
    const rd       = DISP.resourceDays.find(r => r.resource_day_id === p.resource_day_id);
    const session  = DISP.sessions.find(s => s.session === rd?.session);
    const startT   = parseTime(p.scheduled_start);
    const endT     = parseTime(p.scheduled_end);
    const orario   = (startT && endT) ? `${startT}–${endT}` : '—';
    const attivato    = p.mandata_attivazione;
    const comunicato  = p.mandata_comunicazione;
    const rowClass = !comunicato ? 'att-row-no-com' : '';

    return `
      <tr class="att-row ${rowClass}" onclick="openPersonDetailModal('${p.id}')" style="cursor:pointer">
        <td><input type="checkbox" class="att-check" data-id="${p.id}"
          onclick="event.stopPropagation()" /></td>
        <td class="att-name">${ana.surname||''} ${ana.name||''}</td>
        <td class="att-phone">${ana.number
          ? `<a href="tel:${ana.number}" onclick="event.stopPropagation()">${ana.number}</a>`
          : '—'}</td>
        <td class="att-comitato">${displayComitato(ana.comitato)||'—'}</td>
        <td class="att-date">${session?.label || '—'}</td>
        <td class="att-time">${orario}</td>
        <td class="att-role">${ROLE_LABELS[p.role]||p.role||'—'}</td>
        <td class="att-resource">${rd?.resource||'—'}</td>
        <td class="att-badge-cell">
          <span class="att-bool-badge ${attivato ? 'badge-yes' : 'badge-no'}">
            ${attivato ? 'Sì' : 'No'}
          </span>
        </td>
        <td class="att-badge-cell">
          <span class="att-bool-badge ${comunicato ? 'badge-yes' : 'badge-no'}">
            ${comunicato ? 'Sì' : 'No'}
          </span>
        </td>
      </tr>`;
  }).join('');

  body.innerHTML = `
    <div class="table-scroll-wrapper">
      <table class="att-table">
        <thead>
          <tr>
            <th style="width:32px">
              <input type="checkbox" id="att-check-all"
                onchange="toggleAllAttChecks(this.checked)" />
            </th>
            <th>Nominativo</th>
            <th>Telefono</th>
            <th>Comitato</th>
            <th>Data</th>
            <th>Orario</th>
            <th>Ruolo</th>
            <th>Risorsa</th>
            <th>Attivato</th>
            <th>Comunicato</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

/* ================================================================
   CHECKBOX HELPERS
================================================================ */
function toggleAllAttChecks(checked) {
  document.querySelectorAll('.att-check').forEach(cb => cb.checked = checked);
}

function getAttCheckedIds() {
  return [...document.querySelectorAll('.att-check:checked')].map(cb => cb.dataset.id);
}

// Kept for compatibility with any inline calls
function selectAllComp() {}
function getCheckedIds() { return getAttCheckedIds(); }