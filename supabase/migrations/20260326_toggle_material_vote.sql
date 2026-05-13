CREATE OR REPLACE FUNCTION toggle_material_vote(p_material_id uuid, p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  v_voted boolean;
BEGIN
  IF EXISTS (
    SELECT 1 FROM study_material_ratings
    WHERE material_id = p_material_id AND user_id = p_user_id
  ) THEN
    DELETE FROM study_material_ratings
    WHERE material_id = p_material_id AND user_id = p_user_id;

    UPDATE study_materials
    SET up_votes = GREATEST(0, COALESCE(up_votes, 0) - 1)
    WHERE id = p_material_id;

    v_voted := false;
  ELSE
    INSERT INTO study_material_ratings (material_id, user_id, vote)
    VALUES (p_material_id, p_user_id, 1);

    UPDATE study_materials
    SET up_votes = COALESCE(up_votes, 0) + 1
    WHERE id = p_material_id;

    v_voted := true;
  END IF;

  RETURN jsonb_build_object('voted', v_voted);
END;
$$;
