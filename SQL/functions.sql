CREATE OR REPLACE FUNCTION create_incident_with_assessment(
  p_event_id              UUID,
  p_resource_id           UUID,
  p_personnel_id          UUID,        -- nullable: who on the team is recording
  p_reporting_resource_id UUID,        -- nullable, for when an incident is reported from PCA
  p_incident_type         incident_type_enum,
  p_lng                   FLOAT,
  p_lat                   FLOAT,
  p_location_description  TEXT,
  p_patient_name          TEXT,
  p_patient_age           INTEGER,
  p_patient_gender        TEXT,
  p_patient_identifier    TEXT,
  p_initial_outcome       response_outcome_enum,
  -- assessment fields
  p_conscious             BOOLEAN,
  p_respiration           BOOLEAN,
  p_circulation           BOOLEAN,
  p_walking               BOOLEAN,
  p_minor_injuries        BOOLEAN,
  p_heart_rate            INTEGER,
  p_spo2                  INTEGER,
  p_breathing_rate        INTEGER,
  p_blood_pressure        TEXT,
  p_temperature           NUMERIC(4,1),
  p_triage                triage_enum,
  p_description           TEXT,
  p_clinical_notes        TEXT
)
RETURNS JSON AS $$
DECLARE
  v_incident_id   UUID;
  v_response_id   UUID;
  v_geom          GEOMETRY;
  v_pca_resp_id   UUID;
  v_assess_resp_id  UUID;
BEGIN
  -- Build geometry (handle null coordinates gracefully)
  IF p_lng IS NOT NULL AND p_lat IS NOT NULL THEN
    v_geom := ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326);
  ELSE
    v_geom := NULL;
  END IF;

  -- 1. Insert incident (this is done thanks to a trigger TODO: maybe change this?) 
  INSERT INTO incidents (
    event_id, incident_type, geom,
    patient_name, patient_age, patient_gender, patient_identifier,
    description, location_description, reported_by_resource_id, initial_outcome
  )
  VALUES (
    p_event_id, p_incident_type, v_geom,
    p_patient_name, p_patient_age, p_patient_gender, p_patient_identifier,
    p_description, p_location_description, p_resource_id, p_initial_outcome
  )
  RETURNING id INTO v_incident_id;

  -- 2. Get the auto-created response id (created by trigger)
  --    Also update it with personnel_id now that we have the response id
  SELECT id INTO v_response_id
  FROM incident_responses
  WHERE incident_id = v_incident_id
    AND resource_id = p_resource_id
  ORDER BY assigned_at DESC
  LIMIT 1;

  -- Set personnel on the response
  IF v_response_id IS NOT NULL AND p_personnel_id IS NOT NULL THEN
    UPDATE incident_responses
    SET personnel_id = p_personnel_id
    WHERE id = v_response_id;
  END IF;

  -- 3. Insert initial assessment
  -- Determine which response owns the assessment

  IF p_reporting_resource_id IS NOT NULL 
    AND p_reporting_resource_id IS DISTINCT FROM p_resource_id
    AND (p_initial_outcome = 'en_route_to_incident' OR p_resource_id IS NULL) THEN 
    INSERT INTO incident_responses (
      event_id, incident_id, resource_id,
      role, outcome, assigned_at
    )
    VALUES (
      p_event_id, v_incident_id, p_reporting_resource_id,
      'reporting', 'reporting', now()
    )
    RETURNING id INTO v_pca_resp_id;
    v_assess_resp_id := v_pca_resp_id;
  ELSE
    v_assess_resp_id := v_response_id;
  END IF;
  IF v_assess_resp_id IS NOT NULL THEN
    INSERT INTO patient_assessments (
      incident_id, response_id,
      assessed_by,
      conscious, respiration, circulation, walking, minor_injuries,
      heart_rate, spo2, breathing_rate, blood_pressure, temperature,
      triage, description, clinical_notes,
      geom
    )
    VALUES (
      v_incident_id, v_assess_resp_id,
      p_personnel_id,
      p_conscious, p_respiration, p_circulation, p_walking, p_minor_injuries,
      p_heart_rate, p_spo2, p_breathing_rate, p_blood_pressure, p_temperature,
      p_triage, p_description, p_clinical_notes,
      v_geom
    );
  END IF;

  RETURN json_build_object(
    'incident_id', v_incident_id,
    'response_id', v_response_id,
    'pca_response_id', v_pca_resp_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;



-- Function for the case when team A handsoff to team B a patient
CREATE OR REPLACE FUNCTION handoff_incident(
  p_from_response_id  UUID,
  p_to_resource_id    UUID,
  p_to_personnel_id   UUID,        -- nullable: who on receiving team
  p_outcome           response_outcome_enum,
  p_notes             TEXT,
  p_hospital_info     JSONB
)
RETURNS UUID AS $$
DECLARE
  v_incident_id   UUID;
  v_event_id      UUID;
  v_new_response  UUID;
BEGIN
  SELECT incident_id, event_id
  INTO v_incident_id, v_event_id
  FROM incident_responses
  WHERE id = p_from_response_id;
  -- Create receiving team's response row
  INSERT INTO incident_responses (
    event_id, incident_id, resource_id, personnel_id,
    role, outcome, assigned_at
  )
  VALUES (
    v_event_id, v_incident_id, p_to_resource_id, p_to_personnel_id,
    'receiving', 'treating', now()
  )
  RETURNING id INTO v_new_response;
  -- Close sending team's response
  UPDATE incident_responses
  SET
    outcome                = p_outcome,
    released_at            = now(),
    handoff_to_response_id = v_new_response,
    notes                  = p_notes,
    hospital_info          = p_hospital_info
  WHERE id = p_from_response_id;

  RETURN v_new_response;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;