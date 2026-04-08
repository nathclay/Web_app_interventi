-- Geometry Linestring of the route of the event
CREATE TABLE event_route (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid REFERENCES events(id),
  name text NOT NULL,
  geom geometry(LineString, 4326) NOT NULL,
  total_distance_km float GENERATED ALWAYS AS (ST_Length(geom::geography) / 1000) STORED
);
ALTER TABLE event_route ENABLE ROW LEVEL SECURITY;

-- Markers along the route
CREATE TABLE markers_route (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid REFERENCES events(id),
  km float NOT NULL,
  label text,               
  geom geometry(Point, 4326)
);
ALTER TABLE markers_route ENABLE ROW LEVEL SECURITY;


-- Points of interest (internal or external of the route)
-- examples: water station, defibrillator, protezione civile, pizzeria, etc
CREATE TABLE event_poi (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid REFERENCES events(id),
  poi_type text,   -- TODO: create enum list          
  name text NOT NULL,
  properties jsonb,
  geom geometry(Point, 4326)
);
ALTER TABLE event_poi ENABLE ROW LEVEL SECURITY;


-- Road network for routing (pgRouting convention)
CREATE TABLE road_network (
  id bigserial PRIMARY KEY,
  source integer,           -- pgRouting fills these in
  target integer,           -- pgRouting fills these in
  cost float,               -- travel time or distance
  reverse_cost float,
  road_type text,
  geom geometry(LineString, 4326)
);
ALTER TABLE road_network ENABLE ROW LEVEL SECURITY;

