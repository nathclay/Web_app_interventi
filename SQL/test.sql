------ test inserting fake data
-- ═══════════════════════════════════════════════════════════════
-- 1. INSERT RESOURCES
-- Insert coordinator first (LDC) so FK reference works
-- ═══════════════════════════════════════════════════════════════

-- CHARLIE-01 first (no coordinator)
INSERT INTO resources (id, event_id, resource, resource_type, user_email)
VALUES (
  'aaaaaaaa-0000-0000-0000-000000000001',
  '11111111-0000-0000-0000-000000000001',
  'CHARLIE-01', 'LDC',
  'prova4@prova.it'
);

-- ASM-01 coordinated by CHARLIE-01
INSERT INTO resources (id, event_id, resource, resource_type, user_email, coordinator_id)
VALUES (
  'aaaaaaaa-0000-0000-0000-000000000002',
  '11111111-0000-0000-0000-000000000001',
  'ASM-01', 'ASM',
  'prova1@prova.it',
  'aaaaaaaa-0000-0000-0000-000000000001'
);

-- ASM-02 no coordinator
INSERT INTO resources (id, event_id, resource, resource_type, user_email)
VALUES (
  'aaaaaaaa-0000-0000-0000-000000000003',
  '11111111-0000-0000-0000-000000000001',
  'ASM-02', 'ASM',
  'prova2@prova.it'
);

-- SAP-01 coordinated by CHARLIE-01
INSERT INTO resources (id, event_id, resource, resource_type, user_email, coordinator_id)
VALUES (
  'aaaaaaaa-0000-0000-0000-000000000004',
  '11111111-0000-0000-0000-000000000001',
  'SAP-01', 'SAP',
  'prova3@prova.it',
  'aaaaaaaa-0000-0000-0000-000000000001'
);

-- Verify
SELECT id, resource, resource_type, user_email,
       (SELECT resource FROM resources c WHERE c.id = r.coordinator_id) AS coordinator
FROM resources r
WHERE event_id = '11111111-0000-0000-0000-000000000001'
ORDER BY resource_type, resource;


-- ═══════════════════════════════════════════════════════════════
-- 2. INSERT PERSONNEL
-- ═══════════════════════════════════════════════════════════════

-- ASM-01 crew
INSERT INTO personnel (event_id, name, surname, CF, role, resource, present)
VALUES
  ('11111111-0000-0000-0000-000000000001',
   'Marco', 'Ferrari', 'FRRMRC90A01H501Z',
   'Medico', 'aaaaaaaa-0000-0000-0000-000000000002', TRUE),

  ('11111111-0000-0000-0000-000000000001',
   'Sofia', 'Ricci', 'RCCSFO95B41H501X',
   'Autista', 'aaaaaaaa-0000-0000-0000-000000000002', TRUE),

  ('11111111-0000-0000-0000-000000000001',
   'Luca', 'Conti', 'CNTLCU88C15H501Y',
   'Infermiere', 'aaaaaaaa-0000-0000-0000-000000000002', TRUE);

-- ASM-02 crew
INSERT INTO personnel (event_id, name, surname, CF, role, resource, present)
VALUES
  ('11111111-0000-0000-0000-000000000001',
   'Anna', 'Marino', 'MRNNNA92D41H501W',
   'Medico', 'aaaaaaaa-0000-0000-0000-000000000003', TRUE),

  ('11111111-0000-0000-0000-000000000001',
   'Paolo', 'Greco', 'GRCPLA85E01H501V',
   'Autista', 'aaaaaaaa-0000-0000-0000-000000000003', TRUE),

  ('11111111-0000-0000-0000-000000000001',
   'Elena', 'Bruno', 'BRNLNE91F41H501U',
   'Infermiere', 'aaaaaaaa-0000-0000-0000-000000000003', TRUE);

-- SAP-01 crew
INSERT INTO personnel (event_id, name, surname, CF, role, resource, present)
VALUES
  ('11111111-0000-0000-0000-000000000001',
   'Giovanni', 'Russo', 'RSSGNN87G01H501T',
   'Soccorritore', 'aaaaaaaa-0000-0000-0000-000000000004', TRUE),

  ('11111111-0000-0000-0000-000000000001',
   'Chiara', 'Esposito', 'SPSCRH93H41H501S',
   'OPEM', 'aaaaaaaa-0000-0000-0000-000000000004', TRUE),

  ('11111111-0000-0000-0000-000000000001',
   'Davide', 'Romano', 'RMNDVD89I01H501R',
   'OPEM', 'aaaaaaaa-0000-0000-0000-000000000004', TRUE);

-- CHARLIE-01 crew
INSERT INTO personnel (event_id, name, surname, CF, role, resource, present)
VALUES
  ('11111111-0000-0000-0000-000000000001',
   'Roberto', 'Costa', 'CSTRRT86L01H501Q',
   'Coordinatore', 'aaaaaaaa-0000-0000-0000-000000000001', TRUE),

  ('11111111-0000-0000-0000-000000000001',
   'Giulia', 'Fontana', 'FNTGLI94M41H501P',
   'Coordinatore', 'aaaaaaaa-0000-0000-0000-000000000001', TRUE);

