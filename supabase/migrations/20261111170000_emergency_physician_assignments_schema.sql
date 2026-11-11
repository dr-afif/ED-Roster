-- Migration: 20261111170000_emergency_physician_assignments_schema.sql
-- Description: Emergency Physician Assignments for Calendar View and EP duty scheduling

CREATE TABLE IF NOT EXISTS public.roster_ep_assignments (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  period_id bigint NOT NULL REFERENCES public.roster_periods(id) ON DELETE CASCADE,
  duty_date date NOT NULL,
  slot_type text NOT NULL CHECK (slot_type IN ('EP_OFFICE_HOUR', 'EP_ONCALL')),
  physician_names text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id),
  CONSTRAINT roster_ep_assignments_unique_slot UNIQUE (period_id, duty_date, slot_type)
);

CREATE INDEX IF NOT EXISTS idx_roster_ep_assignments_period_date 
  ON public.roster_ep_assignments(period_id, duty_date);

ALTER TABLE public.roster_ep_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "roster_ep_assignments_read_policy" ON public.roster_ep_assignments;
CREATE POLICY "roster_ep_assignments_read_policy"
  ON public.roster_ep_assignments
  FOR SELECT
  TO authenticated
  USING (private.is_active_approved_user());

DROP POLICY IF EXISTS "roster_ep_assignments_write_policy" ON public.roster_ep_assignments;
CREATE POLICY "roster_ep_assignments_write_policy"
  ON public.roster_ep_assignments
  FOR ALL
  TO authenticated
  USING (private.is_active_owner())
  WITH CHECK (private.is_active_owner());

CREATE OR REPLACE FUNCTION public.upsert_roster_ep_assignment(
  p_period_id bigint,
  p_duty_date date,
  p_slot_type text,
  p_physician_names text
)
RETURNS public.roster_ep_assignments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_result public.roster_ep_assignments;
BEGIN
  IF NOT private.is_active_owner() THEN
    RAISE EXCEPTION 'Only active owners may modify emergency physician assignments' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.roster_ep_assignments (period_id, duty_date, slot_type, physician_names, updated_at, updated_by)
  VALUES (p_period_id, p_duty_date, p_slot_type, p_physician_names, now(), auth.uid())
  ON CONFLICT (period_id, duty_date, slot_type)
  DO UPDATE SET
    physician_names = EXCLUDED.physician_names,
    updated_at = now(),
    updated_by = auth.uid()
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;
