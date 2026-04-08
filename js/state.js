/* ================================================================
   js/state.js
   Single source of truth for the session.
   All modules read and write STATE — never duplicate state locally.
================================================================ */

const STATE = {
  session:   null,   // Supabase Auth session
  resource:  null,   // resources table row for logged-in resource
  event:     null,   // active events row
  personnel: null,   // selected personnel row (nullable — can skip)
  incidents: [],     // currently loaded incidents array
  isOnline:  navigator.onLine,

  // Incident form working state (reset on each form open)
  formData: {
    triage:      null,
    conscious:   null,
    respiration: null,
    circulation: null,
    walking:     null,
    status:      'in_progress',
    outcome:     null,
    transport:   null,
  },

  assessmentData: {
    conscious: null, respiration: null,
    circulation: null, walking: null, triage: null
  }

};