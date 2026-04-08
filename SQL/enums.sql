-- Enum types for various fields in the database. These are defined as separate types to allow for easy modification and consistency across tables.

--Incident_status
CREATE TYPE incident_status_enum AS ENUM (
  'open',             -- recorded, no unit assigned yet
  'in_progress',      -- at least one unit actively responding
  'resolved',         -- patient treated and released on scene
  'taken_to_hospital',-- patient transported
  'cancelled'         -- false alarm / duplicate
);

--Triage category for patients involved in incidents
CREATE TYPE triage_enum AS ENUM (
  'red',      
  'yellow',   
  'green',    
  'white'     
);

--Current outcome
CREATE TYPE response_outcome_enum AS ENUM (
  'treating',           -- currently active, no outcome yet
  'treated_and_released',
  'handed_off',         -- passed to another unit on scene
  'transported',        -- this unit took patient to hospital/post
  'cancelled'
);

--Resource types
CREATE TYPE type_enum AS ENUM (
    'ASM',
    'ASI',
    'SAP',
    'BICI',
    'MM',
    'PMA',
    'LDC',
    'ALTRO');


--Resource status
CREATE TYPE resource_status_enum AS ENUM ('free', 'busy', 'stopped');

--Incident types
CREATE TYPE incident_type_enum AS ENUM (
  'medical',
  'trauma', 
  'cardiac',
  'respiratory',
  'environmental',
  'other'
);

