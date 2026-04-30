/* ================================================================
   js/disp-ricerca.js — Ricerca personale view
   Depends on: dispositivo.js (DISP, CTX, all helpers)
               rpc-dispositivo.js (all DB calls)
================================================================ */
 
/* ================================================================
   MOUNT
================================================================ */
async function mountRicerca(container) {
  container.innerHTML = `
    <div class="view-header">
      <div class="view-header-left">
        <h2 class="view-title">Ricerca personale</h2>
        <select id="ricerca-session" class="session-select"></select>
      </div>
      <div class="view-header-right">
        <button class="btn-icon" id="btn-add-resource" title="Aggiungi risorsa">＋</button>
        <button class="btn-icon" id="btn-import-ana"   title="Importa anagrafica">⬆</button>
        <button class="btn-icon" id="btn-export"       title="Esporta XLSX">⬇</button>
      </div>
    </div>
    <div id="ricerca-grid" class="view-body"></div>`;
 
  const sel = document.getElementById('ricerca-session');
  sel.innerHTML = DISP.sessions.map(s =>
    `<option value="${s.session}" ${s.session===DISP.session ? 'selected' : ''}>${s.label}</option>`
  ).join('');
  sel.addEventListener('change', async () => {
    DISP.session = +sel.value;
    await loadSessionData();
    renderRicercaGrid();
  });
 
  document.getElementById('btn-add-resource').addEventListener('click', openAddResourceDayModal);
  document.getElementById('btn-import-ana').addEventListener('click', openImportModal);
  document.getElementById('btn-export').addEventListener('click', exportXLSX);
 
  await loadSessionData();
  renderRicercaGrid();
}

