/* ================================================================
   js/disp-settings.js — Impostazioni view
   Depends on: dispositivo.js (DISP, helpers)
               rpc-dispositivo.js (DB calls)
================================================================ */

async function mountImpostazioni(container) {
  container.innerHTML = `
    <div class="view-header">
      <div class="view-header-left"><h2 class="view-title">Impostazioni</h2></div>
      <div class="view-header-right">
        <div class="tab-bar" id="imp-tabs">
          <button class="tab-btn active" data-tab="matrix">Risorse al giorno</button>
          <button class="tab-btn"        data-tab="requirements">Requisiti</button>
        </div>
      </div>
    </div>
    <div id="imp-body" class="view-body"></div>`;

  document.querySelectorAll('#imp-tabs .tab-btn').forEach(btn =>
    btn.addEventListener('click', () => {
      document.querySelectorAll('#imp-tabs .tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (btn.dataset.tab === 'matrix') renderMatrix();
      else renderRequirements();
    })
  );

  DISP.allResourceDays = await fetchAllResourceDays(DISP.eventId);
  renderMatrix();
}

/* ── Matrix ────────────────────────────────────────────────────*/
function renderMatrix() {
  const body = document.getElementById('imp-body');
  if (!body) return;

  const sessions = DISP.sessions;
  const resources = DISP.allResources;
  const existing  = new Set(DISP.allResourceDays.map(rd => `${rd.resource_id}::${rd.session}`));

  const sessionHeaders = sessions.map(s =>
    `<th class="matrix-session-th" title="${s.label}">G${s.session}</th>`
  ).join('');

  const rows = resources.map(r => {
    const cells = sessions.map(s => {
      const key    = `${r.id}::${s.session}`;
      const exists = existing.has(key);
      const rdRow  = DISP.allResourceDays.find(rd => rd.resource_id===r.id && rd.session===s.session);
      return `
        <td class="matrix-cell ${exists ? 'cell-on' : 'cell-off'}"
          onclick="toggleResourceDay('${r.id}','${s.session}','${s.date}',${exists},'${rdRow?.id||''}')"
          title="${s.label}">
          ${exists ? '✓' : ''}
        </td>`;
    }).join('');
    return `<tr>
      <td class="matrix-resource-name">
        <span class="matrix-type-badge">${r.resource_type}</span>${r.resource}
      </td>${cells}
    </tr>`;
  }).join('');

  body.innerHTML = `
    <div class="matrix-toolbar">
      <button class="btn-primary" onclick="openBulkCreateModal()">+ Aggiungi in blocco</button>
      <span style="font-size:12px;color:var(--text-muted)">Clicca cella per aggiungere/rimuovere</span>
    </div>
    <div class="table-scroll-wrapper">
      <table class="matrix-table">
        <thead><tr><th class="matrix-resource-th">Risorsa</th>${sessionHeaders}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    ${buildBulkCreatePanel()}`;

  wireBulkCreatePanel();
}

async function toggleResourceDay(resourceId, session, date, exists, rdId) {
  try {
    if (exists && rdId) {
      await deleteResourceDay(rdId);
      DISP.allResourceDays = DISP.allResourceDays.filter(rd => rd.id !== rdId);
    } else {
      const newRd = await createResourceDay(DISP.eventId, resourceId, +session, date, null, null);
      DISP.allResourceDays.push(newRd);
    }
    renderMatrix();
  } catch (err) { showToast(err.message, 'error'); }
}

function buildBulkCreatePanel() {
  return `
    <div class="bulk-panel" id="bulk-panel" style="display:none">
      <div class="bulk-panel-title">Aggiungi in blocco</div>
      <div class="form-row">
        <div class="form-group"><label>Dalla sessione</label>
          <select id="bulk-from">
            ${DISP.sessions.map(s => `<option value="${s.session}">G${s.session} — ${s.label}</option>`).join('')}
          </select></div>
        <div class="form-group"><label>Alla sessione</label>
          <select id="bulk-to">
            ${DISP.sessions.map((s,i) =>
              `<option value="${s.session}" ${i===DISP.sessions.length-1 ? 'selected' : ''}>G${s.session} — ${s.label}</option>`
            ).join('')}
          </select></div>
        <div class="form-group"><label>Inizio</label><input type="time" id="bulk-start" value="07:00" /></div>
        <div class="form-group"><label>Fine</label>  <input type="time" id="bulk-end"   value="22:00" /></div>
      </div>
      <div class="form-group">
        <label>Tipo risorsa</label>
        <div class="type-filter-btns" id="bulk-type-filter">
          <button class="type-btn active" data-type="">Tutti</button>
          ${[...new Set(DISP.allResources.map(r => r.resource_type))].sort().map(t =>
            `<button class="type-btn" data-type="${t}">${t}</button>`
          ).join('')}
        </div>
      </div>
      <div class="form-group">
        <label>Risorse</label>
        <div class="bulk-resource-list" id="bulk-resource-list"></div>
      </div>
      <div id="bulk-error" class="error-msg"></div>
      <div style="display:flex;gap:8px;margin-top:10px">
        <button class="btn-primary" id="btn-bulk-confirm">Crea giorni</button>
        <button class="btn-secondary"
          onclick="document.getElementById('bulk-panel').style.display='none'">Annulla</button>
      </div>
    </div>`;
}

function openBulkCreateModal() {
  const panel = document.getElementById('bulk-panel');
  if (panel) { panel.style.display = ''; populateBulkResourceList(''); }
}

function wireBulkCreatePanel() {
  document.querySelectorAll('#bulk-type-filter .type-btn').forEach(btn =>
    btn.addEventListener('click', () => {
      document.querySelectorAll('#bulk-type-filter .type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      populateBulkResourceList(btn.dataset.type);
    })
  );
  document.getElementById('btn-bulk-confirm')?.addEventListener('click', confirmBulkCreate);
}

function populateBulkResourceList(typeFilter) {
  const list = document.getElementById('bulk-resource-list');
  if (!list) return;
  const filtered = typeFilter
    ? DISP.allResources.filter(r => r.resource_type === typeFilter)
    : DISP.allResources;
  list.innerHTML = filtered.map(r => `
    <label class="bulk-resource-item">
      <input type="checkbox" value="${r.id}" />
      <span class="matrix-type-badge">${r.resource_type}</span>${r.resource}
    </label>`).join('');
}

async function confirmBulkCreate() {
  const from  = +document.getElementById('bulk-from').value;
  const to    = +document.getElementById('bulk-to').value;
  const s     = document.getElementById('bulk-start').value || null;
  const e     = document.getElementById('bulk-end').value   || null;
  const errEl = document.getElementById('bulk-error');
  errEl.textContent = '';

  const resourceIds = [...document.querySelectorAll('#bulk-resource-list input:checked')]
    .map(cb => cb.value);
  if (!resourceIds.length) { errEl.textContent = 'Seleziona almeno una risorsa.'; return; }
  if (from > to)           { errEl.textContent = 'Sessione fine ≥ inizio.';       return; }

  const sessions = DISP.sessions.filter(s => s.session >= from && s.session <= to);
  const btn = document.getElementById('btn-bulk-confirm');
  btn.disabled = true; btn.textContent = 'Creazione...';
  try {
    const result = await bulkCreateResourceDays(DISP.eventId, resourceIds, sessions, s, e);
    document.getElementById('bulk-panel').style.display = 'none';
    DISP.allResourceDays = await fetchAllResourceDays(DISP.eventId);
    renderMatrix();
    showToast(`${result.created} giorni creati ✓`, 'success');
  } catch (err) { errEl.textContent = err.message; }
  finally { btn.disabled=false; btn.textContent='Crea giorni'; }
}

/* ── Requirements ──────────────────────────────────────────────*/
async function renderRequirements() {
  const body = document.getElementById('imp-body');
  if (!body) return;

  const reqs     = await fetchRequirements();
  const allTypes = [...new Set(DISP.allResources.map(r => r.resource_type))].sort();

  const sections = allTypes.map(type => {
    const typeReqs = reqs[type] || [];
    const rows = typeReqs.map(r => `
      <tr>
        <td>${ROLE_LABELS[r.role] || r.role}</td>
        <td><input type="number" class="req-count-input" min="0" max="10"
          value="${r.count}" data-id="${r.id}" style="width:60px;text-align:center" /></td>
        <td><button class="btn-icon-sm" onclick="deleteReq('${r.id}')">✕</button></td>
      </tr>`).join('');

    const roleOpts = ALL_ROLES
      .filter(role => !typeReqs.find(r => r.role === role))
      .map(role => `<option value="${role}">${ROLE_LABELS[role]}</option>`)
      .join('');

    return `
      <div class="req-section">
        <div class="req-section-title">${type}</div>
        <table class="req-table">
          <thead><tr><th>Ruolo</th><th>Quantità</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        ${roleOpts ? `
          <div class="req-add-row">
            <select id="req-role-${type}" class="req-role-select">
              <option value="">+ Aggiungi ruolo...</option>${roleOpts}
            </select>
            <button class="btn-secondary btn-sm" onclick="addRequirement('${type}')">Aggiungi</button>
          </div>` : ''}
      </div>`;
  }).join('');

  body.innerHTML = `<div class="req-body">${sections}</div>`;

  document.querySelectorAll('.req-count-input').forEach(input => {
    let t;
    input.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(async () => {
        if (+input.value < 0) return;
        try { await upsertRequirement(input.dataset.id, null, null, +input.value); showToast('Salvato ✓', 'success'); }
        catch (err) { showToast(err.message, 'error'); }
      }, 600);
    });
  });
}

async function addRequirement(resourceType) {
  const sel = document.getElementById(`req-role-${resourceType}`);
  if (!sel?.value) return;
  try { await upsertRequirement(null, resourceType, sel.value, 1); showToast('Aggiunto ✓', 'success'); await renderRequirements(); }
  catch (err) { showToast(err.message, 'error'); }
}

async function deleteReq(id) {
  if (!confirm('Rimuovere questo requisito?')) return;
  try { await deleteRequirement(id); showToast('Rimosso', 'success'); await renderRequirements(); }
  catch (err) { showToast(err.message, 'error'); }
}