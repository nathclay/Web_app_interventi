/* ================================================================
   js/views/pca-hospital.js  —  Ospedalizzazioni page
================================================================ */

async function mountOspedalizzazioni(container) {
  container.innerHTML = `
    <div class="hospital-page">
      <div class="hospital-header">
        <h2 class="hospital-title">Ospedalizzazioni</h2>
        <span class="hospital-updated" id="hospital-updated">—</span>
      </div>
      <div class="hospital-body" id="hospital-body">
        <div class="empty-state">Caricamento...</div>
      </div>
    </div>`;
  await renderOspedalizzazioni();
}

async function renderOspedalizzazioni() {
  const body = document.getElementById('hospital-body');
  if (!body) return;

  // Fetch all hospital responses
  const { data: responses, error } = await db
    .from('incident_responses')
    .select(`
      id, outcome, assigned_at, released_at, dest_hospital, hospital_info, gipse, notes,
      incident_id,
      incidents(
        id, patient_name, patient_identifier, patient_age, patient_gender, current_triage
      ),
      resources!incident_responses_resource_id_fkey(id, resource, resource_type)
    `)
    .eq('event_id', PCA.eventId)
    .in('outcome', ['taken_to_hospital', 'en_route_to_hospital'])
    .order('assigned_at', { ascending: false });

  if (error) {
    body.innerHTML = `<div class="empty-state">Errore: ${error.message}</div>`;
    return;
  }

  // Fetch latest assessment per incident
  const incidentIds = [...new Set((responses || []).map(r => r.incident_id).filter(Boolean))];
  let assessmentMap = {};
  if (incidentIds.length > 0) {
    const { data: assessments } = await db
      .from('patient_assessments')
      .select('incident_id, assessed_at, triage, heart_rate, spo2, breathing_rate, blood_pressure, temperature, gcs_total, hgt, iv_access')
      .in('incident_id', incidentIds)
      .order('assessed_at', { ascending: false });

    // Keep only latest per incident
    (assessments || []).forEach(a => {
      if (!assessmentMap[a.incident_id]) assessmentMap[a.incident_id] = a;
    });
  }

  const updatedEl = document.getElementById('hospital-updated');
  if (updatedEl) updatedEl.textContent =
    `Aggiornato alle ${formatTime(new Date().toISOString())}`;

  const rows = responses || [];
  const inProgress = rows.filter(r => r.outcome === 'en_route_to_hospital');
  const completed  = rows.filter(r => r.outcome === 'taken_to_hospital');

  body.innerHTML = `
    <div class="hospital-section">
      <div class="hospital-section-header">
        <span class="hospital-section-title">In trasporto</span>
        <span class="side-badge">${inProgress.length}</span>
      </div>
      ${buildHospitalTable(inProgress, assessmentMap)}
    </div>
    <div class="hospital-section" style="margin-top:24px;">
      <div class="hospital-section-header">
        <span class="hospital-section-title">Ospedalizzati</span>
        <span class="side-badge">${completed.length}</span>
      </div>
      ${buildHospitalTable(completed, assessmentMap)}
    </div>`;
}

function buildHospitalTable(rows, assessmentMap) {
  if (rows.length === 0) {
    return '<div class="empty-state" style="padding:12px;">Nessun paziente</div>';
  }

  const triageLabels = { red:'Rosso', yellow:'Giallo', green:'Verde', white:'Bianco' };
  const yn = v => v === true ? 'Sì' : v === false ? 'No' : '—';

  const cells = rows.map(r => {
    const inc = r.incidents;
    const a   = assessmentMap[r.incident_id];
    const hospital = r.dest_hospital || r.hospital_info?.name || '—';
    const time     = formatTime(r.released_at || r.assigned_at);
    const triage   = inc?.current_triage;

    return `
      <tr class="hospital-row" onclick="openIncidentDetailModal('${inc?.id}')">
        <td>${time}</td>
        <td>${r.resources?.resource || '—'}</td>
        <td>${hospital}</td>
        <td>${r.gipse || '—'}</td>
        <td>
          <div class="h-patient-name">${inc?.patient_name || '—'}</div>
          <div class="h-patient-meta">
            ${[inc?.patient_age ? inc.patient_age + ' anni' : null,
               inc?.patient_gender,
               inc?.patient_identifier
              ].filter(Boolean).join(' · ')}
          </div>
        </td>
        <td>${triage ? `<span class="triage-pill ${triage}">${triageLabels[triage]}</span>` : '—'}</td>
        <td>${a?.heart_rate     || '—'}</td>
        <td>${a?.spo2           != null ? a.spo2 + '%' : '—'}</td>
        <td>${a?.breathing_rate || '—'}</td>
        <td>${a?.blood_pressure || '—'}</td>
        <td>${a?.temperature    != null ? a.temperature + '°' : '—'}</td>
        <td>${a?.gcs_total      || '—'}</td>
        <td>${a?.hgt            || '—'}</td>
        <td>${a?.iv_access      != null ? yn(a.iv_access) : '—'}</td>
      </tr>`;
  }).join('');

  return `
    <div class="hospital-table-wrapper">
      <table class="hospital-table">
        <thead>
          <tr>
            <th>Ora</th>
            <th>Risorsa</th>
            <th>Ospedale</th>
            <th>GIPSE</th>
            <th>Paziente</th>
            <th>Triage</th>
            <th>FC</th>
            <th>SpO2</th>
            <th>FR</th>
            <th>PA</th>
            <th>Temp</th>
            <th>GCS</th>
            <th>HGT</th>
            <th>Acc. Ven.</th>
          </tr>
        </thead>
        <tbody>${cells}</tbody>
      </table>
    </div>`;
}