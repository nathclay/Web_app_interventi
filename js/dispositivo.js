/* ================================================================
   js/dispositivo.js — view layer
   All DB calls → rpc-dispositivo.js
================================================================ */

// Left = value in DB, Right = display label
const COMITATO_MAP = {
  "Comitato dell'Area Metropolitana di Roma Capitale": "AMRC",
  "Comitato Municipio 2-3 di Roma":    "Roma 2-3",
  "Comitato Municipio 4 di Roma":      "Roma 4",
  "Comitato Municipio 5 di Roma":      "Roma 5",
  "Comitato Municipio 5 Roma":         "Roma 5",
  "Comitato Municipio 6 di Roma":      "Roma 6",
  "Comitato Municipio 7 di Roma":      "Roma 7",
  "Comitato Municipio 8-11-12 di Roma":"Roma 8-11-12",
  "Comitato Municipio 8-11-12 Roma":   "Roma 8-11-12",
  "Comitato Municipio 9 di Roma":      "Roma 9",
  "Comitato Municipio 10 di Roma":     "Roma 10",
  "Comitato Municipio 13-14 di Roma":  "Roma 13-14",
  "Comitato Municipio 15 di Roma":     "Roma 15",
  "Comitato di Allumiere e Tolfa":     "Allumiere e Tolfa",
  "Comitato di Anzio - Nettuno":       "Anzio - Nettuno",
  "Comitato di Ardea":                 "Ardea",
  "Comitato di Bellegra":              "Bellegra",
  "Comitato di Ciampino":              "Ciampino",
  "Comitato di Civitavecchia":         "Civitavecchia",
  "Comitato di Fiumicino":             "Fiumicino",
  "Comitato di Formello":              "Formello",
  "Comitato di Gabio":                 "Gabio",
  "Comitato di Guidonia":              "Guidonia",
  "Comitato di Monterotondo - ODV":    "Monterotondo",
  "Comitato di Monti Prenestini":      "Monti Prenestini",
  "Comitato di Morlupo":               "Morlupo",
  "Comitato di Nomentum":              "Nomentum",
  "Comitato di Pomezia":               "Pomezia",
  "Comitato di Sabatino":              "Sabatino",
  "Comitato di Sabina Romana":         "Sabina Romana",
  "Comitato di Santa Severa – Santa Marinella": "Santa Severa – Santa Marinella",
  "Comitato di Valle Del Sacco":       "Valle del Sacco",
  "Comitato di Valle Del Tevere":      "Valle del Tevere",
  "Comitato di Valle dell'aniene":     "Valle dell'Aniene",
  "Comitato di Valmontone":            "Valmontone",
  "Comitato di Velletri":              "Velletri",
  "Comitato dei Colli Albani":         "Colli Albani",
  "Comitato Dei Comuni dell'Appia":    "Comuni dell'Appia",
  "Comitato Tusculum":                 "Tusculum",
};

// Short names that already exist as-is in the DB (no mapping needed)
const COMITATO_PASSTHROUGH = [
  "AMRC","Capena","Frascati","Genazzano","Grottaferrata",
  "Manziana","Mazzano Romano","Montorio Romano","Nazzano",
  "Olevano Romano","San Cesareo","San Vito Romano",
];

const COMITATO_OPTIONS = [
  "AMRC",
  "Roma 2-3","Roma 4","Roma 5","Roma 6","Roma 7",
  "Roma 8-11-12","Roma 9","Roma 10","Roma 13-14","Roma 15",
  "Allumiere e Tolfa","Anzio - Nettuno","Ardea","Bellegra",
  "Capena","Ciampino","Civitavecchia","Colli Albani","Comuni dell'Appia",
  "Fiumicino","Formello","Frascati","Gabio","Genazzano",
  "Grottaferrata","Guidonia","Manziana","Mazzano Romano",
  "Monterotondo","Monti Prenestini","Montorio Romano","Morlupo",
  "Nazzano","Nomentum","Olevano Romano","Pomezia",
  "Sabatino","Sabina Romana","San Cesareo","San Vito Romano",
  "Santa Severa – Santa Marinella","Tusculum",
  "Valle del Sacco","Valle del Tevere","Valle dell'Aniene","Valmontone","Velletri",
  "Coop Adigea","Coop Professional","Dipendente","Partita Iva",
];

const COMITATO_REVERSE_MAP = Object.fromEntries(
  Object.entries(COMITATO_MAP).map(([db, display]) => [display, db])
);

function displayComitato(val) {
  if (!val) return '';
  const trimmed = val.trim();
  // Already a short/passthrough value
  if (COMITATO_OPTIONS.includes(trimmed)) return trimmed;
  if (COMITATO_PASSTHROUGH.includes(trimmed)) return trimmed;
  return COMITATO_MAP[trimmed] || trimmed;
}

function toDB_Comitato(displayVal) {
  if (!displayVal) return null;
  // If it's a passthrough value, store as-is
  if (COMITATO_PASSTHROUGH.includes(displayVal)) return displayVal;
  // Convert short → long if mapping exists
  return COMITATO_REVERSE_MAP[displayVal] || displayVal;
}


/* ── App state ─────────────────────────────────────────────────*/
const DISP = {
  user: null, event: null, eventId: null,
  session: 1, sessions: [],
  competenzaFilter: null,
  resourceDays: [], personnel: [], requirements: {},
  allResources: [], allResourceDays: [],
  _currentPage: 'ricerca',
  _importRows: [],
};

/* Modal context — shared across the two-step assignment flow */
const CTX = {
  step: 1,               // 1 = anagrafica, 2 = assignment
  anagraficaId:   null,  // existing anagrafica (null = create new)
  personnelId:    null,  // existing personnel row (null = new assignment)
  resourceDayId:  null,
  suggestedRole:  null,
  anaData:        null,  // staged anagrafica form values
};

