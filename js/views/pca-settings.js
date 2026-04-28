/* ================================================================
   js/views/pca-settings.js  —  Impostazioni page
   Event settings: mode toggles (is_route, is_grid), rich text notes,
   and GeoJSON upload for all geo layers (route, grid, markers,
   fixed resources, POI). Includes CRS detection and reprojection.

   Mounted by router.js into #page-content.
   Depends on: supabase.js (db), pca.js (PCA, showToast),
               proj4.js (reprojection, loaded via CDN)
================================================================ */

let _settingsEvent = null;

/* ================================================================
   MOUNT & RENDER
   mountImpostazioni — builds page shell and triggers render.
   renderSettings    — fetches event row, renders all settings cards,
                       initialises rich text editors with saved content.
================================================================ */
async function mountImpostazioni(container) {
  container.innerHTML = `
    <div class="settings-page">
      <div class="settings-header">
        <h2 class="settings-title">Impostazioni evento</h2>
      </div>
      <div class="settings-body" id="settings-body">
        <div class="empty-state">Caricamento...</div>
      </div>
    </div>`;
  await renderSettings();
}

async function renderSettings() {
  const body = document.getElementById('settings-body');
  if (!body) return;

  const event = await fetchEventSettings(PCA.eventId);
  if (!event) { body.innerHTML = '<div class="empty-state">Errore nel caricamento</div>'; return; }

  const currentSession = PCA.event?.current_session || 1;
  const nextSession = currentSession + 1;
  const nextLabel = sessionLabel(nextSession);

  body.innerHTML = `
  <div style="max-width:900px;margin:0 auto;display:flex;flex-direction:column;gap:16px;">

    <!-- ── EVENTO ── -->
    <div class="settings-card">
      <div class="settings-card-title">Evento</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
        <div class="form-group">
          <label>Nome evento</label>
          <input type="text" id="ev-name" value="${event.name || ''}" placeholder="Es. Maratona di Roma" />
        </div>
        <div class="form-group">
          <label>Descrizione</label>
          <input type="text" id="ev-description" value="${event.description || ''}" placeholder="Descrizione breve..." />
        </div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <label class="toggle-switch">
            <input type="checkbox" id="toggle-active" ${event.is_active ? 'checked' : ''}
              onchange="saveEventToggle('is_active', this.checked)" />
            <span class="toggle-slider"></span>
          </label>
          <span style="font-size:13px;font-weight:600;color:var(--text-primary);">Evento attivo</span>
          <span style="font-size:13px;color:var(--text-primary);">— Con evento non attivo i moduli non possono mandare interventi</span>
        </div>
        <button class="btn-primary" style="width:auto;padding:6px 16px;"
          onclick="saveEventNameDesc()">Salva</button>
      </div>
    </div>

    <!-- ── MODALITÀ ── -->
    <div class="settings-card">
      <div class="settings-card-title">Modalità evento</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div style="display:flex;align-items:center;justify-content:space-between;
          padding:12px;background:var(--bg);border-radius:var(--radius);
          border:1px solid var(--border);">
          <div>
            <div style="font-size:13px;font-weight:600;color:var(--text-primary);">Modalità gara</div>
            <div style="font-size:13px;color:var(--text-primary);margin-top:2px;">Abilita percorso e km marker</div>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" id="toggle-gara" ${event.is_route ? 'checked' : ''}
              onchange="saveEventToggle('is_route', this.checked)" />
            <span class="toggle-slider"></span>
          </label>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;
          padding:12px;background:var(--bg);border-radius:var(--radius);
          border:1px solid var(--border);">
          <div>
            <div style="font-size:13px;font-weight:600;color:var(--text-primary);">Modalità griglia</div>
            <div style="font-size:13px;color:var(--text-primary);margin-top:2px;">Abilita griglia geografica</div>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" id="toggle-griglia" ${event.is_grid ? 'checked' : ''}
              onchange="saveEventToggle('is_grid', this.checked)" />
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>
    </div>

    <!-- ── NOTE ── -->
    <div class="settings-card">
      <div class="settings-card-title">Note evento</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div>
          <div style="font-size:12px;font-weight:600;color:var(--text-secondary);
            margin-bottom:6px;text-transform:uppercase;letter-spacing:1px;">
            Note generali
          </div>
          <div style="font-size:13px;color:var(--text-primary);margin-bottom:6px;">
            Visibili a tutti i moduli
          </div>
          ${buildRichEditor('editor-general', event.notes_general || '')}
          <button class="btn-primary" style="margin-top:8px;width:100%;padding:6px 16px;"
            onclick="saveNotes('general')">Salva note generali</button>
        </div>
        <div>
          <div style="font-size:12px;font-weight:600;color:var(--text-secondary);
            margin-bottom:6px;text-transform:uppercase;letter-spacing:1px;">
            Note coordinatori
          </div>
          <div style="font-size:13px;color:var(--text-primary);margin-bottom:6px;">
            Visibili solo a LDC e PCA
          </div>
          ${buildRichEditor('editor-coordinator', event.notes_coordinators || '')}
          <button class="btn-primary" style="margin-top:8px;width:100%;padding:6px 16px;"
            onclick="saveNotes('coordinator')">Salva note coordinatori</button>
        </div>
      </div>
    </div>

    <!-- ── GEOMETRIE ── -->
    <div class="settings-card">
      <div class="settings-card-title">Geometrie</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
        ${buildGeoUpload('route',   'Percorso gara',    'MultiLineString', 'event_route',     'name',  'Carica il percorso di gara in formato geojson')}
        ${buildGeoUpload('grid',    'Griglia',            'MultiPolygon',    'grid',            'label', 'Carica la griglia geografica di settori in formato geojson (tipo MultiPolygons). Inserire colonna "label" con il nome di ogni settore')}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
        ${buildGeoUpload('markers', 'Marker percorso',    'Point',           'markers_route',   'label', 'Carica i marker chilometrici della gara in formato geojson. Inserire colonna "km" per il chilometraggio (numero intero).')}
        ${buildGeoUpload('fixed',   'Risorse fisse',      'Point',           'fixed_resources', 'label', 'Carica le risorse sanitarie fisse (PMA etc) in formato geojson. Inserire colonna "label" con il nome della risorsa')}
      </div>
      <div style="display:grid;grid-template-columns:1fr;gap:12px;">
        ${buildGeoUpload('poi',     'Punti di interesse', 'Point',           'event_poi',       'name',  'Carica i punti di interesse dell\'evento in formato geojson. Inserire colonna "label" con il nome del punto di interesse.')}
      </div>
    </div>

    <!-- ── CHIUDI SESSIONE ── -->
    <div style="display:flex;gap:12px;">
      <button onclick="handleCloseAllSessions()" style="
        flex:1;padding:8px 16px;border-radius:var(--radius);
        border:1.5px solid var(--red);background:transparent;
        color:var(--red);font-size:13px;font-weight:700;
        font-family:var(--font);cursor:pointer;">
        Chiudi sessioni moduli
      </button>
      <button onclick="handleNewSession()" style="
        flex:1;padding:8px 16px;border-radius:var(--radius);
        border:1.5px solid var(--orange);background:transparent;
        color:var(--orange);font-size:13px;font-weight:700;
        font-family:var(--font);cursor:pointer;">
        Nuova giornata → <span id="session-label">(${nextLabel})</span>
      </button>
    </div>

  </div>`;

  initEditor('editor-general',     event.notes_general     || '');
  initEditor('editor-coordinator', event.notes_coordinators || '');
}

