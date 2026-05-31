-- Add missing College/Faculty of Health Science departments.
-- Existing rows under this faculty already include:
-- - Department of Medical Laboratory Science
-- - Department of Nursing

INSERT INTO public.study_departments (id, faculty_id, name, sort_order, is_active)
VALUES
  ('1439d8de-1cd4-40db-83e2-5456dfb722fd', '1c0647b3-d771-43e1-b2af-c6ef119c31ed', 'Department of Public Health', 3, true),
  ('d07290c4-0172-4b98-8fd2-1efbd4198612', '1c0647b3-d771-43e1-b2af-c6ef119c31ed', 'Department of Environmental Health', 4, true),
  ('ba35947e-fd6c-4ec9-90ed-6f2a7391f6bd', '1c0647b3-d771-43e1-b2af-c6ef119c31ed', 'Department of Health Information Management', 5, true)
ON CONFLICT (faculty_id, name)
DO UPDATE SET
  sort_order = EXCLUDED.sort_order,
  is_active = true;
