/* ================================================================
   js/views/pma.js
   PMA dashboard — incoming, active, closed patients
   Depends on: rpc.js, ui.js, state.js, auth.js
================================================================ */

const PMA_CLINICAL_TYPES = ['ASM', 'ASI', 'MM', 'PMA'];

/* ----------------------------------------------------------------
   BOOT — called from auth.js after login
---------------------------------------------------------------- */
async function loadPMAView() {
    showScreen('screen-main');
  document.getElementById('header-resource-name').textContent =
    STATE.resource.resource;
  document.getElementById('header-user-name').textContent =
    STATE.personnel
      ? `${STATE.personnel.name} ${STATE.personnel.surname}`
      : STATE.resource.resource;

  // Wire logout
  document.getElementById('btn-logout').addEventListener('click', async () => {
    await db.auth.signOut();
    sessionStorage.clear();
    location.reload();
  });

  // Wire new patient
  document.getElementById('btn-new-patient')
    .addEventListener('click', () => {
        openNewPatientForm();}
);

  // Wire close modals on backdrop click
  document.querySelectorAll('.modal-backdrop').forEach(b => {
    b.addEventListener('click', e => { if (e.target === b) closeModal(b.id); });
  });

  // Wire close patient modal
  document.getElementById('modal-close-patient-close')
    .addEventListener('click', () => closeModal('modal-close-patient'));
  document.getElementById('modal-assessment-close')
    .addEventListener('click', () => closeModal('modal-assessment'));
  document.getElementById('modal-new-patient-close')
    .addEventListener('click', () => closeModal('modal-new-patient'));

  // Wire close patient outcome options
  document.getElementById('close-opt-dimesso')
    .addEventListener('click', () => selectCloseOutcome('dimesso'));
  document.getElementById('close-opt-ospedale')
    .addEventListener('click', () => selectCloseOutcome('ospedale'));

  await refreshPMA();

  // Auto-refresh every 30 seconds
  onIncidentChange(() => refreshPMA());
  subscribeRealtime();}

/* ----------------------------------------------------------------
   MAIN DATA LOAD
---------------------------------------------------------------- */
async function refreshPMA() {
  const [incoming, active, closed] = await Promise.all([
    fetchPMAIncoming(),
    fetchPMAActive(),
    fetchPMAClosed(),
  ]);

  renderIncoming(incoming);
  renderActive(active);
  renderClosed(closed);
  updateStats(incoming.length, active.length, closed.length);
}

/* ----------------------------------------------------------------
   FETCH FUNCTIONS
---------------------------------------------------------------- */
async function fetchPMAIncoming() {
  // Incidents where a field team is en_route_to_pma to THIS PMA
  const { data, error } = await db
    .from('incident_responses')
    .select(`
      id, outcome, dest_pma_id, assigned_at,
      incidents(
        id, patient_name, patient_identifier, patient_age, patient_gender,
        current_triage, description,
        patient_assessments(
          id, assessed_at, conscious, respiration, circulation,
          walking, minor_injuries, heart_rate, spo2, breathing_rate,
          blood_pressure, temperature, gcs_total, hgt, triage, description, clinical_notes, iv_access
        )
      ),
      resources!incident_responses_resource_id_fkey(resource, resource_type)
    `)
    .order('assigned_at', { ascending: false })
    .eq('outcome', 'en_route_to_pma')
    .eq('dest_pma_id', STATE.resource.id);

  if (error) { console.error('fetchPMAIncoming:', error); return []; }
  return data || [];
}

async function fetchPMAActive() {
  // Incidents where THIS PMA resource is treating
  const { data, error } = await db
    .from('incident_responses')
    .select(`
      id, outcome, assigned_at,
      incidents(
        id, patient_name, patient_identifier, patient_age, patient_gender,
        current_triage, description,
        patient_assessments(
          id, assessed_at, conscious, respiration, circulation,
          walking, minor_injuries, heart_rate, spo2, breathing_rate,
          blood_pressure, temperature, gcs_total, hgt, triage, description, clinical_notes, bed_number_pma, iv_access
        )
      )
    `)
    .order('assigned_at', { ascending: false })
    .eq('resource_id', STATE.resource.id)
    .eq('outcome', 'treating');

  if (error) { console.error('fetchPMAActive:', error); return []; }
  return data || [];
}

async function fetchPMAClosed() {
  // Incidents closed by THIS PMA resource today
  const { data, error } = await db
    .from('incident_responses')
    .select(`
      id, outcome, released_at, dest_hospital, handoff_to_response_id,
      incidents(
        id, patient_name, patient_identifier, patient_age, patient_gender,
        current_triage,
        patient_assessments(
          id, assessed_at, conscious, respiration, circulation,
          walking, minor_injuries, heart_rate, spo2, breathing_rate,
          blood_pressure, temperature, gcs_total, hgt, triage, description, clinical_notes, iv_access
        )
      )
    `)
    .order('assigned_at', { ascending: false })
    .eq('resource_id', STATE.resource.id)
    .in('outcome', ['treated_and_released', 'handed_off'])
    .order('released_at', { ascending: false });

  if (error) { console.error('fetchPMAClosed:', error); return []; }
  return data || [];
}

/* ----------------------------------------------------------------
   RENDER FUNCTIONS
---------------------------------------------------------------- */
function getLatestAssessment(patientAssessments) {
  if (!patientAssessments || patientAssessments.length === 0) return null;
  return [...patientAssessments]
    .sort((a, b) => new Date(b.assessed_at) - new Date(a.assessed_at))[0];
}

function ynCell(value) {
  if (value === true)  return '<span class="yn-cell yes">Sì</span>';
  if (value === false) return '<span class="yn-cell no">No</span>';
  return '<span class="yn-cell unknown">—</span>';
}

function triageCell(triage) {
  if (!triage) return '—';
  return `<span class="triage-dot ${triage}"></span>`;
}

function buildVitalsCells(a) {
  if (!a) return `
    <td>—</td><td>—</td><td>—</td><td>—</td><td>—</td>
    <td>—</td><td>—</td><td>—</td><td>—</td><td>—</td>
    <td>—</td><td>—</td>`;
  return `
    <td>${ynCell(a.conscious)}</td>
    <td>${ynCell(a.respiration)}</td>
    <td>${ynCell(a.circulation)}</td>
    <td>${ynCell(a.iv_access)}</td>
    <td>${a.heart_rate ?? '—'}</td>
    <td>${a.breathing_rate ?? '—'}</td>
    <td>${a.spo2 != null ? a.spo2 + '%' : '—'}</td>
    <td>${a.blood_pressure ?? '—'}</td>
    <td>${a.temperature ?? '—'}</td>
    <td>${a.gcs_total ?? '—'}</td>
    <td>${a.hgt ?? '—'}</td>`
}

function renderIncoming(rows) {
  const tbody = document.getElementById('tbody-incoming');
  document.getElementById('count-incoming').textContent = rows.length;

  if (rows.length === 0) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="17">Nessun paziente in arrivo</td></tr>';
    return;
  }

  tbody.innerHTML = rows.map(row => {
    const inc  = row.incidents;
    const a    = getLatestAssessment(inc.patient_assessments);
    const time = new Date(row.assigned_at)
      .toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    const team = row.resources?.resource || '—';
    const name = inc.patient_name || inc.patient_identifier || 'Ignoto';

    return `<tr>
      <td>${time}</td>
      <td>${triageCell(inc.current_triage)}</td>
      <td>${team}</td>
      <td><strong>${name}</strong><br>
        <span style="font-size:11px;color:var(--text-secondary);">
          Età: ${inc.patient_age ? inc.patient_age : ''||'nd'} Sesso: ${inc.patient_gender || 'nd'}
        </span>
      </td>
      <td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:default;"
      title="${a.description ?? ''}">${a.description ?? '—'}</td>
      ${buildVitalsCells(a)}
      <td>
        <button class="btn-table-action storico" onclick="openStorico('${inc.id}')">
          Storico
        </button>
      </td>
      <td>
        <button class="btn-table-action receive"
          onclick="openReceiveModal('${row.id}', '${inc.id}')">
          Ricevi
        </button>
      </td>
    </tr>`;
  }).join('');
}