-- Verify
SELECT p.name, p.surname, p.role, r.resource AS assigned_to
FROM personnel p
JOIN resources r ON r.id = p.resource
WHERE p.event_id = '11111111-0000-0000-0000-000000000001'
ORDER BY r.resource, p.role, p.name;


-- ═══════════════════════════════════════════════════════════════
-- 3. CREATE AUTH USERS
-- Run each separately — Supabase may not support multiple in one call
-- ═══════════════════════════════════════════════════════════════

-- Option A: use the dashboard
-- Authentication → Users → Add user for each email:
--   prova1@prova.it  password: test1234
--   prova2@prova.it  password: test1234
--   prova3@prova.it  password: test1234
--   prova4@prova.it  password: test1234



-- ═══════════════════════════════════════════════════════════════
-- 1. EVENTS
-- ═══════════════════════════════════════════════════════════════

INSERT INTO events (id, name, description, start_time, end_time, is_active, center_lat, center_lng, default_zoom)
VALUES
  ('11111111-0000-0000-0000-000000000001', 
   'Wizz Air Rome Half Marathon 2025',
   'Annual half marathon through central Rome',
   '2025-04-06 08:00:00+02', 
   '2025-04-06 14:00:00+02',
   TRUE,  -- active event
   41.9028, 12.4964, 14),

  ('11111111-0000-0000-0000-000000000002', 
   'Festa della Repubblica 2025',
   'National day parade and public gathering',
   '2025-06-02 09:00:00+02', 
   '2025-06-02 18:00:00+02',
   FALSE,
   41.9009, 12.4833, 15);

-- verify
SELECT id, name, is_active FROM events;


-- ═══════════════════════════════════════════════════════════════
-- 2. RADIO CHANNELS  (per event)
-- ═══════════════════════════════════════════════════════════════

INSERT INTO event_radio_channels (id, event_id, channel_name, description)
VALUES
  -- Marathon channels
  ('22222222-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'CH-1', 'Command channel'),
  ('22222222-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000001', 'CH-2', 'Medical teams'),
  ('22222222-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000001', 'CH-3', 'Ambulances'),
  -- Festa channels
  ('22222222-0000-0000-0000-000000000004', '11111111-0000-0000-0000-000000000002', 'CH-1', 'Command channel'),
  ('22222222-0000-0000-0000-000000000005', '11111111-0000-0000-0000-000000000002', 'CH-2', 'Medical teams');

-- verify
SELECT erc.channel_name, erc.description, e.name AS event
FROM event_radio_channels erc
JOIN events e ON e.id = erc.event_id;


-- ═══════════════════════════════════════════════════════════════
-- 3. RESOURCES
-- ═══════════════════════════════════════════════════════════════
-- Geometry: ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
-- Note: MakePoint takes (X, Y) = (lng, lat) — NOT (lat, lng)
-- Example Rome coordinates:
--   Colosseo:        lng=12.4922, lat=41.8902
--   Piazza Venezia:  lng=12.4822, lat=41.8958
--   Circo Massimo:   lng=12.4816, lat=41.8855

INSERT INTO resources (id, event_id, resource, resource_type, geom, coordinator, radio_channel_id, user_email)
VALUES
  ('33333333-0000-0000-0000-000000000001',
   '11111111-0000-0000-0000-000000000001',
   'ASM-01', 'ASM',
   ST_SetSRID(ST_MakePoint(12.4922, 41.8902), 4326),  -- near Colosseo
   'CHARLIE-01',
   '22222222-0000-0000-0000-000000000003',  -- CH-3 (ambulances) — same event ✓),
  prova@cri.it),

  ('33333333-0000-0000-0000-000000000002',
   '11111111-0000-0000-0000-000000000001',
   'CHARLIE-01', 'LDC',
   ST_SetSRID(ST_MakePoint(12.4822, 41.8958), 4326),  -- near Piazza Venezia
   NULL,
   '22222222-0000-0000-0000-000000000002',  -- CH-2 (medical teams) — same event ✓
   prova2@cri.it),

  ('33333333-0000-0000-0000-000000000003',
   '11111111-0000-0000-0000-000000000001',
   'SAP-01', 'SAP',
   ST_SetSRID(ST_MakePoint(12.4816, 41.8855), 4326),  -- near Circo Massimo
   'Giuseppe Verdi',
   '22222222-0000-0000-0000-000000000002',  -- CH-2 — same event ✓
   prova3@cri.it);

-- verify
SELECT r.resource, r.resource_type, erc.channel_name,
       ST_X(r.geom) AS lng, ST_Y(r.geom) AS lat
FROM resources r
LEFT JOIN event_radio_channels erc ON erc.id = r.radio_channel_id;

-- TEST: cross-event channel assignment should FAIL
-- Uncomment to test the trigger:
-- INSERT INTO resources (event_id, resource, resource_type, radio_channel_id)
-- VALUES (
--   '11111111-0000-0000-0000-000000000001',  -- Marathon event
--   'TEST-FAIL', 'ASM',
--   '22222222-0000-0000-0000-000000000004'   -- CH-1 of Festa event ← WRONG EVENT
-- );
-- Expected: ERROR: radio_channel_id does not belong to this resource's event