/* ================================================================
   EVENT SETTINGS
   saveEventToggle — saves is_route / is_grid boolean to events table.
   switchNoteTab   — switches between general and coordinator note tabs.
   saveNotes       — saves rich editor HTML content to events table.
================================================================ */
async function saveEventToggle(field, value) {
  const ok = await updateEventFields(PCA.eventId, { [field]: value });
  if (!ok) { showToast('Errore salvataggio', 'error'); return; }
  const labels = {
    is_route: value ? 'Modalità gara attivata ✓' : 'Modalità gara disattivata',
    is_grid:  value ? 'Griglia attivata ✓'        : 'Griglia disattivata',
    is_active: value ? 'Evento attivato ✓'         : 'Evento disattivato',
  };
  showToast(labels[field] || 'Salvato ✓', 'success');
}

async function saveEventNameDesc() {
  const name = document.getElementById('ev-name')?.value.trim();
  const desc = document.getElementById('ev-description')?.value.trim() || null;
  if (!name) { showToast('Il nome evento è obbligatorio', 'error'); return; }

  const ok = await updateEventNameDesc(PCA.eventId, name, desc);
  if (!ok) { showToast('Errore salvataggio', 'error'); return; }

  // Update header
  document.getElementById('header-event-name').textContent = name.toUpperCase();
  PCA.event.name = name;
  showToast('Evento aggiornato ✓', 'success');
}