/* ================================================================
   RENDER GRID
================================================================ */
function renderRicercaGrid() {
  const container = document.getElementById('ricerca-grid');
  if (!container) return;
 
  // Apply competenza filter and exclude cancelled
  const visPersonnel = DISP.personnel
    .filter(p => p.status !== 'cancelled')
    .filter(p => !DISP.competenzaFilter ||
      p.anagrafica?.competenza_attivazione === DISP.competenzaFilter);
 
  // Group by resource_day_id
  const byRD = {};
  visPersonnel.forEach(p => {
    if (!byRD[p.resource_day_id]) byRD[p.resource_day_id] = [];
    byRD[p.resource_day_id].push(p);
  });
 
  // Group resource days by type
  const byType = {};
  DISP.resourceDays.forEach(rd => {
    if (!byType[rd.resource_type]) byType[rd.resource_type] = [];
    byType[rd.resource_type].push(rd);
  });
 
  if (!DISP.resourceDays.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📋</div>
        Nessuna risorsa per questa sessione.
        <button class="btn-primary" style="margin-top:12px"
          onclick="openAddResourceDayModal()">+ Aggiungi risorsa</button>
      </div>`;
    return;
  }
 
  // Build sections in defined order
  const sections = [];
  TYPE_ORDER.forEach(t => {
    if (byType[t]?.length) sections.push(buildTypeSection(t, byType[t], byRD));
  });
  Object.keys(byType).forEach(t => {
    if (!TYPE_ORDER.includes(t)) sections.push(buildTypeSection(t, byType[t], byRD));
  });
 
  // Apply stored legend colors
  applyStoredLegendColors();
 
  container.innerHTML = `
    <div class="grid-legend" id="grid-legend">
      <div class="legend-item">
        <div class="legend-swatch" id="swatch-missing"
          style="background:var(--cell-missing)"></div>
        <span>Risorsa da trovare</span>
      </div>
      <div class="legend-item">
        <div class="legend-swatch" id="swatch-complete"
          style="background:var(--cell-complete)"></div>
        <span>Modulo completo</span>
      </div>
      <button class="btn-legend-edit" onclick="openLegendEditor()">✎ Modifica colori</button>
    </div>
    ${buildRecapBar(DISP.resourceDays, byRD)}
    ${sections.join('')}`;
}

/* ================================================================
   LEGEND EDITOR
================================================================ */
function openLegendEditor() {
  const panel = document.getElementById('legend-editor');
  if (panel) { panel.remove(); return; }

  const stored = JSON.parse(localStorage.getItem('disp_legend') || '{}');
  const missingColor  = stored.missingColor  || '#FFD600';
  const completeColor = stored.completeColor || 'rgba(34,197,94,0.18)';

  const el = document.createElement('div');
  el.id = 'legend-editor';
  el.className = 'legend-editor-panel';
  el.innerHTML = `
    <div class="legend-editor-title">Modifica colori legenda</div>
    <div class="form-row">
      <div class="form-group">
        <label>Da trovare</label>
        <input type="color" id="le-missing"  value="${missingColor.startsWith('#') ? missingColor : '#FFD600'}" />
        <input type="range" id="le-missing-a" min="0" max="100"
          value="${Math.round(getAlpha(missingColor)*100)}" />
      </div>
      <div class="form-group">
        <label>Completo</label>
        <input type="color" id="le-complete"  value="#22c55e" />
        <input type="range" id="le-complete-a" min="0" max="100"
          value="${Math.round(getAlpha(completeColor)*100)}" />
      </div>
    </div>
    <button class="btn-primary btn-sm" onclick="applyLegendColors()">Applica</button>`;

  document.getElementById('grid-legend').after(el);
}

function applyLegendColors() {
  const mc = document.getElementById('le-missing').value;
  const ma = +document.getElementById('le-missing-a').value / 100;
  const cc = document.getElementById('le-complete').value;
  const ca = +document.getElementById('le-complete-a').value / 100;

  const missingColor  = hexToRgba(mc, ma);
  const completeColor = hexToRgba(cc, ca);

  localStorage.setItem('disp_legend', JSON.stringify({ missingColor, completeColor }));

  // Inject into CSS vars
  document.documentElement.style.setProperty('--cell-missing',  missingColor);
  document.documentElement.style.setProperty('--cell-complete', completeColor);
  document.getElementById('swatch-missing').style.background  = missingColor;
  document.getElementById('swatch-complete').style.background = completeColor;

  document.getElementById('legend-editor')?.remove();
  renderRicercaGrid(); // re-render with new colors
}

/* ================================================================
   RECAP BAR
================================================================ */
const RECAP_ROLES = ['autista', 'infermiere', 'medico'];

function buildRecapBar(resourceDays, byRD) {
  // Map: role → turno_label → { needed, missing }
  const recap = {};
  RECAP_ROLES.forEach(r => recap[r] = {});

  resourceDays.forEach(rd => {
    const rdStart = rd.rd_start || rd.start_time;
    const rdEnd   = rd.rd_end   || rd.end_time;
    const turni   = computeTurni(rdStart, rdEnd);
    const crew    = byRD[rd.resource_day_id] || [];

    // Only process resource types that require these roles
    const reqs = DISP.requirements[rd.resource_type] || [];
    const requiredRoles = new Set(reqs.map(r => r.role));

    RECAP_ROLES.forEach(role => {
      if (!requiredRoles.has(role)) return;

      const slots = turni
        ? turni.slice(1) // skip "intero turno", use 1° and 2° only
        : [{ start: fmtTimeParts(rdStart), end: fmtTimeParts(rdEnd),
             label: `${fmtTimeParts(rdStart)}–${fmtTimeParts(rdEnd)}` }];

      slots.forEach(slot => {
        const label = `${slot.start}–${slot.end}`;
        if (!recap[role][label]) recap[role][label] = { needed: 0, missing: 0 };
        recap[role][label].needed++;

        // Check if this slot is covered
        const active = crew.filter(p =>
          p.role === role && p.status !== 'cancelled' && p.status !== 'no_show'
        );
        const slotCovered = active.some(p => {
          if (!p.scheduled_start || !p.scheduled_end) return true; // no time = treat as covering
          const pS = toMinutes(parseTime(p.scheduled_start));
          const pE = toMinutes(parseTime(p.scheduled_end));
          const sS = toMinutes(slot.start);
          const sE = toMinutes(slot.end);
          return pS <= sS && pE >= sE;
        });

        if (!slotCovered) recap[role][label].missing++;
      });
    });
  });

  // Build HTML — only show roles with at least one missing
  const roleBlocks = RECAP_ROLES.map(role => {
    const slots = recap[role];
    const slotEntries = Object.entries(slots).filter(([, v]) => v.missing > 0);
    if (!slotEntries.length) return '';

    const slotTags = slotEntries.map(([label, v]) =>
      `<span class="recap-slot">
        <span class="recap-slot-time">${label}</span>
        <span class="recap-slot-count">mancano ${v.missing}</span>
      </span>`
    ).join('');

    return `
      <div class="recap-role-block">
        <span class="recap-role-name">${ROLE_LABELS[role]}</span>
        ${slotTags}
      </div>`;
  }).join('');

  if (!roleBlocks) return '';

  return `
    <div class="recap-bar" id="recap-bar">
      <span class="recap-title">Riepilogo carenze</span>
      ${roleBlocks}
    </div>`;
}

/* ================================================================
   SECTION & ROW BUILDERS
================================================================ */
const ROLE_ORDER = [
  'autista','soccorritore','infermiere','medico','coordinatore',
  'volontario_generico','opem','tlc','logista','sep','droni'
];

function buildTypeSection(type, resourceDays, byRD) {
  const reqs = DISP.requirements[type] || [];

  // One column per required role (respecting count > 1)
  const displayRoles = reqs
  .flatMap(r => Array.from({ length: r.count }, () => r.role))
  .sort((a, b) => ROLE_ORDER.indexOf(a) - ROLE_ORDER.indexOf(b));

  const requiredRoles = new Set(reqs.map(r => r.role));

  let totalHoles = 0;
  resourceDays.forEach(rd => {
    const crew = byRD[rd.resource_day_id] || [];
    displayRoles.forEach(role => {
      if (!crew.find(p => p.role === role && p.status !== 'cancelled' && p.status !== 'no_show'))
        totalHoles++;
    });
  });

  const holesByRole = {};
  displayRoles.forEach(role => {
    const missing = resourceDays.filter(rd => {
      const crew    = byRD[rd.resource_day_id] || [];
      const rdStart = rd.rd_start || rd.start_time;
      const rdEnd   = rd.rd_end   || rd.end_time;
      const active  = crew.filter(p => p.role === role && p.status !== 'cancelled' && p.status !== 'no_show');
      return !isRoleFullyCovered(active, rdStart, rdEnd);
    }).length;
    holesByRole[role] = missing;
  });

  const roleHeaders = displayRoles.map(r => {
    const n = holesByRole[r];
    return `<th class="col-role th-required">
      ${ROLE_LABELS[r] || r}
      ${n > 0 ? `<div class="col-hole-badge">mancano ${n}</div>` : ''}
    </th>`;
  }).join('');


  const rows = resourceDays.map(rd =>
    buildResourceRow(rd, byRD[rd.resource_day_id] || [], displayRoles, requiredRoles)
  ).join('');

  return `
    <div class="disp-section">
      <div class="section-header">
        <span class="section-type-badge">${type}</span>
        <span class="section-count">${resourceDays.length} risorse</span>
      </div>
      <div class="table-scroll-wrapper">
        <table class="disp-table">
          <thead><tr>
            <th class="col-resource">Risorsa</th>
            <th class="col-time">Orario</th>
            <th class="col-luogo">Luogo</th>
            <th class="col-note">Note</th>
            <th class="col-mezzo">Mezzo</th>
            ${roleHeaders}
            <th class="col-add">Extra</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

function buildResourceRow(rd, crew, displayRoles, requiredRoles) {
  const rdStart = rd.rd_start || rd.start_time;
  const rdEnd   = rd.rd_end   || rd.end_time;
  const orario  = (rdStart && rdEnd)
    ? `${fmtTime(rdStart)}–${fmtTime(rdEnd)}`
    : '—';

  const roleCells = displayRoles.map(role => {
    const people  = crew.filter(p => p.role === role)
      .sort((a, b) => toMinutes(parseTime(a.scheduled_start)) - toMinutes(parseTime(b.scheduled_start)));
    const isReq   = requiredRoles.has(role);
    const active     = people.filter(p => p.status !== 'cancelled' && p.status !== 'no_show');
    const isMissing  = isReq && !isRoleFullyCovered(active, rdStart, rdEnd);
    const isComplete = isReq && !isMissing && active.length > 0;

  return `<td class="person-cell${isMissing ? ' cell-missing' : isComplete ? ' cell-complete' : ''}">
      ${buildRoleStack(people, role, rd.resource_day_id, rdStart, rdEnd)}
    </td>`;
  }).join('');

  // Extra people not in any display role
  const extras = crew.filter(p => !displayRoles.includes(p.role));

  return `
    <tr>
      <td class="col-resource">
        <div class="resource-name">${rd.resource}</div>
        ${rd.targa ? `<div class="resource-targa">${rd.targa}</div>` : ''}
      </td>
      <td class="col-time" style="white-space:nowrap;font-family:var(--mono)">${orario}</td>
      <td class="col-luogo">—</td>
      <td class="col-note">—</td>
      <td class="col-mezzo">—</td>
      ${roleCells}
      <td class="col-add">
        <div class="person-stack">
          ${extras.map(p => buildPersonCard(p)).join('')}
          <button class="btn-add-extra"
            onclick="openAssignmentFlow('${rd.resource_day_id}',null,null,null)"
            title="Aggiungi personale">＋</button>
        </div>
      </td>
    </tr>`;
}

/* ================================================================
   ROLE STACK & PERSON CARD
================================================================ */
function buildRoleStack(people, role, resourceDayId, rdStart, rdEnd) {
  let html = '<div class="person-stack">';

  if (!people.length) {
    html += buildAddButton(resourceDayId, role,
      rdStart ? fmtTimeParts(rdStart) : null,
      rdEnd   ? fmtTimeParts(rdEnd)   : null);
  } else {
    buildTimeOrderedItems(people, rdStart, rdEnd).forEach(item => {
      if (item.type === 'person') html += buildPersonCard(item.p);
      else html += buildAddButton(resourceDayId, role, item.start, item.end, item.isGap);
    });
  }

  html += '</div>';
  return html;
}

function buildTimeOrderedItems(people, rdStart, rdEnd) {
  if (!rdStart || !rdEnd) return people.map(p => ({ type: 'person', p }));

  const winS = toMinutes(fmtTimeParts(rdStart));
  const winE = toMinutes(fmtTimeParts(rdEnd));

  const timed   = people
    .filter(p => p.scheduled_start && p.scheduled_end)
    .sort((a, b) => toMinutes(parseTime(a.scheduled_start)) - toMinutes(parseTime(b.scheduled_start)));
  const untimed = people.filter(p => !p.scheduled_start || !p.scheduled_end);

  if (!timed.length) {
    // No time info — show full window gap then people
    return [
      { type: 'gap', start: fmtTimeParts(rdStart), end: fmtTimeParts(rdEnd), isGap: true },
      ...untimed.map(p => ({ type: 'person', p })),
    ];
  }

  const items = [];
  let cursor = winS;

  for (const p of timed) {
    const pS = toMinutes(parseTime(p.scheduled_start));
    const pE = toMinutes(parseTime(p.scheduled_end));
    if (pS > cursor) items.push({ type: 'gap', start: fromMinutes(cursor), end: fromMinutes(pS), isGap: true });
    items.push({ type: 'person', p });
    cursor = Math.max(cursor, pE);
  }

  if (cursor < winE) items.push({ type: 'gap', start: fromMinutes(cursor), end: fromMinutes(winE), isGap: true });
  untimed.forEach(p => items.push({ type: 'person', p }));

  return items;
}

function isRoleFullyCovered(people, rdStart, rdEnd) {
  if (!people.length) return false;
  if (!rdStart || !rdEnd) return true; // no window defined → covered if anyone present

  const winS = toMinutes(fmtTimeParts(rdStart));
  const winE = toMinutes(fmtTimeParts(rdEnd));

  const intervals = people
    .filter(p => p.scheduled_start && p.scheduled_end)
    .map(p => ({ s: toMinutes(parseTime(p.scheduled_start)), e: toMinutes(parseTime(p.scheduled_end)) }))
    .filter(i => !isNaN(i.s) && !isNaN(i.e))
    .sort((a, b) => a.s - b.s);

  if (!intervals.length) return true; // people assigned but no times → treat as covered

  let cursor = winS;
  for (const i of intervals) {
    if (i.s > cursor) return false; // gap
    cursor = Math.max(cursor, i.e);
  }
  return cursor >= winE;
}

function buildAddButton(resourceDayId, role, startHint, endHint, isGap = false) {
  const timeLabel = (startHint && endHint) ? `${startHint}–${endHint}` : '';
  return `
    <div class="person-card person-empty${isGap ? ' person-empty-gap' : ''}"
      onclick="openAssignmentFlow('${resourceDayId}','${role||''}','${startHint||''}','${endHint||''}')">
      <span class="empty-plus">+</span>
      ${role ? `<span class="empty-role">${ROLE_LABELS[role]||role}</span>` : ''}
      ${timeLabel ? `<span class="empty-time">${timeLabel}</span>` : ''}
    </div>`;
}

function buildPersonCard(p) {
  const ana    = p.anagrafica || {};
  const status = p.status || 'scheduled';
  const startT = parseTime(p.scheduled_start);
  const endT   = parseTime(p.scheduled_end);

  return `
    <div class="person-card" data-status="${status}"
      style="background:${STATUS_COLORS[status]};border-left:3px solid ${COMP_COLORS[p.competenza_attivazione || ana.competenza_attivazione] || 'transparent'};"
      onclick="openPersonDetailModal('${p.id}')">
      <div class="person-name">${ana.surname || ''}${ana.name ? ' ' + ana.name : ''}</div>
      <div class="person-line">${ROLE_LABELS[p.role] || p.role || '—'}</div>
      ${displayComitato(ana.comitato) ? `<div class="person-line">${displayComitato(ana.comitato)}</div>` : ''}
      ${(startT && endT) ? `<div class="person-line person-time">${startT}–${endT}</div>` : ''}
      ${p.updated_by ? `<div class="person-editor">✎ ${p.updated_by === DISP.user?.id ? 'Tu' : p.updated_by.slice(0,8)+'…'}</div>` : ''}
    </div>`;
}