-- ═══════════════════════════════════════════════════════════════
-- 4. PERSONNEL
-- ═══════════════════════════════════════════════════════════════

INSERT INTO personnel (id, event_id, name, surname, CF, comitato, role, resource, present)
VALUES
  ('44444444-0000-0000-0000-000000000001',
   '11111111-0000-0000-0000-000000000001',
   'Marco', 'Ferrari', 'FRRMRC90A01H501Z', 'Roma 1',
   'medic', '33333333-0000-0000-0000-000000000001', TRUE),

  ('44444444-0000-0000-0000-000000000002',
   '11111111-0000-0000-0000-000000000001',
   'Sofia', 'Ricci', 'RCCSFO95B41H501X', 'Roma 1',
   'volunteer', '33333333-0000-0000-0000-000000000001', TRUE),

  ('44444444-0000-0000-0000-000000000003',
   '11111111-0000-0000-0000-000000000001',
   'Luca', 'Conti', 'CNTLCU88C15H501Y', 'Roma 2',
   'volunteer', '33333333-0000-0000-0000-000000000002', TRUE),

  ('44444444-0000-0000-0000-000000000004',
   '11111111-0000-0000-0000-000000000001',
   'Anna', 'Marino', 'MRNNNA92D41H501W', 'Roma 3',
   'medic', '33333333-0000-0000-0000-000000000003', TRUE),

  ('44444444-0000-0000-0000-000000000005',
   '11111111-0000-0000-0000-000000000001',
   'Paolo', 'Greco', 'GRCPLA85E01H501V', 'Roma 2',
   'coordinator', NULL, TRUE);  -- coordinator not assigned to a specific resource

-- verify
SELECT p.name, p.surname, p.role, r.resource AS assigned_resource
FROM personnel p
LEFT JOIN resources r ON r.id = p.resource
WHERE p.event_id = '11111111-0000-0000-0000-000000000001';


-- ═══════════════════════════════════════════════════════════════
-- 5. LOCATION HISTORY  (triggers resources_current_status)
-- ═══════════════════════════════════════════════════════════════
-- Each INSERT here should automatically upsert resources_current_status
-- via trg_update_resource_location

INSERT INTO location_history (resource_id, event_id, geom, accuracy_m, speed_kmh, heading_deg)
VALUES
  -- ASM-01 moving along the course
  ('33333333-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001',
   ST_SetSRID(ST_MakePoint(12.4930, 41.8910), 4326), 5.0, 40.0, 270),

  -- BICI-01 near km 5
  ('33333333-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000001',
   ST_SetSRID(ST_MakePoint(12.4800, 41.8970), 4326), 8.0, 15.0, 180),

  -- SAP-Alpha stationary at post
  ('33333333-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000001',
   ST_SetSRID(ST_MakePoint(12.4816, 41.8855), 4326), 3.0, 0.0, 0);

-- verify resources_current_status was auto-populated by trigger
SELECT 
  r.resource,
  ST_X(rcs.geom) AS lng,
  ST_Y(rcs.geom) AS lat,
  rcs.speed_kmh,
  rcs.status,
  rcs.active_responses,
  rcs.location_updated_at
FROM resources_current_status rcs
JOIN resources r ON r.id = rcs.resource_id;

-- update ASM-01 position again — should update existing row, not insert new one
INSERT INTO location_history (resource_id, event_id, geom, accuracy_m, speed_kmh, heading_deg)
VALUES (
  '33333333-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001',
  ST_SetSRID(ST_MakePoint(12.4950, 41.8920), 4326), 4.0, 38.0, 265
);

-- resources_current_status should show new position for ASM-01
SELECT r.resource, ST_X(rcs.geom) AS lng, ST_Y(rcs.geom) AS lat, rcs.location_updated_at
FROM resources_current_status rcs
JOIN resources r ON r.id = rcs.resource_id
WHERE rcs.resource_id = '33333333-0000-0000-0000-000000000001';


-- ═══════════════════════════════════════════════════════════════
-- 6. INCIDENTS
-- ═══════════════════════════════════════════════════════════════

-- Incident 1: field team reports via RPC (full form submission)
SELECT create_incident_with_assessment(
  '11111111-0000-0000-0000-000000000001',  -- event_id
  '33333333-0000-0000-0000-000000000002',  -- resource_id (BICI-01)
  'cardiac',                               -- incident_type
  12.4810, 41.8960,                        -- lng, lat
  null,                                    -- patient_name
  52,                                      -- patient_age
  'M',                                     -- patient_gender
  'Red bracelet #14',                      -- patient_identifier
  'Runner collapsed, unresponsive. Bystander performing CPR.',
  null,                                    -- initial_outcome = null → treating
  false,                                   -- conscious
  false,                                   -- respiration
  false,                                   -- circulation
  null,                                    -- heart_rate (unknown on arrival)
  70,                                      -- spo2
  'red',                                   -- triage
  'No pulse on arrival. CPR in progress. AED being applied.'
);