/* ── Constants ─────────────────────────────────────────────────*/
const STATUS_LABELS = { scheduled:'Pianificato', activated:'Attivato', cancelled:'Annullato', no_show:'Assente' };
const STATUS_COLORS = { scheduled:'transparent', activated:'rgba(63,185,80,0.20)', cancelled:'rgba(226,75,74,0.20)', no_show:'rgba(72,79,88,0.30)' };
const COMP_COLORS   = { SOP:'#58a6ff', Sala_Roma:'#f0883e', SOR:'#bc8cff' };
const ALL_ROLES     = ['autista','infermiere','medico','soccorritore','coordinatore','volontario_generico','opem','tlc','logista','sep','droni'];
const ROLE_LABELS   = { autista:'Autista', infermiere:'Infermiere', medico:'Medico', soccorritore:'Soccorritore', coordinatore:'Coordinatore', volontario_generico:'Volontario', opem:'OPEM', tlc:'TLC', logista:'Logista', sep:'SEP', droni:'Droni' };
const TYPE_ORDER    = ['ASM','MM','ASI','PMA','SAP','BICI','LDC','PCA'];

/* ================================================================
   INIT & AUTH
================================================================ */
async function initDispositivo() {
  document.querySelectorAll('[data-modal]').forEach(btn =>
    btn.addEventListener('click', () => closeModal(btn.dataset.modal))
  );
  const user = await getDispositivoUser();
  if (!user) { showScreen('screen-login'); wireLoginForm(); return; }
  DISP.user = user;
  await afterLogin();
}

function wireLoginForm() {
  const login = () => {
    const email = document.getElementById('login-email').value.trim();
    const pw    = document.getElementById('login-password').value;
    const errEl = document.getElementById('login-error');
    errEl.textContent = '';
    if (!email || !pw) { errEl.textContent = 'Inserisci email e password.'; return; }
    signInWithEmail(email, pw)
      .then(u => { DISP.user = u; afterLogin(); })
      .catch(err => { errEl.textContent = err.message; });
  };
  document.getElementById('btn-login').addEventListener('click', login);
  document.getElementById('login-password').addEventListener('keydown', e => { if (e.key==='Enter') login(); });
  document.getElementById('btn-google')?.addEventListener('click', () =>
    signInWithGoogle().catch(err => { document.getElementById('login-error').textContent = err.message; })
  );
}

async function afterLogin() {
  document.getElementById('header-user').textContent = DISP.user.email || '';
  document.getElementById('btn-logout').addEventListener('click', async () => { await signOut(); location.reload(); });
  document.querySelectorAll('.sidebar-item[data-page]').forEach(btn =>
    btn.addEventListener('click', () => navigateTo(btn.dataset.page))
  );
  try {
    const events = await fetchActiveEvents();
    if (!events.length) { showToast('Nessun evento trovato', 'error'); return; }
    if (events.length === 1) { await selectEvent(events[0]); }
    else { renderEventSelector(events); showScreen('screen-event'); }
  } catch (err) { showToast(err.message, 'error'); }
}

function renderEventSelector(events) {
  document.getElementById('event-list').innerHTML = events.map((ev, i) => `
    <div class="event-card" data-idx="${i}">
      <div class="event-card-name">${ev.name}</div>
      <div class="event-card-meta">
        ${ev.is_active ? '<span class="badge-active">● Attivo</span>' : '<span class="badge-inactive">○ Non attivo</span>'}
        · Sessione ${ev.current_session}
      </div>
    </div>`).join('');
  document.querySelectorAll('.event-card').forEach((c, i) =>
    c.addEventListener('click', () => selectEvent(events[i]))
  );
}

async function selectEvent(event) {
  DISP.event = event; DISP.eventId = event.id;
  document.getElementById('header-event-name').textContent = event.name.toUpperCase();
  showScreen('screen-main');
  await loadBaseData();
  await navigateTo('ricerca');
}

async function loadBaseData() {
  const [sessions, allResources, allResourceDays] = await Promise.all([
    fetchSessionsForEvent(DISP.eventId),
    fetchAllResources(DISP.eventId),
    fetchAllResourceDays(DISP.eventId),
  ]);
  DISP.sessions = sessions; DISP.session = sessions[0]?.session || 1;
  DISP.allResources = allResources; DISP.allResourceDays = allResourceDays;
}

/* ================================================================
   DATA LOADING (shared between views)
================================================================ */
async function loadSessionData() {
  const [resourceDays, personnel, requirements] = await Promise.all([
    fetchResourceDaysForSession(DISP.eventId, DISP.session),
    fetchPersonnelForSession(DISP.eventId, DISP.session),
    fetchRequirements(),
  ]);
  DISP.resourceDays = resourceDays;
  DISP.personnel    = personnel;
  DISP.requirements = requirements;
}
 
async function reloadPersonnel() {
  DISP.personnel = await fetchPersonnelForSession(DISP.eventId, DISP.session);
}

/* ================================================================
   ROUTER
================================================================ */
async function navigateTo(page) {
  DISP._currentPage = page;
  document.querySelectorAll('.sidebar-item[data-page]').forEach(btn =>
    btn.classList.toggle('active', btn.dataset.page === page)
  );
  const content = document.getElementById('page-content');
  content.innerHTML = '<div class="loading-spinner"><div class="spinner"></div><span>Caricamento...</span></div>';
  try {
    if      (page === 'ricerca')        await mountRicerca(content);
    else if (page === 'attivazioni')    await mountAttivazioni(content);
    else if (page === 'coordinamento')  await mountCoordinamento(content);
    else if (page === 'impostazioni')   await mountImpostazioni(content);
  } catch (err) {
    console.error(err);
    content.innerHTML = `<div class="empty-state">Errore: ${err.message}</div>`;
  }
}

/* ================================================================
   TWO-STEP ASSIGNMENT MODAL
================================================================ */
function openAssignmentFlow(resourceDayId, role, startHint, endHint) {
  CTX.anagraficaId  = null;
  CTX.personnelId   = null;
  CTX.resourceDayId = resourceDayId;
  CTX.suggestedRole = role || null;
  CTX.startHint     = startHint || null;
  CTX.endHint       = endHint   || null;

  openSearchModal();
}