function renderActive(rows) {
  const tbody = document.getElementById('tbody-active');
  document.getElementById('count-active').textContent = rows.length;

  if (rows.length === 0) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="17">Nessun paziente in trattamento</td></tr>';
    return;
  }

  tbody.innerHTML = rows.map(row => {
    const inc  = row.incidents;
    const a    = getLatestAssessment(inc.patient_assessments);
    const time = a
      ? new Date(a.assessed_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
      : new Date(row.assigned_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    const name = inc.patient_name || inc.patient_identifier || 'Ignoto';

    return `<tr>
      <td>${time}</td>
      <td>
        <div id="bed-${row.id}" style="display:flex;align-items:center;gap:4px;">
          <span id="bed-val-${row.id}" style="min-width:24px;">
            ${a?.bed_number_pma ?? '—'}
          </span>
          <button style="border:none;background:none;color:var(--text-secondary);
            cursor:pointer;font-size:11px;padding:2px 4px;"
            onclick="editBed('${row.id}', '${inc.id}')">✎</button>
        </div>
      </td>
      <td>${triageCell(inc.current_triage)}</td>
      <td>
        <div style="display:flex;align-items:center;gap:4px;">
          <div>
            <strong>${name}</strong><br>
            <span style="font-size:11px;color:var(--text-secondary);">
              Età: ${inc.patient_age ? inc.patient_age : 'nd'} Sesso: ${inc.patient_gender || 'nd'}
            </span>
          </div>
          <button style="border:none;background:none;color:var(--text-secondary);
            cursor:pointer;font-size:11px;padding:2px 4px;"
            onclick="editPatientInfo('${inc.id}', '${inc.patient_name || ''}', '${inc.patient_identifier || ''}', ${inc.patient_age || 'null'}, '${inc.patient_gender || ''}')">✎</button>
        </div>
      </td>
      <td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:default;"
        title="${a.description ?? ''}">${a.description ?? '—'}</td>
      ${buildVitalsCells(a)}
      <td>
        <button class="btn-table-action storico" onclick="openStorico('${inc.id}')">
          Storico
        </button>
      </td>
      <td>
        <button class="btn-table-action assess"
          onclick="openPMAAssessment('${row.id}', '${inc.id}')">
          ✎ Valuta
        </button>
      </td>
      <td>
        <button class="btn-table-action close"
          onclick="openClosePatient('${row.id}', '${inc.id}')">
          ✓ Chiudi
        </button>
      </td>
    </tr>`;
  }).join('');
}

function editPatientInfo(incidentId, name, identifier, age, gender) {
  // Reuse assessment modal for simplicity
  document.getElementById('assessment-modal-title').textContent = 'Modifica paziente';
  document.getElementById('assessment-modal-body').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
      <div class="input-group">
        <label for="edit-patient-name">Nome - Cognome</label>
        <input type="text" id="edit-patient-name" value="${name}" placeholder="—" />
      </div>
      <div class="input-group">
        <label for="edit-patient-id">Pettorale</label>
        <input type="text" id="edit-patient-id" value="${identifier}" placeholder="—" />
      </div>
      <div class="input-group">
        <label>Età apparente</label>
        <div style="display:flex;align-items:center;justify-content:space-between;
          border:1.5px solid var(--border-bright);border-radius:var(--radius);
          background:var(--bg-input);height:44px;padding:0 12px;margin-top:4px;">
          <span id="edit-age-display" style="font-size:16px;font-weight:bold;
            color:var(--text-primary);">${age ?? '—'}</span>
          <div style="display:flex;gap:4px;">
            <button type="button" onclick="adjustEditAge(-10)"
              style="width:36px;height:32px;border-radius:var(--radius);
                border:1px solid var(--border-bright);background:var(--bg-card);
                color:var(--text-primary);font-size:16px;font-weight:bold;cursor:pointer;">−</button>
            <button type="button" onclick="adjustEditAge(10)"
              style="width:36px;height:32px;border-radius:var(--radius);
                border:1px solid var(--border-bright);background:var(--bg-card);
                color:var(--text-primary);font-size:16px;font-weight:bold;cursor:pointer;">+</button>
          </div>
        </div>
      </div>
      <div class="input-group">
        <label>Sesso</label>
        <div style="display:flex;gap:0;border-radius:var(--radius);overflow:hidden;
          border:1.5px solid var(--border-bright);height:44px;margin-top:4px;">
          ${['M','F','Altro'].map(g => `
            <button type="button"
              class="edit-gender-btn"
              onclick="selectEditGender(this, '${g}')"
              style="flex:1;border:none;border-right:1px solid var(--border-bright);
                background:${gender === g ? 'var(--blue)' : 'var(--bg-input)'};
                color:${gender === g ? 'white' : 'var(--text-primary)'};
                font-family:var(--font);font-size:14px;font-weight:600;cursor:pointer;transition:all 0.15s;">
              ${g}</button>`).join('')}
        </div>
      </div>
    </div>
    <button class="btn-submit-incident" id="btn-save-patient-info"
      style="height:44px;font-size:13px;padding:10px;">
      Salva
    </button>`;

  window._editAge = age || null;
  window._editGender = gender || null;
  window._editIncidentId = incidentId;

  document.getElementById('btn-save-patient-info').onclick = savePatientInfo;

  const existingBtn = document.getElementById('btn-submit-pma-assessment');
  if (existingBtn) existingBtn.remove();

  openModal('modal-assessment');
}

window._editAge = null;
window._editGender = null;
window._editIncidentId = null;

function adjustEditAge(delta) {
  if (window._editAge === null) window._editAge = 50;
  else window._editAge = Math.max(0, Math.min(120, window._editAge + delta));
  document.getElementById('edit-age-display').textContent = window._editAge;
}

function selectEditGender(btn, gender) {
  window._editGender = gender;
  document.querySelectorAll('.edit-gender-btn').forEach(b => {
    b.style.background = 'var(--bg-input)';
    b.style.color = 'var(--text-primary)';
  });
  btn.style.background = 'var(--blue)';
  btn.style.color = 'white';
}

async function savePatientInfo() {
  const btn = document.getElementById('btn-save-patient-info');
  btn.disabled = true;
  btn.textContent = 'Salvataggio...';

  const { error } = await db
    .from('incidents')
    .update({
      patient_name:       document.getElementById('edit-patient-name')?.value.trim() || null,
      patient_identifier: document.getElementById('edit-patient-id')?.value.trim() || null,
      patient_age:        window._editAge,
      patient_gender:     window._editGender,
    })
    .eq('id', window._editIncidentId);

  if (error) { showToast('Errore: ' + err.message, 'error'); btn.disabled = false; btn.textContent = 'Salva'; return; }

  closeModal('modal-assessment');
  showToast('Paziente aggiornato ✓', 'success');
  await refreshPMA();
}

function renderClosed(rows) {
  const tbody = document.getElementById('tbody-closed');
  document.getElementById('count-closed').textContent = rows.length;

  if (rows.length === 0) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="16">Nessun paziente chiuso</td></tr>';
    return;
  }

  tbody.innerHTML = rows.map(row => {
    const inc  = row.incidents;
    const a    = getLatestAssessment(inc.patient_assessments);
    const time = row.released_at
      ? new Date(row.released_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
      : '—';
    const name    = inc.patient_name || inc.patient_identifier || 'Ignoto';
    const isHospital = row.outcome === 'taken_to_hospital' || 
      (row.outcome === 'handed_off' && row.handoff_to_response_id != null);
    const hospitalName = row.dest_hospital 
      || row.hospital_info?.name 
      || null;

    const outcome = isHospital
      ? `<span class="outcome-badge ospedale">🏥 Ospedalizzato${hospitalName ? ' — ' + hospitalName : ''}</span>`
      : `<span class="outcome-badge dimesso">✔ Dimesso</span>`;

    return `<tr>
      <td>${time}</td>
      <td>${triageCell(inc.current_triage)}</td>
      <td><strong>${name}</strong><br>
        <span style="font-size:11px;color:var(--text-secondary);">
          Età: ${inc.patient_age ? inc.patient_age : ''||'nd'} Sesso: ${inc.patient_gender || 'nd'}
        </span>
      </td>
      <td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:default;"
        title="${a.description ?? ''}">${a.description ?? '—'}</td>      
      ${buildVitalsCells(a)}
      <td>
        <button class="btn-table-action storico" onclick="openStorico('${inc.id}')">
          Storico
        </button>
      </td>
      <td>${outcome}</td>
      <td>
        <button class="btn-table-action receive"
          onclick="riaprePaziente('${row.id}')">
          Riapri
        </button>
      </td>
    </tr>`;
  }).join('');
}

async function riaprePaziente(responseId) {
  const { error } = await db
    .from('incident_responses')
    .update({
      outcome:     'treating',
      released_at: null,
    })
    .eq('id', responseId);

  if (error) { showToast('Errore: ' + error.message, 'error'); return; }
  showToast('Paziente riaperto ✓', 'success');
  await refreshPMA();
}

async function editBed(responseId, incidentId) {
  const span = document.getElementById('bed-val-' + responseId);
  const current = span.textContent.trim() === '—' ? '' : span.textContent.trim();
  const container = document.getElementById('bed-' + responseId);

  container.innerHTML = `
    <input type="text" id="bed-input-${responseId}"
      value="${current}" placeholder="—"
      style="width:48px;padding:4px 6px;border-radius:var(--radius);
        border:1.5px solid var(--blue);background:var(--bg-input);
        font-family:var(--font);font-size:13px;color:var(--text-primary);" />
    <button style="border:none;background:none;color:var(--green);
      cursor:pointer;font-size:14px;font-weight:bold;padding:2px 4px;"
      onclick="saveBed('${responseId}', '${incidentId}')">✓</button>
    <button style="border:none;background:none;color:var(--text-secondary);
      cursor:pointer;font-size:14px;padding:2px 4px;"
      onclick="refreshPMA()">✕</button>`;

  document.getElementById('bed-input-' + responseId).focus();
}

async function saveBed(responseId, incidentId) {
  const val = document.getElementById('bed-input-' + responseId)?.value.trim() || null;

  // Get latest assessment for this incident
  const { data: latest, error: fetchError } = await db
    .from('patient_assessments')
    .select('id')
    .eq('incident_id', incidentId)
    .order('assessed_at', { ascending: false })
    .limit(1)
    .single();

  if (fetchError || !latest) { showToast('Nessuna valutazione trovata', 'error'); return; }

  const { error } = await db
    .from('patient_assessments')
    .update({ bed_number_pma: val })
    .eq('id', latest.id);

  if (error) { showToast('Errore: ' + error.message, 'error'); return; }
  showToast('Letto aggiornato ✓', 'success');
  await refreshPMA();
}

async function openStorico(incidentId) {
  const { data: inc } = await db
    .from('incidents')
    .select(`*, patient_assessments(
      id, assessed_at, conscious, respiration, circulation,
      walking, minor_injuries, heart_rate, spo2, breathing_rate,
      blood_pressure, temperature, gcs_total, hgt, triage, description, clinical_notes,
      response_id
    )`)
    .eq('id', incidentId)
    .single();

  if (!inc) { showToast('Errore nel caricamento', 'error'); return; }

  const responseIds = [...new Set(
    (inc.patient_assessments || []).map(a => a.response_id).filter(Boolean)
  )];

  let responseResourceMap = {};
  if (responseIds.length > 0) {
    const { data: responses } = await db
      .from('incident_responses')
      .select('id, resources!incident_responses_resource_id_fkey(resource)')
      .in('id', responseIds);
    (responses || []).forEach(r => {
      responseResourceMap[r.id] = r.resources?.resource ?? '—';
    });
  }

  const assessments = (inc.patient_assessments || [])
    .map(a => ({ ...a, resourceName: responseResourceMap[a.response_id] ?? '—' }))
    .sort((a, b) => new Date(b.assessed_at) - new Date(a.assessed_at));

  document.getElementById('assessment-modal-title').textContent =
    (inc.patient_name || inc.patient_identifier || 'Paziente ignoto') + ' — Storico';

  const yn = v => v === true ? '<span class="yn-cell yes">Sì</span>'
                : v === false ? '<span class="yn-cell no">No</span>'
                : '<span class="yn-cell unknown">—</span>';

  document.getElementById('assessment-modal-body').innerHTML = assessments.length === 0
    ? '<p style="color:var(--text-secondary)">Nessuna valutazione registrata.</p>'
    : `<div style="overflow-x:auto;">
        <table class="pma-table" style="font-size:12px;">
          <thead><tr>
            <th>Ora</th><th>Squadra</th><th>Triage</th><th>Descrizione</th><th>Cosc.</th><th>Resp.</th><th>Circ.</th>
            <th>FC</th><th>FR</th><th>SpO2</th><th>PA</th><th>Temp</th><th>GCS</th><th>HGT</th>
          </tr></thead>
          <tbody>
            ${assessments.map(a => `<tr>
              <td>${new Date(a.assessed_at).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})}</td>
              <td>${a.resourceName}</td>
              <td>${triageCell(a.triage)}</td>
              <td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:default;"
                title="${a.description ?? ''}">${a.description ?? '—'}</td>
              <td>${yn(a.conscious)}</td><td>${yn(a.respiration)}</td><td>${yn(a.circulation)}</td>
              <td>${a.heart_rate ?? '—'}</td><td>${a.breathing_rate ?? '—'}</td>
              <td>${a.spo2 != null ? a.spo2+'%' : '—'}</td>
              <td>${a.blood_pressure ?? '—'}</td><td>${a.temperature ?? '—'}</td>
              <td>${a.gcs_total ?? '—'}</td><td>${a.hgt ?? '—'}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`;

  const existingBtn = document.getElementById('btn-submit-pma-assessment');
  if (existingBtn) existingBtn.remove();

  openModal('modal-assessment');
}

function updateStats(incoming, active, closed) {
  document.getElementById('stat-incoming').textContent = incoming;
  document.getElementById('stat-active').textContent   = active;
  document.getElementById('stat-closed').textContent   = closed;
}

/* ----------------------------------------------------------------
   RECEIVE PATIENT (incoming → active)
---------------------------------------------------------------- */
function openReceiveModal(fromResponseId, incidentId) {
  window._receiveFromResponseId = fromResponseId;
  window._receiveIncidentId = incidentId;

  Object.assign(PMA_FORM, {
    conscious: true, respiration: true, circulation: true,
    iv_access: null, triage: null
  });
  window._npAge = null;

  document.getElementById('assessment-modal-title').textContent = 'Ricevi paziente';
  document.getElementById('assessment-modal-body').innerHTML = buildReceiveForm();
  document.getElementById('btn-submit-receive').onclick = confirmReceivePatient;

  openModal('modal-assessment');
}

function buildReceiveForm() {
  const ynButtons = (field, label) => `
    <div class="input-group">
      <label>${label}</label>
      <div style="display:flex;gap:8px;margin-top:4px;">
        <button type="button" class="pma-yn-btn pma-yn-no ${PMA_FORM[field] === false ? 'active-no' : ''}"
          onclick="setPMAYN(this, '${field}', false)">No</button>
        <button type="button" class="pma-yn-btn pma-yn-yes ${PMA_FORM[field] === true ? 'active-yes' : ''}"
          onclick="setPMAYN(this, '${field}', true)">Sì</button>
      </div>
    </div>`;

  return `
    <div style="display:grid;grid-template-columns:3fr 1fr;gap:8px;margin-bottom:12px;align-items:stretch;">
      <div class="input-group">
        <label for="receive-description">Descrizione</label>
        <textarea id="receive-description" rows="2" placeholder="Aggiornamento situazione..."
          style="width:100%;padding:10px;border-radius:var(--radius);
          border:1.5px solid var(--border-bright);background:var(--bg-input);
          font-family:var(--font);font-size:14px;color:var(--text-primary);"></textarea>
      </div>
      <div class="input-group" style="display:flex;flex-direction:column;">
        <label for="receive-bed">Letto</label>
        <input type="text" id="receive-bed" placeholder="—"
          style="flex:1;height:100%;box-sizing:border-box;" />
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
      ${ynButtons('conscious', 'Coscienza')}
      ${ynButtons('respiration', 'Respiro')}
      ${ynButtons('circulation', 'Circolo')}
      <div class="input-group">
        <label>Triage</label>
        <div style="display:flex;gap:6px;margin-top:4px;">
          ${['white','green','yellow','red'].map(t => `
            <button type="button"
              class="pma-triage-btn ${t}"
              onclick="setPMATriage('${t}')"
              data-triage="${t}"
              style="flex:1;height:40px;border-radius:var(--radius);border:2px solid transparent;
                font-size:12px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;
                cursor:pointer;transition:all 0.15s;opacity:0.5;font-family:var(--font);">
              ${t === 'white' ? 'Bianco' : t === 'green' ? 'Verde' : t === 'yellow' ? 'Giallo' : 'Rosso'}
            </button>`).join('')}
        </div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(8,1fr);gap:8px;margin-bottom:12px;align-items:end;">
      <div class="input-group">
        <label for="receive-heart-rate">FC</label>
        <input type="number" id="receive-heart-rate" placeholder="—" min="0" max="300" />
      </div>
      <div class="input-group">
        <label for="receive-breathing-rate">FR</label>
        <input type="number" id="receive-breathing-rate" placeholder="—" min="0" max="60" />
      </div>
      <div class="input-group">
        <label for="receive-spo2">SpO2</label>
        <input type="number" id="receive-spo2" placeholder="—" min="0" max="100" />
      </div>
      <div class="input-group">
        <label for="receive-blood-pressure">PA</label>
        <input type="text" id="receive-blood-pressure" placeholder="—" />
      </div>
      <div class="input-group">
        <label for="receive-temperature">Temp</label>
        <input type="number" id="receive-temperature" placeholder="—" step="0.1" />
      </div>
      <div class="input-group">
        <label for="receive-gcs">GCS</label>
        <input type="number" id="receive-gcs" placeholder="—" min="3" max="15" />
      </div>
      <div class="input-group">
        <label for="receive-hgt">HGT</label>
        <input type="text" id="receive-hgt" placeholder="—" />
      </div>
      <div class="input-group">
        <label>Acc. venoso</label>
        <div style="display:flex;gap:4px;margin-top:4px;">
          <button type="button" class="pma-yn-btn pma-yn-no ${PMA_FORM.iv_access === false ? 'active-no' : ''}"
            style="padding:8px 6px;font-size:12px;"
            onclick="setPMAYN(this, 'iv_access', false)">No</button>
          <button type="button" class="pma-yn-btn pma-yn-yes ${PMA_FORM.iv_access === true ? 'active-yes' : ''}"
            style="padding:8px 6px;font-size:12px;"
            onclick="setPMAYN(this, 'iv_access', true)">Sì</button>
        </div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 160px;gap:8px;align-items:end;">
      <div class="input-group">
        <label for="receive-clinical-notes">Note cliniche</label>
        <textarea id="receive-clinical-notes" rows="1" placeholder="Osservazioni cliniche..."
          style="width:100%;padding:10px;border-radius:var(--radius);
          border:1.5px solid var(--border-bright);background:var(--bg-input);
          font-family:var(--font);font-size:14px;color:var(--text-primary);"></textarea>
      </div>
      <button class="btn-submit-incident" id="btn-submit-receive"
        style="height:44px;font-size:13px;padding:10px;">
        Ricevi paziente
      </button>
    </div>`;
}

async function confirmReceivePatient() {
  const btn = document.getElementById('btn-submit-receive');
  btn.disabled = true;
  btn.textContent = 'Ricezione...';

  try {
    // Handoff from field team to PMA
    const { error: handoffError } = await db.rpc('handoff_incident', {
      p_from_response_id: window._receiveFromResponseId,
      p_to_resource_id:   STATE.resource.id,
      p_to_personnel_id:  STATE.personnel?.id || null,
      p_outcome:          'taken_to_pma',
      p_notes:            null,
      p_hospital_info:    null,
    });
    if (handoffError) throw handoffError;

    // Get the new PMA response id
    const { data: newResp } = await db
      .from('incident_responses')
      .select('id')
      .eq('incident_id', window._receiveIncidentId)
      .eq('resource_id', STATE.resource.id)
      .eq('outcome', 'treating')
      .order('assigned_at', { ascending: false })
      .limit(1)
      .single();

    if (!newResp) throw new Error('Risposta PMA non trovata');

    // Insert assessment
    const { data: assessment, error: assessError } = await db
      .from('patient_assessments')
      .insert({
        incident_id:    window._receiveIncidentId,
        response_id:    newResp.id,
        assessed_by:    STATE.personnel?.id || null,
        conscious:      PMA_FORM.conscious,
        respiration:    PMA_FORM.respiration,
        circulation:    PMA_FORM.circulation,
        iv_access:      PMA_FORM.iv_access,
        triage:         PMA_FORM.triage,
        description:    document.getElementById('receive-description')?.value.trim() || null,
        clinical_notes: document.getElementById('receive-clinical-notes')?.value.trim() || null,
        heart_rate:     parseInt(document.getElementById('receive-heart-rate')?.value)     || null,
        breathing_rate: parseInt(document.getElementById('receive-breathing-rate')?.value) || null,
        spo2:           parseInt(document.getElementById('receive-spo2')?.value)           || null,
        blood_pressure: document.getElementById('receive-blood-pressure')?.value           || null,
        temperature:    parseFloat(document.getElementById('receive-temperature')?.value)  || null,
        gcs_total:      parseInt(document.getElementById('receive-gcs')?.value)            || null,
        hgt:            document.getElementById('receive-hgt')?.value                     || null,
      })
      .select('id')
      .single();
    if (assessError) throw assessError;

    // Update bed if provided
    const bedVal = document.getElementById('receive-bed')?.value.trim() || null;
    if (bedVal && assessment) {
      await db
        .from('patient_assessments')
        .update({ bed_number_pma: bedVal })
        .eq('id', assessment.id);
    }

    closeModal('modal-assessment');
    showToast('Paziente ricevuto ✓', 'success');
    await refreshPMA();

  } catch (err) {
    showToast('Errore: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Ricevi paziente';
  }
}
/* ----------------------------------------------------------------
   ASSESSMENT MODAL
---------------------------------------------------------------- */
async function openPMAAssessment(responseId, incidentId) {
  const { data: inc } = await db
      .from('incidents')
      .select(`
        *,
        patient_assessments(
          id, assessed_at, conscious, respiration, circulation,
          walking, minor_injuries, heart_rate, spo2, breathing_rate,
          blood_pressure, temperature, gcs_total, hgt, triage,
          description, clinical_notes, iv_access, bed_number_pma, response_id
        )
      `)
      .eq('id', incidentId)
      .single();
  if (!inc) { showToast('Errore nel caricamento', 'error'); return; }

  // Get resource names for each assessment via response_id
  const responseIds = [...new Set(
    (inc.patient_assessments || []).map(a => a.response_id).filter(Boolean)
  )];

  let responseResourceMap = {};
  if (responseIds.length > 0) {
    const { data: responses } = await db
      .from('incident_responses')
      .select('id, resource_id, resources!incident_responses_resource_id_fkey(resource)')
      .in('id', responseIds);
        
    (responses || []).forEach(r => {
      responseResourceMap[r.id] = r.resources?.resource ?? '—';
    });
  }
  const assessments = (inc.patient_assessments || [])
  .map(a => ({ ...a, resourceName: responseResourceMap[a.response_id] ?? '—' }))
  .sort((a, b) => new Date(b.assessed_at) - new Date(a.assessed_at));


  const latest = assessments[0] || null;
  Object.assign(PMA_FORM, {
    conscious:      latest?.conscious      ?? null,
    respiration:    latest?.respiration    ?? null,
    circulation:    latest?.circulation    ?? null,
    walking:        latest?.walking        ?? null,
    minor_injuries: latest?.minor_injuries ?? null,
    triage:         latest?.triage         ?? null,
  });

  document.getElementById('assessment-modal-title').textContent =
    inc.patient_name || inc.patient_identifier || 'Paziente ignoto';

  const body = document.getElementById('assessment-modal-body');
  body.innerHTML = buildPMAAssessmentForm(latest, assessments);

  // Wire submit
  document.getElementById('btn-submit-pma-assessment').onclick =
    () => submitPMAAssessment(responseId, incidentId);

  openModal('modal-assessment');
}

function buildPMAAssessmentForm(previous, history) {
  const yn = v => v === true ? 'Sì' : v === false ? 'No' : '—';

  const historyHTML = history.length === 0 ? '' : `
    <div style="margin-bottom:16px;">
      <div style="font-size:10px;letter-spacing:2px;color:var(--text-secondary);
        text-transform:uppercase;font-weight:700;margin-bottom:8px;">
        Storico valutazioni
      </div>
      <div style="overflow-x:auto;">
        <table class="pma-table" style="font-size:12px;">
          <thead>
            <tr>
              <th>Ora</th><th>Squadra</th><th>Triage</th><th>Descr.</th><th>Cosc.</th><th>Resp.</th>
              <th>Circ.</th><th>FC</th><th>FR</th><th>SpO2</th><th>PA</th><th>Temp</th><th>GCS</th><th>HGT</th>
            </tr>
          </thead>
          <tbody>
            ${history.map(a => `<tr>
              <td>${new Date(a.assessed_at).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})}</td>
              <td>${a.resourceName ?? '—'}</td>
              <td>${triageCell(a.triage)}</td>
              <td style="max-width:120px;overflow:hidden;text-overflow:ellipsis;">${a.description || '—'}</td>
              <td>${yn(a.conscious)}</td><td>${yn(a.respiration)}</td><td>${yn(a.circulation)}</td>
              <td>${a.heart_rate ?? '—'}</td><td>${a.breathing_rate ?? '—'}</td>
              <td>${a.spo2 != null ? a.spo2+'%' : '—'}</td>
              <td>${a.blood_pressure ?? '—'}</td><td>${a.temperature ?? '—'}</td>
              <td>${a.gcs_total ?? '—'}</td><td>${a.hgt ?? '—'}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;

  const def = previous || {
    conscious: true, respiration: true, circulation: true,
    heart_rate: null, breathing_rate: null, spo2: null,
    blood_pressure: null, temperature: null, gcs_total: null, hgt: null,
    triage: null, iv_access: null, bed_number_pma: null
  };

  const ynButtons = (field, label, required = false) => `
    <div class="input-group">
      <label>${label}${required ? '<span class="required">*</span>' : ''}</label>
      <div style="display:flex;gap:8px;margin-top:4px;">
        <button type="button" class="pma-yn-btn pma-yn-no ${def[field] === false ? 'active-no' : ''}"
          data-field="${field}" data-value="false"
          onclick="setPMAYN(this, '${field}', false)">No</button>
        <button type="button" class="pma-yn-btn pma-yn-yes ${def[field] === true ? 'active-yes' : ''}"
          data-field="${field}" data-value="true"
          onclick="setPMAYN(this, '${field}', true)">Sì</button>
      </div>
    </div>`;

  return `
    ${historyHTML}

    <div style="display:grid;grid-template-columns:3fr 1fr;gap:8px;margin-bottom:12px;align-items:stretch;">
      <div class="input-group">
        <label for="pma-description">Descrizione <span class="required">*</span></label>
        <textarea id="pma-description" rows="2" placeholder="Aggiornamento situazione..."
          style="width:100%;padding:10px;border-radius:var(--radius);
          border:1.5px solid var(--border-bright);background:var(--bg-input);
          font-family:var(--font);font-size:14px;color:var(--text-primary);"></textarea>
      </div>
      <div class="input-group" style="display:flex;flex-direction:column;">
        <label for="pma-bed">Letto</label>
        <input type="text" id="pma-bed" placeholder="—"
          value="${def.bed_number_pma || ''}"
          style="flex:1;height:100%;box-sizing:border-box;" />
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
      ${ynButtons('conscious', 'Coscienza', true)}
      ${ynButtons('respiration', 'Respiro', true)}
      ${ynButtons('circulation', 'Circolo', true)}
      <div class="input-group">
        <label>Triage</label>
        <div style="display:flex;gap:6px;margin-top:4px;">
          ${['white','green','yellow','red'].map(t => `
            <button type="button"
              class="pma-triage-btn ${t} ${def.triage === t ? 'selected' : ''}"
              onclick="setPMATriage('${t}')"
              data-triage="${t}"
              style="flex:1;height:40px;border-radius:var(--radius);border:2px solid transparent;
                font-size:12px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;
                cursor:pointer;transition:all 0.15s;opacity:0.5;font-family:var(--font);">
              ${t === 'white' ? 'Bianco' : t === 'green' ? 'Verde' : t === 'yellow' ? 'Giallo' : 'Rosso'}
            </button>`).join('')}
        </div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(8,1fr);gap:8px;margin-bottom:12px;align-items:end;">
      <div class="input-group">
        <label for="pma-heart-rate">FC</label>
        <input type="number" id="pma-heart-rate" placeholder="—"
          value="${def.heart_rate || ''}" min="0" max="300" />
      </div>
      <div class="input-group">
        <label for="pma-breathing-rate">FR</label>
        <input type="number" id="pma-breathing-rate" placeholder="—"
          value="${def.breathing_rate || ''}" min="0" max="60" />
      </div>
      <div class="input-group">
        <label for="pma-spo2">SpO2</label>
        <input type="number" id="pma-spo2" placeholder="—"
          value="${def.spo2 || ''}" min="0" max="100" />
      </div>
      <div class="input-group">
        <label for="pma-blood-pressure">PA</label>
        <input type="text" id="pma-blood-pressure" placeholder="—"
          value="${def.blood_pressure || ''}" />
      </div>
      <div class="input-group">
        <label for="pma-temperature">Temp</label>
        <input type="number" id="pma-temperature" placeholder="—"
          value="${def.temperature || ''}" step="0.1" />
      </div>
      <div class="input-group">
        <label for="pma-gcs">GCS</label>
        <input type="number" id="pma-gcs" placeholder="—"
          value="${def.gcs_total || ''}" min="3" max="15" />
      </div>
      <div class="input-group">
        <label for="pma-hgt">HGT</label>
        <input type="text" id="pma-hgt" placeholder="—"
          value="${def.hgt || ''}" />
      </div>
      <div class="input-group">
        <label>Acc. venoso</label>
        <div style="display:flex;gap:4px;margin-top:4px;">
          <button type="button" class="pma-yn-btn pma-yn-no ${def.iv_access === false ? 'active-no' : ''}"
            style="padding:8px 6px;font-size:12px;"
            onclick="setPMAYN(this, 'iv_access', false)">No</button>
          <button type="button" class="pma-yn-btn pma-yn-yes ${def.iv_access === true ? 'active-yes' : ''}"
            style="padding:8px 6px;font-size:12px;"
            onclick="setPMAYN(this, 'iv_access', true)">Sì</button>
        </div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 160px;gap:8px;margin-bottom:16px;align-items:end;">
      <div class="input-group">
        <label for="pma-clinical-notes">Note cliniche</label>
        <textarea id="pma-clinical-notes" rows="1" placeholder="Osservazioni cliniche..."
          style="width:100%;padding:10px;border-radius:var(--radius);
          border:1.5px solid var(--border-bright);background:var(--bg-input);
          font-family:var(--font);font-size:14px;color:var(--text-primary);"
          ></textarea>
      </div>
      <button class="btn-submit-incident" id="btn-submit-pma-assessment"
        style="height:44px;font-size:13px;padding:10px;">
        Salva Valutazione
      </button>
    </div>`;
}


// PMA assessment state
const PMA_FORM = {
  conscious: null, respiration: null, circulation: null,
  walking: null, minor_injuries: null, triage: null
};

function setPMAYN(btn, field, value) {
  // Toggle off if already selected
  if (PMA_FORM[field] === value) {
    PMA_FORM[field] = null;
    btn.classList.remove('active-yes', 'active-no');
    return;
  }
  PMA_FORM[field] = value;
  const parent = btn.closest('div');
  parent.querySelectorAll('.pma-yn-btn').forEach(b => {
    b.classList.remove('active-yes', 'active-no');
  });
  btn.classList.add(value ? 'active-yes' : 'active-no');
}

function setPMATriage(triage) {
  PMA_FORM.triage = triage;
  document.querySelectorAll('.pma-triage-btn').forEach(b => {
    b.classList.toggle('selected', b.dataset.triage === triage);
  });
}

async function submitPMAAssessment(responseId, incidentId) {
  const btn = document.getElementById('btn-submit-pma-assessment');

  if (PMA_FORM.conscious === null)      { showToast('Indica coscienza', 'error'); return; }
  if (PMA_FORM.respiration === null)    { showToast('Indica respirazione', 'error'); return; }
  if (PMA_FORM.circulation === null)    { showToast('Indica circolo', 'error'); return; }
  if (PMA_FORM.minor_injuries === null) { showToast('Indica problema minore', 'error'); return; }
  if (!document.getElementById('pma-description')?.value.trim()) {
    showToast('Inserisci una descrizione', 'error'); return;
  }

  btn.disabled = true;
  btn.textContent = 'Salvataggio...';

  try {
    const { error } = await db
      .from('patient_assessments')
      .insert({
        incident_id:    incidentId,
        response_id:    responseId,
        assessed_by:    STATE.personnel?.id || null,
        conscious:      PMA_FORM.conscious,
        respiration:    PMA_FORM.respiration,
        circulation:    PMA_FORM.circulation,
        walking:        PMA_FORM.walking,
        minor_injuries: PMA_FORM.minor_injuries,
        triage:         PMA_FORM.triage,
        description:    document.getElementById('pma-description')?.value.trim() || null,
        clinical_notes: document.getElementById('pma-clinical-notes')?.value.trim() || null,
        heart_rate:     parseInt(document.getElementById('pma-heart-rate')?.value)     || null,
        breathing_rate: parseInt(document.getElementById('pma-breathing-rate')?.value) || null,
        spo2:           parseInt(document.getElementById('pma-spo2')?.value)           || null,
        blood_pressure: document.getElementById('pma-blood-pressure')?.value           || null,
        temperature:    parseFloat(document.getElementById('pma-temperature')?.value)  || null,
        gcs_total:      parseInt(document.getElementById('pma-gcs')?.value)            || null,
        hgt:            document.getElementById('pma-hgt')?.value                     || null,
      });

    if (error) throw error;

    closeModal('modal-assessment');
    showToast('Valutazione salvata ✓', 'success');
    await refreshPMA();

  } catch (err) {
    showToast('Errore: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Salva Valutazione';
  }
}

/* ----------------------------------------------------------------
   CLOSE PATIENT MODAL
---------------------------------------------------------------- */
let _closePatientResponseId = null;
let _closePatientIncidentId = null;
let _closeOutcome = null;

function openClosePatient(responseId, incidentId) {
  _closePatientResponseId = responseId;
  _closePatientIncidentId = incidentId;
  _closeOutcome = null;

  document.getElementById('close-opt-dimesso').classList.remove('selected');
  document.getElementById('close-opt-ospedale').classList.remove('selected');
  document.getElementById('close-hospital-detail').style.display = 'none';

  document.getElementById('btn-confirm-close-patient').onclick = confirmClosePatient;
  openModal('modal-close-patient');
}

async function selectCloseOutcome(type) {
  _closeOutcome = type;
  document.getElementById('close-opt-dimesso')
    .classList.toggle('selected', type === 'dimesso');
  document.getElementById('close-opt-ospedale')
    .classList.toggle('selected', type === 'ospedale');
  const detail = document.getElementById('close-hospital-detail');
  document.getElementById('btn-confirm-close-patient').style.display = 'block';
  if (type === 'ospedale') {
    detail.style.display = 'flex';
    // Populate transport units
    const { data: resources } = await db
      .from('resources')
      .select('id, resource, resource_type')
      .eq('event_id', STATE.resource.event_id)
      .in('resource_type', ['ASM', 'ASI'])
      .order('resource');
    const select = document.getElementById('close-transport-unit');
    select.innerHTML = '<option value="">— Seleziona —</option>' +
      (resources || []).map(r =>
        `<option value="${r.id}">${r.resource} (${r.resource_type})</option>`
      ).join('');
  } else {
    detail.style.display = 'none';
  }
}

async function confirmClosePatient() {
  if (!_closeOutcome) { showToast('Seleziona un esito', 'error'); return; }
  const btn = document.getElementById('btn-confirm-close-patient');
  btn.disabled = true;
  btn.textContent = 'Chiusura...';

  try {
    if (_closeOutcome === 'dimesso') {
      // Direct close — no handoff needed
      const { error } = await db
        .from('incident_responses')
        .update({
          outcome:     'treated_and_released',
          released_at: new Date().toISOString(),
        })
        .eq('id', _closePatientResponseId);
      if (error) throw error;

    } else if (_closeOutcome === 'ospedale') {
     const unitId = document.getElementById('close-transport-unit')?.value;
    if (!unitId) { showToast('Seleziona unità di trasporto', 'error'); return; }

    // Handoff to transport unit — PMA closes as handed_off
    const { data: newRespData, error: handoffError } = await db.rpc('handoff_incident', {
        p_from_response_id: _closePatientResponseId,
        p_to_resource_id:   unitId,
        p_to_personnel_id:  null,
        p_outcome:          'handed_off',
        p_notes:            null,
        p_hospital_info:    null,
    });
    if (handoffError) throw handoffError;

    // Set new ambulance response to en_route_to_hospital
    const { data: newResp } = await db
        .from('incident_responses')
        .select('id')
        .eq('incident_id', _closePatientIncidentId)
        .eq('resource_id', unitId)
        .eq('outcome', 'treating')
        .order('assigned_at', { ascending: false })
        .limit(1)
        .single();

    if (newResp) {
        await db
        .from('incident_responses')
        .update({ outcome: 'en_route_to_hospital' })
        .eq('id', newResp.id);
    }
    }

    closeModal('modal-close-patient');
    showToast('Paziente chiuso ✓', 'success');
    await refreshPMA();

  } catch (err) {
    showToast('Errore: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Conferma';
  }
}

/* ----------------------------------------------------------------
   NEW PATIENT (walk-in)
---------------------------------------------------------------- */
function openNewPatientForm() {

  // Reset PMA form state
  Object.assign(PMA_FORM, {
    conscious: true, respiration: true, circulation: true, triage: null, iv_access: null
  });

  const body = document.getElementById('new-patient-body');

  body.innerHTML = buildNewPatientForm();

  const btn = document.getElementById('btn-submit-new-patient');
  btn.onclick = submitNewPatient;
  window._npAge = null;
  window._npIngresso = null;
  openModal('modal-new-patient');

}

function buildNewPatientForm() {
  const ynButtons = (field, label) => `
    <div class="input-group">
      <label>${label}</label>
      <div style="display:flex;gap:8px;margin-top:4px;">
        <button type="button" class="pma-yn-btn pma-yn-no ${PMA_FORM[field] === false ? 'active-no' : ''}"
          data-field="${field}"
          onclick="setPMAYN(this, '${field}', false)">No</button>
        <button type="button" class="pma-yn-btn pma-yn-yes ${PMA_FORM[field] === true ? 'active-yes' : ''}"
          data-field="${field}"
          onclick="setPMAYN(this, '${field}', true)">Sì</button>
      </div>
    </div>`;

  return `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
      <div class="input-group">
        <label for="np-patient-name">Nome - Cognome</label>
        <input type="text" id="np-patient-name" placeholder="—" />
      </div>
      <div class="input-group">
        <label for="np-patient-id">Pettorale</label>
        <input type="text" id="np-patient-id" placeholder="—" />
      </div>
      <div class="input-group">
        <label>Età apparente</label>
        <div style="display:flex;align-items:center;justify-content:space-between;
          border:1.5px solid var(--border-bright);border-radius:var(--radius);
          background:var(--bg-input);height:44px;padding:0 12px;margin-top:4px;">
          <span id="np-age-display" style="font-size:16px;font-weight:bold;
            color:var(--text-primary);">—</span>
          <div style="display:flex;gap:4px;">
            <button type="button" onclick="adjustNPAge(-10)"
              style="width:36px;height:32px;border-radius:var(--radius);
                border:1px solid var(--border-bright);background:var(--bg-card);
                color:var(--text-primary);font-size:16px;font-weight:bold;cursor:pointer;">−</button>
            <button type="button" onclick="adjustNPAge(10)"
              style="width:36px;height:32px;border-radius:var(--radius);
                border:1px solid var(--border-bright);background:var(--bg-card);
                color:var(--text-primary);font-size:16px;font-weight:bold;cursor:pointer;">+</button>
          </div>
        </div>
      </div>
      <div class="input-group">
        <label>Sesso</label>
        <div style="display:flex;gap:0;border-radius:var(--radius);overflow:hidden;
          border:1.5px solid var(--border-bright);height:44px;margin-top:4px;">
          ${['M','F','Altro'].map(g => `
            <button type="button"
              class="np-gender-btn"
              data-gender="${g}"
              onclick="selectNPGender(this, '${g}')"
              style="flex:1;border:none;border-right:1px solid var(--border-bright);
                background:var(--bg-input);font-family:var(--font);font-size:14px;font-weight:600;
                color:var(--text-primary);cursor:pointer;transition:all 0.15s;">
              ${g}</button>`).join('')}
        </div>
      </div>
    </div>
    <div class="input-group" style="margin-bottom:12px;">
      <label>Ingresso<span class="required">*</span></label>
      <div style="display:flex;gap:8px;margin-top:4px;">
        <button type="button" class="pma-yn-btn np-ingresso-btn"
          onclick="selectNPIngresso(this, 'autonomo')">Autonomo</button>
        <button type="button" class="pma-yn-btn np-ingresso-btn"
          onclick="selectNPIngresso(this, 'team')">Da squadra</button>
      </div>
    </div>
    <div id="np-ingresso-team-detail" style="display:none;margin-bottom:12px;">
      <div class="input-group">
        <label>Squadra <span class="required">*</span></label>
        <select id="np-ingresso-team">
          <option value="">— Seleziona —</option>
        </select>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:2fr 2fr;gap:8px;margin-bottom:12px;align-items:stretch;">
      <div class="input-group">
        <label for="np-description">Descrizione</label>
        <textarea id="np-description" rows="2" placeholder="Motivo accesso al PMA..."
          style="width:100%;padding:10px;border-radius:var(--radius);
          border:1.5px solid var(--border-bright);background:var(--bg-input);
          font-family:var(--font);font-size:14px;color:var(--text-primary);"></textarea>
      </div>
      <div class="input-group" style="display:flex;flex-direction:column;">
        <label for="np-bed">Letto</label>
        <input type="text" id="np-bed" placeholder="—" 
          style="flex:1;height:100%;box-sizing:border-box;" />
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
      ${ynButtons('conscious', 'Coscienza', true)}
      ${ynButtons('respiration', 'Respiro', true)}
      ${ynButtons('circulation', 'Circolo', true)}
      <div class="input-group">
        <label>Triage</label>
        <div style="display:flex;gap:6px;margin-top:4px;">
          ${['white','green','yellow','red'].map(t => `
            <button type="button"
              class="pma-triage-btn ${t}"
              onclick="setPMATriage('${t}')"
              data-triage="${t}"
              style="flex:1;height:40px;border-radius:var(--radius);border:2px solid transparent;
                font-size:12px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;
                cursor:pointer;transition:all 0.15s;opacity:0.5;font-family:var(--font);">
              ${t === 'white' ? 'Bianco' : t === 'green' ? 'Verde' : t === 'yellow' ? 'Giallo' : 'Rosso'}
            </button>`).join('')}
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:12px;align-items:end;">
        <div class="input-group">
          <label for="np-heart-rate">FC</label>
          <input type="number" id="np-heart-rate" placeholder="—" min="0" max="300" />
        </div>
        <div class="input-group">
          <label for="np-breathing-rate">FR</label>
          <input type="number" id="np-breathing-rate" placeholder="—" min="0" max="60" />
        </div>
        <div class="input-group">
          <label for="np-spo2">SpO2</label>
          <input type="number" id="np-spo2" placeholder="—" min="0" max="100" />
        </div>
        <div class="input-group">
          <label for="np-blood-pressure">PA</label>
          <input type="text" id="np-blood-pressure" placeholder="—" />
        </div>
        <div class="input-group">
          <label for="np-temperature">Temp</label>
          <input type="number" id="np-temperature" placeholder="—" step="0.1" />
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:16px;align-items:end;">
        <div class="input-group">
          <label for="np-gcs">GCS</label>
          <input type="number" id="np-gcs" placeholder="—" min="3" max="15" />
        </div>
        <div class="input-group">
          <label for="np-hgt">HGT</label>
          <input type="text" id="np-hgt" placeholder="—" />
        </div>
        <div class="input-group">
          <label>Accesso venoso</label>
          <div style="display:flex;gap:8px;margin-top:4px;">
            <button type="button" class="pma-yn-btn pma-yn-no"
              onclick="setPMAYN(this, 'iv_access', false)">No</button>
            <button type="button" class="pma-yn-btn pma-yn-yes"
              onclick="setPMAYN(this, 'iv_access', true)">Sì</button>
          </div>
        </div>
      </div>
    </div>        
    <div style="display:grid;grid-template-columns:2fr 2fr;gap:8px;margin-bottom:16px;align-items:end;">
      <div class="input-group">
        <label for="np-clinical-notes">Note cliniche</label>
        <textarea id="np-clinical-notes" rows="1" placeholder="Osservazioni cliniche..."
          style="width:100%;padding:10px;border-radius:var(--radius);
          border:1.5px solid var(--border-bright);background:var(--bg-input);
          font-family:var(--font);font-size:14px;color:var(--text-primary);"></textarea>
      </div>
      <button class="btn-submit-incident" id="btn-submit-new-patient"
        style="min-width:140px;font-size:13px;padding:10px;height:44px;">
        Registra Paziente
      </button>
    </div>
    `;
}

window._npAge = null;
function selectNPGender(btn, gender) {
  document.querySelectorAll('.np-gender-btn').forEach(b => b.classList.remove('np-active'));
  btn.classList.add('np-active');
  window._npGender = gender;
}

window._npAge = null;

function adjustNPAge(delta) {
  if (window._npAge === null) window._npAge = 50;
  else window._npAge = Math.max(0, Math.min(120, window._npAge + delta));
  document.getElementById('np-age-display').textContent = window._npAge;
}


window._npIngresso = null;
async function selectNPIngresso(btn, type) {
  // Toggle off if already selected
  if (window._npIngresso === type) {
    window._npIngresso = null;
    btn.classList.remove('active-yes');
    document.getElementById('np-ingresso-team-detail').style.display = 'none';
    return;
  }

  window._npIngresso = type;
  // Deselect all ingresso buttons
  document.querySelectorAll('.np-ingresso-btn').forEach(b => b.classList.remove('active-yes'));
  btn.classList.add('active-yes');

  const detail = document.getElementById('np-ingresso-team-detail');
  if (type === 'team') {
    detail.style.display = 'block';
    const { data: resources } = await db
      .from('resources')
      .select('id, resource, resource_type')
      .eq('event_id', STATE.resource.event_id)
      .in('resource_type', ['ASM', 'ASI', 'SAP', 'BICI', 'MM'])
      .order('resource');
    document.getElementById('np-ingresso-team').innerHTML =
      '<option value="">— Seleziona —</option>' +
      (resources || []).map(r =>
        `<option value="${r.id}">${r.resource} (${r.resource_type})</option>`
      ).join('');
  } else {
    detail.style.display = 'none';
  }
}

async function submitNewPatient() {
  const btn = document.getElementById('btn-submit-new-patient');

  if (PMA_FORM.conscious === null)   { showToast('Indica coscienza', 'error'); return; }
  if (PMA_FORM.respiration === null) { showToast('Indica respirazione', 'error'); return; }
  if (PMA_FORM.circulation === null) { showToast('Indica circolo', 'error'); return; }
  if (!window._npIngresso) { showToast('Seleziona tipo di ingresso', 'error'); return; }


  btn.disabled = true;
  btn.textContent = 'Registrazione...';

  try {
    const params = {
      p_event_id:        STATE.resource.event_id,
      p_resource_id:     STATE.resource.id,
      p_personnel_id:    STATE.personnel?.id || null,
      p_incident_type:   'medical',
      p_lng:             null,
      p_lat:             null,
      p_patient_name:    document.getElementById('np-patient-name')?.value.trim() || null,
      p_patient_age: window._npAge,
      p_patient_gender:  window._npGender || null,
      p_patient_identifier: document.getElementById('np-patient-id')?.value.trim() || null,
      p_description:     document.getElementById('np-description')?.value.trim() || null,
      p_initial_outcome: 'treating',
      p_conscious:       PMA_FORM.conscious,
      p_respiration:     PMA_FORM.respiration,
      p_circulation:     PMA_FORM.circulation,
      p_walking:         PMA_FORM.walking,
      p_minor_injuries:  PMA_FORM.minor_injuries,
      p_heart_rate:      parseInt(document.getElementById('np-heart-rate')?.value)     || null,
      p_spo2:            parseInt(document.getElementById('np-spo2')?.value)           || null,
      p_breathing_rate:  parseInt(document.getElementById('np-breathing-rate')?.value) || null,
      p_blood_pressure:  document.getElementById('np-blood-pressure')?.value           || null,
      p_temperature:     parseFloat(document.getElementById('np-temperature')?.value)  || null,
      p_triage:          PMA_FORM.triage,
      p_clinical_notes:  document.getElementById('np-clinical-notes')?.value.trim()   || null,
    };

    const { data, error } = await db.rpc('create_incident_with_assessment', params);
    if (error) throw error;

    //Save bed number if provided
    const bedVal = document.getElementById('np-bed')?.value.trim() || null;
    if (bedVal && data?.response_id) {
      // Get the assessment that was just created
      const { data: assessment } = await db
        .from('patient_assessments')
        .select('id')
        .eq('incident_id', data.incident_id)
        .order('assessed_at', { ascending: false })
        .limit(1)
        .single();

      if (assessment) {
        await db
          .from('patient_assessments')
          .update({ bed_number_pma: bedVal })
          .eq('id', assessment.id);
      }
    }

    // If patient came from a team, create their response as taken_to_pma
    if (window._npIngresso === 'team') {
      const teamId = document.getElementById('np-ingresso-team')?.value;
      if (teamId && data?.incident_id) {
        await db.from('incident_responses').insert({
          event_id:    STATE.resource.event_id,
          incident_id: data.incident_id,
          resource_id: teamId,
          role:        'first_responder',
          outcome:     'taken_to_pma',
          dest_pma_id: STATE.resource.id,
          assigned_at: new Date().toISOString(),
          released_at: new Date().toISOString(),
        });
      }
    }
    closeModal('modal-new-patient');
    showToast('Paziente registrato ✓', 'success');
    await refreshPMA();

  } catch (err) {
    showToast('Errore: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Registra Paziente';
  }
}