-- Incident 2: control room logs it directly (no resource yet, no assessment)
INSERT INTO incidents (id, event_id, incident_type, geom, patient_age, patient_gender, notes)
VALUES (
  '55555555-0000-0000-0000-000000000002',
  '11111111-0000-0000-0000-000000000001',
  'trauma',
  ST_SetSRID(ST_MakePoint(12.4900, 41.8880), 4326),
  35, 'F',
  'Runner fell, possible ankle fracture. Self-reported at km 18.'
);
-- reported_by_resource_id is NULL → trigger does not fire → no auto-response
-- status stays 'open' until control room assigns a resource

-- verify
SELECT id, incident_type, status, current_triage,
       ST_X(geom) AS lng, ST_Y(geom) AS lat
FROM incidents;


-- ═══════════════════════════════════════════════════════════════
-- 7. INCIDENT RESPONSES  (triggers resources_current_status)
-- ═══════════════════════════════════════════════════════════════

-- check: BICI-01 should now be 'busy' with active_responses = 1
SELECT r.resource, rcs.status, rcs.active_responses
FROM resources_current_status rcs
JOIN resources r ON r.id = rcs.resource_id
WHERE rcs.resource_id = '33333333-0000-0000-0000-000000000002';

-- ASM-01 dispatched to same incident as backup
INSERT INTO incident_responses (id, event_id, incident_id, resource_id, geom, role, outcome)
VALUES (
  '66666666-0000-0000-0000-000000000002',
  '11111111-0000-0000-0000-000000000001',
  '55555555-0000-0000-0000-000000000001',
  '33333333-0000-0000-0000-000000000001',  -- ASM-01
  ST_SetSRID(ST_MakePoint(12.4935, 41.8915), 4326),  -- ASM current position
  'backup', 'treating'
);

-- check: ASM-01 also now 'busy'
SELECT r.resource, rcs.status, rcs.active_responses
FROM resources_current_status rcs
JOIN resources r ON r.id = rcs.resource_id;

-- SAP-Alpha assigned to incident 2 (trauma)
INSERT INTO incident_responses (id, event_id, incident_id, resource_id, geom, role, outcome)
VALUES (
  '66666666-0000-0000-0000-000000000003',
  '11111111-0000-0000-0000-000000000001',
  '55555555-0000-0000-0000-000000000002',
  '33333333-0000-0000-0000-000000000003',  -- SAP-Alpha
  ST_SetSRID(ST_MakePoint(12.4816, 41.8855), 4326),
  'first_responder', 'treating'
);


-- ═══════════════════════════════════════════════════════════════
-- 8. PATIENT ASSESSMENTS  (triggers incidents.current_triage)
-- ═══════════════════════════════════════════════════════════════

-- check: incidents.current_triage should now be 'red'
SELECT id, incident_type, status, current_triage FROM incidents
WHERE id = '55555555-0000-0000-0000-000000000001';

-- Second assessment after AED — patient improving
INSERT INTO patient_assessments 
  (incident_id, response_id, conscious, respiration, circulation, heart_rate, spo2, triage, notes, geom)
VALUES (
  '55555555-0000-0000-0000-000000000001',
  '66666666-0000-0000-0000-000000000002',  -- ASM-01's response
  TRUE, TRUE, TRUE, 88, 94,
  'red',  -- still red, but improving
  'ROSC achieved. Patient conscious but confused. GCS 11. IV access established.',
  ST_SetSRID(ST_MakePoint(12.4810, 41.8960), 4326)
);

-- Assessment for incident 2 by SAP-Alpha — minor trauma
INSERT INTO patient_assessments 
  (incident_id, response_id, conscious, respiration, circulation, heart_rate, spo2, triage, notes)
VALUES (
  '55555555-0000-0000-0000-000000000002',
  '66666666-0000-0000-0000-000000000003',  -- SAP-Alpha response
  TRUE, TRUE, TRUE, 92, 98,
  'green',
  'Alert and oriented. Right ankle swollen, no deformity. Ice applied.'
);

-- check: full assessment history for incident 1 (in chronological order)
SELECT 
  pa.assessed_at,
  r.resource AS recorded_by_unit,
  pa.conscious, pa.respiration, pa.circulation,
  pa.heart_rate, pa.spo2, pa.triage, pa.notes
FROM patient_assessments pa
JOIN incident_responses ir ON ir.id = pa.response_id
JOIN resources r ON r.id = ir.resource_id
WHERE pa.incident_id = '55555555-0000-0000-0000-000000000001'
ORDER BY pa.assessed_at ASC;


-- ═══════════════════════════════════════════════════════════════
-- 9. HANDOFF: ASM-01 transports patient to hospital
-- ═══════════════════════════════════════════════════════════════

-- Step 1: create new response row for SAP-Alpha as receiving unit
INSERT INTO incident_responses (id, event_id, incident_id, resource_id, role, outcome)
VALUES (
  '66666666-0000-0000-0000-000000000004',
  '11111111-0000-0000-0000-000000000001',
  'db9336ea-a45f-4245-a6d4-f2151cbd1be3',
  '33333333-0000-0000-0000-000000000003',  -- SAP-Alpha receives
  'receiving', 'treating'
);