function openSearchModal() {
  document.getElementById('search-surname').value = '';
  document.getElementById('search-name').value    = '';
  document.getElementById('search-cf').value      = '';
  document.getElementById('search-phone').value = '';
  document.getElementById('search-results').innerHTML = '';


  document.getElementById('btn-new-anagrafica').onclick = () => {
    closeModal('modal-search');
    CTX.anagraficaId = null;
    openStep1();
  };

  const doSearch = async () => {
    const surname = document.getElementById('search-surname').value.trim();
    const name    = document.getElementById('search-name').value.trim();
    const cf      = document.getElementById('search-cf').value.trim().toUpperCase();
    const phone = document.getElementById('search-phone').value.replace(/\s+/g, '');
    if (!surname && !name && !cf && !phone) {
      document.getElementById('search-results').innerHTML = '';
      return;
    }
    try {
      const results = await searchAnagrafica({ surname, name, cf, phone });
      renderSearchResults(document.getElementById('search-results'), results);
    } catch (err) { console.error(err); }
  };

  let _deb;
  const debounced = () => { clearTimeout(_deb); _deb = setTimeout(doSearch, 250); };

  document.getElementById('search-surname').oninput = debounced;
  document.getElementById('search-name').oninput    = debounced;
  document.getElementById('search-cf').oninput      = debounced;
  document.getElementById('search-phone').oninput = debounced;

  openModal('modal-search');
  setTimeout(() => document.getElementById('search-surname').focus(), 80);
}

function selectFromSearch(anagraficaId) {
  CTX.anagraficaId = anagraficaId;
  closeModal('modal-search');
  openStep1(anagraficaId);
}

function renderSearchResults(container, results) {
  if (!results.length) { container.innerHTML = '<div class="search-empty">Nessun risultato</div>'; return; }
  container.innerHTML = results.map(a => {
    const comp = a.competenza_attivazione;
    return `
      <div class="search-row" onclick="selectFromSearch('${a.id}')">
        <div class="search-name">${a.surname} ${a.name}</div>
        <div class="search-meta">
          ${displayComitato(a.comitato) || ''}
        </div>
      </div>`;
  }).join('');
}

/* ── STEP 1: ───────────────────────────────────────*/
async function openStep1(anagraficaId) {
  let prefill = {};
  if (anagraficaId) {
    try {
      prefill = await fetchAnagraficaById(anagraficaId);
      CTX._prefillComp = prefill.competenza_attivazione || null;
    } catch {}
  } else if (CTX.personnelId) {
    const p = DISP.personnel.find(p => p.id === CTX.personnelId);
    if (p?.anagrafica) {
      prefill = p.anagrafica;
      CTX._prefillComp = p.competenza_attivazione || p.anagrafica?.competenza_attivazione || null;
    }
  }
 
  CTX.step = 1;
 
  document.getElementById('assign-modal-title').textContent =
    CTX.personnelId ? 'Modifica personale' : 'Aggiungi personale';
 
  document.getElementById('assign-step-indicator').innerHTML = `
    <span class="step active">1 · Anagrafica</span>
    <span class="step-arrow">›</span>
    <span class="step">2 · Assegnazione</span>`;
 
  document.getElementById('assign-modal-body').innerHTML = renderStep1Form(prefill);
 
  // Strip and rewire buttons to avoid duplicate listeners
  const nextBtn = document.getElementById('assign-next');
  const freshNext = nextBtn.cloneNode(true);
  nextBtn.replaceWith(freshNext);
  document.getElementById('assign-next').style.display  = '';
  document.getElementById('assign-next').textContent    = 'Avanti ›';
  document.getElementById('assign-next').onclick        = handleStep1Next;
 
  document.getElementById('assign-back').style.display    = 'none';
  document.getElementById('assign-confirm').style.display = 'none';
 
  // Delete/cancel button
  const delBtn = document.getElementById('assign-delete');
  if (CTX.personnelId) {
    delBtn.style.display = '';
    delBtn.textContent   = 'Annulla assegnazione';
    delBtn.onclick       = () => cancelPersonnel(CTX.personnelId);
  } else {
    delBtn.style.display = 'none';
  }
 
  openModal('modal-assign');
}

function renderStep1Form(p) {
  return `
    <div class="form-row">
      <div class="form-group"><label>Nome <span class="req">*</span></label>
        <input type="text" id="s1-name" value="${p.name||''}" /></div>
      <div class="form-group"><label>Cognome <span class="req">*</span></label>
        <input type="text" id="s1-surname" value="${p.surname||''}" /></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Codice Fiscale</label>
        <input type="text" id="s1-cf" value="${p.cf||''}" style="text-transform:uppercase" /></div>
      <div class="form-group"><label>Telefono<span class="req">*</span></label>
        <input type="tel" id="s1-number" value="${p.number||''}" /></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Email</label>
        <input type="email" id="s1-email" value="${p.email||''}" /></div>
      <div class="form-group"><label>Qualifiche</label>
        <input type="text" id="s1-qual" value="${p.qualifications||''}" placeholder="BLSD, PTCA…" /></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>ICE (contatto emergenza)</label>
        <input type="text" id="s1-ice" value="${p.ice||''}" placeholder="Nome, tel" /></div>
      <div class="form-group"><label>Allergie / patologie note</label>
        <input type="text" id="s1-allergies" value="${p.allergies||''}" /></div>
    </div>
    <div class="form-group"><label>Comitato<span class="req">*</span></label>
      <select id="s1-comitato" onchange="onComitatoChange()">
        <option value="">— Seleziona —</option>
        ${COMITATO_OPTIONS.map(c =>
          `<option value="${c}" ${displayComitato(p.comitato) === c ? 'selected' : ''}>${c}</option>`
        ).join('')}
        <option value="__altro__"
          ${p.comitato && !COMITATO_OPTIONS.includes(displayComitato(p.comitato)) ? 'selected' : ''}>
          Altro...
        </option>
      </select>
      <input type="text" id="s1-comitato-custom"
        placeholder="Inserisci comitato"
        value="${p.comitato && !COMITATO_OPTIONS.includes(displayComitato(p.comitato)) ? displayComitato(p.comitato) : ''}"
        style="${p.comitato && !COMITATO_OPTIONS.includes(displayComitato(p.comitato)) ? '' : 'display:none'}" />
    </div>
    <div id="s1-error" class="error-msg"></div>`;
}

