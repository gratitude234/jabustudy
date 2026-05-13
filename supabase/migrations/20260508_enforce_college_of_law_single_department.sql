DO $$
DECLARE
  law_faculty_id uuid;
  law_faculty_name text;
  single_department_id uuid;
  other_department_ids uuid[];
  target_department_name text := 'Department of Law';
BEGIN
  SELECT id, name
    INTO law_faculty_id, law_faculty_name
  FROM public.study_faculties
  WHERE lower(trim(name)) = 'college of law'
  LIMIT 1;

  IF law_faculty_id IS NULL THEN
    RAISE NOTICE 'College of Law faculty not found; skipping single department enforcement.';
    RETURN;
  END IF;

  SELECT id
    INTO single_department_id
  FROM public.study_departments
  WHERE faculty_id = law_faculty_id
    AND lower(trim(name)) IN (
      'department of law',
      'law',
      'college of law',
      'college of law (legacy combined)'
    )
  ORDER BY
    CASE lower(trim(name))
      WHEN 'department of law' THEN 0
      WHEN 'college of law (legacy combined)' THEN 1
      ELSE 2
    END,
    created_at
  LIMIT 1;

  IF single_department_id IS NULL THEN
    INSERT INTO public.study_departments (id, faculty_id, name, sort_order, is_active)
    VALUES (gen_random_uuid(), law_faculty_id, target_department_name, 0, true)
    RETURNING id INTO single_department_id;
  ELSE
    UPDATE public.study_departments
    SET name = target_department_name,
        sort_order = 0,
        is_active = true
    WHERE id = single_department_id;
  END IF;

  SELECT coalesce(array_agg(id), ARRAY[]::uuid[])
    INTO other_department_ids
  FROM public.study_departments
  WHERE faculty_id = law_faculty_id
    AND id <> single_department_id;

  IF coalesce(array_length(other_department_ids, 1), 0) > 0 THEN
    UPDATE public.study_courses
    SET faculty_id = law_faculty_id,
        faculty = law_faculty_name,
        department_id = single_department_id,
        department = target_department_name,
        updated_at = now()
    WHERE department_id = ANY(other_department_ids);

    UPDATE public.study_materials
    SET faculty_id = law_faculty_id,
        faculty = law_faculty_name,
        department_id = single_department_id,
        department = target_department_name,
        updated_at = now()
    WHERE department_id = ANY(other_department_ids);

    UPDATE public.study_preferences
    SET faculty_id = law_faculty_id,
        faculty = law_faculty_name,
        department_id = single_department_id,
        department = target_department_name,
        updated_at = now()
    WHERE department_id = ANY(other_department_ids);

    UPDATE public.study_course_requests
    SET faculty_id = law_faculty_id,
        faculty = law_faculty_name,
        department_id = single_department_id,
        department = target_department_name,
        updated_at = now()
    WHERE department_id = ANY(other_department_ids);

    UPDATE public.study_rep_applications
    SET faculty_id = law_faculty_id,
        department_id = single_department_id,
        updated_at = now()
    WHERE department_id = ANY(other_department_ids);

    UPDATE public.study_reps
    SET faculty_id = law_faculty_id,
        department_id = single_department_id
    WHERE department_id = ANY(other_department_ids);
  END IF;

  UPDATE public.study_courses
  SET faculty_id = law_faculty_id,
      faculty = law_faculty_name,
      department_id = single_department_id,
      department = target_department_name,
      updated_at = now()
  WHERE faculty_id = law_faculty_id
     OR lower(trim(faculty)) = lower(trim(law_faculty_name));

  UPDATE public.study_materials
  SET faculty_id = law_faculty_id,
      faculty = law_faculty_name,
      department_id = single_department_id,
      department = target_department_name,
      updated_at = now()
  WHERE faculty_id = law_faculty_id
     OR lower(trim(faculty)) = lower(trim(law_faculty_name));

  UPDATE public.study_preferences
  SET faculty_id = law_faculty_id,
      faculty = law_faculty_name,
      department_id = single_department_id,
      department = target_department_name,
      updated_at = now()
  WHERE faculty_id = law_faculty_id
     OR lower(trim(faculty)) = lower(trim(law_faculty_name));

  UPDATE public.study_course_requests
  SET faculty_id = law_faculty_id,
      faculty = law_faculty_name,
      department_id = single_department_id,
      department = target_department_name,
      updated_at = now()
  WHERE faculty_id = law_faculty_id
     OR lower(trim(faculty)) = lower(trim(law_faculty_name));

  UPDATE public.study_rep_applications
  SET faculty_id = law_faculty_id,
      department_id = single_department_id,
      updated_at = now()
  WHERE faculty_id = law_faculty_id;

  UPDATE public.study_reps
  SET faculty_id = law_faculty_id,
      department_id = single_department_id
  WHERE faculty_id = law_faculty_id;

  DELETE FROM public.study_departments
  WHERE faculty_id = law_faculty_id
    AND id <> single_department_id;

  UPDATE public.study_departments
  SET name = target_department_name,
      sort_order = 0,
      is_active = true
  WHERE id = single_department_id;
END $$;