-- Step 2: update ASM-01 response — outcome = transported, fill hospital_info,
--         set handoff_to point to the new SAP-Alpha response row
UPDATE incident_responses
SET
  outcome = 'transported',
  released_at = now(),
  hospital_info = '{
    "hospital_name":    "Ospedale San Giovanni Addolorata",
    "departure_time":   "2025-04-06T10:45:00+02:00",
    "arrival_time":     null,
    "handoff_notes":    "ROSC achieved, GCS 11, IV access, monitoring en route",
    "receiving_doctor": "Dr. Ferrara"
  }'::jsonb,
  handoff_to_response_id = '66666666-0000-0000-0000-000000000004'
WHERE id = '66666666-0000-0000-0000-000000000002';  -- ASM-01's response

-- check: ASM-01 should drop to 0 active responses → status = free
-- (BICI-01 still treating, so incident stays in_progress)
SELECT r.resource, rcs.status, rcs.active_responses
FROM resources_current_status rcs
JOIN resources r ON r.id = rcs.resource_id;


-- ═══════════════════════════════════════════════════════════════
-- 10. RESOLVE INCIDENT 2
-- ═══════════════════════════════════════════════════════════════

UPDATE incident_responses
SET outcome = 'treated_and_released', released_at = now(),
    notes = 'Patient discharged with ice pack and advice to seek X-ray.'
WHERE id = '66666666-0000-0000-0000-000000000003';  -- SAP-Alpha on incident 2

-- SAP-Alpha should now be free (no more active responses)
SELECT r.resource, rcs.status, rcs.active_responses
FROM resources_current_status rcs
JOIN resources r ON r.id = rcs.resource_id
WHERE rcs.resource_id = '33333333-0000-0000-0000-000000000003';


-- ═══════════════════════════════════════════════════════════════
-- 11. FINAL OVERVIEW QUERY
-- ═══════════════════════════════════════════════════════════════

SELECT
  i.incident_type,
  i.current_triage,
  i.status AS incident_status,
  COUNT(ir.id)                                        AS total_responses,
  COUNT(ir.id) FILTER (WHERE ir.outcome = 'treating') AS still_active,
  string_agg(r.resource || ' (' || ir.outcome || ')', ', ') AS resources
FROM incidents i
LEFT JOIN incident_responses ir ON ir.incident_id = i.id
LEFT JOIN resources r ON r.id = ir.resource_id
WHERE i.event_id = '11111111-0000-0000-0000-000000000001'
GROUP BY i.id, i.incident_type, i.current_triage, i.status
ORDER BY i.created_at;



-- NEW assestemnt of all the cases for incidents
SET search_path TO prova, public;

-- ═══════════════════════════════════════════════════════════════
-- CLEAN UP previous test data (incidents + responses + assessments)
-- keeping events, resources, personnel, location_history intact
-- ═══════════════════════════════════════════════════════════════

DELETE FROM patient_assessments;
DELETE FROM incident_responses;
DELETE FROM incidents;

-- Reset resource statuses to free
UPDATE resources_current_status 
SET status = 'free'::resource_status_enum, 
    active_responses = 0,
    last_response_at = NULL;

-- verify clean state
SELECT r.resource, rcs.status, rcs.active_responses
FROM resources_current_status rcs
JOIN resources r ON r.id = rcs.resource_id;


-- ═══════════════════════════════════════════════════════════════
-- SCENARIO 1: Solo response → treated and released
-- BICI-01 reports a minor injury, treats on scene, releases
-- ═══════════════════════════════════════════════════════════════

SELECT create_incident_with_assessment(
  '11111111-0000-0000-0000-000000000001',  -- event_id
  '33333333-0000-0000-0000-000000000002',  -- BICI-01
  'trauma',
  12.4800, 41.8970,                        -- lng, lat
  'Giovanni Bianchi',                      -- patient_name
  28, 'M',                                 -- age, gender
  'Green bracelet #05',                    -- identifier
  'Runner with twisted ankle at km 5.',    -- situation notes
  NULL,                                    -- initial_outcome → treating
  TRUE, TRUE, TRUE,                        -- conscious, respiration, circulation
  88, 98,                                  -- heart_rate, spo2
  'green',                                 -- triage
  'Alert, oriented. Right ankle swollen. No deformity.'
);

-- save the incident id for later
DO $$
DECLARE v_id UUID;
BEGIN
  SELECT id INTO v_id FROM incidents ORDER BY created_at DESC LIMIT 1;
  RAISE NOTICE 'Scenario 1 incident_id: %', v_id;
END $$;

-- check: BICI-01 busy, incident in_progress
SELECT r.resource, rcs.status, rcs.active_responses FROM resources_current_status rcs
JOIN resources r ON r.id = rcs.resource_id;
SELECT incident_type, status, current_triage FROM incidents ORDER BY created_at DESC LIMIT 1;

-- BICI-01 resolves it on scene
UPDATE incident_responses
SET outcome     = 'treated_and_released'::response_outcome_enum,
    released_at = NOW(),
    notes       = 'Ice applied, advised to seek X-ray. Patient walked away unaided.'
WHERE resource_id = '33333333-0000-0000-0000-000000000002'
  AND outcome   = 'treating';