function onComitatoChange() {
  const sel    = document.getElementById('s1-comitato');
  const custom = document.getElementById('s1-comitato-custom');
  if (!sel || !custom) return;
  if (sel.value === '__altro__') {
    custom.style.display = '';
    custom.focus();
  } else {
    custom.style.display = 'none';
    custom.value = '';
  }
}

async function handleStep1Next() {
  const name     = document.getElementById('s1-name').value.trim();
  const surname  = document.getElementById('s1-surname').value.trim();
  const number   = document.getElementById('s1-number').value.replace(/\s+/g, ''); // strip spaces
  const selCom   = document.getElementById('s1-comitato');
  const comitato = selCom.value === '__altro__'
    ? (document.getElementById('s1-comitato-custom').value.trim() || null)
    : (selCom.value || null);

  const errEl = document.getElementById('s1-error');
  errEl.textContent = '';

  if (!name)     { errEl.textContent = 'Nome obbligatorio.';     return; }
  if (!surname)  { errEl.textContent = 'Cognome obbligatorio.';  return; }
  if (!number)   { errEl.textContent = 'Telefono obbligatorio.'; return; }
  if (!comitato) { errEl.textContent = 'Comitato obbligatorio.'; return; }

  CTX.anaData = {
    name, surname,
    cf:                    document.getElementById('s1-cf').value.trim().toUpperCase() || null,
    number,                // already stripped
    email:                 document.getElementById('s1-email').value.trim() || null,
    qualifications:        document.getElementById('s1-qual').value.trim() || null,
    ice:           document.getElementById('s1-ice').value.trim() || null,
    allergies:             document.getElementById('s1-allergies').value.trim() || null,
    comitato: toDB_Comitato(comitato),
    competenza_attivazione: CTX._prefillComp || null,
  };

  openStep2();
}

/* ── STEP 2: ────────────────────────────────*/
function openStep2() {
  CTX.step = 2;
 
  const existing = CTX.personnelId
    ? DISP.personnel.find(p => p.id === CTX.personnelId)
    : null;
 
  const rd      = DISP.resourceDays.find(r => r.resource_day_id === CTX.resourceDayId);
  const rdStart = rd?.rd_start || rd?.start_time;
  const rdEnd   = rd?.rd_end   || rd?.end_time;
  const turni   = computeTurni(rdStart, rdEnd);
 
  document.getElementById('assign-step-indicator').innerHTML = `
    <span class="step">1 · Anagrafica</span>
    <span class="step-arrow">›</span>
    <span class="step active">2 · Assegnazione</span>`;
 
  document.getElementById('assign-modal-body').innerHTML =
    renderStep2Form(existing, turni, rdStart, rdEnd);
 
  // Back button
  const backBtn = document.getElementById('assign-back');
  const freshBack = backBtn.cloneNode(true);
  backBtn.replaceWith(freshBack);
  document.getElementById('assign-back').style.display = '';
  document.getElementById('assign-back').onclick       = () => openStep1(CTX.anagraficaId);
 
  document.getElementById('assign-next').style.display = 'none';
 
  // Confirm button
  const confirmBtn = document.getElementById('assign-confirm');
  const freshConfirm = confirmBtn.cloneNode(true);
  confirmBtn.replaceWith(freshConfirm);
  document.getElementById('assign-confirm').style.display = '';
  document.getElementById('assign-confirm').textContent   = CTX.personnelId ? 'Salva' : 'Conferma';
  document.getElementById('assign-confirm').onclick       = handleConfirm;
 
  wireStep2();
}
 