async function handleCloseAllSessions() {
  if (!confirm('Disconnettere tutti i moduli in campo?')) return;
  const ok = await closeAllMobileSessions();
  if (!ok) { showToast('Errore chiusura sessioni', 'error'); return; }
  showToast('Sessioni chiuse ✓', 'success');
}

async function saveNotes(tab) {
  const id    = tab === 'general' ? 'editor-general' : 'editor-coordinator';
  const field = tab === 'general' ? 'notes_general'  : 'notes_coordinators';
  const html  = document.getElementById(id)?.innerHTML || '';

  const ok = await updateEventFields(PCA.eventId, { [field]: html });
  if (!ok) { showToast('Errore salvataggio note', 'error'); return; }

  showToast('Note salvate ✓', 'success');
}

async function handleNewSession() {
  const currentSession = PCA.event?.current_session || 1;
  const nextSession = currentSession + 1;
  const nextLabel = sessionLabel(nextSession);

  if (!confirm(`Avviare giornata ${nextLabel}?\n\nQuesto disconnetterà tutti i moduli e azzererà le posizioni.`)) return;

  const newSession = await incrementSession(PCA.eventId);
  if (!newSession) { showToast('Errore avvio nuova sessione', 'error'); return; }

  await wipeResourcePositions(PCA.eventId);
  await closeAllMobileSessions();

  // Update local state
  PCA.event.current_session = newSession;

  showToast(`Sessione ${newSession} avviata ✓`, 'success');
  await renderSettings();

}

/* ================================================================
   RICH TEXT EDITOR
   buildRichEditor    — returns the toolbar + contenteditable HTML.
   initEditor         — sets initial HTML content on the editor div.
   editorCmd          — executes a document.execCommand formatting command.
   editorInsertLink   — prompts for URL and inserts a link.
   editorInsertPhone  — prompts for a phone number and inserts a tel: link.
================================================================ */
function buildRichEditor(id, content) {
  return `
    <div class="rich-editor-wrap">
      <div class="rich-toolbar">
        <button type="button" title="Grassetto"    onclick="editorCmd('${id}','bold')"><b>B</b></button>
        <button type="button" title="Corsivo"      onclick="editorCmd('${id}','italic')"><i>I</i></button>
        <button type="button" title="Sottolineato" onclick="editorCmd('${id}','underline')"><u>U</u></button>
        <div class="rich-toolbar-sep"></div>
        <button type="button" title="Lista"        onclick="editorCmd('${id}','insertUnorderedList')">≡</button>
        <button type="button" title="Link"         onclick="editorInsertLink('${id}')">🔗</button>
        <button type="button" title="Telefono"     onclick="editorInsertPhone('${id}')">📞</button>
        <div class="rich-toolbar-sep"></div>
        <button type="button" title="Pulisci"      onclick="editorCmd('${id}','removeFormat')">✕</button>
      </div>
      <div class="rich-editor" id="${id}" contenteditable="true"
        data-placeholder="Scrivi qui..."></div>
    </div>`;
}

