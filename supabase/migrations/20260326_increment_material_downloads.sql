CREATE OR REPLACE FUNCTION increment_material_downloads(p_id uuid)
RETURNS void LANGUAGE sql AS $$
  UPDATE study_materials
  SET downloads = COALESCE(downloads, 0) + 1
  WHERE id = p_id;
$$;