function renderStep2Form(existing, turni, rdStart, rdEnd) {
  const e      = existing || {};
  const ana    = e.anagrafica || CTX.anaData || {};
  const startT = parseTime(e.scheduled_start) || CTX.startHint || '';
  const endT   = parseTime(e.scheduled_end)   || CTX.endHint   || '';
  const partenza = e.partenza || '';

  const turniOpts = turni
    ? turni.map(t =>
        `<option value="${t.start}|${t.end}" ${startT===t.start&&endT===t.end ? 'selected' : ''}>${t.label}</option>`
      ).join('')
    : '';

  // Only show time inputs if explicitly personalizzato
  const isCustom = startT && !turni?.find(t => t.start === startT && t.end === endT);

  return `
    <div class="form-row">
      <div class="form-group"><label>Ruolo <span class="req">*</span></label>
        <select id="s2-role">
          ${ALL_ROLES.map(r =>
            `<option value="${r}" ${(e.role||CTX.suggestedRole)===r ? 'selected' : ''}>${ROLE_LABELS[r]}</option>`
          ).join('')}
        </select>
      </div>
      <div class="form-group"><label>Competenza attivazione</label>
        <select id="s2-comp">
          <option value="">— Non specificata —</option>
          ${['SOP','Sala_Roma','SOR'].map(c =>
            `<option value="${c}" ${(e.competenza_attivazione||ana.competenza_attivazione)===c ? 'selected' : ''}>${c}</option>`
          ).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Risorsa assegnata</label>
        <select id="s2-resource-day">
          ${DISP.resourceDays.map(rd =>
            `<option value="${rd.resource_day_id}"
              ${rd.resource_day_id === CTX.resourceDayId ? 'selected' : ''}>
              ${rd.resource} 
            </option>`
          ).join('')}
        </select>
      </div>
    </div>

    <div class="form-group">
      <label>Turno / Orario</label>
      ${turniOpts ? `
        <select id="s2-turno" onchange="onTurnoChange()" style="margin-bottom:6px">
          <option value="">— Seleziona turno —</option>
          ${turniOpts}
          <option value="custom" ${isCustom ? 'selected' : ''}>Personalizzato</option>
        </select>` : ''}
      <div class="form-row" id="s2-custom-time" style="display:none">
        <div class="form-group"><label>Inizio</label>
          <input type="time" id="s2-start" value="${startT}" step="60" /></div>
        <div class="form-group"><label>Fine</label>
          <input type="time" id="s2-end"   value="${endT}"   step="60" /></div>
      </div>
    </div>

    <div class="form-group">
      <label>Mandata comunicazione</label>
      <div class="toggle-group">
        <button class="toggle-btn ${!e.mandata_comunicazione ? 'active' : ''}"
          onclick="setToggle('mandata-com',false)">No</button>
        <button class="toggle-btn ${e.mandata_comunicazione ? 'active' : ''}"
          onclick="setToggle('mandata-com',true)">Sì</button>
      </div>
    </div>

    <div id="comunicazione-block" style="${e.mandata_comunicazione ? '' : 'display:none'}">
      <div class="sub-block">
        <div class="sub-block-title">📞 Comunicazione</div>
        <div class="form-row">
          <div class="form-group"><label>Data/ora comunicazione</label>
            <input type="datetime-local" id="s2-time-com"
              value="${e.time_comunicazione ? toLocalInput(e.time_comunicazione) : ''}" /></div>
          <div class="form-group"><label>Note comunicazione</label>
            <input type="text" id="s2-notes-com" value="${e.notes_comunicazione||''}" /></div>
        </div>
      </div>
    </div>

    <div class="form-group">
      <label>Mandata attivazione</label>
      <div class="toggle-group">
        <button class="toggle-btn ${!e.mandata_attivazione ? 'active' : ''}"
          onclick="setToggle('mandata-att',false)">No</button>
        <button class="toggle-btn ${e.mandata_attivazione ? 'active' : ''}"
          onclick="setToggle('mandata-att',true)">Sì</button>
      </div>
    </div>

    <div id="attivazione-block" style="${e.mandata_attivazione ? '' : 'display:none'}">
      <div class="sub-block">
        <div class="sub-block-title">🚨 Protocollo attivazione</div>
        <div class="form-row">
          <div class="form-group"><label>Protocollo</label>
            <input type="text" id="s2-protocol"
              value="${e.activation_protocol||''}" placeholder="es. So.Roma.26.001_del_01_01_2026" /></div>
          <div class="form-group"><label>Data/ora attivazione</label>
            <input type="datetime-local" id="s2-time-protocol"
              value="${e.time_activation_protocol ? toLocalInput(e.time_activation_protocol) : ''}" /></div>
        </div>
        <div class="form-group"><label>Note attivazione</label>
          <input type="text" id="s2-notes-protocol" value="${e.notes_activation_protocol||''}" /></div>
      </div>
    </div>

    <div class="form-group">
      <label>Partenza</label>
      <div class="toggle-group">
        <button class="toggle-btn partenza-btn ${partenza==='sul_posto'?'active':''}"
          data-val="sul_posto" onclick="setPartenza('sul_posto')">Sul posto</button>
        <button class="toggle-btn partenza-btn ${partenza==='sala_roma'?'active':''}"
          data-val="sala_roma" onclick="setPartenza('sala_roma')">Sala Roma</button>
      </div>
    </div>

    <div class="form-group"><label>Note</label>
      <textarea id="s2-notes" rows="2">${e.notes||''}</textarea></div>

    <div id="s2-error" class="error-msg"></div>`;
}

function wireStep2() {
  const turnoSel    = document.getElementById('s2-turno');
  const customBlock = document.getElementById('s2-custom-time');
  if (!turnoSel || !customBlock) return;

  // If no start time pre-filled, hide time inputs and leave turno unselected
  const startVal = document.getElementById('s2-start')?.value;
  if (!startVal) {
    customBlock.style.display = 'none';
    turnoSel.value = '';
  }
}

function onTurnoChange() {
  const sel         = document.getElementById('s2-turno');
  const customBlock = document.getElementById('s2-custom-time');
  if (!sel || !customBlock) return;

  if (sel.value === 'custom') {
    customBlock.style.display = '';
    document.getElementById('s2-start').value = '';
    document.getElementById('s2-end').value   = '';
  } else if (sel.value) {
    // Preset — set values silently, keep block hidden
    const [s, e] = sel.value.split('|');
    document.getElementById('s2-start').value = s || '';
    document.getElementById('s2-end').value   = e || '';
    customBlock.style.display = 'none';
  } else {
    // Nothing selected — clear and hide
    document.getElementById('s2-start').value = '';
    document.getElementById('s2-end').value   = '';
    customBlock.style.display = 'none';
  }
}

function setToggle(id, val) {
  const block = id === 'mandata-com'
    ? document.getElementById('comunicazione-block')
    : document.getElementById('attivazione-block');

  const btns = block?.previousElementSibling?.querySelectorAll('.toggle-btn');
  btns?.forEach((b, i) => b.classList.toggle('active', i === (val ? 1 : 0)));

  if (block) block.style.display = val ? '' : 'none';
}

function setPartenza(val) {
  const current = document.querySelector('.partenza-btn.active')?.dataset.val;
  document.querySelectorAll('.partenza-btn').forEach(b => b.classList.remove('active'));
  if (current !== val) {
    document.querySelector(`.partenza-btn[data-val="${val}"]`)?.classList.add('active');
  }
}

