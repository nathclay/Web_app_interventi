-- Temporarily allow all authenticated users to read everything
-- Replace these with proper role-based policies before go-live

CREATE POLICY "authenticated all operations" ON location_history
FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated all operations" ON incidents
FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated all operations" ON incident_responses
FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated all operations" ON patient_assessments
FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated all operations" ON resources_current_status
FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated all operations" ON resources
FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated all operations" ON personnel
FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated all operations" ON events
FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated all operations" ON event_radio_channels
FOR ALL TO authenticated USING (true) WITH CHECK (true);