-- check: BICI-01 free, incident resolved
SELECT r.resource, rcs.status, rcs.active_responses FROM resources_current_status rcs
JOIN resources r ON r.id = rcs.resource_id;
SELECT incident_type, status, current_triage FROM incidents ORDER BY created_at DESC LIMIT 1;


-- ═══════════════════════════════════════════════════════════════
-- SCENARIO 2: Solo response → transported to hospital
-- ASM-01 responds to cardiac, transports to hospital
-- ═══════════════════════════════════════════════════════════════

SELECT create_incident_with_assessment(
  '11111111-0000-0000-0000-000000000001',
  '33333333-0000-0000-0000-000000000001',  -- ASM-01
  'cardiac',
  12.4922, 41.8902,
  NULL, 61, 'F',
  'Blue bracelet #11',
  'Runner collapsed at km 10. Bystander CPR in progress.',
  NULL,
  FALSE, FALSE, FALSE,
  NULL, 65,
  'red',
  'No pulse on arrival. AED applied x2. No ROSC yet.'
);

-- check: ASM-01 busy, incident in_progress, triage red
SELECT r.resource, rcs.status, rcs.active_responses FROM resources_current_status rcs
JOIN resources r ON r.id = rcs.resource_id;
SELECT incident_type, status, current_triage FROM incidents ORDER BY created_at DESC LIMIT 1;

-- second assessment after ROSC
INSERT INTO patient_assessments (incident_id, response_id, conscious, respiration, 
  circulation, heart_rate, spo2, triage, notes, geom)
SELECT 
  ir.incident_id, ir.id,
  TRUE, TRUE, TRUE, 90, 94,
  'red',
  'ROSC achieved. GCS 12. IV access. Preparing for transport.',
  ST_SetSRID(ST_MakePoint(12.4922, 41.8902), 4326)
FROM incident_responses ir
WHERE ir.resource_id = '33333333-0000-0000-0000-000000000001'
  AND ir.outcome = 'treating'
ORDER BY ir.assigned_at DESC LIMIT 1;

-- ASM-01 transports to hospital
UPDATE incident_responses
SET outcome       = 'transported'::response_outcome_enum,
    released_at   = NOW(),
    hospital_info = '{
      "hospital_name":    "Ospedale San Giovanni Addolorata",
      "departure_time":   "2026-04-06T10:15:00+02:00",
      "arrival_time":     null,
      "handoff_notes":    "ROSC achieved, GCS 12, IV access, monitoring en route",
      "receiving_doctor": "Dr. Ferrara"
    }'::jsonb
WHERE resource_id = '33333333-0000-0000-0000-000000000001'
  AND outcome = 'treating';

-- check: ASM-01 free, incident taken_to_hospital
SELECT r.resource, rcs.status, rcs.active_responses FROM resources_current_status rcs
JOIN resources r ON r.id = rcs.resource_id;
SELECT incident_type, status, current_triage FROM incidents ORDER BY created_at DESC LIMIT 1;


-- ═══════════════════════════════════════════════════════════════
-- SCENARIO 3: Handoff between two resources
-- BICI-01 first on scene → hands off to ASM-01
-- ═══════════════════════════════════════════════════════════════

SELECT create_incident_with_assessment(
  '11111111-0000-0000-0000-000000000001',
  '33333333-0000-0000-0000-000000000002',  -- BICI-01 first responder
  'medical',
  12.4816, 41.8855,
  'Maria Rossi', 45, 'F',
  'Yellow bracelet #07',
  'Runner dizzy and nauseous at km 15. Sitting on ground.',
  NULL,
  TRUE, TRUE, TRUE,
  105, 97,
  'yellow',
  'Alert, pale, diaphoretic. Suspected heat exhaustion.'
);

-- check: BICI-01 busy
SELECT r.resource, rcs.status, rcs.active_responses FROM resources_current_status rcs
JOIN resources r ON r.id = rcs.resource_id;

-- ASM-01 arrives as backup
INSERT INTO incident_responses (event_id, incident_id, resource_id, geom, role, outcome)
SELECT
  ir.event_id, ir.incident_id,
  '33333333-0000-0000-0000-000000000001',  -- ASM-01
  ST_SetSRID(ST_MakePoint(12.4816, 41.8855), 4326),
  'backup',
  'treating'::response_outcome_enum
FROM incident_responses ir
WHERE ir.resource_id = '33333333-0000-0000-0000-000000000002'
  AND ir.outcome = 'treating'
ORDER BY ir.assigned_at DESC LIMIT 1;

-- check: both busy
SELECT r.resource, rcs.status, rcs.active_responses FROM resources_current_status rcs
JOIN resources r ON r.id = rcs.resource_id;

-- BICI-01 formally hands off to ASM-01 and leaves
UPDATE incident_responses
SET outcome                = 'handed_off'::response_outcome_enum,
    released_at            = NOW(),
    handoff_to_response_id = (
      SELECT id FROM incident_responses
      WHERE resource_id = '33333333-0000-0000-0000-000000000001'
        AND outcome = 'treating'
      ORDER BY assigned_at DESC LIMIT 1
    ),
    notes = 'Handed off to ASM-01. Patient stable, IV access established.'
WHERE resource_id = '33333333-0000-0000-0000-000000000002'
  AND outcome = 'treating';