function collectStep2() {
  const mandataCom = document.querySelector('#comunicazione-block')?.style.display !== 'none';
  const mandataAtt = document.querySelector('#attivazione-block')?.style.display !== 'none';
  const partenza = [...document.querySelectorAll('.toggle-btn.active')]
    .find(b => ['sul_posto','sala_roma',''].includes(b.dataset.val))?.dataset.val || null;

  return {
    role:                     document.getElementById('s2-role')?.value || null,
    competenza_attivazione:      document.getElementById('s2-comp')?.value || null,
    scheduled_start:          buildDateTime(CTX.resourceDayId, document.getElementById('s2-start')?.value),
    scheduled_end:            buildDateTime(CTX.resourceDayId, document.getElementById('s2-end')?.value),
    mandata_comunicazione:      mandataCom,
    time_comunicazione:         mandataCom ? (document.getElementById('s2-time-com')?.value ? new Date(document.getElementById('s2-time-com').value).toISOString() : null) : null,
    notes_comunicazione:        mandataCom ? (document.getElementById('s2-notes-com')?.value.trim() || null) : null,
    mandata_attivazione:        mandataAtt,
    activation_protocol:        mandataAtt ? (document.getElementById('s2-protocol')?.value.trim() || null) : null,
    time_activation_protocol:   mandataAtt ? (document.getElementById('s2-time-protocol')?.value ? new Date(document.getElementById('s2-time-protocol').value).toISOString() : null) : null,
    notes_activation_protocol:  mandataAtt ? (document.getElementById('s2-notes-protocol')?.value.trim() || null) : null,
    partenza: document.querySelector('.partenza-btn.active')?.dataset.val || null,
    notes:                    document.getElementById('s2-notes')?.value.trim() || null,
    _resourceDayId: document.getElementById('s2-resource-day')?.value || CTX.resourceDayId,
  };
}

async function handleConfirm() {
  const errEl = document.getElementById('s2-error');
  errEl.textContent = '';
  const assignment = collectStep2();

  if (!assignment.role) {
    errEl.textContent = 'Seleziona un ruolo.'; return;
  }
  if (!assignment.competenza_attivazione) {
    errEl.textContent = 'Seleziona la competenza di attivazione.'; return;
  }

  const btn = document.getElementById('assign-confirm');
  btn.disabled = true; btn.textContent = 'Salvataggio...';

  try {
    const savedAna = await upsertAnagrafica(CTX.anagraficaId, CTX.anaData);

    if (!CTX.personnelId) {
      const newStart = toMinutes(document.getElementById('s2-start')?.value || '');
      const newEnd   = toMinutes(document.getElementById('s2-end')?.value   || '');
      const conflicts = DISP.personnel.filter(p => {
        if (p.anagrafica?.id !== savedAna.id) return false;
        if (!p.scheduled_start || !p.scheduled_end) return true;
        const pStart = toMinutes(parseTime(p.scheduled_start));
        const pEnd   = toMinutes(parseTime(p.scheduled_end));
        if (isNaN(newStart) || isNaN(newEnd)) return true;
        return !(newEnd <= pStart || newStart >= pEnd);
      });
      if (conflicts.length) {
        const names = conflicts.map(c => {
          const rd = DISP.resourceDays.find(r => r.resource_day_id === c.resource_day_id);
          const st = parseTime(c.scheduled_start);
          const et = parseTime(c.scheduled_end);
          return `${rd?.resource||'?'} ${st&&et ? `(${st}–${et})` : ''}`;
        }).join(', ');
        if (!confirm(`⚠️ Sovrapposizione oraria con: ${names}\n\nContinuare?`)) {
          btn.disabled = false; btn.textContent = 'Conferma'; return;
        }
      }
    }

    const targetRdId = assignment._resourceDayId || CTX.resourceDayId;
    delete assignment._resourceDayId;

    if (CTX.personnelId) {
      await updatePersonnelFields(CTX.personnelId, {
        ...assignment,
        anagrafica_id:   savedAna.id,
        resource_day_id: targetRdId,
      });
    } else {
      await assignPersonnel(DISP.eventId, savedAna.id, targetRdId, assignment);
    }

    closeModal('modal-assign');
    showToast(CTX.personnelId ? 'Salvato ✓' : 'Personale aggiunto ✓', 'success');
    await reloadPersonnel();
    if (DISP._currentPage === 'ricerca') renderRicercaGrid();
    else if (DISP._currentPage === 'attivazioni') renderAttivazioniBody();
  } catch (err) {
    errEl.textContent = err.message;
  } finally {
    btn.disabled = false; btn.textContent = CTX.personnelId ? 'Salva' : 'Conferma';
  }
}

async function openPersonDetailModal(personnelId) {
  CTX.personnelId = personnelId;
  const p = DISP.personnel.find(p => p.id === personnelId);
  if (!p) return;
  CTX.anagraficaId  = p.anagrafica?.id || null;
  CTX.resourceDayId = p.resource_day_id;
  CTX.suggestedRole = p.role;
  CTX.startHint     = parseTime(p.scheduled_start);
  CTX.endHint       = parseTime(p.scheduled_end);
  CTX.anaData       = { ...(p.anagrafica || {}) };

  // Cancel button
  const delBtn = document.getElementById('assign-delete');
  delBtn.style.display = '';
  delBtn.textContent   = 'Annulla disponibilità';
  delBtn.onclick       = () => cancelPersonnel(CTX.personnelId);

  openStep1(CTX.anagraficaId);
}

async function cancelPersonnel(personnelId) {
  if (!confirm('Annullare questa assegnazione?')) return;
  try {
    await updatePersonnelFields(personnelId, { status: 'cancelled' });
    closeModal('modal-assign');
    showToast('Assegnazione annullata', 'success');
    await reloadPersonnel();
    if (DISP._currentPage === 'ricerca') renderRicercaGrid();
    else if (DISP._currentPage === 'attivazioni') renderAttivazioniBody();
  } catch (err) { showToast(err.message, 'error'); }
}

/* ================================================================
   ADD RESOURCE DAY MODAL
================================================================ */
async function openAddResourceDayModal() {
  const body = document.getElementById('resource-day-modal-body');
  body.innerHTML = '<div class="loading-inline">Caricamento...</div>';
  document.getElementById('resource-day-modal-save').style.display = '';
  openModal('modal-resource-day');

  try {
    const available = await fetchAvailableResources(DISP.eventId, DISP.session);
    const session   = DISP.sessions.find(s => s.session===DISP.session);

    if (!available.length) {
      body.innerHTML = '<div class="empty-state">Tutte le risorse già assegnate.</div>';
      document.getElementById('resource-day-modal-save').style.display = 'none';
      return;
    }

    const byType = {};
    available.forEach(r => { if (!byType[r.resource_type]) byType[r.resource_type]=[]; byType[r.resource_type].push(r); });

    body.innerHTML = `
      <div class="form-group"><label>Sessione</label>
        <div class="info-value">${session?.label||`G${DISP.session}`}</div></div>
      <div class="form-group"><label>Risorsa <span class="req">*</span></label>
        <select id="rd-resource">
          ${Object.entries(byType).map(([type,res])=>
            `<optgroup label="${type}">${res.map(r=>`<option value="${r.id}">${r.resource}</option>`).join('')}</optgroup>`
          ).join('')}
        </select></div>
      <div class="form-row">
        <div class="form-group"><label>Inizio</label><input type="time" id="rd-start" value="07:00" /></div>
        <div class="form-group"><label>Fine</label>  <input type="time" id="rd-end"   value="22:00" /></div>
      </div>
      <div id="rd-error" class="error-msg"></div>`;

    document.getElementById('resource-day-modal-save').onclick = saveResourceDay;
  } catch (err) { body.innerHTML = `<div class="error-msg">${err.message}</div>`; }
}