function initEditor(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

function editorCmd(id, cmd) {
  document.getElementById(id)?.focus();
  document.execCommand(cmd, false, null);
}

function editorInsertLink(id) {
  const url = prompt('URL link:');
  if (!url) return;
  document.getElementById(id)?.focus();
  document.execCommand('createLink', false, url);
  // Make link open in new tab
  const editor = document.getElementById(id);
  editor?.querySelectorAll('a').forEach(a => a.setAttribute('target', '_blank'));
}

function editorInsertPhone(id) {
  const raw = prompt('Numero di telefono:');
  if (!raw) return;
  const number = raw.trim();
  const href   = 'tel:' + number.replace(/\s+/g, '');
  const html   = `<a href="${href}" style="text-decoration:none;">📞 <span style="color:var(--blue);font-weight:600;">${number}</span></a>`;
  const editor = document.getElementById(id);
  if (!editor) return;
  editor.focus();
  document.execCommand('insertHTML', false, html);
}

/* ================================================================
   GEO UPLOAD
   buildGeoUpload   — returns the collapsible upload section HTML
                      for a single geo layer.
   toggleGeoSection — collapses/expands a geo upload section.
   previewGeoJSON   — reads and parses the selected file, detects CRS,
                      validates geometry types, renders a preview table.
   uploadGeoJSON    — reprojects if needed, then deletes existing rows
                      (replace mode) and inserts new features.
================================================================ */
function buildGeoUpload(key, label, geomType, table, primaryProp, hint) {
  return `
    <div class="geo-section" id="geo-section-${key}">
      <div class="geo-section-header" onclick="toggleGeoSection('${key}')">
        <span class="geo-section-title">${label}</span>
        <span class="geo-section-type">${geomType}</span>
        <span class="geo-chevron" id="geo-chevron-${key}">▸</span>
      </div>
      <div class="geo-section-body" id="geo-body-${key}" style="display:none;">
        <div class="settings-row-desc" style="margin-bottom:8px;">${hint}</div>
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">
          <input type="file" id="geo-file-${key}" accept=".geojson,.json"
            onchange="previewGeoJSON('${key}','${table}','${geomType}','${primaryProp}')"
            style="font-size:11px;color:var(--text-secondary);" />
        </div>
        <div id="geo-preview-${key}"></div>
      </div>
    </div>`;
}

function toggleGeoSection(key) {
  const body    = document.getElementById(`geo-body-${key}`);
  const chevron = document.getElementById(`geo-chevron-${key}`);
  const open    = body.style.display !== 'none';
  body.style.display    = open ? 'none' : '';
  chevron.textContent   = open ? '▸' : '▾';
}

async function previewGeoJSON(key, table, expectedType, primaryProp) {
    const file    = document.getElementById(`geo-file-${key}`)?.files[0];
    const preview = document.getElementById(`geo-preview-${key}`);
    if (!file || !preview) return;

    let geojson;
    try {
        const text = await file.text();
        geojson = JSON.parse(text);
    } catch {
        preview.innerHTML = `<div class="geo-error">File non valido: non è un JSON leggibile.</div>`;
        return;
    }

    // Accept FeatureCollection or single Feature
    const features = geojson.type === 'FeatureCollection'
        ? geojson.features
        : geojson.type === 'Feature' ? [geojson] : [];

    if (features.length === 0) {
        preview.innerHTML = `<div class="geo-error">Nessuna feature trovata nel file.</div>`;
        return;
    }

    // Reproject if needed
    const epsg = detectCRS(geojson);
    let crsNote = '';
    if (!isWGS84(epsg) && epsg) {
        crsNote = `<div style="color:var(--yellow);font-size:11px;margin-bottom:6px;">
        ⚠️ CRS rilevato: EPSG:${epsg} — verrà riproiettato in WGS84 al caricamento</div>`;
    }
    
    // Validate geometry type
    const wrong = features.filter(f => {
        const t = f.geometry?.type;
        return t?.toLowerCase() !== expectedType.toLowerCase();
    });

    const rows = features.map(f => {
        const prop = f.properties?.[primaryProp] || '—';
        const type = f.geometry?.type || '?';
        const ok   = type.toLowerCase() === expectedType.toLowerCase();
        return `<tr>
        <td>${prop}</td>
        <td>${type}</td>
        <td>${ok ? '✓' : `<span style="color:var(--red)">✗ atteso ${expectedType}</span>`}</td>
        </tr>`;
    }).join('');

    preview.innerHTML = `
        <div class="geo-preview-box">
        <div style="font-size:11px;color:var(--text-secondary);margin-bottom:8px;">
            ${features.length} feature trovate${wrong.length > 0 ? ` — <span style="color:var(--red)">${wrong.length} tipo errato</span>` : ''}
        </div>
        <table class="geo-preview-table">
            <thead><tr><th>${primaryProp}</th><th>Tipo</th><th>Valido</th></tr></thead>
            <tbody>${rows}</tbody>
        </table>
        ${wrong.length === 0 ? `
            <div style="display:flex;gap:8px;margin-top:10px;align-items:center;">
            <label style="font-size:11px;color:var(--text-secondary);">
                <input type="radio" name="geo-mode-${key}" value="replace" checked /> Sostituisci esistenti
            </label>
            <label style="font-size:11px;color:var(--text-secondary);">
                <input type="radio" name="geo-mode-${key}" value="additive" /> Aggiungi
            </label>
            <button class="btn-primary" style="width:auto;padding:5px 14px;margin-left:auto;"
                onclick="uploadGeoJSON('${key}','${table}','${primaryProp}')">
                Carica
            </button>
            </div>` : ''}
        </div>`;
}

async function uploadGeoJSON(key, table, primaryProp) {
  const file = document.getElementById(`geo-file-${key}`)?.files[0];
  if (!file) return;

  const mode = document.querySelector(`input[name="geo-mode-${key}"]:checked`)?.value || 'replace';
  const text = await file.text();
  const geojson = JSON.parse(text);
  let features = geojson.type === 'FeatureCollection'
    ? geojson.features
    : [geojson];

  const preview = document.getElementById(`geo-preview-${key}`);

  // Reproject if needed
  features = await reprojectFeaturesIfNeeded(geojson, features);
  if (!features) return; // CRS unknown, error already shown

  try {
    // Replace: delete existing for this event
    if (mode === 'replace') {
      const deleted = await deleteGeoLayer(PCA.eventId, table);
      if (!deleted) throw new Error('Errore nella cancellazione dei layer esistenti');
    }

    // Build rows
    const rows = features.map(f => {
      const props = f.properties || {};
      const geomWKT = geojsonGeomToWKT(f.geometry);
      const base = {
        event_id: PCA.eventId,
        geom:     geomWKT,
      };

      // Table-specific fields
      if (table === 'event_route')    return { ...base, name:  props.name  || 'Percorso' };
      if (table === 'markers_route')  return { ...base, km:    props.km    || 0, label: props.label || null };
      if (table === 'fixed_resources')return { ...base, label: props.label || props.name || null };
      if (table === 'grid')           return { ...base, label: props.label || props.name || null };
      if (table === 'event_poi')      return { ...base, label:  props.label  || '—', poi_type: props.poi_type || null, properties: props };
      return base;
    });

    const inserted = await insertGeoRows(table, rows);
    if (!inserted) throw new Error('Errore nel caricamento delle geometrie');

    showToast(`${rows.length} geometrie caricate ✓`, 'success');
    preview.innerHTML += `<div style="color:var(--green);font-size:11px;margin-top:6px;">
      ✓ ${rows.length} feature inserite con successo.</div>`;

  } catch (err) {
    showToast('Errore caricamento', 'error');
    preview.innerHTML += `<div class="geo-error" style="margin-top:6px;">Errore: ${err.message}</div>`;
  }
}

/* ================================================================
   CRS DETECTION & REPROJECTION
   detectCRS                  — extracts EPSG code from GeoJSON CRS field.
   isWGS84                    — returns true if code is 4326, 4269 or null.
   getProj4Def                — fetches proj4 definition string from epsg.io.
   reprojectCoord             — reprojects a single coordinate pair.
   reprojectGeometry          — reprojects all coordinates in a geometry.
   reprojectFeaturesIfNeeded  — runs full reprojection pipeline if the
                                file is not already WGS84.
================================================================ */
function detectCRS(geojson) {
  const crs = geojson?.crs?.properties?.name || '';
  if (!crs) return null;
  // Extract EPSG code from strings like "EPSG:32632" or "urn:ogc:def:crs:EPSG::32632"
  const match = crs.match(/EPSG[::]+(\d+)/i);
  return match ? parseInt(match[1]) : null;
}

function isWGS84(epsgCode) {
  return !epsgCode || epsgCode === 4326 || epsgCode === 4269;
}

async function getProj4Def(epsgCode) {
  try {
    const res = await fetch(`https://epsg.io/${epsgCode}.proj4`);
    if (!res.ok) throw new Error('not found');
    return await res.text();
  } catch {
    return null;
  }
}

function reprojectCoord(coord, fromProj) {
  // proj4(from, to, coord) — to is always WGS84
  const [x, y] = proj4(fromProj, 'WGS84', [coord[0], coord[1]]);
  return coord.length === 3 ? [x, y, coord[2]] : [x, y];
}

function reprojectGeometry(geom, fromProj) {
  const r = c => reprojectCoord(c, fromProj);

  switch (geom.type) {
    case 'Point':
      return { ...geom, coordinates: r(geom.coordinates) };
    case 'LineString':
    case 'MultiPoint':
      return { ...geom, coordinates: geom.coordinates.map(r) };
    case 'Polygon':
    case 'MultiLineString':
      return { ...geom, coordinates: geom.coordinates.map(ring => ring.map(r)) };
    case 'MultiPolygon':
      return { ...geom, coordinates: geom.coordinates.map(poly => poly.map(ring => ring.map(r))) };
    default:
      return geom;
  }
}

async function reprojectFeaturesIfNeeded(geojson, features) {
  const epsg = detectCRS(geojson);
  if (isWGS84(epsg)) return features; // already WGS84

  showToast(`Riproiezione da EPSG:${epsg} a WGS84...`, 'success');

  const proj4def = await getProj4Def(epsg);
  if (!proj4def) {
    showToast(`CRS EPSG:${epsg} non riconosciuto — verifica il file`, 'error');
    return null;
  }

  proj4.defs(`EPSG:${epsg}`, proj4def);

  return features.map(f => ({
    ...f,
    geometry: reprojectGeometry(f.geometry, `EPSG:${epsg}`),
  }));
}

/* ================================================================
   GEOJSON → WKT
   geojsonGeomToWKT — converts a GeoJSON geometry object to a
                      PostGIS-compatible WKT string for DB insert.
                      Supports Point, LineString, Polygon,
                      MultiPolygon, MultiLineString.
================================================================ */
function geojsonGeomToWKT(geom) {
  if (!geom) return null;

  const coordToStr = c => `${c[0]} ${c[1]}`;
  const ringToStr  = r => r.map(coordToStr).join(', ');

  switch (geom.type) {
    case 'Point':
      return `POINT(${coordToStr(geom.coordinates)})`;

    case 'LineString':
      return `LINESTRING(${geom.coordinates.map(coordToStr).join(', ')})`;

    case 'Polygon':
      return `POLYGON(${geom.coordinates.map(r => `(${ringToStr(r)})`).join(', ')})`;

    case 'MultiPolygon':
      return `MULTIPOLYGON(${geom.coordinates
        .map(poly => `(${poly.map(r => `(${ringToStr(r)})`).join(', ')})`)
        .join(', ')})`;

    case 'MultiLineString':
        return `MULTILINESTRING(${geom.coordinates
        .map(line => `(${line.map(coordToStr).join(', ')})`)
        .join(', ')})`;
    default:
      throw new Error(`Tipo geometria non supportato: ${geom.type}`);
  }
}