-- check: BICI-01 free, ASM-01 still busy, incident still in_progress
SELECT r.resource, rcs.status, rcs.active_responses FROM resources_current_status rcs
JOIN resources r ON r.id = rcs.resource_id;
SELECT incident_type, status, current_triage FROM incidents ORDER BY created_at DESC LIMIT 1;

-- ASM-01 resolves it
UPDATE incident_responses
SET outcome     = 'treated_and_released'::response_outcome_enum,
    released_at = NOW(),
    notes       = 'Patient recovered. Discharged with advice to hydrate and rest.'
WHERE resource_id = '33333333-0000-0000-0000-000000000001'
  AND outcome = 'treating';

-- check: both free, incident resolved
SELECT r.resource, rcs.status, rcs.active_responses FROM resources_current_status rcs
JOIN resources r ON r.id = rcs.resource_id;
SELECT incident_type, status, current_triage FROM incidents ORDER BY created_at DESC LIMIT 1;


-- ═══════════════════════════════════════════════════════════════
-- SCENARIO 4: Multiple resources, one transports
-- All three resources on same incident
-- ASM-01 transports → BICI-01 and SAP-Alpha auto handed_off to ASM-01
-- ═══════════════════════════════════════════════════════════════

SELECT create_incident_with_assessment(
  '11111111-0000-0000-0000-000000000001',
  '33333333-0000-0000-0000-000000000002',  -- BICI-01 first on scene
  'trauma',
  12.4822, 41.8958,
  NULL, 35, 'M',
  'Red bracelet #22',
  'Runner hit barrier at km 8. Head injury, bleeding.',
  NULL,
  TRUE, TRUE, TRUE,
  100, 96,
  'red',
  'Laceration on forehead. GCS 13. Cervical collar applied.'
);

-- ASM-01 joins
INSERT INTO incident_responses (event_id, incident_id, resource_id, geom, role, outcome)
SELECT
  ir.event_id, ir.incident_id,
  '33333333-0000-0000-0000-000000000001',  -- ASM-01
  ST_SetSRID(ST_MakePoint(12.4822, 41.8958), 4326),
  'backup', 'treating'::response_outcome_enum
FROM incident_responses ir
WHERE ir.resource_id = '33333333-0000-0000-0000-000000000002'
  AND ir.outcome = 'treating'
ORDER BY ir.assigned_at DESC LIMIT 1;

-- SAP-Alpha also joins
INSERT INTO incident_responses (event_id, incident_id, resource_id, geom, role, outcome)
SELECT
  ir.event_id, ir.incident_id,
  '33333333-0000-0000-0000-000000000003',  -- SAP-Alpha
  ST_SetSRID(ST_MakePoint(12.4816, 41.8855), 4326),
  'backup', 'treating'::response_outcome_enum
FROM incident_responses ir
WHERE ir.resource_id = '33333333-0000-0000-0000-000000000002'
  AND ir.outcome = 'treating'
ORDER BY ir.assigned_at DESC LIMIT 1;

-- check: all three busy, incident in_progress
SELECT r.resource, rcs.status, rcs.active_responses FROM resources_current_status rcs
JOIN resources r ON r.id = rcs.resource_id;
SELECT incident_type, status, current_triage FROM incidents ORDER BY created_at DESC LIMIT 1;

-- ASM-01 transports → trigger closes BICI-01 and SAP-Alpha as handed_off to ASM-01
UPDATE incident_responses
SET outcome       = 'transported'::response_outcome_enum,
    released_at   = NOW(),
    hospital_info = '{
      "hospital_name":    "Policlinico Umberto I",
      "departure_time":   "2026-04-06T11:30:00+02:00",
      "arrival_time":     null,
      "handoff_notes":    "Head trauma, GCS 13, cervical collar, IV access",
      "receiving_doctor": "Dr. Marino"
    }'::jsonb
WHERE resource_id = '33333333-0000-0000-0000-000000000001'  -- ASM-01
  AND outcome = 'treating';

-- check: all three free, incident taken_to_hospital
SELECT r.resource, rcs.status, rcs.active_responses FROM resources_current_status rcs
JOIN resources r ON r.id = rcs.resource_id;
SELECT incident_type, status, current_triage FROM incidents ORDER BY created_at DESC LIMIT 1;

-- verify BICI-01 and SAP-Alpha have handoff_to_response_id pointing to ASM-01's response
SELECT 
  r.resource,
  ir.outcome,
  ir.released_at,
  ir.notes,
  (SELECT r2.resource FROM incident_responses ir2 
   JOIN resources r2 ON r2.id = ir2.resource_id
   WHERE ir2.id = ir.handoff_to_response_id) AS handed_off_to
FROM incident_responses ir
JOIN resources r ON r.id = ir.resource_id
WHERE ir.incident_id = (SELECT id FROM incidents ORDER BY created_at DESC LIMIT 1)
ORDER BY ir.assigned_at;


-- ═══════════════════════════════════════════════════════════════
-- SCENARIO 5: Status reversal
-- Team marks patient released, then realises they were wrong → back to treating
-- ═══════════════════════════════════════════════════════════════