async function saveResourceDay() {
  const resourceId = document.getElementById('rd-resource')?.value;
  const errEl = document.getElementById('rd-error');
  if (!resourceId) { errEl.textContent = 'Seleziona una risorsa.'; return; }

  const session = DISP.sessions.find(s => s.session===DISP.session);
  const btn = document.getElementById('resource-day-modal-save');
  btn.disabled = true; btn.textContent = 'Aggiunta...';
  try {
    const newRd = await createResourceDay(DISP.eventId, resourceId, DISP.session,
      session?.date || new Date().toISOString().slice(0,10),
      document.getElementById('rd-start').value || null,
      document.getElementById('rd-end').value   || null);
    DISP.allResourceDays.push(newRd);
    closeModal('modal-resource-day');
    showToast('Risorsa aggiunta ✓','success');
    await loadSessionData(); renderRicercaGrid();
  } catch (err) { errEl.textContent = err.message; }
  finally { btn.disabled=false; btn.textContent='Aggiungi'; }
}

async function confirmDeleteResourceDay(resourceDayId) {
  const rd   = DISP.resourceDays.find(r=>r.resource_day_id===resourceDayId);
  const crew = DISP.personnel.filter(p=>p.resource_day_id===resourceDayId);
  if (!confirm(crew.length
    ? `Rimuovere ${rd?.resource}? Verranno rimossi anche ${crew.length} assegnazioni.`
    : `Rimuovere ${rd?.resource} dalla sessione?`)) return;
  try {
    await deleteResourceDay(resourceDayId);
    DISP.allResourceDays = DISP.allResourceDays.filter(r=>r.id!==resourceDayId);
    showToast('Rimossa','success');
    await loadSessionData(); renderRicercaGrid();
  } catch (err) { showToast(err.message,'error'); }
}

/* ================================================================
   IMPORT & EXPORT
================================================================ */
function openImportModal() {
  const body = document.getElementById('import-modal-body');
  DISP._importRows = [];
  body.innerHTML = `
    <p class="import-desc">
      CSV o XLSX: <strong>cognome, nome, cf, comitato, numero, email, qualifiche, competenza, ice, allergie</strong><br>
      Competenza: <code>SOP</code>, <code>Sala_Roma</code>, <code>SOR</code>
    </p>
    <div class="drop-zone" id="import-drop-zone">
      <div class="dz-icon">📄</div>
      <div class="dz-text">Trascina CSV o XLSX qui, oppure clicca</div>
      <input type="file" id="import-file" accept=".csv,.xlsx" style="display:none" />
    </div>
    <div id="import-preview"></div>
    <div id="import-error" class="error-msg"></div>`;

  const dz = document.getElementById('import-drop-zone');
  const fi = document.getElementById('import-file');
  dz.addEventListener('click', ()=>fi.click());
  dz.addEventListener('dragover', e=>{e.preventDefault();dz.classList.add('drag-over');});
  dz.addEventListener('dragleave', ()=>dz.classList.remove('drag-over'));
  dz.addEventListener('drop', e=>{e.preventDefault();dz.classList.remove('drag-over');if(e.dataTransfer.files[0])handleImportFile(e.dataTransfer.files[0]);});
  fi.addEventListener('change', e=>{if(e.target.files[0])handleImportFile(e.target.files[0]);});

  document.getElementById('import-modal-confirm').style.display = 'none';
  document.getElementById('import-modal-confirm').onclick = confirmImport;
  openModal('modal-import');
}

async function handleImportFile(file) {
  const errEl=document.getElementById('import-error'), preview=document.getElementById('import-preview');
  errEl.textContent=''; preview.innerHTML='<div class="loading-inline">Analisi...</div>';
  try {
    const rows = await parseImportFile(file);
    DISP._importRows = rows;
    preview.innerHTML = `
      <div class="import-count">${rows.length} righe trovate</div>
      <div class="import-preview-scroll">
        <table class="preview-table">
          <thead><tr><th>Cognome</th><th>Nome</th><th>CF</th><th>Comitato</th><th>Competenza</th></tr></thead>
          <tbody>${rows.slice(0,25).map(r=>`
            <tr><td>${r.surname||'—'}</td><td>${r.name||'—'}</td><td>${r.cf||'—'}</td>
            <td>${r.comitato||'—'}</td>
            <td style="color:${COMP_COLORS[r.competenza_attivazione]||'inherit'}">${r.competenza_attivazione||'—'}</td></tr>`).join('')}
          </tbody>
        </table>
        ${rows.length>25?`<div class="import-more">... e altri ${rows.length-25}</div>`:''}
      </div>`;
    document.getElementById('import-modal-confirm').style.display = '';
  } catch (err) { errEl.textContent=err.message; preview.innerHTML=''; }
}

async function parseImportFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (ext==='csv') {
    const lines = (await file.text()).trim().split('\n');
    const headers = lines[0].split(',').map(h=>h.trim().replace(/"/g,'').toLowerCase());
    return lines.slice(1).map(line=>{
      const vals = line.split(',').map(v=>v.trim().replace(/"/g,''));
      const row = {}; headers.forEach((h,i)=>{ row[h]=vals[i]||''; });
      return normalizeImportRow(row);
    }).filter(r=>r.name&&r.surname);
  }
  if (ext==='xlsx') {
    if (typeof XLSX==='undefined') throw new Error('Libreria XLSX non caricata.');
    const wb = XLSX.read(await file.arrayBuffer(), {type:'array'});
    const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {defval:''});
    return data.map(row=>{
      const n={}; Object.keys(row).forEach(k=>{n[k.toLowerCase().trim()]=String(row[k]);});
      return normalizeImportRow(n);
    }).filter(r=>r.name&&r.surname);
  }
  throw new Error('Usa CSV o XLSX.');
}

function normalizeImportRow(row) {
  return {
    name:                  (row.nome||row.name||'').trim()||null,
    surname:               (row.cognome||row.surname||'').trim()||null,
    cf:                    (row.cf||'').trim().toUpperCase()||null,
    comitato:              (row.comitato||'').trim()||null,
    number:                (row.numero||row.number||row.telefono||'').trim()||null,
    email:                 (row.email||'').trim()||null,
    qualifications:        (row.qualifiche||row.qualifications||'').trim()||null,
    competenza_attivazione: normalizeComp(row.competenza||row.competenza_attivazione||''),
    ice:           (row.ice||row.ice||'').trim()||null,
    allergies:             (row.allergie||row.allergies||'').trim()||null,
  };
}

function normalizeComp(v) {
  v = String(v).trim().toLowerCase().replace(/\s+/g,'_');
  if (v==='sop') return 'SOP';
  if (['sala_roma','salaroma'].includes(v)) return 'Sala_Roma';
  if (v==='sor') return 'SOR';
  return null;
}

async function confirmImport() {
  const btn = document.getElementById('import-modal-confirm');
  btn.disabled=true; btn.textContent='Importazione...';
  try {
    const result = await bulkImportAnagrafica(DISP._importRows);
    closeModal('modal-import');
    showToast(`${result.inserted} importati${result.errors.length?` · ${result.errors.length} errori`:''}`,
      result.errors.length?'warning':'success');
  } catch (err) { document.getElementById('import-error').textContent=err.message; }
  finally { btn.disabled=false; btn.textContent='Importa'; }
}

async function exportXLSX() {
  if (typeof XLSX==='undefined') { showToast('XLSX non disponibile','error'); return; }
  try {
    const rows = await fetchExportData(DISP.eventId, DISP.session);
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `G${DISP.session}`);
    XLSX.writeFile(wb, `dispositivo_G${DISP.session}_${(DISP.event?.name||'evento').replace(/\s+/g,'_')}.xlsx`);
    showToast('Download avviato','success');
  } catch (err) { showToast(err.message,'error'); }
}

/* ================================================================
   TURNI & TIME UTILITIES
================================================================ */
function computeTurni(rdStart, rdEnd) {
  if (!rdStart || !rdEnd) return null;
  const s = toMinutes(fmtTimeParts(rdStart));
  const e = toMinutes(fmtTimeParts(rdEnd));
  if (isNaN(s) || isNaN(e) || e <= s) return null;

  const mid = Math.round((s + e) / 2);
  const fmt = fromMinutes;

  return [
    { label: `Intero turno  (${fmt(s)}–${fmt(e)})`, start: fmt(s), end: fmt(e) },
    { label: `1° turno  (${fmt(s)}–${fmt(mid)})`,   start: fmt(s), end: fmt(mid) },
    { label: `2° turno  (${fmt(mid)}–${fmt(e)})`,    start: fmt(mid), end: fmt(e) },
  ];
}

function parseTime(val) {
  if (!val) return null;
  try {
    // ISO datetime
    if (val.includes('T') || val.includes(' ')) {
      return new Date(val).toLocaleTimeString('it-IT', { hour:'2-digit', minute:'2-digit' });
    }
    // TIME string: 08:00:00 or 08:00
    return val.slice(0, 5);
  } catch { return null; }
}

function fmtTimeParts(t) {
  if (!t) return null;
  return t.slice(0, 5);
}

function toMinutes(hhmm) {
  if (!hhmm) return NaN;
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function fromMinutes(min) {
  return `${String(Math.floor(min/60)).padStart(2,'0')}:${String(min%60).padStart(2,'0')}`;
}

function buildDateTime(resourceDayId, timeStr) {
  if (!timeStr) return null;
  const rd = DISP.resourceDays.find(r => r.resource_day_id === resourceDayId);
  const date = rd?.date || new Date().toISOString().slice(0, 10);
  return new Date(`${date}T${timeStr}:00`).toISOString();
}

function toLocalInput(iso) {
  if (!iso) return '';
  try { return new Date(iso).toISOString().slice(0, 16); } catch { return ''; }
}

function fmtTime(t) {
  if (!t) return '—';
  return fmtTimeParts(t) || '—';
}

/* ================================================================
   LEGEND COLOR PERSISTENCE
================================================================ */
function applyStoredLegendColors() {
  const stored = JSON.parse(localStorage.getItem('disp_legend') || '{}');
  if (stored.missingColor)
    document.documentElement.style.setProperty('--cell-missing', stored.missingColor);
  if (stored.completeColor)
    document.documentElement.style.setProperty('--cell-complete', stored.completeColor);
}

function getAlpha(color) {
  const m = color.match(/rgba?\([^)]+,\s*([\d.]+)\)/);
  return m ? parseFloat(m[1]) : 1;
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return alpha >= 0.99 ? hex : `rgba(${r},${g},${b},${alpha.toFixed(2)})`;
}

/* ================================================================
   UI HELPERS
================================================================ */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s=>s.classList.add('hidden'));
  document.getElementById(id)?.classList.remove('hidden');
}
function openModal(id)  { document.getElementById(id)?.classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id)?.classList.add('hidden'); }

function showToast(msg, type='success') {
  const el = document.getElementById('toast');
  el.textContent = msg; el.className = `toast toast-${type}`;
  el.classList.remove('hidden'); clearTimeout(el._t);
  el._t = setTimeout(()=>el.classList.add('hidden'), 3500);
}

document.addEventListener('DOMContentLoaded', initDispositivo);