SELECT create_incident_with_assessment(
  '11111111-0000-0000-0000-000000000001',
  '33333333-0000-0000-0000-000000000002',  -- BICI-01
  'medical',
  12.4900, 41.8990,
  NULL, 55, 'F',
  'Green bracelet #03',
  'Runner feeling faint at km 3.',
  NULL,
  TRUE, TRUE, TRUE,
  95, 99,
  'green',
  'Patient sitting, alert. BP slightly low.'
);

-- BICI-01 marks as released (too soon)
UPDATE incident_responses
SET outcome     = 'treated_and_released'::response_outcome_enum,
    released_at = NOW()
WHERE resource_id = '33333333-0000-0000-0000-000000000002'
  AND outcome = 'treating';

-- check: BICI-01 free, incident resolved
SELECT r.resource, rcs.status, rcs.active_responses FROM resources_current_status rcs
JOIN resources r ON r.id = rcs.resource_id
WHERE rcs.resource_id = '33333333-0000-0000-0000-000000000002';
SELECT incident_type, status FROM incidents ORDER BY created_at DESC LIMIT 1;

-- patient deteriorates → revert back to treating
UPDATE incident_responses
SET outcome     = 'treating'::response_outcome_enum,
    released_at = NULL
WHERE resource_id = '33333333-0000-0000-0000-000000000002'
  AND outcome = 'treated_and_released'
  AND incident_id = (SELECT id FROM incidents ORDER BY created_at DESC LIMIT 1);

-- check: BICI-01 busy again, incident back to in_progress
SELECT r.resource, rcs.status, rcs.active_responses FROM resources_current_status rcs
JOIN resources r ON r.id = rcs.resource_id
WHERE rcs.resource_id = '33333333-0000-0000-0000-000000000002';
SELECT incident_type, status FROM incidents ORDER BY created_at DESC LIMIT 1;


-- ═══════════════════════════════════════════════════════════════
-- SCENARIO 6: Control room logs incident, assigns resource later
-- ═══════════════════════════════════════════════════════════════

INSERT INTO incidents (id, event_id, incident_type, geom, patient_age, patient_gender, notes)
VALUES (
  '55555555-0000-0000-0000-000000000099',
  '11111111-0000-0000-0000-000000000001',
  'environmental',
  ST_SetSRID(ST_MakePoint(12.4750, 41.9000), 4326),
  42, 'M',
  'Runner reported overheating near km 2. Sitting by the road.'
);

-- check: incident exists with status open, no responses
SELECT incident_type, status, current_triage FROM incidents 
WHERE id = '55555555-0000-0000-0000-000000000099';
SELECT COUNT(*) AS response_count FROM incident_responses 
WHERE incident_id = '55555555-0000-0000-0000-000000000099';

-- control room assigns SAP-Alpha
INSERT INTO incident_responses (event_id, incident_id, resource_id, geom, role, outcome)
VALUES (
  '11111111-0000-0000-0000-000000000001',
  '55555555-0000-0000-0000-000000000099',
  '33333333-0000-0000-0000-000000000003',  -- SAP-Alpha
  ST_SetSRID(ST_MakePoint(12.4816, 41.8855), 4326),
  'first_responder',
  'treating'::response_outcome_enum
);

-- check: SAP-Alpha busy, incident in_progress
SELECT r.resource, rcs.status, rcs.active_responses FROM resources_current_status rcs
JOIN resources r ON r.id = rcs.resource_id
WHERE rcs.resource_id = '33333333-0000-0000-0000-000000000003';
SELECT incident_type, status FROM incidents 
WHERE id = '55555555-0000-0000-0000-000000000099';

-- SAP-Alpha resolves it
UPDATE incident_responses
SET outcome     = 'treated_and_released'::response_outcome_enum,
    released_at = NOW(),
    notes       = 'Patient cooled down, rehydrated. Released.'
WHERE resource_id = '33333333-0000-0000-0000-000000000003'
  AND outcome = 'treating';

-- check: SAP-Alpha free, incident resolved
SELECT r.resource, rcs.status, rcs.active_responses FROM resources_current_status rcs
JOIN resources r ON r.id = rcs.resource_id
WHERE rcs.resource_id = '33333333-0000-0000-0000-000000000003';
SELECT incident_type, status FROM incidents 
WHERE id = '55555555-0000-0000-0000-000000000099';


-- ═══════════════════════════════════════════════════════════════
-- FINAL OVERVIEW
-- ═══════════════════════════════════════════════════════════════

SELECT
  i.incident_type,
  i.current_triage,
  i.status,
  COUNT(ir.id)                                              AS total_responses,
  COUNT(ir.id) FILTER (WHERE ir.outcome = 'treating')       AS still_active,
  string_agg(r.resource || ' → ' || ir.outcome, ', ' 
    ORDER BY ir.assigned_at)                                AS resource_outcomes
FROM incidents i
LEFT JOIN incident_responses ir ON ir.incident_id = i.id
LEFT JOIN resources r ON r.id = ir.resource_id
WHERE i.event_id = '11111111-0000-0000-0000-000000000001'
GROUP BY i.id, i.incident_type, i.current_triage, i.status
ORDER BY i.created_at;