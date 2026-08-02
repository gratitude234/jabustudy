-- GNS 121 Exam Sprint: import 150 questions into the existing private bank
-- Target set: 5a4b65e8-6904-4cf5-87f9-1973824982bb
-- This script refuses to run when the target already contains questions.
BEGIN;

DO $preflight$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.study_quiz_sets WHERE id = '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid AND delivery_mode = 'mock_exam') THEN
    RAISE EXCEPTION 'Target Exam Sprint bank does not exist or is not a mock exam.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.study_quiz_questions WHERE coalesce(set_id, quiz_set_id) = '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid) THEN
    RAISE EXCEPTION 'Target bank already has questions. Import stopped to prevent duplicates.';
  END IF;
END
$preflight$;

-- Question 1
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('9ba205e3-4fe6-41d4-9fe4-5c8160f86027'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'Which drive letter is most commonly assigned to the disk containing the Windows operating system?', 'Windows is normally installed on the drive identified as C:.', 'mcq', 0, 'recall', 'easy', 'recall', 'Windows and File Management', '3845fa4f7f2924abd4cb326a6b84818a113188e3ba88504de698a6a0d1b61095', '{"sourceLabel":"Revision Questions 2025, Q1","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q1"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('56d92ca8-b8a9-432c-b646-2db4dacaa437'::uuid, '9ba205e3-4fe6-41d4-9fe4-5c8160f86027'::uuid, 'A:', false, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('954daaba-6355-44d9-a38a-ab3776dd0485'::uuid, '9ba205e3-4fe6-41d4-9fe4-5c8160f86027'::uuid, 'C:', true, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('83fa0c98-e1bc-4cf6-a117-c40739595d21'::uuid, '9ba205e3-4fe6-41d4-9fe4-5c8160f86027'::uuid, 'D:', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('26c8706a-1b50-4eb5-a4a0-18b205988a7d'::uuid, '9ba205e3-4fe6-41d4-9fe4-5c8160f86027'::uuid, 'Z:', false, 3, now());

-- Question 2
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('814539aa-07f7-404a-bc62-a6c7fc901e86'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'A folder contains separate subfolders for courses, semesters and assignments. What does this arrangement represent?', 'A directory structure is the hierarchical organization of folders and files on a storage device.', 'mcq', 1, 'application', 'medium', 'application', 'Windows and File Management', '34f754e24171c6b0ac96b39e48815d6fc77f497e5b5fd09c677d07e485ec2942', '{"sourceLabel":"Revision Questions 2025, Q3; Revision Guide, p.1","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q3; Revision Guide, p.1"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('2df9c1bd-e52d-4a57-af26-d9622d2ffb1c'::uuid, '814539aa-07f7-404a-bc62-a6c7fc901e86'::uuid, 'A file extension', false, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('de29515c-dbb7-41c4-81c9-d76193d8c884'::uuid, '814539aa-07f7-404a-bc62-a6c7fc901e86'::uuid, 'A directory structure', true, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('05030cbf-d6fa-47a7-8e56-6e641db2435e'::uuid, '814539aa-07f7-404a-bc62-a6c7fc901e86'::uuid, 'A network protocol', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('fb058505-02d8-411c-9d61-1e99057b8d44'::uuid, '814539aa-07f7-404a-bc62-a6c7fc901e86'::uuid, 'A software licence', false, 3, now());

-- Question 3
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('fd3b14e7-3ce0-4227-8711-9a9111e041d8'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'Which key quickly allows a selected Windows file or folder to be renamed?', 'F2 activates the rename command for a selected file or folder.', 'mcq', 2, 'application', 'medium', 'application', 'Windows and File Management', '8516a38997d5930387115e20ef699bf187e9a32a15b1b5399490f0ed06069a42', '{"sourceLabel":"Revision Questions 2025, Q9","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q9"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('311c1433-f034-4cb9-87b9-1139ffce711a'::uuid, 'fd3b14e7-3ce0-4227-8711-9a9111e041d8'::uuid, 'F1', false, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('c35ac3cf-3bbc-411b-8819-7a967342a963'::uuid, 'fd3b14e7-3ce0-4227-8711-9a9111e041d8'::uuid, 'F2', true, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('108bbe5f-1a2c-46ec-98ce-5b1faa1c5c32'::uuid, 'fd3b14e7-3ce0-4227-8711-9a9111e041d8'::uuid, 'F5', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('95cea655-669b-43f4-a231-6d8117ce5a10'::uuid, 'fd3b14e7-3ce0-4227-8711-9a9111e041d8'::uuid, 'F12', false, 3, now());

-- Question 4
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('dc6e0a65-6839-4311-bd6f-14a4e8725a13'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'What is the suffix such as .docx or .pdf at the end of a filename called?', 'A file extension identifies a file''s format and often indicates which program can open it.', 'mcq', 3, 'recall', 'easy', 'recall', 'Windows and File Management', '0535b9dcc0bf7c8a50c77fe7f24b659c3b4ab07807de5b410312ffe0c7ce478a', '{"sourceLabel":"Revision Questions 2025, Q10; Revision Guide, pp.1-2","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q10; Revision Guide, pp.1-2"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('cbf5d728-182f-4f07-99a0-8901cb506ecf'::uuid, 'dc6e0a65-6839-4311-bd6f-14a4e8725a13'::uuid, 'File pathway', false, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('5ba437aa-0627-49c9-a779-7ef21961b18d'::uuid, 'dc6e0a65-6839-4311-bd6f-14a4e8725a13'::uuid, 'File extension', true, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('af4b2000-ed0c-4371-ab73-19c445ddb57b'::uuid, 'dc6e0a65-6839-4311-bd6f-14a4e8725a13'::uuid, 'Directory label', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('c3adc896-c2cd-49e4-9c5d-ad4e9daf3e4f'::uuid, 'dc6e0a65-6839-4311-bd6f-14a4e8725a13'::uuid, 'Storage prefix', false, 3, now());

-- Question 5
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('bb68df35-a8be-4f1b-a683-d61d38570bfa'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'Which filename would Windows reject even though it is shorter than 255 characters?', 'The vertical bar is one of the characters that Windows prohibits in file and folder names.', 'mcq', 4, 'scenario_analysis', 'hard', 'analysis', 'Windows and File Management', '588d53e8bb5de0c640fc06b63bddb54bfed134ed6e2795cf0efd46beefeccd9c', '{"sourceLabel":"Revision Questions 2025, Q14; Revision Guide, p.2","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q14; Revision Guide, p.2"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('65051e19-7613-4e2d-9cca-669b398d3731'::uuid, 'bb68df35-a8be-4f1b-a683-d61d38570bfa'::uuid, 'GNS121_Revision-2026.pdf', false, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('3f49a79c-2e2a-42bc-85cb-14ea043c5aaf'::uuid, 'bb68df35-a8be-4f1b-a683-d61d38570bfa'::uuid, 'GNS121 Revision (Final).pdf', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('c9fffa80-b306-458d-9430-158847490919'::uuid, 'bb68df35-a8be-4f1b-a683-d61d38570bfa'::uuid, 'GNS121|Revision.pdf', true, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('cc0e6787-6687-4be0-a4b4-af99343e78e4'::uuid, 'bb68df35-a8be-4f1b-a683-d61d38570bfa'::uuid, 'GNS121.Revision.v2.pdf', false, 3, now());

-- Question 6
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('95fee198-640c-44a1-acf2-deb4e9a735b1'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'Before copying, moving, deleting or renaming a file in File Explorer, what must a user normally do?', 'The intended file or folder must first be selected before an action is applied to it.', 'mcq', 5, 'application', 'medium', 'application', 'Windows and File Management', '5de37f9594ab74506f60c48212c4f1697a8af5e81b299d558cebf9dd8515d833', '{"sourceLabel":"Revision Questions 2025, Q12","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q12"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('9852be61-19e6-4946-b4dc-904f95a01a98'::uuid, '95fee198-640c-44a1-acf2-deb4e9a735b1'::uuid, 'Compress the file', false, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('fd67ddb9-0e82-4700-bf8f-70f3c13c6870'::uuid, '95fee198-640c-44a1-acf2-deb4e9a735b1'::uuid, 'Select the file', true, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('2ec77418-2efb-4712-9d7b-2099b73c84a2'::uuid, '95fee198-640c-44a1-acf2-deb4e9a735b1'::uuid, 'Change its extension', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('ce9d0136-91a6-418b-a5cf-23169e4e08b8'::uuid, '95fee198-640c-44a1-acf2-deb4e9a735b1'::uuid, 'Open the Recycle Bin', false, 3, now());

-- Question 7
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('117e7b6e-0461-4f65-a4b9-eb79df09cefc'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'A PDF is downloaded without choosing a destination folder. Where should the user look first?', 'Windows normally stores downloaded Internet files in the Downloads folder.', 'mcq', 6, 'recall', 'easy', 'recall', 'Windows and File Management', 'd08f3fb53ba338548f690b59e429b8d73a06c419802e1e7699870c8a0a2439ac', '{"sourceLabel":"Revision Questions 2025, Q17; Revision Guide, p.2","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q17; Revision Guide, p.2"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('230e1c2c-0c01-4a4b-8cfc-1bf5c65e3dec'::uuid, '117e7b6e-0461-4f65-a4b9-eb79df09cefc'::uuid, 'Documents', false, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('1bf81bd2-29fb-4978-80fa-bc9e4dc23d7c'::uuid, '117e7b6e-0461-4f65-a4b9-eb79df09cefc'::uuid, 'Downloads', true, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('a71a0c99-f492-4440-b4d1-2bb078aee0ac'::uuid, '117e7b6e-0461-4f65-a4b9-eb79df09cefc'::uuid, 'Pictures', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('a120ed98-ef80-453c-beae-f1bec6461c11'::uuid, '117e7b6e-0461-4f65-a4b9-eb79df09cefc'::uuid, 'Recycle Bin', false, 3, now());

-- Question 8
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('8624ea5a-6273-406a-81d3-52028f7972d3'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'Which Windows folder is the default location intended for image files?', 'The Pictures folder is the standard Windows location for images.', 'mcq', 7, 'application', 'medium', 'application', 'Windows and File Management', '92f3bb87504e14a916da37f60fbf72670e97bf1eff1e52c9ba7618d4bec3a29e', '{"sourceLabel":"Revision Questions 2025, Q18","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q18"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('3dbbb4e4-8d82-485e-9be0-10ff2e45d130'::uuid, '8624ea5a-6273-406a-81d3-52028f7972d3'::uuid, 'Music', false, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('f190f0c9-f0d1-4bbc-9c30-f5812763dfae'::uuid, '8624ea5a-6273-406a-81d3-52028f7972d3'::uuid, 'Pictures', true, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('21265951-f530-4dc4-855a-d60d3a5fe1a2'::uuid, '8624ea5a-6273-406a-81d3-52028f7972d3'::uuid, 'Documents', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('61ef9742-f192-4f4b-b40f-e1513cb4b8b4'::uuid, '8624ea5a-6273-406a-81d3-52028f7972d3'::uuid, 'Desktop', false, 3, now());

-- Question 9
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('c9dcc0ac-a296-4d61-9aa4-7907262f8b46'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'Ada saves a document inside her private Windows user-profile folder. Which statement best describes access to it?', 'Access to files under a user profile is controlled by accounts, rights and folder permissions.', 'mcq', 8, 'scenario_analysis', 'hard', 'analysis', 'Windows and File Management', 'a2d6a410f3259bd61ff26df50db219a5178d9c0c71db045c292470c1eb694f3c', '{"sourceLabel":"Revision Questions 2025, Q5; Revision Guide, p.1","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q5; Revision Guide, p.1"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('64432515-cdf0-4a7e-a1f2-7cb2ba2da043'::uuid, 'c9dcc0ac-a296-4d61-9aa4-7907262f8b46'::uuid, 'Every user automatically has full access', false, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('d8e38e62-1b9f-4e17-8974-7287bd600a0f'::uuid, 'c9dcc0ac-a296-4d61-9aa4-7907262f8b46'::uuid, 'Access depends on the permissions assigned to users and folders', true, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('43f0761b-0251-42dd-a854-8827f83e25f2'::uuid, 'c9dcc0ac-a296-4d61-9aa4-7907262f8b46'::uuid, 'Only Internet users can open it', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('3d049213-153e-4c14-9e5c-329ea2a90d05'::uuid, 'c9dcc0ac-a296-4d61-9aa4-7907262f8b46'::uuid, 'Renaming the file makes it public', false, 3, now());

-- Question 10
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('affb271b-a279-40e6-9463-3a064042aef2'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'Which part of a window should normally be dragged to move the entire window around the screen?', 'Dragging the title bar repositions a window without resizing it.', 'mcq', 9, 'application', 'medium', 'application', 'Windows and File Management', '2128989a21ac79acb46e580344a564969cb095d81773d9dca0fcf9355641fb10', '{"sourceLabel":"Revision Questions 2025, Q7","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q7"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('5bb918a3-70a3-4984-84d8-f7af0ccf70f2'::uuid, 'affb271b-a279-40e6-9463-3a064042aef2'::uuid, 'Status bar', false, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('be07b57e-8487-4ff6-ab97-a225d0c837b2'::uuid, 'affb271b-a279-40e6-9463-3a064042aef2'::uuid, 'Title bar', true, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('16efb883-3e94-4b7a-beb0-ba1fb6837db8'::uuid, 'affb271b-a279-40e6-9463-3a064042aef2'::uuid, 'Scroll bar', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('e02ff258-8db0-486b-a275-9157ee85be8b'::uuid, 'affb271b-a279-40e6-9463-3a064042aef2'::uuid, 'Address bar', false, 3, now());

-- Question 11
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('4ffad3cf-ec05-4ffb-8129-5530d11a6c05'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'Which command sequence moves a file to another folder without leaving the original in place?', 'Cut followed by Paste relocates the selected file from its original folder.', 'mcq', 10, 'recall', 'easy', 'recall', 'Windows and File Management', 'f8e24ff861a46ddddaf9c6dbdb60c2cc7a7c6f7f3b145e6e6c64c36737126df6', '{"sourceLabel":"Revision Questions 2025, Q13; Revision Guide, p.2","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q13; Revision Guide, p.2"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('8c3cc73c-7ae1-4c09-8d84-add4b5ec22fb'::uuid, '4ffad3cf-ec05-4ffb-8129-5530d11a6c05'::uuid, 'Copy and Paste', false, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('4336f76a-b7d3-471e-9125-ffc1c2bb625f'::uuid, '4ffad3cf-ec05-4ffb-8129-5530d11a6c05'::uuid, 'Cut and Paste', true, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('a5777d86-2028-411a-b58a-a4c30141ec8b'::uuid, '4ffad3cf-ec05-4ffb-8129-5530d11a6c05'::uuid, 'Rename and Save', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('eee45622-0b7e-489b-a24f-753700e8e131'::uuid, '4ffad3cf-ec05-4ffb-8129-5530d11a6c05'::uuid, 'Compress and Extract', false, 3, now());

-- Question 12
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('712a33c5-ed4a-419e-b771-2608fce3d61d'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'Why is a file extension useful when choosing an application to open a file?', 'The extension indicates the file format and therefore which applications are likely compatible.', 'mcq', 11, 'application', 'medium', 'application', 'Windows and File Management', '14eac509de3fcfd2e122c7af14fcf479b554416e9a7b3e724771a1ce01848211', '{"sourceLabel":"Revision Questions 2025, Q8; Revision Guide, pp.1-2","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q8; Revision Guide, pp.1-2"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('d1a6d20e-263d-4a4b-b534-d7a78c19a924'::uuid, '712a33c5-ed4a-419e-b771-2608fce3d61d'::uuid, 'It identifies the file''s likely format', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('71d2cbf8-4e97-4b64-ab4b-09b5028e8b3a'::uuid, '712a33c5-ed4a-419e-b771-2608fce3d61d'::uuid, 'It displays the owner''s password', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('47a0e29b-3698-4db0-a7ad-f48775a6a4ed'::uuid, '712a33c5-ed4a-419e-b771-2608fce3d61d'::uuid, 'It shows the file''s physical location', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('0b36942f-d45d-4d45-985f-7a01b7e3823d'::uuid, '712a33c5-ed4a-419e-b771-2608fce3d61d'::uuid, 'It guarantees the file is virus-free', false, 3, now());

-- Question 13
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('33efe12c-aedb-4529-8e08-65d1314b34a4'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'Which example is a remote storage location rather than a local one?', 'A location hosted on another computer and accessed through a network is remote.', 'mcq', 12, 'scenario_analysis', 'hard', 'analysis', 'Windows and File Management', '1c1bbab40ad6dced446726c66cc4a50b8ab97eaa6c094449e60a98a0aaff4acf', '{"sourceLabel":"Revision Guide, p.1","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Guide, p.1"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('ca27a410-0e50-4661-bb80-0fd4352476fd'::uuid, '33efe12c-aedb-4529-8e08-65d1314b34a4'::uuid, 'A laptop''s internal SSD', false, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('48bf659c-aa09-4b19-b644-a36a00b0d81f'::uuid, '33efe12c-aedb-4529-8e08-65d1314b34a4'::uuid, 'A USB drive attached to the laptop', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('aff6f301-c76e-4306-bc48-5d24dcdfd067'::uuid, '33efe12c-aedb-4529-8e08-65d1314b34a4'::uuid, 'A shared folder on another network computer', true, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('38be24fc-5e7e-483c-9a54-0237aeb74095'::uuid, '33efe12c-aedb-4529-8e08-65d1314b34a4'::uuid, 'The laptop''s Downloads folder', false, 3, now());

-- Question 14
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('8ce9897a-0afb-47e2-a1ff-766c1569d998'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'Why might a user compress four large photographs before attaching them to an email?', 'A compressed folder can package several files together and may reduce the total size for transfer.', 'mcq', 13, 'application', 'medium', 'application', 'Windows and File Management', '1cd2c609861a7d4628fb9aa3bb08399dd05748d549adf03da0cddb9bbaa9b906', '{"sourceLabel":"Revision Questions 2025, Q22","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q22"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('94638808-4db6-4c1d-a026-e6ecbd39318c'::uuid, '8ce9897a-0afb-47e2-a1ff-766c1569d998'::uuid, 'To improve their camera resolution', false, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('28032346-cf2e-4c05-bc58-161c881e622a'::uuid, '8ce9897a-0afb-47e2-a1ff-766c1569d998'::uuid, 'To combine them and potentially reduce transfer size', true, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('2c69b3e6-2a3b-458d-ac22-99b88090f577'::uuid, '8ce9897a-0afb-47e2-a1ff-766c1569d998'::uuid, 'To convert them into executable programs', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('44d69f32-baff-4978-8b9d-2bf84b4b8a24'::uuid, '8ce9897a-0afb-47e2-a1ff-766c1569d998'::uuid, 'To prevent the recipient from downloading them', false, 3, now());

-- Question 15
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('ad1ac57d-1cb0-44ce-81f1-60ff5e920a9f'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'According to the revision guide''s legacy file-matching exercise, which program is associated with an .swf file?', 'The guide associates the legacy Shockwave Flash format with Flash Player.', 'mcq', 14, 'recall', 'easy', 'recall', 'Windows and File Management', '570c8c1bc4892eb4afab74eb9422345e4ddcd3d8b20daa1a9fd2565c579f3e45', '{"sourceLabel":"Revision Guide, pp.1-2","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Guide, pp.1-2"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('77aec0e4-7ca5-46a9-bab9-5e9620b6a2ae'::uuid, 'ad1ac57d-1cb0-44ce-81f1-60ff5e920a9f'::uuid, 'Flash Player', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('4bc79491-dbae-4c46-b04c-9e90494f61a1'::uuid, 'ad1ac57d-1cb0-44ce-81f1-60ff5e920a9f'::uuid, 'Microsoft Word', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('143d1f5f-8125-4bea-96d5-71f33e9137d9'::uuid, 'ad1ac57d-1cb0-44ce-81f1-60ff5e920a9f'::uuid, 'WinZip', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('a10d99ac-3e83-4a35-963d-92df6424542b'::uuid, 'ad1ac57d-1cb0-44ce-81f1-60ff5e920a9f'::uuid, 'iTunes', false, 3, now());

-- Question 16
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('2e3319b1-1846-4a07-9a98-1fb2d444b577'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'Which technology converts text in a scanned page image into editable characters?', 'Optical character recognition analyzes an image and converts recognized text into editable data.', 'mcq', 15, 'application', 'medium', 'application', 'Windows and File Management', 'edb738798654c75f3790f0bdfd668b14b5e1ae2051606af9cc4905d6a93f6599', '{"sourceLabel":"Revision Questions 2025, Q16","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q16"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('fdf5a0f1-2b13-428f-a33b-7065da18868a'::uuid, '2e3319b1-1846-4a07-9a98-1fb2d444b577'::uuid, 'Optical character recognition', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('dfebb4e1-2ba2-4089-8d33-f56e340bff16'::uuid, '2e3319b1-1846-4a07-9a98-1fb2d444b577'::uuid, 'Digital rights management', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('06c8f6dc-7b31-4c41-b4ef-6018f16404b0'::uuid, '2e3319b1-1846-4a07-9a98-1fb2d444b577'::uuid, 'File compression', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('4217a7b8-feb9-4986-8c6e-95fda2cb16a0'::uuid, '2e3319b1-1846-4a07-9a98-1fb2d444b577'::uuid, 'Disk formatting', false, 3, now());

-- Question 17
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('30ef614b-c0f8-4701-929a-a3c00714f1d0'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'A proposed Windows filename contains 260 characters but no prohibited symbols. Why should it still be rejected according to the guide?', 'The guide states a maximum filename length of 255 characters in addition to its prohibited-character rule.', 'mcq', 16, 'scenario_analysis', 'hard', 'analysis', 'Windows and File Management', '97388af3fd3033891594bf745ec7fa8b9996c5537aa78c947fb14f47d942146f', '{"sourceLabel":"Revision Guide, p.2","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Guide, p.2"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('00386a85-bd98-4af1-98f1-53909735785d'::uuid, '30ef614b-c0f8-4701-929a-a3c00714f1d0'::uuid, 'Windows permits only uppercase filenames', false, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('de13c9f7-a483-45d5-81e4-6cc8b4ca48ad'::uuid, '30ef614b-c0f8-4701-929a-a3c00714f1d0'::uuid, 'The stated filename limit is 255 characters', true, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('360786af-5f00-4210-81f9-7047d98d9c47'::uuid, '30ef614b-c0f8-4701-929a-a3c00714f1d0'::uuid, 'Every filename must include a number', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('d933f62e-8187-4c07-b6f3-bc2bcedc782d'::uuid, '30ef614b-c0f8-4701-929a-a3c00714f1d0'::uuid, 'PDF files cannot have long names', false, 3, now());

-- Question 18
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('a18017a4-2bbc-4abf-b937-583e93a531d1'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'What primarily defines what a purchaser is legally permitted to do with installed software?', 'A software licence states the permitted installation, use and distribution conditions.', 'mcq', 17, 'application', 'medium', 'application', 'Windows and File Management', '83244370cb8d80cfa254a82b79b9cea766f2847c8f202cd41485c5a9014e8917', '{"sourceLabel":"Revision Questions 2025, Q24","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q24"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('a33f4526-c073-435a-9698-937403541b24'::uuid, 'a18017a4-2bbc-4abf-b937-583e93a531d1'::uuid, 'The desktop shortcut', false, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('6cd0cee6-b893-456f-bd0b-f4fd0a4ba53f'::uuid, 'a18017a4-2bbc-4abf-b937-583e93a531d1'::uuid, 'The software licence', true, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('b9afbac8-1826-4818-b9fc-c03a904af776'::uuid, 'a18017a4-2bbc-4abf-b937-583e93a531d1'::uuid, 'The filename', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('8f5ac164-20f4-4437-9363-984a4e3345cb'::uuid, 'a18017a4-2bbc-4abf-b937-583e93a531d1'::uuid, 'The screen resolution', false, 3, now());

-- Question 19
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('c24500a2-89d3-4648-8265-a53143a0d541'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'What is the safest standard method for removing an installed Windows program?', 'The Windows uninstall facility removes the application and its registered components properly.', 'mcq', 18, 'recall', 'easy', 'recall', 'Windows and File Management', '6206f2671b3d53a8b5a59bf1e0ebd47c669bcb1a1469c3e8b629c3e7063f06ad', '{"sourceLabel":"Revision Questions 2025, Q25","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q25"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('7c8a06ee-7097-4f1d-867d-c555bea2fd1f'::uuid, 'c24500a2-89d3-4648-8265-a53143a0d541'::uuid, 'Delete its desktop icon', false, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('9a78b489-82b0-4e27-aff8-0442d74bb9d3'::uuid, 'c24500a2-89d3-4648-8265-a53143a0d541'::uuid, 'Delete random files from its folder', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('45784fab-dea8-47ad-84b5-17d0841ca91f'::uuid, 'c24500a2-89d3-4648-8265-a53143a0d541'::uuid, 'Use Apps or Uninstall a program', true, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('bd913020-705d-4354-9fa5-7b86d54aaf86'::uuid, 'c24500a2-89d3-4648-8265-a53143a0d541'::uuid, 'Rename its installation folder', false, 3, now());

-- Question 20
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('90e11295-8c9d-4898-af1a-3659694a2498'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'What is normally required before downloading or installing an application from the Windows Store?', 'The Store normally requires the user to sign in with a Microsoft account to obtain applications.', 'mcq', 19, 'application', 'medium', 'application', 'Windows and File Management', '00cc897448c71b00afddada90e3f9f9a4daf47f704addd44e6e0c8261205b4e1', '{"sourceLabel":"Revision Questions 2025, Q29","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q29"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('28a3766f-b18d-4e72-8f0e-36d647c7320c'::uuid, '90e11295-8c9d-4898-af1a-3659694a2498'::uuid, 'A Microsoft account', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('383385c3-f454-45e8-993a-f661a56bb7ba'::uuid, '90e11295-8c9d-4898-af1a-3659694a2498'::uuid, 'A printer connection', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('323634b1-c177-4dbb-96f6-0cc19b60a567'::uuid, '90e11295-8c9d-4898-af1a-3659694a2498'::uuid, 'A DVD writer', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('d4a603a4-4d8d-494c-b435-30f84638880f'::uuid, '90e11295-8c9d-4898-af1a-3659694a2498'::uuid, 'A compressed folder', false, 3, now());

-- Question 21
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('f4af6074-2b06-4cda-9994-524a0ec439b9'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'Which password best follows the security recommendations in the revision guide?', 'A strong password is long and combines letters, capitals, numbers and symbols without obvious personal information.', 'mcq', 20, 'recall', 'easy', 'recall', 'Security and Maintenance', '04e024179820931baa4ba1510cc1ecc28e0bbd2e3fcd34427e9ca0e7fe731230', '{"sourceLabel":"Revision Questions 2025, Q48; Revision Guide, p.2","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q48; Revision Guide, p.2"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('668b34bb-25a4-4f01-b084-9e229bc496b3'::uuid, 'f4af6074-2b06-4cda-9994-524a0ec439b9'::uuid, 'password001', false, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('db69420b-441f-4961-87e0-0186f35b215a'::uuid, 'f4af6074-2b06-4cda-9994-524a0ec439b9'::uuid, 'Samuel2005', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('026f8907-cf1b-473c-b0c4-0ef709bb2cb8'::uuid, 'f4af6074-2b06-4cda-9994-524a0ec439b9'::uuid, 'Health!River7Lamp', true, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('0e152021-ccac-4e9c-8077-a5c437f75c2d'::uuid, 'f4af6074-2b06-4cda-9994-524a0ec439b9'::uuid, '123456789012345', false, 3, now());

-- Question 22
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('f292050d-ffee-486b-bcb7-97e79d7409fb'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'What is the main danger of using the same password for email, cloud storage and social media?', 'Password reuse allows a single compromised credential to unlock multiple services.', 'mcq', 21, 'application', 'medium', 'application', 'Security and Maintenance', '36bf527a82fc272d49a175185e1039c97e9a1b824092bafd3f688d1eba9d7855', '{"sourceLabel":"Revision Guide, p.3","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Guide, p.3"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('a15a08ce-9065-4fc5-9446-ee5619651b0b'::uuid, 'f292050d-ffee-486b-bcb7-97e79d7409fb'::uuid, 'The accounts will merge', false, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('04fb98e6-0638-4df2-ae01-9919024d78e0'::uuid, 'f292050d-ffee-486b-bcb7-97e79d7409fb'::uuid, 'One stolen password could expose every account', true, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('14ef0e4d-3851-418c-8a93-639bf6df34a4'::uuid, 'f292050d-ffee-486b-bcb7-97e79d7409fb'::uuid, 'The password will expire daily', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('a8fa3504-f7d9-4288-af2f-244fa84236c2'::uuid, 'f292050d-ffee-486b-bcb7-97e79d7409fb'::uuid, 'The username will be deleted', false, 3, now());

-- Question 23
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('54014ee1-3bb8-48e2-a6c6-7ccfa19419ba'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'A student accidentally posts login details in a group chat. What should the student do first?', 'The guide directs users to change accidentally shared login information immediately.', 'mcq', 22, 'application', 'medium', 'application', 'Security and Maintenance', 'e14416ee18e7a4b71d234bc36705d932b72e51d46861ba6642d7c617c4b49d2a', '{"sourceLabel":"Revision Guide, p.3","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Guide, p.3"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('ea8c23f2-6fc3-4093-86d5-0001d287cd08'::uuid, '54014ee1-3bb8-48e2-a6c6-7ccfa19419ba'::uuid, 'Wait for evidence of misuse', false, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('8d9b110e-f5f0-41e5-a8dd-8b26b1e669ac'::uuid, '54014ee1-3bb8-48e2-a6c6-7ccfa19419ba'::uuid, 'Change the password immediately', true, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('882a03de-8476-4e86-b5ee-0501fb042618'::uuid, '54014ee1-3bb8-48e2-a6c6-7ccfa19419ba'::uuid, 'Delete the account username', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('3929fa8d-8594-4add-8563-0ba5a0ff4354'::uuid, '54014ee1-3bb8-48e2-a6c6-7ccfa19419ba'::uuid, 'Hide the password under the keyboard', false, 3, now());

-- Question 24
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('d6513d0b-5bba-44b0-92d5-c1e9f71930d9'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'Which Start-menu sequence locks a Windows session while leaving programs open?', 'The guide specifies selecting the account icon in the Start menu and then choosing Lock.', 'mcq', 23, 'recall', 'easy', 'recall', 'Security and Maintenance', '494d0af47752bf8ce8ad8d0a5033358dc93c076a985457a338055308ec914969', '{"sourceLabel":"Revision Questions 2025, Q49; Revision Guide, p.3","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q49; Revision Guide, p.3"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('54e7c001-b3dc-492f-9edd-1182f2162f01'::uuid, 'd6513d0b-5bba-44b0-92d5-c1e9f71930d9'::uuid, 'Start, account icon, Lock', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('c02622cc-cfc5-4084-82ff-60f28d8f8989'::uuid, 'd6513d0b-5bba-44b0-92d5-c1e9f71930d9'::uuid, 'Start, Documents, Lock', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('53be733f-d8fa-450e-b35f-408912a3709b'::uuid, 'd6513d0b-5bba-44b0-92d5-c1e9f71930d9'::uuid, 'Start, Settings, Delete', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('8ae871fb-e87f-48df-a44a-5682e99ff4e4'::uuid, 'd6513d0b-5bba-44b0-92d5-c1e9f71930d9'::uuid, 'Start, Power, Uninstall', false, 3, now());

-- Question 25
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('db49412a-32f6-40c5-9b57-1f9cc2e3e152'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'A caller claims to be from ICT support and pressures a student to reveal a password. Which attack is being attempted?', 'Social engineering manipulates a person into revealing information or granting unauthorized access.', 'mcq', 24, 'scenario_analysis', 'hard', 'analysis', 'Security and Maintenance', 'cd76df15d6cc53f0445726428b50cd6eb92336dfc4259cd1e627fa3527bc9387', '{"sourceLabel":"Revision Questions 2025, Q56","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q56"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('b448570a-7a57-4cf0-9132-373c09bcc458'::uuid, 'db49412a-32f6-40c5-9b57-1f9cc2e3e152'::uuid, 'File compression', false, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('4f076810-3963-450b-8b31-c18edb3b5d4a'::uuid, 'db49412a-32f6-40c5-9b57-1f9cc2e3e152'::uuid, 'Social engineering', true, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('87e77152-86da-4e99-84f6-25aaa1e23af8'::uuid, 'db49412a-32f6-40c5-9b57-1f9cc2e3e152'::uuid, 'Digital rights management', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('074f6acb-7c39-429b-a1b8-07781449ff36'::uuid, 'db49412a-32f6-40c5-9b57-1f9cc2e3e152'::uuid, 'System restoration', false, 3, now());

-- Question 26
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('8d8c39f8-f06b-41f4-bcb3-fc3b9971eabb'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'A computer displays unexpected advertisements and repeatedly redirects its browser. Which threat is the most likely cause?', 'Unwanted advertisements and redirects are common symptoms of adware or other malware.', 'mcq', 25, 'application', 'medium', 'application', 'Security and Maintenance', 'e56114f7a0b537b352bb1a3415b19ca0fd3a7acfcadda73e9ecf0c24d0baed15', '{"sourceLabel":"Revision Questions 2025, Q50-52; Revision Guide, p.3","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q50-52; Revision Guide, p.3"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('554a5e4f-4605-46af-b500-2f45b044a508'::uuid, '8d8c39f8-f06b-41f4-bcb3-fc3b9971eabb'::uuid, 'Adware or malware', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('a1c07044-09fc-4b6f-934d-04a83c7dca3e'::uuid, '8d8c39f8-f06b-41f4-bcb3-fc3b9971eabb'::uuid, 'A file extension', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('40da34c6-c70e-486a-9057-8936af47d329'::uuid, '8d8c39f8-f06b-41f4-bcb3-fc3b9971eabb'::uuid, 'Cloud storage', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('740c7979-79f3-4a91-97d1-211fde5f112f'::uuid, '8d8c39f8-f06b-41f4-bcb3-fc3b9971eabb'::uuid, 'A system restore point', false, 3, now());

-- Question 27
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('f86a2368-a05d-46ae-aa0a-9e92606ef1c5'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'Which security control filters potentially dangerous traffic entering or leaving a network?', 'A firewall applies traffic rules to block unauthorized or dangerous network connections.', 'mcq', 26, 'recall', 'easy', 'recall', 'Security and Maintenance', '5147794de7e202a554124140ee7e1321f08206e40d15706215052a0ef0555731', '{"sourceLabel":"Revision Questions 2025, Q58","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q58"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('de042839-d43e-4d44-940d-1d439fcb4a2a'::uuid, 'f86a2368-a05d-46ae-aa0a-9e92606ef1c5'::uuid, 'Firewall', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('e7395d71-472a-44f4-af13-089dc1950fcc'::uuid, 'f86a2368-a05d-46ae-aa0a-9e92606ef1c5'::uuid, 'Spreadsheet', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('f7174b96-b987-4ec1-a978-01908c8fda88'::uuid, 'f86a2368-a05d-46ae-aa0a-9e92606ef1c5'::uuid, 'File extension', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('ad7fec9d-de8b-4507-b993-a27727a98d48'::uuid, 'f86a2368-a05d-46ae-aa0a-9e92606ef1c5'::uuid, 'Presentation template', false, 3, now());

-- Question 28
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('59d0b460-9e9a-4c4d-a855-a87ae2a03806'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'Which type of software is specifically intended to detect and remove computer viruses?', 'Antivirus software scans for, quarantines and removes known malicious code.', 'mcq', 27, 'application', 'medium', 'application', 'Security and Maintenance', '801518f4fa026fb94ea6a6aadd8958fb86f3ac314e7cd3547d20c30a3be82c15', '{"sourceLabel":"Revision Questions 2025, Q57","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q57"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('419a8959-7f35-4410-bfdb-49058fb9ab0f'::uuid, '59d0b460-9e9a-4c4d-a855-a87ae2a03806'::uuid, 'Antivirus software', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('d9c46ce8-40a4-42cd-95ca-b1f769238215'::uuid, '59d0b460-9e9a-4c4d-a855-a87ae2a03806'::uuid, 'Presentation software', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('f05567d5-0c7b-4cc1-aa8f-73d3a7742fca'::uuid, '59d0b460-9e9a-4c4d-a855-a87ae2a03806'::uuid, 'Compression software', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('a3062893-914c-4082-a417-32e88ca006b0'::uuid, '59d0b460-9e9a-4c4d-a855-a87ae2a03806'::uuid, 'Accounting software', false, 3, now());

-- Question 29
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('104d4b4d-ae18-4e1b-96da-6f90ea425dae'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'Peter must retrieve confidential company documents while travelling. Which connection is most appropriate on an untrusted network?', 'A VPN creates an encrypted connection suitable for accessing private organizational resources remotely.', 'mcq', 28, 'scenario_analysis', 'hard', 'analysis', 'Security and Maintenance', '1e64cd75deed85b0d21b71ca6204dae111735f557279ef6b5f40106b29b69680', '{"sourceLabel":"Revision Questions 2025, Q61","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q61"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('e2d7cd39-d58e-4194-856e-92056fffbdee'::uuid, '104d4b4d-ae18-4e1b-96da-6f90ea425dae'::uuid, 'An open file-sharing link', false, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('53315ea7-aa39-4d6a-b9c3-4e43b7b13f31'::uuid, '104d4b4d-ae18-4e1b-96da-6f90ea425dae'::uuid, 'A virtual private network', true, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('79f09686-a6c6-48c2-bde2-80c2e4ff7f9d'::uuid, '104d4b4d-ae18-4e1b-96da-6f90ea425dae'::uuid, 'An unencrypted public folder', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('8f8fdef4-bbba-4b30-8a8e-c743e9d00204'::uuid, '104d4b4d-ae18-4e1b-96da-6f90ea425dae'::uuid, 'A social-media message', false, 3, now());

-- Question 30
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('8afe1fb0-7564-4d96-86b8-ad3bb1f69bd1'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'Which backup location best protects documents if the computer''s internal drive completely fails?', 'A backup should be stored separately from the original device so one drive failure does not destroy both copies.', 'mcq', 29, 'application', 'medium', 'application', 'Security and Maintenance', 'd8b4377880124a45c9288e2207b055dc3a8990089c09ae210130dbb3e03bda46', '{"sourceLabel":"Revision Questions 2025, Q62-63","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q62-63"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('b87a1f54-f297-48bf-b31c-f02f9756eb23'::uuid, '8afe1fb0-7564-4d96-86b8-ad3bb1f69bd1'::uuid, 'Another folder on the same drive', false, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('0eab5f92-4d94-4cdb-a322-a1c34f14cdac'::uuid, '8afe1fb0-7564-4d96-86b8-ad3bb1f69bd1'::uuid, 'An external drive or secure cloud location', true, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('f83695d5-4671-4d7a-9a08-be063130226f'::uuid, '8afe1fb0-7564-4d96-86b8-ad3bb1f69bd1'::uuid, 'The Recycle Bin on the same drive', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('44a3892c-c47d-4d8f-959e-36e329d2329b'::uuid, '8afe1fb0-7564-4d96-86b8-ad3bb1f69bd1'::uuid, 'A desktop shortcut', false, 3, now());

-- Question 31
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('b72fde77-1995-4db1-9df7-805fc072d3f6'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'Which type of content is not protected as part of a Windows System Restore point?', 'System Restore targets system configuration and does not serve as a backup for personal files.', 'mcq', 30, 'recall', 'easy', 'recall', 'Security and Maintenance', 'ae9e66b9a23efc85b9b658c6db86f1211771db6c4e07dc217142a1da128a38f1', '{"sourceLabel":"Revision Questions 2025, Q64","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q64"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('c584234a-097d-4429-b4fc-b9a8532c9c47'::uuid, 'b72fde77-1995-4db1-9df7-805fc072d3f6'::uuid, 'System settings', false, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('cbbc5ec2-07ad-4e70-90d4-bd12ea88b4c9'::uuid, 'b72fde77-1995-4db1-9df7-805fc072d3f6'::uuid, 'Registry configuration', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('4ff4025c-6c6d-433c-b096-328013b8ff37'::uuid, 'b72fde77-1995-4db1-9df7-805fc072d3f6'::uuid, 'Personal documents and photographs', true, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('a66c181d-63d9-4f0b-a2d5-c42ca591f905'::uuid, 'b72fde77-1995-4db1-9df7-805fc072d3f6'::uuid, 'Some driver configuration', false, 3, now());

-- Question 32
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('43efb916-f9fa-4ac4-85cb-d7c8a240f7d7'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'Which malicious software is designed to monitor a user''s activity and secretly collect information?', 'Spyware secretly observes activity or gathers information without proper consent.', 'mcq', 31, 'application', 'medium', 'application', 'Security and Maintenance', '4b217433f8009182b55d3c9ebc5d5ecfb2d29ab88256797f5700a7b5015cc01b', '{"sourceLabel":"Revision Guide, p.3","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Guide, p.3"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('eb996d0b-3d48-472a-bc37-dc4f324e7dc2'::uuid, '43efb916-f9fa-4ac4-85cb-d7c8a240f7d7'::uuid, 'Spyware', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('b1e82757-e30e-43f9-9ca6-c3d306f24939'::uuid, '43efb916-f9fa-4ac4-85cb-d7c8a240f7d7'::uuid, 'Spreadsheet software', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('91ee5df8-30ec-46ff-885f-f505d0b4a3d1'::uuid, '43efb916-f9fa-4ac4-85cb-d7c8a240f7d7'::uuid, 'Presentation software', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('c88a6e75-dc71-43ed-956e-e419ed066732'::uuid, '43efb916-f9fa-4ac4-85cb-d7c8a240f7d7'::uuid, 'Compression software', false, 3, now());

-- Question 33
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('1dcf50da-e72c-46d2-93c8-a0508b7f32b9'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'Why is a browser cookie not automatically classified as malware?', 'Cookies have legitimate uses such as maintaining sessions and preferences, although they still require responsible handling.', 'mcq', 32, 'scenario_analysis', 'hard', 'analysis', 'Security and Maintenance', '8f063e225b934c9a353d32d955b5c453a08af7e45db043675828bbaf4e2fe83e', '{"sourceLabel":"Revision Questions 2025, Q53 and Q146","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q53 and Q146"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('46fff795-732f-49df-8489-6da2adf2044e'::uuid, '1dcf50da-e72c-46d2-93c8-a0508b7f32b9'::uuid, 'It can only contain photographs', false, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('5976ee76-142b-4bfc-a796-928d4c8e219f'::uuid, '1dcf50da-e72c-46d2-93c8-a0508b7f32b9'::uuid, 'It is normally a small data record used by a website to remember session or preference information', true, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('fd177380-5fac-4b54-b532-4bd9ef28a33f'::uuid, '1dcf50da-e72c-46d2-93c8-a0508b7f32b9'::uuid, 'It always deletes itself before being stored', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('5e52d0f3-e0b3-4a51-ab0d-01668ebe5e16'::uuid, '1dcf50da-e72c-46d2-93c8-a0508b7f32b9'::uuid, 'It cannot be read by any website', false, 3, now());

-- Question 34
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('47f920d6-e0e6-4e0a-a06b-b511235fe158'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'How should an airport Wi-Fi connection normally be classified in Windows when its users are unknown?', 'The Public profile applies more restrictive sharing and discovery rules on untrusted networks.', 'mcq', 33, 'application', 'medium', 'application', 'Security and Maintenance', '7890a74242b0802784814c301e0a1ef855d5f26a51d0e923dde57eadecf7cbc2', '{"sourceLabel":"Revision Questions 2025, Q54","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q54"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('d6c5c6cf-4ff7-4bed-9e89-08d71ebc8409'::uuid, '47f920d6-e0e6-4e0a-a06b-b511235fe158'::uuid, 'Domain network', false, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('1b94709a-8111-43fa-81d9-bee691b60c17'::uuid, '47f920d6-e0e6-4e0a-a06b-b511235fe158'::uuid, 'Private network', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('ea00a3be-f428-420a-bc47-cec9847df969'::uuid, '47f920d6-e0e6-4e0a-a06b-b511235fe158'::uuid, 'Public network', true, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('b322b415-35f9-4491-8245-5d04d26c3aa8'::uuid, '47f920d6-e0e6-4e0a-a06b-b511235fe158'::uuid, 'Offline network', false, 3, now());

-- Question 35
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('af86e9a4-2761-4005-a743-b7b2cfe05449'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'What is the purpose of digital rights management?', 'DRM applies rules intended to control access, copying or distribution of protected digital works.', 'mcq', 34, 'recall', 'easy', 'recall', 'Security and Maintenance', '90a2ee708553047f5b325e5afb277c1f8616527702144f6c74e96ebe31908054', '{"sourceLabel":"Revision Questions 2025, Q19","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q19"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('8937edff-064e-4111-be63-7b3ae3cb4126'::uuid, 'af86e9a4-2761-4005-a743-b7b2cfe05449'::uuid, 'To control authorized use and copying of digital content', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('c3a6dd94-05a5-4664-8941-46302986b908'::uuid, 'af86e9a4-2761-4005-a743-b7b2cfe05449'::uuid, 'To rename files automatically', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('0c5ff4a5-0a29-4a3e-8b04-45789b98b0dd'::uuid, 'af86e9a4-2761-4005-a743-b7b2cfe05449'::uuid, 'To repair damaged hardware', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('028a82b5-1d45-480a-8f53-e75c93ae405a'::uuid, 'af86e9a4-2761-4005-a743-b7b2cfe05449'::uuid, 'To improve Wi-Fi signal strength', false, 3, now());

-- Question 36
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('d3c6c37e-ce3a-4cf4-a3cf-f5e218329dd2'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'A computer freezes only when one particular application starts. What should be investigated first?', 'A fault consistently triggered by one application points first to that program, its resources or compatibility.', 'mcq', 35, 'application', 'medium', 'application', 'Security and Maintenance', '980d7c647b4ef6f9b86c00d33558605dd279a88bb8ab93fef669db4b717f0e8f', '{"sourceLabel":"Revision Questions 2025, Q66","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q66"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('4c874db6-438b-40a8-be83-b0be36a36819'::uuid, 'd3c6c37e-ce3a-4cf4-a3cf-f5e218329dd2'::uuid, 'An application or software compatibility problem', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('0c9921f7-b655-4635-a39c-4730331363ca'::uuid, 'd3c6c37e-ce3a-4cf4-a3cf-f5e218329dd2'::uuid, 'The user''s social-media profile', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('c46e652e-d5cd-4a88-8be0-49fa1d04e145'::uuid, 'd3c6c37e-ce3a-4cf4-a3cf-f5e218329dd2'::uuid, 'The filename of an unrelated photograph', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('ec5f3fea-3d42-484a-8ae7-bef2e2cd9b0c'::uuid, 'd3c6c37e-ce3a-4cf4-a3cf-f5e218329dd2'::uuid, 'The printer''s paper size', false, 3, now());

-- Question 37
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('903eb144-dcd5-4d8c-a260-bd771ec83383'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'After using webmail on a public computer, which action most effectively reduces access by the next user?', 'Signing out and removing saved session information helps prevent the next user from reopening the account.', 'mcq', 36, 'scenario_analysis', 'hard', 'analysis', 'Security and Maintenance', 'e729c3b1306be90bbe47a98b59cb684b13fd0e3ec17ce4a4538513f2878542eb', '{"sourceLabel":"Revision Questions 2025, Q55","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q55"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('8e65d58e-5b84-4e6a-aed8-c97cbe8e3609'::uuid, '903eb144-dcd5-4d8c-a260-bd771ec83383'::uuid, 'Close only the browser tab', false, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('e035c7e2-56c2-48be-ae14-8e01e1b5c0ae'::uuid, '903eb144-dcd5-4d8c-a260-bd771ec83383'::uuid, 'Sign out and clear saved session data', true, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('811d86ec-8520-47e9-8a3f-822c397fb360'::uuid, '903eb144-dcd5-4d8c-a260-bd771ec83383'::uuid, 'Minimize the browser', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('c4795022-076b-49c7-936c-70adc540e64e'::uuid, '903eb144-dcd5-4d8c-a260-bd771ec83383'::uuid, 'Leave the account open but lock one message', false, 3, now());

-- Question 38
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('cd713650-454f-4672-a1fc-13051155dfd8'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'Which security system is designed to monitor and record network activity for suspicious behaviour?', 'Network monitoring and intrusion-detection systems record activity and help identify suspicious events.', 'mcq', 37, 'application', 'medium', 'application', 'Security and Maintenance', '0fbedcca0c8124d5a7bc8eb7f4f16607af98f961824239e62f03b3d99e97774c', '{"sourceLabel":"Revision Questions 2025, Q59","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q59"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('64601887-ab3b-4ca7-be94-ed9761f8f2ad'::uuid, 'cd713650-454f-4672-a1fc-13051155dfd8'::uuid, 'Intrusion detection or monitoring system', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('2189869d-8826-48e4-9327-ca844a7f03e1'::uuid, 'cd713650-454f-4672-a1fc-13051155dfd8'::uuid, 'Word processor', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('e43b3799-0ecf-4246-a0b2-1bcca687b9fc'::uuid, 'cd713650-454f-4672-a1fc-13051155dfd8'::uuid, 'File compressor', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('a0398ca3-bef7-4a02-a454-643ce0f20840'::uuid, 'cd713650-454f-4672-a1fc-13051155dfd8'::uuid, 'Presentation template', false, 3, now());

-- Question 39
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('beeb7da0-4995-4da4-a611-a5fed0078ae0'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'Which protocol in a browser address indicates an encrypted web connection?', 'HTTPS uses encryption to protect data exchanged between a browser and a web server.', 'mcq', 38, 'recall', 'easy', 'recall', 'Security and Maintenance', '25a7376e34c03a6621f263f8a521340da595e207f938c960c5541cc5bf1655db', '{"sourceLabel":"Revision Questions 2025, Q60","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q60"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('377a1321-020b-4a59-80ac-becbf02ea5eb'::uuid, 'beeb7da0-4995-4da4-a611-a5fed0078ae0'::uuid, 'HTTP', false, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('aba4337a-f6d2-48c0-afe4-508605c7511b'::uuid, 'beeb7da0-4995-4da4-a611-a5fed0078ae0'::uuid, 'HTTPS', true, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('6a861311-1424-4f0c-ab5b-6adcb4b8f975'::uuid, 'beeb7da0-4995-4da4-a611-a5fed0078ae0'::uuid, 'FTP', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('a885064f-7260-453f-b7f5-23efc75abb3e'::uuid, 'beeb7da0-4995-4da4-a611-a5fed0078ae0'::uuid, 'SMTP', false, 3, now());

-- Question 40
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('61e0c16a-55f1-4825-951f-d07f294e8f3a'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'Why should a user never allow someone else to perform actions through the user''s account?', 'Account activity is attributed to the account identity, so misuse can damage the owner''s data and reputation.', 'mcq', 39, 'application', 'medium', 'application', 'Security and Maintenance', '78a76895b558eaed31c8d86719b4642369ecefffd4f5fc45d87f0d4fef889f18', '{"sourceLabel":"Revision Guide, p.3","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Guide, p.3"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('699eb181-a84e-4686-afe9-c157558defe1'::uuid, '61e0c16a-55f1-4825-951f-d07f294e8f3a'::uuid, 'The monitor may become brighter', false, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('b1b4bc03-9203-47dc-b534-5a9070c29aad'::uuid, '61e0c16a-55f1-4825-951f-d07f294e8f3a'::uuid, 'Actions can be traced back to the account owner', true, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('0a660a6d-b166-4eb6-bc9d-873198ee3936'::uuid, '61e0c16a-55f1-4825-951f-d07f294e8f3a'::uuid, 'Every file extension will change', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('28a746b7-dd8d-4416-9f1b-7480734b407b'::uuid, '61e0c16a-55f1-4825-951f-d07f294e8f3a'::uuid, 'The keyboard will be disabled', false, 3, now());

-- Question 41
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('5833324a-1c6d-4497-afff-c3908c6ddd40'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'Which activity is an example of cloud computing?', 'Cloud computing provides applications or storage through network-accessible services.', 'mcq', 40, 'recall', 'easy', 'recall', 'Cloud, Apps, LMS and CRM', 'baa150aeeb5654646975ab15b340b7a99d274f40d7177d5b96ea382ad4497b2d', '{"sourceLabel":"Revision Questions 2025, Q33","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q33"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('c2f78a2c-f2ea-457a-a553-2238add1fdbe'::uuid, '5833324a-1c6d-4497-afff-c3908c6ddd40'::uuid, 'Saving only to a disconnected USB drive', false, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('94810545-b034-4e30-834e-6c65b4a76ca9'::uuid, '5833324a-1c6d-4497-afff-c3908c6ddd40'::uuid, 'Editing a document stored in Google Drive through a browser', true, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('52f63b2c-5594-4769-8577-6ef532366c6b'::uuid, '5833324a-1c6d-4497-afff-c3908c6ddd40'::uuid, 'Printing through a USB cable', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('3f83c024-91f4-48b7-b99c-a02c63eb11c8'::uuid, '5833324a-1c6d-4497-afff-c3908c6ddd40'::uuid, 'Installing software from a DVD', false, 3, now());

-- Question 42
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('a9af4637-37a3-4dd7-973c-06647d8de126'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'How are changes normally saved while editing a workbook in Excel Online?', 'Excel Online automatically saves changes to its cloud storage location while the user works.', 'mcq', 41, 'application', 'medium', 'application', 'Cloud, Apps, LMS and CRM', '9bf67e3548a1c8cd9184627b6dedbe94b8ed377f4c555099737063c09b061d7b', '{"sourceLabel":"Revision Questions 2025, Q42","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q42"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('8f9c1bac-2cd8-4f14-8069-791611620c07'::uuid, 'a9af4637-37a3-4dd7-973c-06647d8de126'::uuid, 'They are saved automatically', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('fb3ea1eb-ce23-414f-b1ec-a447b0528214'::uuid, 'a9af4637-37a3-4dd7-973c-06647d8de126'::uuid, 'They are saved only when the browser closes', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('74b5d505-fc09-4daa-a382-8afd5fb23acc'::uuid, 'a9af4637-37a3-4dd7-973c-06647d8de126'::uuid, 'They require a DVD backup', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('c7c521b6-5425-467e-984a-e9cf2f71a027'::uuid, 'a9af4637-37a3-4dd7-973c-06647d8de126'::uuid, 'They cannot be saved online', false, 3, now());

-- Question 43
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('90bc4ab8-26af-4dd6-8241-206c270aa25e'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'Which action uploads a local document to Google Drive?', 'Google Drive''s upload command transfers a selected local file into cloud storage.', 'mcq', 42, 'application', 'medium', 'application', 'Cloud, Apps, LMS and CRM', '1d4c5f46da3ea7e2af0f24930ba8739687c4ce2aea0b424a82820a29ee3ff940', '{"sourceLabel":"Revision Questions 2025, Q37","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q37"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('97f0e0f2-b72e-4976-8358-61237334451c'::uuid, '90bc4ab8-26af-4dd6-8241-206c270aa25e'::uuid, 'Choose New or File upload and select the document', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('c9d7cb4d-6804-46c1-9d9c-0d8efaa6eea7'::uuid, '90bc4ab8-26af-4dd6-8241-206c270aa25e'::uuid, 'Rename the browser tab', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('65ceef01-b871-46aa-abae-27c7cfc3f21f'::uuid, '90bc4ab8-26af-4dd6-8241-206c270aa25e'::uuid, 'Move the document to the Recycle Bin', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('1cadd2fb-7567-480e-9bc6-3221f949c652'::uuid, '90bc4ab8-26af-4dd6-8241-206c270aa25e'::uuid, 'Print the document first', false, 3, now());

-- Question 44
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('b62fa225-6689-4bb2-8a50-30fbacf5ead4'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'What does downloading a Google Drive file do?', 'Downloading creates a local copy of a file obtained from the cloud service.', 'mcq', 43, 'recall', 'easy', 'recall', 'Cloud, Apps, LMS and CRM', 'b2f9a381aee115debc40a5854745c48eada6dd7a3a14bd8c08394674680cc1cf', '{"sourceLabel":"Revision Questions 2025, Q38","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q38"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('318ffa98-0ee6-4e1e-8dbe-6dcefb15ede0'::uuid, 'b62fa225-6689-4bb2-8a50-30fbacf5ead4'::uuid, 'Transfers a copy from cloud storage to the local device', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('5aee915b-c446-4403-ac85-f094cea3bb2b'::uuid, 'b62fa225-6689-4bb2-8a50-30fbacf5ead4'::uuid, 'Permanently deletes the online file', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('626e05a2-69fa-4fc2-86e2-f85d5de21696'::uuid, 'b62fa225-6689-4bb2-8a50-30fbacf5ead4'::uuid, 'Changes the user''s Google password', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('e7cfd55e-71f4-4a3d-ac52-6b6006544c7e'::uuid, 'b62fa225-6689-4bb2-8a50-30fbacf5ead4'::uuid, 'Shares the file publicly', false, 3, now());

-- Question 45
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('20d7a31a-f6a1-4cde-9973-25f7e5fc2868'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'A lecturer wants students to read a Drive document but not modify it. Which permission is most suitable?', 'Viewer permission allows access to the content without granting editing rights.', 'mcq', 44, 'scenario_analysis', 'hard', 'analysis', 'Cloud, Apps, LMS and CRM', 'cfdbf56092dd3560002688fad8ea7774f2146e0a3b13a6d5bdb5f7a04112894f', '{"sourceLabel":"Revision Questions 2025, Q40","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q40"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('099f5bed-7deb-4932-98f8-d85b223d53b3'::uuid, '20d7a31a-f6a1-4cde-9973-25f7e5fc2868'::uuid, 'Editor', false, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('a2e902eb-60c1-40b0-8b19-c928d40f00f1'::uuid, '20d7a31a-f6a1-4cde-9973-25f7e5fc2868'::uuid, 'Viewer', true, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('686c162c-9601-40f9-b94a-696172450ecf'::uuid, '20d7a31a-f6a1-4cde-9973-25f7e5fc2868'::uuid, 'Owner', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('6e96d582-6d2d-4e44-9a69-e70cc4515aa9'::uuid, '20d7a31a-f6a1-4cde-9973-25f7e5fc2868'::uuid, 'Administrator', false, 3, now());

-- Question 46
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('ae4245a0-6697-4758-9208-baaa036316d3'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'What is the main purpose of a local OneDrive folder on a Windows computer?', 'The local OneDrive folder keeps selected local and cloud files synchronized.', 'mcq', 45, 'application', 'medium', 'application', 'Cloud, Apps, LMS and CRM', 'f86487eab26ed3dc22a5a4b081b485a8e9b4b31ab096556a72d6469e1db8b581', '{"sourceLabel":"Revision Questions 2025, Q41","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q41"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('d59f802d-7f5e-48a5-89e8-9bd21c56947a'::uuid, 'ae4245a0-6697-4758-9208-baaa036316d3'::uuid, 'To synchronize selected files with OneDrive cloud storage', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('67f4d779-28a6-49d2-93e1-2601e8b7c81e'::uuid, 'ae4245a0-6697-4758-9208-baaa036316d3'::uuid, 'To replace the operating system', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('168f7f06-9d2a-47d7-aeb3-a3ddde14e5bb'::uuid, 'ae4245a0-6697-4758-9208-baaa036316d3'::uuid, 'To scan documents for printing only', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('4135946a-99ce-47ed-85d4-5cf18df66674'::uuid, 'ae4245a0-6697-4758-9208-baaa036316d3'::uuid, 'To prevent every file from being shared', false, 3, now());

-- Question 47
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('d1639e8f-57e3-45a0-b250-c0ee10e7a386'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'Which statement describes locally installed software?', 'Locally installed applications use program files placed on the user''s device.', 'mcq', 46, 'recall', 'easy', 'recall', 'Cloud, Apps, LMS and CRM', '2d6db5c347b3a4c07f91f8206afce1d29676c010e7ea2d9902c3607c8bdccb7b', '{"sourceLabel":"Revision Questions 2025, Q23","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q23"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('32755fc4-4ff0-4a76-a3f9-9fa561a4a84a'::uuid, 'd1639e8f-57e3-45a0-b250-c0ee10e7a386'::uuid, 'It runs from files installed on the device', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('69066123-8ca7-40ab-bd48-b08f24c97f0d'::uuid, 'd1639e8f-57e3-45a0-b250-c0ee10e7a386'::uuid, 'It can run only inside an email message', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('d3ef3574-06d2-443a-863b-6a7af4268ad8'::uuid, 'd1639e8f-57e3-45a0-b250-c0ee10e7a386'::uuid, 'It is stored exclusively on a remote server', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('d9e9e132-82d3-4d88-b078-3d3410ac735c'::uuid, 'd1639e8f-57e3-45a0-b250-c0ee10e7a386'::uuid, 'It never requires device resources', false, 3, now());

-- Question 48
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('18091bd9-1a25-4f3d-b589-9d24d14c39a3'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'What is a digital platform used to distribute software applications commonly called?', 'An app store provides a catalog and delivery mechanism for software applications.', 'mcq', 47, 'application', 'medium', 'application', 'Cloud, Apps, LMS and CRM', '65b5235f471bc34014b816da951d12583e2dd413f890502dcfdcc09061801ea3', '{"sourceLabel":"Revision Questions 2025, Q70","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q70"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('13c504ba-6561-4d52-8485-68e686fd3854'::uuid, '18091bd9-1a25-4f3d-b589-9d24d14c39a3'::uuid, 'An app store', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('b6925d54-5f99-479a-9266-1b46d4ddf66a'::uuid, '18091bd9-1a25-4f3d-b589-9d24d14c39a3'::uuid, 'A directory path', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('21cc88bc-4aaf-4c0b-8da3-2d69206161ca'::uuid, '18091bd9-1a25-4f3d-b589-9d24d14c39a3'::uuid, 'A browser cache', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('640340d1-3bd4-4219-8f6d-cc399c7a985e'::uuid, '18091bd9-1a25-4f3d-b589-9d24d14c39a3'::uuid, 'A restore point', false, 3, now());

-- Question 49
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('073229d7-958d-403d-ba09-f386471f0ca0'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'Why is a browser-based web application described as platform-independent?', 'A web app relies primarily on browser standards rather than one specific operating system.', 'mcq', 48, 'scenario_analysis', 'hard', 'analysis', 'Cloud, Apps, LMS and CRM', 'dd38a7edf2363e8f5159fb7a6506d6b4757dc20cb4b7ec5221c907b83bc60f7d', '{"sourceLabel":"Revision Questions 2025, Q69","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q69"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('daa658fe-1349-4bc0-b05a-7b4ee281faee'::uuid, '073229d7-958d-403d-ba09-f386471f0ca0'::uuid, 'It requires the same processor brand on every device', false, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('5af7cf95-9723-4894-a608-3ac0fb62e9e9'::uuid, '073229d7-958d-403d-ba09-f386471f0ca0'::uuid, 'It can run through compatible browsers on different operating systems', true, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('f2a02831-af7c-4acc-a84a-308276fbffce'::uuid, '073229d7-958d-403d-ba09-f386471f0ca0'::uuid, 'It never uses an Internet connection', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('8a54a4c6-0442-405f-933d-46b86fd72102'::uuid, '073229d7-958d-403d-ba09-f386471f0ca0'::uuid, 'It permanently changes the operating system', false, 3, now());

-- Question 50
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('db1366c0-0d37-4d9d-85e7-04200414d6bf'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'Which application type generally has the deepest access to a device''s operating-system features?', 'Native applications are built for a particular platform and generally offer the most complete device integration.', 'mcq', 49, 'application', 'medium', 'application', 'Cloud, Apps, LMS and CRM', '4b2f6d7b87fca51acf0a83569a48bb1dfe677f910688adf2d855d13e6235f74f', '{"sourceLabel":"Revision Questions 2025, Q35 and Q67","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q35 and Q67"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('ec6a4693-3f17-4c72-ad72-98e2699bbb29'::uuid, 'db1366c0-0d37-4d9d-85e7-04200414d6bf'::uuid, 'A native application designed for that platform', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('e8a09196-2e64-4478-bc3b-55c68c7c8000'::uuid, 'db1366c0-0d37-4d9d-85e7-04200414d6bf'::uuid, 'A plain text document', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('4675e4a6-43e8-4f26-967d-2792b0eac7f9'::uuid, 'db1366c0-0d37-4d9d-85e7-04200414d6bf'::uuid, 'A compressed folder', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('6c8e27d3-6022-481f-a69e-f99ce8ac4116'::uuid, 'db1366c0-0d37-4d9d-85e7-04200414d6bf'::uuid, 'A static web page', false, 3, now());

-- Question 51
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('6d421890-8e73-4831-94de-7ed222069cfa'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'What is the primary purpose of a Learning Management System?', 'An LMS organizes course content, learning activities, users and progress within a digital learning environment.', 'mcq', 50, 'recall', 'easy', 'recall', 'Cloud, Apps, LMS and CRM', '9394c8262d9de63cdd3f22a5abd27cccc82bebaf973e927a983709b9d46d5510', '{"sourceLabel":"Revision Questions 2025, Q45","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q45"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('c8e06364-6bb3-4962-bca9-216459f4a06e'::uuid, '6d421890-8e73-4831-94de-7ed222069cfa'::uuid, 'To deliver and manage learning activities and course content', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('ec1844d7-0f7d-4f71-8def-f790d3d49cd4'::uuid, '6d421890-8e73-4831-94de-7ed222069cfa'::uuid, 'To repair damaged computer hardware', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('094929cb-42bb-49c0-9b46-1f8d2cb3a7d0'::uuid, '6d421890-8e73-4831-94de-7ed222069cfa'::uuid, 'To replace every web browser', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('36cc24d1-7a70-4e49-9a93-95a0f0086871'::uuid, '6d421890-8e73-4831-94de-7ed222069cfa'::uuid, 'To compress photographs for email', false, 3, now());

-- Question 52
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('1800f1a8-17a9-47bc-aa05-b437544cd8ea'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'What information is at the heart of a Customer Relationship Management application?', 'CRM systems organize information about customers, communications and relationships.', 'mcq', 51, 'application', 'medium', 'application', 'Cloud, Apps, LMS and CRM', '7a272002c4f0a2deb21134605915ccabb136513d5aa48177c5a53d6cba4fafa6', '{"sourceLabel":"Revision Questions 2025, Q46","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q46"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('5ddd8b36-5d85-4bfa-a09a-9a3b8b184600'::uuid, '1800f1a8-17a9-47bc-aa05-b437544cd8ea'::uuid, 'Customer records and interactions', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('e55698db-dc86-4cbc-a843-d86520c064a4'::uuid, '1800f1a8-17a9-47bc-aa05-b437544cd8ea'::uuid, 'Monitor brightness settings', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('dcf93aca-c689-4fc9-b76c-39688fa108d7'::uuid, '1800f1a8-17a9-47bc-aa05-b437544cd8ea'::uuid, 'Operating-system installation files', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('431c9c12-44cb-49e8-b8c3-c02e220087b7'::uuid, '1800f1a8-17a9-47bc-aa05-b437544cd8ea'::uuid, 'Presentation animations', false, 3, now());

-- Question 53
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('6359fb0c-cdf2-466e-9fed-7b9b1d4f4389'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'A free mobile application charges a user to unlock an advanced feature from inside the application. What is this transaction called?', 'An in-app purchase unlocks content or features after the application has already been installed.', 'mcq', 52, 'scenario_analysis', 'hard', 'analysis', 'Cloud, Apps, LMS and CRM', '606c552a97868f55b4884b1a3b7b6352c699729434089f5de16100e30240bc87', '{"sourceLabel":"Revision Questions 2025, Q78","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q78"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('b093626d-5fe4-499e-a420-3e9b8ae86438'::uuid, '6359fb0c-cdf2-466e-9fed-7b9b1d4f4389'::uuid, 'A system restore', false, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('c4074fca-04d7-4500-88da-6cf2d1a342cb'::uuid, '6359fb0c-cdf2-466e-9fed-7b9b1d4f4389'::uuid, 'An in-app purchase', true, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('fc9e417b-4e4b-4ff3-b9ad-468ed88969b9'::uuid, '6359fb0c-cdf2-466e-9fed-7b9b1d4f4389'::uuid, 'A file permission', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('2e78e7a5-0eb2-4f0b-88f9-d5017734afde'::uuid, '6359fb0c-cdf2-466e-9fed-7b9b1d4f4389'::uuid, 'A browser cookie', false, 3, now());

-- Question 54
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('4b825afd-11ee-41d0-aeff-8582c42e12f9'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'What happens during media streaming?', 'Streaming delivers a continuing flow of data that can be played without first downloading the complete file.', 'mcq', 53, 'application', 'medium', 'application', 'Cloud, Apps, LMS and CRM', '139c39a4f1d990d3580343c4582bfa8dea21ca8fbb75ef640ae1a97a14ed212c', '{"sourceLabel":"Revision Questions 2025, Q75-76","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q75-76"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('f7aec951-a86b-474f-b2fd-a5bfa1b75d70'::uuid, '4b825afd-11ee-41d0-aeff-8582c42e12f9'::uuid, 'The entire file must finish downloading before playback', false, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('46270730-d508-4b60-8ca3-5b67e03ba4e8'::uuid, '4b825afd-11ee-41d0-aeff-8582c42e12f9'::uuid, 'Data arrives continuously and playback begins before the full file is stored', true, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('0c25f150-eb58-490b-963b-80422f580a84'::uuid, '4b825afd-11ee-41d0-aeff-8582c42e12f9'::uuid, 'The device permanently deletes the media', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('ac1b6a4e-f38f-4418-923d-615e90e9dd18'::uuid, '4b825afd-11ee-41d0-aeff-8582c42e12f9'::uuid, 'The media is converted into a spreadsheet', false, 3, now());

-- Question 55
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('a0f871fe-e57d-41ec-a841-5834903d55f8'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'Which program type is specifically designed for interaction on devices such as tablets and smartphones?', 'Mobile apps commonly provide controls designed for touch-screen devices.', 'mcq', 54, 'recall', 'easy', 'recall', 'Cloud, Apps, LMS and CRM', '4a7f20937cafdfb950fbaa67403298c292c6f2dc6e5056a9ce77756c44ec2239', '{"sourceLabel":"Revision Questions 2025, Q67","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q67"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('1c95edb4-dcc0-4bd3-b0b4-2ed16142f9b3'::uuid, 'a0f871fe-e57d-41ec-a841-5834903d55f8'::uuid, 'A touch-oriented mobile app', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('549568b4-0f2a-40ef-997f-47e323742fe8'::uuid, 'a0f871fe-e57d-41ec-a841-5834903d55f8'::uuid, 'A printer driver only', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('756f5452-a4fc-4e85-a8b1-8bb0cf598864'::uuid, 'a0f871fe-e57d-41ec-a841-5834903d55f8'::uuid, 'A compressed archive', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('1b0d2845-a65f-43e5-9a4f-6a695b94b5ed'::uuid, 'a0f871fe-e57d-41ec-a841-5834903d55f8'::uuid, 'A file extension', false, 3, now());

-- Question 56
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('b5bcdfec-eae0-46a9-82bd-3f4ac80e12a3'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'Which area of Microsoft Word contains commands for opening, saving, printing and configuring documents?', 'The File tab opens Backstage view, where file-management and application options are located.', 'mcq', 55, 'recall', 'easy', 'recall', 'Microsoft Word', 'a393d20a97fe73e63a50396af8f90cb45d397cd15db5220f759e25a14349a327', '{"sourceLabel":"Revision Guide, p.1; Revision Questions 2025, Q79","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Guide, p.1; Revision Questions 2025, Q79"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('3bc58421-b2ce-4279-80c5-bbce1a14e8ca'::uuid, 'b5bcdfec-eae0-46a9-82bd-3f4ac80e12a3'::uuid, 'Backstage view', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('b8aebdd2-49b3-421a-a399-702e3e71637b'::uuid, 'b5bcdfec-eae0-46a9-82bd-3f4ac80e12a3'::uuid, 'Status bar', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('82d2374e-bfc0-48d1-bad3-3d4d3fb3372d'::uuid, 'b5bcdfec-eae0-46a9-82bd-3f4ac80e12a3'::uuid, 'Document margin', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('b8c313dd-9f99-4c99-8010-79938c23c52d'::uuid, 'b5bcdfec-eae0-46a9-82bd-3f4ac80e12a3'::uuid, 'Clipboard', false, 3, now());

-- Question 57
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('f59a9610-4c48-4b33-be34-2a01a56030a9'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'Where are related Word commands organized into groups such as Font, Paragraph and Styles?', 'The Ribbon organizes commands into tabs and functional groups.', 'mcq', 56, 'application', 'medium', 'application', 'Microsoft Word', 'c2c592cad948ac58137317ce8e66f6d4e1b05012f20f9345bf604d76a4ebb220', '{"sourceLabel":"Revision Guide, p.1","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Guide, p.1"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('1d30a72d-da83-46b0-a1da-f3c2d24b6173'::uuid, 'f59a9610-4c48-4b33-be34-2a01a56030a9'::uuid, 'On Ribbon tabs', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('0e7b9581-3cd8-43fa-8928-0586e3666eb1'::uuid, 'f59a9610-4c48-4b33-be34-2a01a56030a9'::uuid, 'Inside the status bar', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('c7424384-9457-4709-bf51-c11f779406b2'::uuid, 'f59a9610-4c48-4b33-be34-2a01a56030a9'::uuid, 'In the document footer', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('914f0dbb-7ede-4796-b5a4-156aca06ecf6'::uuid, 'f59a9610-4c48-4b33-be34-2a01a56030a9'::uuid, 'On the vertical ruler', false, 3, now());

-- Question 58
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('c3f20f41-43e9-4138-bb46-a1922db9383f'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'Why may Word open an email attachment in Protected View?', 'Protected View isolates files from potentially unsafe sources before editing is enabled.', 'mcq', 57, 'application', 'medium', 'application', 'Microsoft Word', 'ce2337f0aecbd7dd59535b961274ea395643ad28c47eff620a6d93e9f44617c9', '{"sourceLabel":"Revision Questions 2025, Q84-85","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q84-85"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('9d7cf746-deac-4c25-897d-579a0c3ab5b2'::uuid, 'c3f20f41-43e9-4138-bb46-a1922db9383f'::uuid, 'To reduce the file''s page count', false, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('9e86b597-ebe2-4e58-8aa7-0e02de92f367'::uuid, 'c3f20f41-43e9-4138-bb46-a1922db9383f'::uuid, 'To limit potentially unsafe content until the document is trusted', true, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('22336c0d-fa2e-48bf-aba8-dce1b386b25e'::uuid, 'c3f20f41-43e9-4138-bb46-a1922db9383f'::uuid, 'To translate the document automatically', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('fdf57579-a988-46bf-a47e-dfdc61238c3d'::uuid, 'c3f20f41-43e9-4138-bb46-a1922db9383f'::uuid, 'To prevent the user from reading it', false, 3, now());

-- Question 59
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('2acf06be-2c1e-484d-90b2-fd9c1ce77852'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'Which key should be held to select separate, non-contiguous passages in a Word document?', 'Holding Ctrl allows separated selections without including everything between them.', 'mcq', 58, 'recall', 'easy', 'recall', 'Microsoft Word', '5974cbbe656d3b6c5ba4430bc35c325369f87cd2b7455338c3ea057d183509bf', '{"sourceLabel":"Revision Questions 2025, Q82","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q82"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('8d265a92-ac78-4d32-aa97-0d6bdc333a0b'::uuid, '2acf06be-2c1e-484d-90b2-fd9c1ce77852'::uuid, 'Alt', false, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('e1f2a3d8-52b0-4a19-826a-313cc17bd072'::uuid, '2acf06be-2c1e-484d-90b2-fd9c1ce77852'::uuid, 'Ctrl', true, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('e380ab58-1227-421f-b052-01c241d43963'::uuid, '2acf06be-2c1e-484d-90b2-fd9c1ce77852'::uuid, 'Shift', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('55548701-14cc-47fd-9575-5ca7bdc2df81'::uuid, '2acf06be-2c1e-484d-90b2-fd9c1ce77852'::uuid, 'Tab', false, 3, now());

-- Question 60
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('8728f2ec-964a-4526-95b6-8a093bece8ab'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'A paragraph must remain in its original location while an identical copy is placed on another page. Which commands should be used?', 'Copy preserves the original content, whereas Cut would remove it from its first location.', 'mcq', 59, 'scenario_analysis', 'hard', 'analysis', 'Microsoft Word', '23d86bb50750ec37b6d877b385b8bc2215384280df5391e804a2863f4a36e893', '{"sourceLabel":"Revision Questions 2025, Q86","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q86"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('d6d2194f-cf33-4ed8-a20b-8ed6383ea945'::uuid, '8728f2ec-964a-4526-95b6-8a093bece8ab'::uuid, 'Cut and Paste', false, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('2d01316c-19e3-4ab3-844d-c6c02bbc63ad'::uuid, '8728f2ec-964a-4526-95b6-8a093bece8ab'::uuid, 'Copy and Paste', true, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('319e4750-92c2-44b8-afea-aff715648566'::uuid, '8728f2ec-964a-4526-95b6-8a093bece8ab'::uuid, 'Delete and Undo', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('525c4ade-c208-4059-9d42-49c61a7e8db9'::uuid, '8728f2ec-964a-4526-95b6-8a093bece8ab'::uuid, 'Find and Replace', false, 3, now());

-- Question 61
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('7f10deef-3e19-46cf-bb8a-f37fa39fb850'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'What should be done before applying formatting to existing text?', 'Formatting commands act on the text or object currently selected.', 'mcq', 60, 'application', 'medium', 'application', 'Microsoft Word', 'a5f1e7b62227e789574fceaa4305641a77143da0824ef77b13f0d7b17ace1ffc', '{"sourceLabel":"Revision Questions 2025, Q88","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q88"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('4ed6e6aa-b2e3-439a-8e20-8ab03a109be9'::uuid, '7f10deef-3e19-46cf-bb8a-f37fa39fb850'::uuid, 'Select the intended text', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('f54b676a-a20d-4f31-88a2-67ef2c03ffde'::uuid, '7f10deef-3e19-46cf-bb8a-f37fa39fb850'::uuid, 'Close the document', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('f49d6063-b897-4bf1-8c0b-66ce9ad402a3'::uuid, '7f10deef-3e19-46cf-bb8a-f37fa39fb850'::uuid, 'Change the file extension', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('7d87211f-09c8-4cdd-a5be-20a0e87b0adc'::uuid, '7f10deef-3e19-46cf-bb8a-f37fa39fb850'::uuid, 'Open a different application', false, 3, now());

-- Question 62
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('f99ecbc1-3278-41f8-b333-d24537843572'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'Which page orientation produces a page that is wider than it is tall?', 'Landscape orientation places the longer page dimension horizontally.', 'mcq', 61, 'recall', 'easy', 'recall', 'Microsoft Word', '42b4f57e19b917aa0c92e69d0e2ef70398f7724fea2f3a8127dc180693abbe9c', '{"sourceLabel":"Revision Questions 2025, Q90","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q90"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('fe118ebf-28d7-4329-bca5-54715062c0b5'::uuid, 'f99ecbc1-3278-41f8-b333-d24537843572'::uuid, 'Portrait', false, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('62c3b52b-0c47-4592-bca1-047dd55e9458'::uuid, 'f99ecbc1-3278-41f8-b333-d24537843572'::uuid, 'Landscape', true, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('eff25916-72ad-48c9-98db-c73b6be889aa'::uuid, 'f99ecbc1-3278-41f8-b333-d24537843572'::uuid, 'Justified', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('8334c72a-befa-48ea-9ff3-07ff7855aee4'::uuid, 'f99ecbc1-3278-41f8-b333-d24537843572'::uuid, 'Vertical', false, 3, now());

-- Question 63
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('c0f5d8da-f1b4-4a09-a8fe-3e0ce6575015'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'Why are tab stops preferable to repeated spaces when aligning figures in a financial report?', 'Tab stops position text predictably and keep columns aligned when content changes.', 'mcq', 62, 'application', 'medium', 'application', 'Microsoft Word', '01d2bea753a244f4572c150025115f1918ee37f337cdfe5074f4c306e94863a3', '{"sourceLabel":"Revision Questions 2025, Q89","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q89"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('39c1ae96-9cbe-44a6-8caf-544a874938de'::uuid, 'c0f5d8da-f1b4-4a09-a8fe-3e0ce6575015'::uuid, 'They provide consistent column alignment', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('6c699d4e-e056-4108-8477-c70dd811a0bf'::uuid, 'c0f5d8da-f1b4-4a09-a8fe-3e0ce6575015'::uuid, 'They encrypt the figures', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('09a8e79b-6b81-4edb-8468-da86a835591a'::uuid, 'c0f5d8da-f1b4-4a09-a8fe-3e0ce6575015'::uuid, 'They reduce the document to one page', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('beac82d6-21e8-45f0-9de6-5c64e4152bad'::uuid, 'c0f5d8da-f1b4-4a09-a8fe-3e0ce6575015'::uuid, 'They convert figures into formulas', false, 3, now());

-- Question 64
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('7168db75-c466-47b1-961d-3546fdf5a422'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'A user has formatted one paragraph correctly and wants to apply the same formatting to two other paragraphs. Which tool is most efficient?', 'Format Painter copies formatting attributes without copying the paragraph''s text.', 'mcq', 63, 'scenario_analysis', 'hard', 'analysis', 'Microsoft Word', '8edfb749a4d6a259f991a88a55badb2511258b95a685f858447657462d46e421', '{"sourceLabel":"Revision Questions 2025, Q87","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q87"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('dcbdddbb-b7d9-4915-bbd0-08419b3cc317'::uuid, '7168db75-c466-47b1-961d-3546fdf5a422'::uuid, 'Format Painter', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('d02ee5e3-32cb-4e7e-8825-38dfd60a9878'::uuid, '7168db75-c466-47b1-961d-3546fdf5a422'::uuid, 'Word Count', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('9d4faa32-1c9d-4a3a-b3d1-6e4b3630da7f'::uuid, '7168db75-c466-47b1-961d-3546fdf5a422'::uuid, 'Navigation Pane', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('24801a8c-b5f8-44b1-9abc-4c663f429c4f'::uuid, '7168db75-c466-47b1-961d-3546fdf5a422'::uuid, 'Track Changes', false, 3, now());

-- Question 65
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('a56e582b-0cd2-4abc-867f-1773b5075ce7'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'How are page margins represented on Word''s horizontal and vertical rulers?', 'The ruler visually separates margin areas from the usable page area.', 'mcq', 64, 'application', 'medium', 'application', 'Microsoft Word', 'f24b2cd2cbbc294fd78308794450f3341890972c28e46e75ecae913edcd1e354', '{"sourceLabel":"Revision Questions 2025, Q91","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q91"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('192d4e3b-d16a-4a91-b606-cdcf53cc2bbd'::uuid, 'a56e582b-0cd2-4abc-867f-1773b5075ce7'::uuid, 'By the boundaries between shaded and unshaded ruler areas', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('bb8a099e-5a46-42ce-82ad-52ec4245ba16'::uuid, 'a56e582b-0cd2-4abc-867f-1773b5075ce7'::uuid, 'By red spelling underlines', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('7a90f1b5-0676-49ff-b797-f697db20ae30'::uuid, 'a56e582b-0cd2-4abc-867f-1773b5075ce7'::uuid, 'By the document filename', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('94fb751f-874c-4485-8234-699f1bd9be9c'::uuid, 'a56e582b-0cd2-4abc-867f-1773b5075ce7'::uuid, 'By animation markers', false, 3, now());

-- Question 66
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('1c4b06a9-1b5c-49e8-8fba-03a7255ab479'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'Where does Word normally place an automatically inserted page number?', 'Automatic page numbers are fields placed in the page header or footer area.', 'mcq', 65, 'recall', 'easy', 'recall', 'Microsoft Word', '3ed9b017876bbee0ad2bd04593ce9f704e07746cf9cb9b8861f006087580d4b5', '{"sourceLabel":"Revision Questions 2025, Q92","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q92"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('45dca171-4808-462c-9d0d-1cb5fc841bf2'::uuid, '1c4b06a9-1b5c-49e8-8fba-03a7255ab479'::uuid, 'In a header or footer', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('eb9f110f-8808-4e20-8ce6-4b04266171d0'::uuid, '1c4b06a9-1b5c-49e8-8fba-03a7255ab479'::uuid, 'Inside every paragraph', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('5679c16b-9cef-46bc-97eb-6f6c7f4df20e'::uuid, '1c4b06a9-1b5c-49e8-8fba-03a7255ab479'::uuid, 'In the filename', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('83c55f12-4efd-45c4-b9c1-011e41b0f423'::uuid, '1c4b06a9-1b5c-49e8-8fba-03a7255ab479'::uuid, 'On the Clipboard', false, 3, now());

-- Question 67
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('e6d3b1cd-bdfd-4bfa-8c3a-049ab20eb28b'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'Which shortcut inserts a column break in a multi-column Word document?', 'Ctrl+Shift+Enter inserts a column break, moving following text to the next column.', 'mcq', 66, 'application', 'medium', 'application', 'Microsoft Word', 'a994aedcb75da998ee024105fc61c6ed69d669146da29b50db080e3ef0be05d2', '{"sourceLabel":"Revision Questions 2025, Q93","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q93"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('09727c89-1da9-49c1-9f44-0e4aba98f1a8'::uuid, 'e6d3b1cd-bdfd-4bfa-8c3a-049ab20eb28b'::uuid, 'Ctrl+Enter', false, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('6b0b0b0a-2798-480b-814b-6a365fbe35ac'::uuid, 'e6d3b1cd-bdfd-4bfa-8c3a-049ab20eb28b'::uuid, 'Ctrl+Shift+Enter', true, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('607355d7-59b9-4c26-b3e9-b73549003a11'::uuid, 'e6d3b1cd-bdfd-4bfa-8c3a-049ab20eb28b'::uuid, 'Ctrl+P', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('181bb287-39aa-4a9c-8eb1-66ee810352c0'::uuid, 'e6d3b1cd-bdfd-4bfa-8c3a-049ab20eb28b'::uuid, 'Alt+F4', false, 3, now());

-- Question 68
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('12b6d54a-30b0-479f-b339-860a800eb80c'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'A user needs to locate every occurrence of a heading in a long structured document. Which Word feature is most helpful?', 'The Navigation Pane exposes headings and search results for rapid movement through a document.', 'mcq', 67, 'scenario_analysis', 'hard', 'analysis', 'Microsoft Word', 'fa72c72bcb0e82ac65f242cdc33b1b074429071299a2d29470d401a50c586520', '{"sourceLabel":"Revision Questions 2025, Q94; Revision Guide, p.1","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q94; Revision Guide, p.1"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('1969d74b-0600-4f11-acc2-5fc1fe3128d8'::uuid, '12b6d54a-30b0-479f-b339-860a800eb80c'::uuid, 'Navigation Pane', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('3820601d-22a1-4ee1-9054-aa799e2f3e01'::uuid, '12b6d54a-30b0-479f-b339-860a800eb80c'::uuid, 'Status bar zoom', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('d2a697f9-504f-4363-8445-a663805c58a1'::uuid, '12b6d54a-30b0-479f-b339-860a800eb80c'::uuid, 'Clipboard', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('53b26ca8-a052-4c00-863a-dff957e5f65a'::uuid, '12b6d54a-30b0-479f-b339-860a800eb80c'::uuid, 'Page colour', false, 3, now());

-- Question 69
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('bcab6dc7-9429-45ff-802e-8dd2902f7fd4'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'How does Word commonly identify a possible spelling error in document text?', 'Word marks suspected spelling errors with a visual underline for user review.', 'mcq', 68, 'application', 'medium', 'application', 'Microsoft Word', '1c4971759698eafc153ac76260c33ca9589c23cac2252ce9f01f86ec1f27f107', '{"sourceLabel":"Revision Questions 2025, Q95","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q95"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('5e33e815-b641-498c-910f-c0a279598448'::uuid, 'bcab6dc7-9429-45ff-802e-8dd2902f7fd4'::uuid, 'With a coloured wavy underline', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('e798a04f-63dc-4cb7-8639-3c494472b17b'::uuid, 'bcab6dc7-9429-45ff-802e-8dd2902f7fd4'::uuid, 'By deleting the word', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('944deacc-db20-45c5-87e6-f5f170773303'::uuid, 'bcab6dc7-9429-45ff-802e-8dd2902f7fd4'::uuid, 'By changing the page orientation', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('418b31e3-ba0e-4b5a-a27f-22dd3a069621'::uuid, 'bcab6dc7-9429-45ff-802e-8dd2902f7fd4'::uuid, 'By closing the document', false, 3, now());

-- Question 70
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('fdc7d23b-e91f-4148-a74d-3d9dfc32c100'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'Which shortcut opens the Print interface in Microsoft Office applications?', 'Ctrl+P opens the print options in Backstage view.', 'mcq', 69, 'recall', 'easy', 'recall', 'Microsoft Word', '5a86d0308123fef6ef5adcafe503762681687b6486d8093ea80449c830904d03', '{"sourceLabel":"Revision Questions 2025, Q96","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q96"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('3b367e85-13cc-4656-b678-62bdf0e96d42'::uuid, 'fdc7d23b-e91f-4148-a74d-3d9dfc32c100'::uuid, 'Ctrl+F', false, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('5525ac41-0e69-4153-b115-d6e5a688fd1d'::uuid, 'fdc7d23b-e91f-4148-a74d-3d9dfc32c100'::uuid, 'Ctrl+P', true, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('37d7acdd-387a-426f-a916-772ed05806eb'::uuid, 'fdc7d23b-e91f-4148-a74d-3d9dfc32c100'::uuid, 'Ctrl+T', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('f1852305-e7de-49e5-8876-37e7a617d933'::uuid, 'fdc7d23b-e91f-4148-a74d-3d9dfc32c100'::uuid, 'Ctrl+L', false, 3, now());

-- Question 71
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('3dafe7bf-b839-4ad1-bc30-4358e736bc02'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'What normally appears around an image after it has been selected for manipulation?', 'Selection handles indicate that the image is active and can be resized or modified.', 'mcq', 70, 'application', 'medium', 'application', 'Microsoft Word', '242436191de73ab29932d75fcd1727fcde6aff09433a6959e28e15584d5bc2e2', '{"sourceLabel":"Revision Questions 2025, Q97","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q97"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('79cb69f1-6ea2-4ebd-94d7-db8e58b4427c'::uuid, '3dafe7bf-b839-4ad1-bc30-4358e736bc02'::uuid, 'Selection and sizing handles', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('f6d6c39c-3287-4e5e-988c-7300d5602d3b'::uuid, '3dafe7bf-b839-4ad1-bc30-4358e736bc02'::uuid, 'A password prompt', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('ec59ea2e-0bcc-4678-9c14-4f557fb37a05'::uuid, '3dafe7bf-b839-4ad1-bc30-4358e736bc02'::uuid, 'A formula bar', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('f166abc2-fab9-48a3-a850-b12244192d5d'::uuid, '3dafe7bf-b839-4ad1-bc30-4358e736bc02'::uuid, 'A browser address', false, 3, now());

-- Question 72
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('e9a8d3dd-26c1-4540-b6b1-84d30e5f817c'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'A photograph contains unwanted content around its edges, but the original image file should remain unchanged. Which Word command should be used?', 'Cropping hides unwanted outer areas without rewriting the source image file.', 'mcq', 71, 'scenario_analysis', 'hard', 'analysis', 'Microsoft Word', '9e6bb7e6b64e1c0440e0586009e6c48499b0cc1fc58cbeeddaa2d11312eb2dbc', '{"sourceLabel":"Revision Questions 2025, Q98","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q98"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('2191369d-5e99-4821-b192-479e8839c52a'::uuid, 'e9a8d3dd-26c1-4540-b6b1-84d30e5f817c'::uuid, 'Crop', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('30a879c9-9f40-4348-abe2-175e2abc552a'::uuid, 'e9a8d3dd-26c1-4540-b6b1-84d30e5f817c'::uuid, 'Track Changes', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('ca82d408-3210-4f24-903e-d83410ada003'::uuid, 'e9a8d3dd-26c1-4540-b6b1-84d30e5f817c'::uuid, 'Word Count', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('7c1ca4c4-b817-4774-a6a7-ef9b4a003656'::uuid, 'e9a8d3dd-26c1-4540-b6b1-84d30e5f817c'::uuid, 'Mail Merge', false, 3, now());

-- Question 73
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('6a1e34e6-b72d-4154-961a-ff4adba148ce'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'How should Track Changes be stopped after a reviewer finishes recording edits?', 'Track Changes is a toggle; selecting it again stops the recording of new edits.', 'mcq', 72, 'application', 'medium', 'application', 'Microsoft Word', 'e435b383a838f4e8f432c05ec899380fb22dc74603b1e589367f9d7eeefe0ccf', '{"sourceLabel":"Revision Questions 2025, Q101","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q101"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('35a937f2-28af-4fb2-a699-9eba3c56c87c'::uuid, '6a1e34e6-b72d-4154-961a-ff4adba148ce'::uuid, 'Select the Track Changes command again to turn it off', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('16e67aa2-8ea0-492e-ac73-582650bd6c3c'::uuid, '6a1e34e6-b72d-4154-961a-ff4adba148ce'::uuid, 'Delete the entire document', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('f3542184-fccb-4d67-a54e-b20f4c52d440'::uuid, '6a1e34e6-b72d-4154-961a-ff4adba148ce'::uuid, 'Change the file to PDF', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('64733940-3d44-4d34-81c1-bf8c9aac9cb4'::uuid, '6a1e34e6-b72d-4154-961a-ff4adba148ce'::uuid, 'Close the Navigation Pane', false, 3, now());

-- Question 74
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('4d239ba9-4081-4b36-9054-d509cd61535f'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'What is the relationship between an Excel workbook and a worksheet?', 'The workbook is the Excel file, and worksheets are the individual sheets within it.', 'mcq', 73, 'recall', 'easy', 'recall', 'Microsoft Excel and Databases', '15f88312456cdce11277d9ed2661ec6324ce73b36887ec688febcf9b1471fd97', '{"sourceLabel":"Revision Questions 2025, Q102","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q102"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('be389fd7-1ef6-4eea-9580-7e0076cf843c'::uuid, '4d239ba9-4081-4b36-9054-d509cd61535f'::uuid, 'A workbook contains one or more worksheets', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('f0b1f600-3055-4296-9bb1-0c76b3062610'::uuid, '4d239ba9-4081-4b36-9054-d509cd61535f'::uuid, 'A worksheet contains multiple workbook files', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('bcec7b6e-2b5d-4055-9552-08eb2ae4fc5d'::uuid, '4d239ba9-4081-4b36-9054-d509cd61535f'::uuid, 'They are unrelated file types', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('3b0cc94f-0a23-42e2-99f9-094a95f0f732'::uuid, '4d239ba9-4081-4b36-9054-d509cd61535f'::uuid, 'A workbook can contain text but no cells', false, 3, now());

-- Question 75
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('e93a02d1-1625-4af4-aee4-3e592f739927'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'Why are labels entered into a worksheet?', 'Labels provide headings and descriptions that make worksheet data understandable.', 'mcq', 74, 'application', 'medium', 'application', 'Microsoft Excel and Databases', '10d85da1a122218aeb1b1bf30b90d9ba13000fa371a01832178a732dbed16720', '{"sourceLabel":"Revision Questions 2025, Q104","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q104"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('fa634435-8ccf-4d23-b25c-99aabaa50475'::uuid, 'e93a02d1-1625-4af4-aee4-3e592f739927'::uuid, 'To describe and identify the associated data', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('65c9677c-1e99-43b4-800d-76edee8b984b'::uuid, 'e93a02d1-1625-4af4-aee4-3e592f739927'::uuid, 'To replace every numeric value', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('0a7691e0-32c1-4e8a-bc72-dc09600cfb19'::uuid, 'e93a02d1-1625-4af4-aee4-3e592f739927'::uuid, 'To uninstall Excel', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('2c6582c5-9920-48c3-b706-98a01d7a61aa'::uuid, 'e93a02d1-1625-4af4-aee4-3e592f739927'::uuid, 'To encrypt the workbook', false, 3, now());

-- Question 76
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('6001156e-e272-4bd6-be25-3ee29f55a087'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'Which key activates Excel''s Go To command?', 'F5 opens the Go To dialog for navigating directly to a cell or named range.', 'mcq', 75, 'application', 'medium', 'application', 'Microsoft Excel and Databases', '1b93f50739a63d861539c13f9b4096cc4612cc7a7af531508376f99dd0b1ccb9', '{"sourceLabel":"Revision Questions 2025, Q105","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q105"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('ac3902db-7c0c-459b-8946-9fef29579526'::uuid, '6001156e-e272-4bd6-be25-3ee29f55a087'::uuid, 'F2', false, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('b83a1d98-358f-47ab-8a97-7b571b35f3a6'::uuid, '6001156e-e272-4bd6-be25-3ee29f55a087'::uuid, 'F5', true, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('2335a985-59cd-48fc-abd3-425246891488'::uuid, '6001156e-e272-4bd6-be25-3ee29f55a087'::uuid, 'F7', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('250382d9-9968-441b-b480-7d2b58415959'::uuid, '6001156e-e272-4bd6-be25-3ee29f55a087'::uuid, 'F12', false, 3, now());

-- Question 77
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('dd8ce4f7-4429-4bc2-8f7e-e92463db4e71'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'Where should a user click to select an entire worksheet row?', 'Clicking the numbered row heading selects every cell in that row.', 'mcq', 76, 'recall', 'easy', 'recall', 'Microsoft Excel and Databases', 'f51714c438f58a8db637827a1aa57504b2dc3fe18aac7affcd8c6eea45b52baa', '{"sourceLabel":"Revision Questions 2025, Q106","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q106"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('46f385bd-f42b-4355-88be-96bbe9acd33f'::uuid, 'dd8ce4f7-4429-4bc2-8f7e-e92463db4e71'::uuid, 'The row number heading', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('673d96b5-3900-4b6e-815c-db12d6f1282b'::uuid, 'dd8ce4f7-4429-4bc2-8f7e-e92463db4e71'::uuid, 'The formula bar', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('41ce0eb1-a0c8-47a6-9d52-21e3d1216b9c'::uuid, 'dd8ce4f7-4429-4bc2-8f7e-e92463db4e71'::uuid, 'The sheet tab', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('7ddec414-5043-4093-b30a-e8516eca7192'::uuid, 'dd8ce4f7-4429-4bc2-8f7e-e92463db4e71'::uuid, 'The status bar', false, 3, now());

-- Question 78
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('91754871-cfc3-4fa9-976e-d739e0cf6afd'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'What visual indicator normally surrounds Excel cells after Cut or Copy is activated?', 'Excel displays a moving dashed border around the range placed on the Clipboard.', 'mcq', 77, 'scenario_analysis', 'hard', 'analysis', 'Microsoft Excel and Databases', '7a19d03a42de3ee9f7de91aa4f2b5c11e5dbdb18f996e53e40f69a653ed0fcc0', '{"sourceLabel":"Revision Questions 2025, Q107","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q107"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('478a34f7-b4f6-4110-bb43-473542ea2739'::uuid, '91754871-cfc3-4fa9-976e-d739e0cf6afd'::uuid, 'A moving dashed border', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('495a084e-2e55-4922-8598-448c142c0f7b'::uuid, '91754871-cfc3-4fa9-976e-d739e0cf6afd'::uuid, 'A spelling underline', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('3c22c401-8c0e-4773-9d09-4baa975c7bd3'::uuid, '91754871-cfc3-4fa9-976e-d739e0cf6afd'::uuid, 'A slide-transition icon', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('5f6326e0-7b07-42d4-8c61-5219aca6b3f1'::uuid, '91754871-cfc3-4fa9-976e-d739e0cf6afd'::uuid, 'A password field', false, 3, now());

-- Question 79
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('c94891c0-8bf0-4c98-aa73-16adc57ba9f8'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'What is the most precise method for making an Excel column exactly 18 units wide?', 'The Column Width dialog accepts an exact numerical width instead of relying on visual estimation.', 'mcq', 78, 'application', 'medium', 'application', 'Microsoft Excel and Databases', '06fb3ae290f992749d8f4a69f4194181a7fc5f85fedcabb6491042bab162e3de', '{"sourceLabel":"Revision Questions 2025, Q108","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q108"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('d03032f6-f57c-4e42-89eb-2279302835e7'::uuid, 'c94891c0-8bf0-4c98-aa73-16adc57ba9f8'::uuid, 'Enter 18 in the Column Width dialog', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('eb3a3e7c-f52c-4261-be3c-54f619387620'::uuid, 'c94891c0-8bf0-4c98-aa73-16adc57ba9f8'::uuid, 'Drag the column until it looks suitable', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('1f5f3e5b-fc21-4edb-81bd-8050d4873ff8'::uuid, 'c94891c0-8bf0-4c98-aa73-16adc57ba9f8'::uuid, 'Increase the worksheet zoom', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('e4976923-4c0c-482d-ad3e-920ee79bed99'::uuid, 'c94891c0-8bf0-4c98-aa73-16adc57ba9f8'::uuid, 'Change the row height', false, 3, now());

-- Question 80
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('ab6011ae-368c-4189-8b7f-c54156fce5fd'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'When a worksheet row is inserted, where does Excel normally place it relative to the selected row?', 'Excel inserts a new row above the currently selected row position.', 'mcq', 79, 'recall', 'easy', 'recall', 'Microsoft Excel and Databases', '863ad0e6f7446ef35fe0983a4b447a47344c40e4017facce4bb336a216c95d2d', '{"sourceLabel":"Revision Questions 2025, Q109","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q109"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('eff946e4-a5e7-4265-889f-64e9f8ca8011'::uuid, 'ab6011ae-368c-4189-8b7f-c54156fce5fd'::uuid, 'Above the selected row', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('b493bd97-3321-4687-a9be-df343b5d2ae4'::uuid, 'ab6011ae-368c-4189-8b7f-c54156fce5fd'::uuid, 'Below the last used row', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('f8ee5fd4-786f-491d-a405-04cb1d98bef9'::uuid, 'ab6011ae-368c-4189-8b7f-c54156fce5fd'::uuid, 'Inside the formula bar', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('02980f45-25f7-4325-93ab-5ccb2db373a2'::uuid, 'ab6011ae-368c-4189-8b7f-c54156fce5fd'::uuid, 'On another worksheet', false, 3, now());

-- Question 81
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('dfcece7e-f0a9-4387-83cd-75b995cf76b3'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'Which entry correctly adds the values in cells B2 and B3?', 'Every Excel formula begins with an equals sign.', 'mcq', 80, 'application', 'medium', 'application', 'Microsoft Excel and Databases', '415188f01ff6fe712e7d65be89fdab4af78132aeaa5114853a8741ad3c048eda', '{"sourceLabel":"Revision Questions 2025, Q110","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q110"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('c9ded412-1637-4b07-a2ae-96b3b14eb725'::uuid, 'dfcece7e-f0a9-4387-83cd-75b995cf76b3'::uuid, 'B2+B3', false, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('82bc0c9e-15a5-4933-90a4-7aacd047d6e9'::uuid, 'dfcece7e-f0a9-4387-83cd-75b995cf76b3'::uuid, '=B2+B3', true, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('2956e88b-c2f9-4062-a8ba-fbce8e2da7f0'::uuid, 'dfcece7e-f0a9-4387-83cd-75b995cf76b3'::uuid, 'B2=B3', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('f5d36ebc-9aee-4e35-b520-9dbe7084958a'::uuid, 'dfcece7e-f0a9-4387-83cd-75b995cf76b3'::uuid, '$B2+$B3 without an equals sign', false, 3, now());

-- Question 82
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('af243122-2587-45e5-9187-15d87dfc432f'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'Which statement about Excel cell alignment is correct?', 'Excel provides separate horizontal and vertical alignment controls for cell contents.', 'mcq', 81, 'scenario_analysis', 'hard', 'analysis', 'Microsoft Excel and Databases', '9d345156bc3f887944791517e0dbdcc15c708943a9442b8599c0052809d912f1', '{"sourceLabel":"Revision Questions 2025, Q111","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q111"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('9319179f-d9ed-40da-8d63-23740351f02c'::uuid, 'af243122-2587-45e5-9187-15d87dfc432f'::uuid, 'Content can be aligned both horizontally and vertically', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('0a3ad8a6-c3ef-4935-8dcc-99dca525f725'::uuid, 'af243122-2587-45e5-9187-15d87dfc432f'::uuid, 'Content can be aligned only horizontally', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('dae32659-2283-4c7b-bafa-bcbd1aa8bdfd'::uuid, 'af243122-2587-45e5-9187-15d87dfc432f'::uuid, 'Content can be aligned only vertically', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('1f5af7f6-5de4-4c52-9eb5-768920928062'::uuid, 'af243122-2587-45e5-9187-15d87dfc432f'::uuid, 'Alignment is fixed and cannot be changed', false, 3, now());

-- Question 83
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('f86c6c68-30b3-4c3b-a5f6-99f7e21f14c1'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'Why might printed worksheet cells need borders even though gridlines are visible on screen?', 'Borders are explicit formatting, whereas worksheet gridlines may not appear in the final printout.', 'mcq', 82, 'application', 'medium', 'application', 'Microsoft Excel and Databases', 'dce3163e2707b4952fab0c35d290457ff8802b1bcd95c1c6c8831c235b80aa55', '{"sourceLabel":"Revision Questions 2025, Q112","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q112"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('17e10126-dee1-49a1-8697-fc12b297a028'::uuid, 'f86c6c68-30b3-4c3b-a5f6-99f7e21f14c1'::uuid, 'Borders provide deliberate formatting and can be configured to print', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('a3055201-1292-4112-a82b-2e64faaa7c5a'::uuid, 'f86c6c68-30b3-4c3b-a5f6-99f7e21f14c1'::uuid, 'Borders convert labels into formulas', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('35157b20-9537-47c3-9784-52c98a454b25'::uuid, 'f86c6c68-30b3-4c3b-a5f6-99f7e21f14c1'::uuid, 'Gridlines delete cell values', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('d64aa638-73a0-4716-bb1e-ae414003f8e1'::uuid, 'f86c6c68-30b3-4c3b-a5f6-99f7e21f14c1'::uuid, 'Borders automatically sort the data', false, 3, now());

-- Question 84
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('f9511314-ef33-4ef2-9af8-63881d0fe7f0'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'What is the intersection of a row and a column in a worksheet called?', 'A cell is the basic worksheet location formed by the intersection of one row and one column.', 'mcq', 83, 'recall', 'easy', 'recall', 'Microsoft Excel and Databases', '857c8378ede905bd3c1db484520653963930698516bfa62187405b5d846fffee', '{"sourceLabel":"Revision Questions 2025, Q99","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q99"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('2a0f63eb-d0e2-4d0a-8100-781e7f2b70cf'::uuid, 'f9511314-ef33-4ef2-9af8-63881d0fe7f0'::uuid, 'Cell', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('4f8244b3-de37-420b-ab90-0f03f3315736'::uuid, 'f9511314-ef33-4ef2-9af8-63881d0fe7f0'::uuid, 'Workbook', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('dc9906d4-0189-4c72-8678-e357b0eaa506'::uuid, 'f9511314-ef33-4ef2-9af8-63881d0fe7f0'::uuid, 'Formula', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('f7ce6378-9575-41fb-b111-99a4ddb6beeb'::uuid, 'f9511314-ef33-4ef2-9af8-63881d0fe7f0'::uuid, 'Chart', false, 3, now());

-- Question 85
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('0dfbec92-4d38-43af-9bbd-83bda0119ea1'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'Which item is data rather than a formula?', 'Quarterly Sales is a text label, while the other entries are formulas beginning with equals signs.', 'mcq', 84, 'application', 'medium', 'application', 'Microsoft Excel and Databases', '930197de5613c20d0b1b284d68631ece48fdd89bc1ec95e24ffe2cd39abaf380', '{"sourceLabel":"Revision Questions 2025, Q104 and Q114","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q104 and Q114"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('e130747d-d6e2-4840-b021-a772f72f6a97'::uuid, '0dfbec92-4d38-43af-9bbd-83bda0119ea1'::uuid, '=SUM(B2:B5)', false, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('e41c64cb-17a4-400c-9e0d-823173f657cc'::uuid, '0dfbec92-4d38-43af-9bbd-83bda0119ea1'::uuid, '=B2*C2', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('31b2e67a-f6cd-47d2-92eb-0ee697f50a1f'::uuid, '0dfbec92-4d38-43af-9bbd-83bda0119ea1'::uuid, 'Quarterly Sales', true, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('a3ab9320-78ae-4f62-a640-73c7479d3a10'::uuid, '0dfbec92-4d38-43af-9bbd-83bda0119ea1'::uuid, '=AVERAGE(D2:D8)', false, 3, now());

-- Question 86
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('61bd0320-15a3-45ee-87d7-50dd44b95814'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'Which tool is commonly used on a web page to capture information supplied by users for storage in a database?', 'Web forms collect structured user input that an application can validate and store in a database.', 'mcq', 85, 'scenario_analysis', 'hard', 'analysis', 'Microsoft Excel and Databases', 'ae08a7cba8f667a4a1f2a1e4750868c050cd4b1005396af5ea177790dda11978', '{"sourceLabel":"Revision Questions 2025, Q115-116","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q115-116"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('e2c6cd4f-b21e-49e1-b383-13d7b43189b0'::uuid, '61bd0320-15a3-45ee-87d7-50dd44b95814'::uuid, 'An online form', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('63c606ca-fe00-44db-b7bc-a40e307f6d73'::uuid, '61bd0320-15a3-45ee-87d7-50dd44b95814'::uuid, 'A slide transition', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('fc8a426f-6f43-4193-af16-d42f9ec0d35a'::uuid, '61bd0320-15a3-45ee-87d7-50dd44b95814'::uuid, 'A browser theme', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('94fc2765-ea21-4656-8e4a-44dfd2f08fdb'::uuid, '61bd0320-15a3-45ee-87d7-50dd44b95814'::uuid, 'A file extension', false, 3, now());

-- Question 87
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('0a15ec46-a80a-435b-a56a-1985cabadc47'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'What default title commonly appears when the first new blank Excel workbook is created?', 'Excel normally assigns the temporary title Book1 to the first unsaved blank workbook.', 'mcq', 86, 'application', 'medium', 'application', 'Microsoft Excel and Databases', '55a314193a833bb84f3173743130de03b69c2c5fad989f4a66c0520f8be0ac67', '{"sourceLabel":"Revision Questions 2025, Q103","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q103"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('4a3733aa-4645-4449-b28e-b46b5a502ed6'::uuid, '0a15ec46-a80a-435b-a56a-1985cabadc47'::uuid, 'Document1', false, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('8161a119-b63d-4e89-9412-e6650e4db033'::uuid, '0a15ec46-a80a-435b-a56a-1985cabadc47'::uuid, 'Book1', true, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('d6ae9bcc-12d7-49c5-88f1-833a6bf4f754'::uuid, '0a15ec46-a80a-435b-a56a-1985cabadc47'::uuid, 'Presentation1', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('8c54fdd9-cca1-4a03-b969-0d6b03f40026'::uuid, '0a15ec46-a80a-435b-a56a-1985cabadc47'::uuid, 'Database1', false, 3, now());

-- Question 88
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('8d4832c9-cdb7-463c-b2b0-8a055570b7f6'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'Why might a solid background colour be preferable to a dense pattern in a cell?', 'A suitable solid fill can emphasize cells while preserving the readability of their contents.', 'mcq', 87, 'recall', 'easy', 'recall', 'Microsoft Excel and Databases', '862b768f533fdba6eda5a73594d681d785487ce2829600a0b79405aa91d12164', '{"sourceLabel":"Revision Questions 2025, Q113","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q113"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('012b694b-2ea7-43bd-a2ce-44a22727f409'::uuid, '8d4832c9-cdb7-463c-b2b0-8a055570b7f6'::uuid, 'It can make the content easier to read', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('6920793e-0e39-44b7-a715-8e32c87a5574'::uuid, '8d4832c9-cdb7-463c-b2b0-8a055570b7f6'::uuid, 'It turns text into a formula', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('fc86c2e2-223b-4e6a-b965-ef0d8390ca5a'::uuid, '8d4832c9-cdb7-463c-b2b0-8a055570b7f6'::uuid, 'It changes the workbook into a presentation', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('70e25849-6089-4877-bdc0-5a38b16583a9'::uuid, '8d4832c9-cdb7-463c-b2b0-8a055570b7f6'::uuid, 'It prevents the file from being saved', false, 3, now());

-- Question 89
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('fac8890d-e075-49f1-b52b-334f25b79d3e'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'Which content normally appears on the first two slides of a basic presentation?', 'A standard presentation begins with a title slide and commonly follows it with a Title and Content layout.', 'mcq', 88, 'recall', 'easy', 'recall', 'Microsoft PowerPoint', '81e7338cfb42385dcc9adec0b2f38fa55046cc56e9e59dcbcc5ff0d1c92ee36a', '{"sourceLabel":"Revision Questions 2025, Q117 and Q121","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q117 and Q121"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('040d7656-3cd9-4304-a409-011c0c6c1502'::uuid, 'fac8890d-e075-49f1-b52b-334f25b79d3e'::uuid, 'A title slide followed by a title-and-content slide', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('e667a825-278d-4242-a7a9-de53479f36fd'::uuid, 'fac8890d-e075-49f1-b52b-334f25b79d3e'::uuid, 'Two blank slides', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('fedbf2b7-4c22-407c-b7e7-2e0850fc3042'::uuid, 'fac8890d-e075-49f1-b52b-334f25b79d3e'::uuid, 'A chart followed by a video', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('680d66d7-b3be-4011-b971-05c00a298e1f'::uuid, 'fac8890d-e075-49f1-b52b-334f25b79d3e'::uuid, 'A bibliography followed by a title', false, 3, now());

-- Question 90
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('5d4905aa-92a7-477f-b330-9108400bdd5b'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'Which view is normally used to create and edit one PowerPoint slide at a time?', 'Normal view is PowerPoint''s principal slide-editing workspace.', 'mcq', 89, 'application', 'medium', 'application', 'Microsoft PowerPoint', '9c1c3e3c19370d9c7d690b3fa8e4fbcf660c50c7a04690c3991fd0aac01837ce', '{"sourceLabel":"Revision Questions 2025, Q118","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q118"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('88dc6e8c-3ab2-4964-b728-5af50610fb39'::uuid, '5d4905aa-92a7-477f-b330-9108400bdd5b'::uuid, 'Normal view', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('4a9dcc63-1d2b-4488-b0f8-f36bc14d4fa1'::uuid, '5d4905aa-92a7-477f-b330-9108400bdd5b'::uuid, 'Slide Sorter view', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('87404aaa-b1a0-403a-8c9b-5eef6764a1ee'::uuid, '5d4905aa-92a7-477f-b330-9108400bdd5b'::uuid, 'Reading view', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('9972fac0-dad1-46c1-99bd-10c94519f562'::uuid, '5d4905aa-92a7-477f-b330-9108400bdd5b'::uuid, 'Print Preview', false, 3, now());

-- Question 91
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('55179d33-d4fb-41dc-8814-2242d973c649'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'When is a PowerPoint template most useful?', 'Templates provide coordinated designs, layouts and formatting that accelerate presentation creation.', 'mcq', 90, 'application', 'medium', 'application', 'Microsoft PowerPoint', 'baf23c543c7d8dae801cf6df260d9da11064b3df0fa8e4560176f1661a894b66', '{"sourceLabel":"Revision Questions 2025, Q119","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q119"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('89b205a3-dbb2-4b03-b287-d6c8f68425ab'::uuid, '55179d33-d4fb-41dc-8814-2242d973c649'::uuid, 'When a consistent predesigned appearance and layout are needed', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('c1154288-114d-4da9-88f8-f536f9507dc8'::uuid, '55179d33-d4fb-41dc-8814-2242d973c649'::uuid, 'When deleting the presentation permanently', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('8b05b0fa-225e-4376-a73e-31174d6fa4a8'::uuid, '55179d33-d4fb-41dc-8814-2242d973c649'::uuid, 'When changing a video into a spreadsheet', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('0e24cc61-882b-46a7-a7fb-b56d092e9bbb'::uuid, '55179d33-d4fb-41dc-8814-2242d973c649'::uuid, 'When repairing computer hardware', false, 3, now());

-- Question 92
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('8bb0e4c8-8bb4-4c1b-9792-01b6fa9d02d9'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'Which PowerPoint view displays many slides as thumbnails for rearranging their order?', 'Slide Sorter displays slides in a grid and supports rapid reordering.', 'mcq', 91, 'recall', 'easy', 'recall', 'Microsoft PowerPoint', '61f8861f05c8a64b9cfc8e43c7297e8cf8d55d8c94a59a1d180af53b19c242cb', '{"sourceLabel":"Revision Questions 2025, Q120 and Q123","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q120 and Q123"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('c2098ce8-6890-4e21-b8d8-255d56c75758'::uuid, '8bb0e4c8-8bb4-4c1b-9792-01b6fa9d02d9'::uuid, 'Slide Sorter view', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('9b1ad27a-e686-46aa-9a14-184af5bd06ea'::uuid, '8bb0e4c8-8bb4-4c1b-9792-01b6fa9d02d9'::uuid, 'Normal view', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('ac8c1b19-efad-4f9a-8bd1-cf3f07a46896'::uuid, '8bb0e4c8-8bb4-4c1b-9792-01b6fa9d02d9'::uuid, 'Notes Page view', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('56e8eabe-4184-4c0a-bc5e-40fa28258836'::uuid, '8bb0e4c8-8bb4-4c1b-9792-01b6fa9d02d9'::uuid, 'Outline only', false, 3, now());

-- Question 93
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('d1b65a12-ce6f-4879-ba46-72b11f3250f3'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'A slide already contains content, but its placeholder arrangement must change without deleting the slide. Which command should be used?', 'The Layout command applies a different structural placeholder arrangement to the existing slide.', 'mcq', 92, 'scenario_analysis', 'hard', 'analysis', 'Microsoft PowerPoint', '5f905407cf739e884a43db81114ceb39def8c61f87833cfa993dab7065bf8e44', '{"sourceLabel":"Revision Questions 2025, Q122","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q122"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('29933446-aa80-49a9-a700-3bdc3858c2f5'::uuid, 'd1b65a12-ce6f-4879-ba46-72b11f3250f3'::uuid, 'Layout on the Home tab', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('93268b8c-3322-4009-9c43-a0118e953930'::uuid, 'd1b65a12-ce6f-4879-ba46-72b11f3250f3'::uuid, 'Transitions on the Transitions tab', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('6c553ace-ecdd-491e-b254-f891b70308b8'::uuid, 'd1b65a12-ce6f-4879-ba46-72b11f3250f3'::uuid, 'New Window on the View tab', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('0112528f-722c-44f3-8a78-a16cbfa1e6e8'::uuid, 'd1b65a12-ce6f-4879-ba46-72b11f3250f3'::uuid, 'Save As on the File tab', false, 3, now());

-- Question 94
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('d3ea7ce9-bd8a-4cf9-a9e7-c3b96d067a12'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'A text placeholder displays a dashed border while the insertion point is inside it. What does this indicate?', 'A dashed placeholder boundary with an insertion point indicates text-editing mode.', 'mcq', 93, 'application', 'medium', 'application', 'Microsoft PowerPoint', '0a720250a8585b9c8522854ca6e708dd171c9731d5fa6775bffa843cf0efaac2', '{"sourceLabel":"Revision Questions 2025, Q124","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q124"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('e533d64c-4643-4078-a631-2e1e7e04a2e9'::uuid, 'd3ea7ce9-bd8a-4cf9-a9e7-c3b96d067a12'::uuid, 'The user is editing text inside the placeholder', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('7603ea79-038f-4b5b-acba-3e9ff7804824'::uuid, 'd3ea7ce9-bd8a-4cf9-a9e7-c3b96d067a12'::uuid, 'The presentation has been deleted', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('4c09afdb-dac2-4752-bfb8-558d2ccc2ee4'::uuid, 'd3ea7ce9-bd8a-4cf9-a9e7-c3b96d067a12'::uuid, 'The slide is in Slide Sorter view', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('150e7957-038d-4bbd-954c-c88ac7618e89'::uuid, 'd3ea7ce9-bd8a-4cf9-a9e7-c3b96d067a12'::uuid, 'The file is protected by a password', false, 3, now());

-- Question 95
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('c10f4bc2-54b4-4578-a2f5-f399ab28c1e7'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'Which key runs the spelling checker in a PowerPoint presentation?', 'F7 activates spelling review in PowerPoint and other Microsoft Office applications.', 'mcq', 94, 'recall', 'easy', 'recall', 'Microsoft PowerPoint', 'ae7e3242d7fdf543a94335efa8f9d43f1017c4c3e211a342bdf48c0ff153e1fc', '{"sourceLabel":"Revision Questions 2025, Q125","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q125"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('05298bb4-23f0-403d-ba5e-78a0469c3c37'::uuid, 'c10f4bc2-54b4-4578-a2f5-f399ab28c1e7'::uuid, 'F2', false, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('1f4e9ec0-5c07-4f0d-94f7-f3a99e599137'::uuid, 'c10f4bc2-54b4-4578-a2f5-f399ab28c1e7'::uuid, 'F5', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('a5835711-9bc3-47fc-ac22-5fdc07cc792a'::uuid, 'c10f4bc2-54b4-4578-a2f5-f399ab28c1e7'::uuid, 'F7', true, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('e81b18d7-983c-4b64-9b28-5b784350795c'::uuid, 'c10f4bc2-54b4-4578-a2f5-f399ab28c1e7'::uuid, 'F12', false, 3, now());

-- Question 96
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('1e851114-4d66-429d-aa12-f647cb2e2a15'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'What should be checked before using an image found through an online search in a presentation?', 'Online images may be protected by copyright, so their licence and permitted use should be verified.', 'mcq', 95, 'application', 'medium', 'application', 'Microsoft PowerPoint', '70381c15a94b0a6a3ded593cbc93dc3d288371f0579c3258efe92571ff00579d', '{"sourceLabel":"Revision Questions 2025, Q126","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q126"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('c9ad5a28-b9c7-4ccd-987a-80f8eb1c2805'::uuid, '1e851114-4d66-429d-aa12-f647cb2e2a15'::uuid, 'Its usage rights and licence', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('747dc29b-3d0d-4495-a978-e685c84e0199'::uuid, '1e851114-4d66-429d-aa12-f647cb2e2a15'::uuid, 'The colour of the browser toolbar', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('105104fd-bc2e-408e-b620-9fbb97a06b6a'::uuid, '1e851114-4d66-429d-aa12-f647cb2e2a15'::uuid, 'The user''s Windows password', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('fa928703-7315-4adc-936e-3283a8a54227'::uuid, '1e851114-4d66-429d-aa12-f647cb2e2a15'::uuid, 'The printer''s paper tray', false, 3, now());

-- Question 97
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('ba58b1d7-4188-4527-bb1c-0c84db7b31e6'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'Before resizing, cropping or formatting a picture on a PowerPoint slide, what must be done?', 'Picture-formatting commands operate on the currently selected image.', 'mcq', 96, 'scenario_analysis', 'hard', 'analysis', 'Microsoft PowerPoint', 'cf97f9d8753cf098b968236a2c79a3ff1f64e13b2483aad1ef08c4ce36768049', '{"sourceLabel":"Revision Questions 2025, Q127","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q127"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('03d3d994-fd8b-4a37-8509-a14b679c229c'::uuid, 'ba58b1d7-4188-4527-bb1c-0c84db7b31e6'::uuid, 'Select the picture', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('cc7831de-5291-453e-9014-d1601110b531'::uuid, 'ba58b1d7-4188-4527-bb1c-0c84db7b31e6'::uuid, 'Delete the slide', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('c3483a2b-6d59-4d24-969c-96111ae43219'::uuid, 'ba58b1d7-4188-4527-bb1c-0c84db7b31e6'::uuid, 'Start the slideshow', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('851d759b-b052-4cb9-b9be-cd56f2198791'::uuid, 'ba58b1d7-4188-4527-bb1c-0c84db7b31e6'::uuid, 'Change the file extension', false, 3, now());

-- Question 98
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('e83da803-f87f-44db-96e4-da7f52215455'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'On which Ribbon tab are commands for adding audio or video normally found?', 'The Insert tab contains commands for adding media and other slide objects.', 'mcq', 97, 'application', 'medium', 'application', 'Microsoft PowerPoint', '121254e9b14c55c19a4a8fa004f6457b73f8620dbef4105095257310974903b7', '{"sourceLabel":"Revision Questions 2025, Q128","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q128"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('ff1ad0b5-b18a-4486-9507-57c168e33be0'::uuid, 'e83da803-f87f-44db-96e4-da7f52215455'::uuid, 'Insert', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('9e5a6a75-0cff-4d33-8b11-4967fd295adb'::uuid, 'e83da803-f87f-44db-96e4-da7f52215455'::uuid, 'Review', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('4fb073b3-2c06-4542-80cb-cafea7c3ce6e'::uuid, 'e83da803-f87f-44db-96e4-da7f52215455'::uuid, 'Transitions', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('add714ef-040b-4d76-b3ac-b493de0ce0a2'::uuid, 'e83da803-f87f-44db-96e4-da7f52215455'::uuid, 'View', false, 3, now());

-- Question 99
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('0a9e6bdb-e416-409f-b2c1-ee57b7dbb61c'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'What are the three main categories of animation effects applied to slide objects?', 'PowerPoint classifies common object animations as Entrance, Emphasis and Exit effects.', 'mcq', 98, 'recall', 'easy', 'recall', 'Microsoft PowerPoint', '27bd71c6e5a0bf2d9b9af7481edb6ec2c0796eb294f8fac0039cfe6056dab718', '{"sourceLabel":"Revision Questions 2025, Q129","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q129"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('465b6000-ddc6-4717-9902-6b25a2550f14'::uuid, '0a9e6bdb-e416-409f-b2c1-ee57b7dbb61c'::uuid, 'Entrance, Emphasis and Exit', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('320a5774-eae1-43af-9335-7691be8d044a'::uuid, '0a9e6bdb-e416-409f-b2c1-ee57b7dbb61c'::uuid, 'Portrait, Landscape and Square', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('b63f4f25-d50f-4e38-94cb-1c411cde398d'::uuid, '0a9e6bdb-e416-409f-b2c1-ee57b7dbb61c'::uuid, 'Cut, Copy and Paste', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('ec7e3c7d-4159-4e35-a782-da0573a58bf6'::uuid, '0a9e6bdb-e416-409f-b2c1-ee57b7dbb61c'::uuid, 'Header, Footer and Margin', false, 3, now());

-- Question 100
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('fbffd369-43fc-4fc1-8764-a05e834980ac'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'Which pane is used to review, reorder and customize animations applied to slide objects?', 'The Animation Pane shows applied effects and allows their timing and order to be managed.', 'mcq', 99, 'application', 'medium', 'application', 'Microsoft PowerPoint', '386a5e157be78427284939b5740aea090d524c33634bed2d7717b53880c7351b', '{"sourceLabel":"Revision Questions 2025, Q130","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q130"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('bb4a35c8-192f-4eeb-b545-7c890393e861'::uuid, 'fbffd369-43fc-4fc1-8764-a05e834980ac'::uuid, 'Animation Pane', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('8ac6bb82-3781-4dbd-91e5-3cbc76aba0f4'::uuid, 'fbffd369-43fc-4fc1-8764-a05e834980ac'::uuid, 'Navigation Pane', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('e0885289-d313-4ad4-af37-88cab3c48cc5'::uuid, 'fbffd369-43fc-4fc1-8764-a05e834980ac'::uuid, 'Clipboard Pane', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('ecf4bd73-d479-4ad3-880d-02dfe6f01ce3'::uuid, 'fbffd369-43fc-4fc1-8764-a05e834980ac'::uuid, 'Selection of Print Pages', false, 3, now());

-- Question 101
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('84852ff8-b5d9-4f03-893f-156247aad835'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'A chart should appear piece by piece, and afterward the entire presentation should move from the current slide to the next with a fade. Which features are required?', 'Animations control objects within a slide, while transitions control movement from one whole slide to another.', 'mcq', 100, 'scenario_analysis', 'hard', 'analysis', 'Microsoft PowerPoint', 'ffde5fb76f45ef52178856a697ed5b5aab30417096186b13d26878e1d002e407', '{"sourceLabel":"Revision Questions 2025, Q131","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q131"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('05c1a254-a113-4515-96a7-318e7a710b2a'::uuid, '84852ff8-b5d9-4f03-893f-156247aad835'::uuid, 'An animation for the chart and a transition for the slide change', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('c05ce151-182c-4403-8ec1-313e9e9de147'::uuid, '84852ff8-b5d9-4f03-893f-156247aad835'::uuid, 'A transition for the chart and a layout for the slide change', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('d4d95ae4-b9a0-4060-80a8-7f56758ecaf8'::uuid, '84852ff8-b5d9-4f03-893f-156247aad835'::uuid, 'Two slide layouts', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('a0158a4c-3004-4d96-9424-852bbbccaf99'::uuid, '84852ff8-b5d9-4f03-893f-156247aad835'::uuid, 'Two page orientations', false, 3, now());

-- Question 102
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('21c1cc91-870d-4a47-91b5-5243c35fef06'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'Which cable is commonly used to carry high-definition video and audio from a laptop to an HD television?', 'HDMI commonly carries digital high-definition video and audio to televisions and projectors.', 'mcq', 101, 'application', 'medium', 'application', 'Microsoft PowerPoint', '9a98d070fa03be3ffe07ccae3772ad70524d90205c602f5cf10dbb89c791addb', '{"sourceLabel":"Revision Questions 2025, Q132","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q132"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('1e919d33-8b05-451c-9dbe-bf5a754d9337'::uuid, '21c1cc91-870d-4a47-91b5-5243c35fef06'::uuid, 'HDMI', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('c6f3b6e8-a494-4c8a-b763-146b9489748f'::uuid, '21c1cc91-870d-4a47-91b5-5243c35fef06'::uuid, 'Ethernet only', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('98c0ccb1-265f-4945-8ee1-65d1273ca259'::uuid, '21c1cc91-870d-4a47-91b5-5243c35fef06'::uuid, 'Telephone cable', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('307f4152-1c27-4d70-b611-0d4323701f2d'::uuid, '21c1cc91-870d-4a47-91b5-5243c35fef06'::uuid, 'Printer power cable', false, 3, now());

-- Question 103
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('8aa2ff96-77d6-48c0-ac81-86fddaea97cc'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'Which File-tab feature can turn a PowerPoint presentation into a video?', 'PowerPoint''s export tools include the option to create a video from a presentation.', 'mcq', 102, 'recall', 'easy', 'recall', 'Microsoft PowerPoint', '0dad6bc6884f32d3b6e194ad934f6c456eb7fad65528fdb69e39e64d8ffaea1a', '{"sourceLabel":"Revision Questions 2025, Q133","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q133"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('d9a45ea1-19fe-449b-b1ca-e095f6ddbe63'::uuid, '8aa2ff96-77d6-48c0-ac81-86fddaea97cc'::uuid, 'Export or Create a Video', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('b9f1a5cf-ec59-4b60-9678-2c8a7b44bbf6'::uuid, '8aa2ff96-77d6-48c0-ac81-86fddaea97cc'::uuid, 'Page Setup', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('fe364f52-b42e-45b6-9706-2af67df452d9'::uuid, '8aa2ff96-77d6-48c0-ac81-86fddaea97cc'::uuid, 'Track Changes', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('bf5a41a8-cbda-4eed-aaa4-33cea1b20997'::uuid, '8aa2ff96-77d6-48c0-ac81-86fddaea97cc'::uuid, 'Mail Merge', false, 3, now());

-- Question 104
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('0719c221-09e3-4ec8-a176-e4ee270768a2'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'Which address identifies a computer when it exchanges packets with a web server?', 'Internet Protocol addresses identify the network endpoints sending and receiving packets.', 'mcq', 103, 'recall', 'easy', 'recall', 'Internet, Browsers, Search and Intellectual Property', '2a9da9e70372e2cda2391c3bd770180355c0c57553de909c9bcdfe2e50611a95', '{"sourceLabel":"Revision Questions 2025, Q135","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q135"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('30f44f71-c6da-4308-bc45-1e695e7972bc'::uuid, '0719c221-09e3-4ec8-a176-e4ee270768a2'::uuid, 'IP address', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('47854fd6-e235-4dcf-8af0-fed09ea6049b'::uuid, '0719c221-09e3-4ec8-a176-e4ee270768a2'::uuid, 'Email password', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('6b07be0f-b986-426a-9c08-2d131c36226c'::uuid, '0719c221-09e3-4ec8-a176-e4ee270768a2'::uuid, 'Filename', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('65f0315b-a892-4c19-91d0-f9bbcf8b0bf8'::uuid, '0719c221-09e3-4ec8-a176-e4ee270768a2'::uuid, 'Screen resolution', false, 3, now());

-- Question 105
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('c41dde51-0497-4785-b80f-18449f49fd35'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'Which service allows users to enter a domain name instead of a web server''s numeric IP address?', 'The Domain Name System resolves human-readable domain names to IP addresses.', 'mcq', 104, 'application', 'medium', 'application', 'Internet, Browsers, Search and Intellectual Property', 'bc04cdf12d723691f098ac322bb5954c16248e82325a1d00a8f3eab20baf420e', '{"sourceLabel":"Revision Questions 2025, Q136","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q136"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('cddd2925-aec3-473e-8f3b-4de4215147b1'::uuid, 'c41dde51-0497-4785-b80f-18449f49fd35'::uuid, 'DNS', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('e0d49e3c-a434-4877-a9fa-1b9f3fe2bb50'::uuid, 'c41dde51-0497-4785-b80f-18449f49fd35'::uuid, 'FTP', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('f4f8e4d3-a647-4bf3-9625-498090b241b9'::uuid, 'c41dde51-0497-4785-b80f-18449f49fd35'::uuid, 'SMTP', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('9a1b06fc-4d37-4193-b40d-4559f35cc545'::uuid, 'c41dde51-0497-4785-b80f-18449f49fd35'::uuid, 'OCR', false, 3, now());

-- Question 106
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('d30a29b3-8aba-4ca4-9cba-bee30b213d6e'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'In the address www.ccilearning.com, which part is the top-level domain?', 'The final .com portion is the address''s top-level domain.', 'mcq', 105, 'application', 'medium', 'application', 'Internet, Browsers, Search and Intellectual Property', '40ab50c1690c9ea1828c9b840b7e1f2be965a71ced7534f8e73f26dbacb633d3', '{"sourceLabel":"Revision Questions 2025, Q137","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q137"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('ade7de85-fc35-40c5-b63b-9ec64507a7dc'::uuid, 'd30a29b3-8aba-4ca4-9cba-bee30b213d6e'::uuid, 'www', false, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('c928de9f-6f75-45a1-8cb5-8a0bdb2c4d0c'::uuid, 'd30a29b3-8aba-4ca4-9cba-bee30b213d6e'::uuid, 'ccilearning', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('75a6eb5d-b290-4a8a-8605-0308ed55db02'::uuid, 'd30a29b3-8aba-4ca4-9cba-bee30b213d6e'::uuid, '.com', true, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('dfc5e0c0-a044-455f-b6ca-7febcb9e520f'::uuid, 'd30a29b3-8aba-4ca4-9cba-bee30b213d6e'::uuid, 'https', false, 3, now());

-- Question 107
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('119d620a-bdd0-4912-8b71-185b9797584c'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'Which address most clearly indicates an encrypted connection to a website?', 'The HTTPS scheme indicates that HTTP communication is protected with transport encryption.', 'mcq', 106, 'recall', 'easy', 'recall', 'Internet, Browsers, Search and Intellectual Property', '09e96199a086c00c13ededa3034b5f075a21a609be00a818a776b57e122f8b68', '{"sourceLabel":"Revision Questions 2025, Q60 and Q138","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q60 and Q138"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('0b312cd1-6950-454f-b023-01136a5d594d'::uuid, '119d620a-bdd0-4912-8b71-185b9797584c'::uuid, 'http://shop.example.com', false, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('b8c347a9-db6a-4875-ae5a-a7a11faac909'::uuid, '119d620a-bdd0-4912-8b71-185b9797584c'::uuid, 'https://shop.example.com', true, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('8401b994-bc42-4d6a-9d5a-094ef1df7af3'::uuid, '119d620a-bdd0-4912-8b71-185b9797584c'::uuid, 'ftp://shop.example.com', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('3f329ffd-4947-4998-bc14-b045a7b8e81d'::uuid, '119d620a-bdd0-4912-8b71-185b9797584c'::uuid, 'smtp://shop.example.com', false, 3, now());

-- Question 108
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('16276404-a17b-4a91-989d-925645f307e9'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'What can be concluded from the address https://bountifulbaskets.com/account?', 'HTTPS protects the connection but does not independently prove that the organization or content is trustworthy.', 'mcq', 107, 'scenario_analysis', 'hard', 'analysis', 'Internet, Browsers, Search and Intellectual Property', '3334c5fcee4d13175685e2754fc6158420fae227615c7bf71e8e750ea0a98ef0', '{"sourceLabel":"Revision Questions 2025, Q138-139","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q138-139"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('74469d9c-750e-46cf-b5bf-07182b283d12'::uuid, '16276404-a17b-4a91-989d-925645f307e9'::uuid, 'The connection uses HTTPS, but the site''s trustworthiness must still be evaluated', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('b7fb30af-bb88-4d48-8264-4a989daa40fa'::uuid, '16276404-a17b-4a91-989d-925645f307e9'::uuid, 'The website is guaranteed to be honest because it uses .com', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('e0463e6e-d2a6-4baa-b796-ec1d050bf884'::uuid, '16276404-a17b-4a91-989d-925645f307e9'::uuid, 'The page cannot collect user data', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('c131da11-8d8e-4b18-83f9-10b532bea27e'::uuid, '16276404-a17b-4a91-989d-925645f307e9'::uuid, 'The website is stored on the user''s computer', false, 3, now());

-- Question 109
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('605489d3-e873-415e-9dcf-54e21ec347f8'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'Which shortcut opens a new tab in most modern web browsers?', 'Ctrl+T creates a new browser tab.', 'mcq', 108, 'application', 'medium', 'application', 'Internet, Browsers, Search and Intellectual Property', '33448315f97bdc62d6df64a444324dc3f823a0efb8fe607ef446b67bc161d476', '{"sourceLabel":"Revision Questions 2025, Q140","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q140"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('83b7b198-8e3c-4971-a245-6bd07da830ce'::uuid, '605489d3-e873-415e-9dcf-54e21ec347f8'::uuid, 'Ctrl+P', false, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('4c429f1b-c3ca-4664-adc2-6aa4278489cb'::uuid, '605489d3-e873-415e-9dcf-54e21ec347f8'::uuid, 'Ctrl+T', true, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('a1344ef3-3b23-4db9-8aa9-9275c4e788dd'::uuid, '605489d3-e873-415e-9dcf-54e21ec347f8'::uuid, 'Ctrl+W', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('10d0fd9d-be12-4fe7-9d36-6785d0cdd6c8'::uuid, '605489d3-e873-415e-9dcf-54e21ec347f8'::uuid, 'Ctrl+F', false, 3, now());

-- Question 110
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('20a46ff3-d6d6-4653-bec4-1556fc933480'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'What is a web browser?', 'A browser requests, interprets and displays content from websites and web applications.', 'mcq', 109, 'recall', 'easy', 'recall', 'Internet, Browsers, Search and Intellectual Property', '10d34a8ce9ad2311a158312bcbf1de091b602112fe0175be7fbe3bde8e6d19d7', '{"sourceLabel":"Revision Questions 2025, Q141","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q141"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('bcaf35df-31b0-4b45-8ef4-661ea356e417'::uuid, '20a46ff3-d6d6-4653-bec4-1556fc933480'::uuid, 'Software used to retrieve and display web content', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('61689d93-45bc-42a2-92ae-1a882357fadd'::uuid, '20a46ff3-d6d6-4653-bec4-1556fc933480'::uuid, 'A device used only to print webpages', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('fdb0d8b4-6a2c-42e1-a743-091c4d0a9670'::uuid, '20a46ff3-d6d6-4653-bec4-1556fc933480'::uuid, 'A folder containing downloaded files', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('72d64a5c-6c43-4f4d-81e7-c054bd3e57e6'::uuid, '20a46ff3-d6d6-4653-bec4-1556fc933480'::uuid, 'A password-management rule', false, 3, now());

-- Question 111
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('0c6a1947-b087-490d-bb83-8e0ff16d039b'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'Which connection speed is the fastest?', 'One gigabit per second exceeds the listed kilobit and megabit rates.', 'mcq', 110, 'application', 'medium', 'application', 'Internet, Browsers, Search and Intellectual Property', 'bbd9f7f3ead359b6c6e7438f3ddeb0bfa43c51e33e8ffdff81e15d2875d5bcac', '{"sourceLabel":"Revision Questions 2025, Q142","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q142"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('8bb6e5e2-95b5-4209-8e28-13dfb403da8b'::uuid, '0c6a1947-b087-490d-bb83-8e0ff16d039b'::uuid, '10 Kbps', false, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('f7fe32e8-0f71-4b49-87b2-4b2e7296752a'::uuid, '0c6a1947-b087-490d-bb83-8e0ff16d039b'::uuid, '10 Mbps', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('1f24f74d-1938-4958-a672-c6f1aaea6017'::uuid, '0c6a1947-b087-490d-bb83-8e0ff16d039b'::uuid, '100 Mbps', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('87810e19-1983-4540-83b4-81ef0ddded18'::uuid, '0c6a1947-b087-490d-bb83-8e0ff16d039b'::uuid, '1 Gbps', true, 3, now());

-- Question 112
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('c925c7e9-9871-495f-982b-01b7390e73db'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'On the same connection, which file would normally require the most time to download?', 'With connection speed held constant, the largest file generally takes the longest to transfer.', 'mcq', 111, 'scenario_analysis', 'hard', 'analysis', 'Internet, Browsers, Search and Intellectual Property', '57e8094519e1f3c1d6a806a124c455fe7ca2c3632abaae7c87f713691cfc2f8a', '{"sourceLabel":"Revision Questions 2025, Q143","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q143"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('44714af6-43e2-43c1-a9c2-b7922ad8af5c'::uuid, 'c925c7e9-9871-495f-982b-01b7390e73db'::uuid, 'A 15 KB text file', false, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('485a6e8d-4112-4c85-9cd1-f09f48a60604'::uuid, 'c925c7e9-9871-495f-982b-01b7390e73db'::uuid, 'A 2 MB photograph', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('9d76e36f-667c-41e2-8178-aff5e8327e44'::uuid, 'c925c7e9-9871-495f-982b-01b7390e73db'::uuid, 'A 40 MB audio file', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('d3816490-c485-4ec9-8ac5-f173ad29d24a'::uuid, 'c925c7e9-9871-495f-982b-01b7390e73db'::uuid, 'A 2 GB video file', true, 3, now());

-- Question 113
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('897c38db-d239-4398-ae6e-9e44339c1633'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'A user wants to return to a recipe visited last week but cannot remember its address. Which browser feature should be checked?', 'Browser history records previously visited pages and can help recover a forgotten URL.', 'mcq', 112, 'application', 'medium', 'application', 'Internet, Browsers, Search and Intellectual Property', '9db7adebd09bef97ff3e21212d28378de8b29ec6517092e6d03ec0bbbf9a8bec', '{"sourceLabel":"Revision Questions 2025, Q144","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q144"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('f859ea05-b1d7-477a-9513-276f94ae5ba8'::uuid, '897c38db-d239-4398-ae6e-9e44339c1633'::uuid, 'Browsing history', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('825ae450-36ad-47f2-b504-35c669933ec6'::uuid, '897c38db-d239-4398-ae6e-9e44339c1633'::uuid, 'Page margins', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('a8ae8fe3-fc97-4bc2-b416-274107bb1bac'::uuid, '897c38db-d239-4398-ae6e-9e44339c1633'::uuid, 'Spell checker', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('d9b26304-e571-4619-9f6d-1be8b36d06bf'::uuid, '897c38db-d239-4398-ae6e-9e44339c1633'::uuid, 'File permissions', false, 3, now());

-- Question 114
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('580f6425-b5ae-4f6c-bd93-64357d5ebb94'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'Why might an online banking service sign a user out after a period of inactivity?', 'An inactivity timeout limits the opportunity for another person to use an unattended authenticated session.', 'mcq', 113, 'recall', 'easy', 'recall', 'Internet, Browsers, Search and Intellectual Property', 'c34424c5da43f5c002cd97ee6339c82e03897ba783ae73a0b43ab66e2d49588b', '{"sourceLabel":"Revision Questions 2025, Q145","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q145"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('9d24c193-a8c9-47ca-a62b-4ee4d866d4cd'::uuid, '580f6425-b5ae-4f6c-bd93-64357d5ebb94'::uuid, 'To reduce the risk of unauthorized access to an unattended session', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('650e4014-f78c-45cb-b8ed-31dbe38bcb87'::uuid, '580f6425-b5ae-4f6c-bd93-64357d5ebb94'::uuid, 'To increase the user''s account balance', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('1ef46485-a579-4421-9f2a-5f05d86b99f9'::uuid, '580f6425-b5ae-4f6c-bd93-64357d5ebb94'::uuid, 'To improve the monitor resolution', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('4f0c16f2-42ca-4204-a4d6-7d6d42d2ac59'::uuid, '580f6425-b5ae-4f6c-bd93-64357d5ebb94'::uuid, 'To rename downloaded statements', false, 3, now());

-- Question 115
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('c95aed7e-6a74-41e3-b336-fa79054aa11a'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'What are browser cookies?', 'Websites use cookies for legitimate functions such as sessions and preferences, though they may also support tracking.', 'mcq', 114, 'application', 'medium', 'application', 'Internet, Browsers, Search and Intellectual Property', '5ad299ff93da2345b448b21b3a738dae0b23c9bb91ed5e21588a0ea1992bfc0a', '{"sourceLabel":"Revision Questions 2025, Q146","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q146"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('d78c40a5-db37-4dd2-959a-c7f676a95534'::uuid, 'c95aed7e-6a74-41e3-b336-fa79054aa11a'::uuid, 'Small data records stored for websites to remember session or preference information', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('0957f64f-9bd8-4ae6-80a9-39c79eeb416f'::uuid, 'c95aed7e-6a74-41e3-b336-fa79054aa11a'::uuid, 'Programs that always destroy files', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('a498271d-fc1d-4e59-8e14-fbd4c8dcebfd'::uuid, 'c95aed7e-6a74-41e3-b336-fa79054aa11a'::uuid, 'Hardware devices that increase connection speed', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('bd636bd0-c9fc-4897-acdd-4e800ff28252'::uuid, 'c95aed7e-6a74-41e3-b336-fa79054aa11a'::uuid, 'Printed copies of webpages', false, 3, now());

-- Question 116
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('7950a555-7dba-449c-9116-0f6221c691f9'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'A webpage loads faster on a second visit because unchanged images are reused from local temporary storage. Which browser feature caused this?', 'The browser cache stores copies of resources so they do not always need to be downloaded again.', 'mcq', 115, 'scenario_analysis', 'hard', 'analysis', 'Internet, Browsers, Search and Intellectual Property', 'd8c9e1148e1b3bb7618bb67f79ac98522060dbe26dbf9766918c6442fa5d0693', '{"sourceLabel":"Revision Questions 2025, Q147","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q147"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('be4b2ae4-d1e2-4ed1-96d1-e6833baeee88'::uuid, '7950a555-7dba-449c-9116-0f6221c691f9'::uuid, 'Cache', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('ecd788fa-2448-482c-8eb8-9287364d2598'::uuid, '7950a555-7dba-449c-9116-0f6221c691f9'::uuid, 'History', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('8dba46c3-bf0d-4140-ba08-2bbe77207673'::uuid, '7950a555-7dba-449c-9116-0f6221c691f9'::uuid, 'Bookmark', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('49917f92-6a1c-4165-9c4b-412bf5019698'::uuid, '7950a555-7dba-449c-9116-0f6221c691f9'::uuid, 'Top-level domain', false, 3, now());

-- Question 117
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('54740cc9-7901-4252-bfb7-6725079b06c6'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'What is the purpose of browser plug-ins or add-ons?', 'Add-ons extend browser functionality, although they should be installed only from trusted sources.', 'mcq', 116, 'application', 'medium', 'application', 'Internet, Browsers, Search and Intellectual Property', '2287caa6aaac4be447dadc2cbc022e94c57a232a9cacb16528deebb3706dfe53', '{"sourceLabel":"Revision Questions 2025, Q148","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q148"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('7690a5c0-7ca8-4490-9ab6-88458f04d032'::uuid, '54740cc9-7901-4252-bfb7-6725079b06c6'::uuid, 'To extend or modify browser capabilities', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('8f0a1325-9a3d-41aa-8941-1d7dc9d52864'::uuid, '54740cc9-7901-4252-bfb7-6725079b06c6'::uuid, 'To replace the computer''s processor', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('1d5d9acc-51f9-406f-9db2-8537670cd2c5'::uuid, '54740cc9-7901-4252-bfb7-6725079b06c6'::uuid, 'To create physical network cables', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('2699062d-cc12-4aa2-bfab-e3692c79eb6f'::uuid, '54740cc9-7901-4252-bfb7-6725079b06c6'::uuid, 'To guarantee every website is safe', false, 3, now());

-- Question 118
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('67ec8b0e-6c86-4824-a5fa-a2a25c084564'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'Which shortcut quickly finds a word or phrase on the webpage currently displayed?', 'Ctrl+F opens the browser''s Find tool for searching within the current page.', 'mcq', 117, 'recall', 'easy', 'recall', 'Internet, Browsers, Search and Intellectual Property', '231b45a3adef130f0b2d67a52c4345459dc77f42ce13a161834983fa5369c159', '{"sourceLabel":"Revision Questions 2025, Q151","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q151"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('91fe9759-ca79-4e54-8931-8872900ea143'::uuid, '67ec8b0e-6c86-4824-a5fa-a2a25c084564'::uuid, 'Ctrl+F', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('c5f2215c-cbe9-439c-98e4-3ef1b15b6b6b'::uuid, '67ec8b0e-6c86-4824-a5fa-a2a25c084564'::uuid, 'Ctrl+N', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('cdd4daa4-905c-4963-ab74-c56b8e0d469c'::uuid, '67ec8b0e-6c86-4824-a5fa-a2a25c084564'::uuid, 'Ctrl+P', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('e8e5df64-eb5d-4084-83cb-cead6ba9381e'::uuid, '67ec8b0e-6c86-4824-a5fa-a2a25c084564'::uuid, 'Ctrl+S', false, 3, now());

-- Question 119
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('9de7ef1c-7e96-437f-9257-d112a6061371'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'What does a search engine maintain to provide rapid results for user queries?', 'Search engines build indexes from discovered pages and query those indexes when returning results.', 'mcq', 118, 'application', 'medium', 'application', 'Internet, Browsers, Search and Intellectual Property', '9c1fe4d45934e8d0ff89182d0ca4597f0941980f61b536ff5c4a97f290a185b9', '{"sourceLabel":"Revision Questions 2025, Q152","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q152"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('4303b0f5-2a32-4b84-9008-9186f4ef477a'::uuid, '9de7ef1c-7e96-437f-9257-d112a6061371'::uuid, 'An index of discovered web content', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('0591b845-7aa5-4f74-8f30-fc419caac4e7'::uuid, '9de7ef1c-7e96-437f-9257-d112a6061371'::uuid, 'A printed directory of every user', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('e5418205-77b3-48b5-b558-e220db34cc51'::uuid, '9de7ef1c-7e96-437f-9257-d112a6061371'::uuid, 'A copy of every user''s password', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('93f488a8-8e3d-4d4a-b585-a25a00db85f6'::uuid, '9de7ef1c-7e96-437f-9257-d112a6061371'::uuid, 'A list of local printer settings', false, 3, now());

-- Question 120
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('815ad643-0a6d-41e6-b97c-7795bda560ab'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'Two websites make conflicting claims about a health topic. What is the strongest reason to compare them with additional reputable sources?', 'Cross-checking reputable sources helps expose errors, weak evidence and bias.', 'mcq', 119, 'scenario_analysis', 'hard', 'analysis', 'Internet, Browsers, Search and Intellectual Property', 'b4c081b161760de2d42446ba38eebf0cfba5d8e32c5030ee5b9aa01a248f110c', '{"sourceLabel":"Revision Questions 2025, Q155","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q155"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('f91f420e-5f83-4160-85d1-218e25c6ed76'::uuid, '815ad643-0a6d-41e6-b97c-7795bda560ab'::uuid, 'To evaluate accuracy, authority and possible bias', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('b449611d-5d50-4bf0-9f01-a2a2f90d36c6'::uuid, '815ad643-0a6d-41e6-b97c-7795bda560ab'::uuid, 'To make both pages use the same colour', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('d2cd6138-3786-47ba-97db-68139e6e74dd'::uuid, '815ad643-0a6d-41e6-b97c-7795bda560ab'::uuid, 'To increase the computer''s storage capacity', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('3d89f798-9d7b-4382-8e72-164f9819b111'::uuid, '815ad643-0a6d-41e6-b97c-7795bda560ab'::uuid, 'To prevent the browser from using tabs', false, 3, now());

-- Question 121
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('226375a6-df8e-4ff1-9286-9fb5cf220c27'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'Which work can generally be reused without seeking copyright permission because its protection has expired or does not apply?', 'Public-domain works are not restricted by active copyright protection, although attribution may still be good practice.', 'mcq', 120, 'application', 'medium', 'application', 'Internet, Browsers, Search and Intellectual Property', 'ec8d688f5b4ec64f32333f63e18728249c23d9ef56cf92dadf5b93fd0d825670', '{"sourceLabel":"Revision Questions 2025, Q156-159","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q156-159"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('7dd4ae17-c10b-40b4-b2b7-bdf0699683b2'::uuid, '226375a6-df8e-4ff1-9286-9fb5cf220c27'::uuid, 'A work in the public domain', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('81b97075-c783-408e-bec5-9ff14f502669'::uuid, '226375a6-df8e-4ff1-9286-9fb5cf220c27'::uuid, 'Any photograph found through a search engine', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('7df09a7d-dca1-4d0c-9c54-490a904fed1a'::uuid, '226375a6-df8e-4ff1-9286-9fb5cf220c27'::uuid, 'Any paid textbook', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('7138143d-3115-4cb7-b065-84f3d1093baf'::uuid, '226375a6-df8e-4ff1-9286-9fb5cf220c27'::uuid, 'Any recent commercial film', false, 3, now());

-- Question 122
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('d9cb7f24-5bc3-4487-a59c-03cfaddd4d91'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'What was the original maximum length of a standard SMS message using the basic character set?', 'A standard SMS was originally designed to carry up to 160 basic characters.', 'mcq', 121, 'recall', 'easy', 'recall', 'Email, VoIP, Messaging and Calendars', '5777118da657a4fbd12f2ab50efd5e6ec913213f1c4c0ce8b4f7cca0f62f3c31', '{"sourceLabel":"Revision Questions 2025, Q30","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q30"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('af3faef6-c819-408c-9655-197a9758eeba'::uuid, 'd9cb7f24-5bc3-4487-a59c-03cfaddd4d91'::uuid, '80 characters', false, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('86094c68-7c89-4ef2-bc55-a4537d62818e'::uuid, 'd9cb7f24-5bc3-4487-a59c-03cfaddd4d91'::uuid, '160 characters', true, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('c494af01-b9e6-4a91-b486-36c58b7883f2'::uuid, 'd9cb7f24-5bc3-4487-a59c-03cfaddd4d91'::uuid, '500 characters', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('1b05c2d4-e596-430b-aa77-97b27133b779'::uuid, 'd9cb7f24-5bc3-4487-a59c-03cfaddd4d91'::uuid, '1,000 characters', false, 3, now());

-- Question 123
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('0a465fba-4366-4bef-8995-352e09bd748e'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'Which activity is an example of synchronous digital communication?', 'Synchronous communication occurs in real time or with participants interacting simultaneously.', 'mcq', 122, 'application', 'medium', 'application', 'Email, VoIP, Messaging and Calendars', 'cd8594a03224e44a07aa88a278113a844763f62b35f37240e884e0b805b70d63', '{"sourceLabel":"Revision Questions 2025, Q166","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q166"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('28717f80-2b84-4e39-ac51-6699c4f5a050'::uuid, '0a465fba-4366-4bef-8995-352e09bd748e'::uuid, 'A live instant-message conversation', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('bc7d2707-7fb2-47f9-bbc3-e910b6e68e97'::uuid, '0a465fba-4366-4bef-8995-352e09bd748e'::uuid, 'A blog post read two days later', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('c50d5dff-9b40-4390-9269-b1b268026830'::uuid, '0a465fba-4366-4bef-8995-352e09bd748e'::uuid, 'An email awaiting a reply', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('c8f3c95d-44d1-4b18-8690-09cda2841771'::uuid, '0a465fba-4366-4bef-8995-352e09bd748e'::uuid, 'A forum comment', false, 3, now());

-- Question 124
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('90a486d8-4783-4f54-8697-f5c839f7d6c8'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'What is essential for making a Voice over Internet Protocol call?', 'VoIP carries voice data over an IP network and therefore requires a suitable network connection.', 'mcq', 123, 'application', 'medium', 'application', 'Email, VoIP, Messaging and Calendars', '13dfb9adade4c4117e15033b9699c368cacac5f2c15b6116ef709088dd6ed984', '{"sourceLabel":"Revision Questions 2025, Q167","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q167"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('0c94f89f-21cd-4ed0-84a9-e56b2234098e'::uuid, '90a486d8-4783-4f54-8697-f5c839f7d6c8'::uuid, 'A functioning Internet connection', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('1b1fbb99-f05a-4f5e-989d-aa0ae40dfb0f'::uuid, '90a486d8-4783-4f54-8697-f5c839f7d6c8'::uuid, 'A printed telephone directory', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('b5043ada-3cb4-4b5a-98f9-69f34ffca86b'::uuid, '90a486d8-4783-4f54-8697-f5c839f7d6c8'::uuid, 'A fax machine', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('44ed4585-6bd9-4b74-8a97-56bea43fb6c8'::uuid, '90a486d8-4783-4f54-8697-f5c839f7d6c8'::uuid, 'A DVD drive', false, 3, now());

-- Question 125
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('c4f67574-6c62-44d6-9021-19dc61c966fd'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'What distinguishes a conference call from a normal one-to-one call?', 'A conference call allows multiple participants to communicate within the same call session.', 'mcq', 124, 'recall', 'easy', 'recall', 'Email, VoIP, Messaging and Calendars', '7f58ec2113ca60a9372884706760831d767cb43c85783ac29431715a1ebecc10', '{"sourceLabel":"Revision Questions 2025, Q168","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q168"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('8d02e467-362e-4195-8802-ccfb40adc356'::uuid, 'c4f67574-6c62-44d6-9021-19dc61c966fd'::uuid, 'It connects more than two participants', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('9209ce78-19d8-422b-aedd-2e94a8ed429b'::uuid, 'c4f67574-6c62-44d6-9021-19dc61c966fd'::uuid, 'It can carry only text', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('7aace0c9-7ec2-4ad9-9c2d-1b5d8eb1be87'::uuid, 'c4f67574-6c62-44d6-9021-19dc61c966fd'::uuid, 'It requires every participant to share one device', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('2ddd3e4e-e1d4-49fa-b94d-51c5f4c923c9'::uuid, 'c4f67574-6c62-44d6-9021-19dc61c966fd'::uuid, 'It cannot occur over the Internet', false, 3, now());

-- Question 126
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('0345af29-7860-41df-a604-50a15feddb44'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'During a VoIP conference, a participant shares a document link while continuing to speak. What does this demonstrate?', 'Modern VoIP conferencing allows participants to communicate while using complementary features and applications.', 'mcq', 125, 'scenario_analysis', 'hard', 'analysis', 'Email, VoIP, Messaging and Calendars', '21f12a4a18533212219ee83df080e142714924b6c5d0463dd8eb7d2663f36003', '{"sourceLabel":"Revision Questions 2025, Q169","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q169"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('367ce111-f877-46a0-9928-0e515917cf35'::uuid, '0345af29-7860-41df-a604-50a15feddb44'::uuid, 'VoIP tools can support communication alongside other digital tasks', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('4d52c5e3-8984-4528-b8d0-9a955e80c418'::uuid, '0345af29-7860-41df-a604-50a15feddb44'::uuid, 'Voice calls disable every other application', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('22165801-6ee6-4dbc-8047-707e2525358d'::uuid, '0345af29-7860-41df-a604-50a15feddb44'::uuid, 'A document can be shared only after the call ends', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('9cf629bc-cc59-4bc0-abe9-c2bb38c507bf'::uuid, '0345af29-7860-41df-a604-50a15feddb44'::uuid, 'The call has become an SMS message', false, 3, now());

-- Question 127
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('c69172f4-fa90-40ea-ac01-d4dbcac6a107'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'Which pair of applications is commonly used for multiperson video conferencing?', 'Zoom and Skype provide real-time audio and video communication among multiple participants.', 'mcq', 126, 'application', 'medium', 'application', 'Email, VoIP, Messaging and Calendars', '412050076e94b6613bbb789349783166899ebbeca1a88880c79173b4b2330ef7', '{"sourceLabel":"Revision Questions 2025, Q170-171","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q170-171"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('25eeda2e-f938-471f-ac3e-379ee1a3746c'::uuid, 'c69172f4-fa90-40ea-ac01-d4dbcac6a107'::uuid, 'Zoom and Skype', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('0c00f11a-8318-4851-88d3-6d9cb19ed1ef'::uuid, 'c69172f4-fa90-40ea-ac01-d4dbcac6a107'::uuid, 'Notepad and Calculator', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('bd86a9a4-49b0-41ae-9242-64c336e9f743'::uuid, 'c69172f4-fa90-40ea-ac01-d4dbcac6a107'::uuid, 'WinZip and Paint', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('43720274-354e-43ba-a108-fb80afd26745'::uuid, 'c69172f4-fa90-40ea-ac01-d4dbcac6a107'::uuid, 'Excel and Disk Cleanup', false, 3, now());

-- Question 128
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('16779866-3f91-4659-b7f3-47209f4d9691'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'What is the real-time distribution of live audio or video over the Internet called?', 'Live streaming broadcasts media over the Internet as the event occurs.', 'mcq', 127, 'recall', 'easy', 'recall', 'Email, VoIP, Messaging and Calendars', 'e86cf29902680ac910335ec798ab467c68fd72be4c6fba2f105c0d38ee44538c', '{"sourceLabel":"Revision Questions 2025, Q172","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q172"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('c7891c88-0d99-4920-86c7-57c7441784b4'::uuid, '16779866-3f91-4659-b7f3-47209f4d9691'::uuid, 'Live streaming', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('b24581d7-e3ac-4088-b79f-5afaf6d6d05d'::uuid, '16779866-3f91-4659-b7f3-47209f4d9691'::uuid, 'File renaming', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('02102d3b-b1d5-443a-a24e-e7b2fe962d42'::uuid, '16779866-3f91-4659-b7f3-47209f4d9691'::uuid, 'Disk formatting', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('3d480cd2-c7bd-4ba2-84f6-5f08d8b8f894'::uuid, '16779866-3f91-4659-b7f3-47209f4d9691'::uuid, 'Optical recognition', false, 3, now());

-- Question 129
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('fb64ccae-90fa-4027-8a85-98aa8d39bc1e'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'In the email address bv_thorpe@mycable.com, which part identifies the organization or mail domain?', 'The portion after the @ symbol identifies the domain responsible for the mailbox.', 'mcq', 128, 'application', 'medium', 'application', 'Email, VoIP, Messaging and Calendars', '4a2f9b11553946c591537674a74dfc85e874909da95b1c1942ecd5cefd69d0ab', '{"sourceLabel":"Revision Questions 2025, Q173","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q173"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('e15c42a4-580b-400d-8d1a-c7033747348f'::uuid, 'fb64ccae-90fa-4027-8a85-98aa8d39bc1e'::uuid, 'bv_thorpe', false, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('769b5fd9-0d15-4fc4-9e00-e2e04cc05977'::uuid, 'fb64ccae-90fa-4027-8a85-98aa8d39bc1e'::uuid, '@', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('ed57ef15-205e-4ee5-89cd-b41e7d2d7fd1'::uuid, 'fb64ccae-90fa-4027-8a85-98aa8d39bc1e'::uuid, 'mycable.com', true, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('238d791d-e0de-4682-847c-40b651ddec07'::uuid, 'fb64ccae-90fa-4027-8a85-98aa8d39bc1e'::uuid, 'bv', false, 3, now());

-- Question 130
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('93edd90b-33fe-4600-ba68-2ccc182eac40'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'From Gmail, which interface element normally opens related Google services such as Calendar?', 'The Google apps launcher provides shortcuts to Calendar and other services associated with the account.', 'mcq', 129, 'scenario_analysis', 'hard', 'analysis', 'Email, VoIP, Messaging and Calendars', '10d038c59e526bb36894bc04a88d821ee95be3ddefca2628e551d14ef19b57b2', '{"sourceLabel":"Revision Questions 2025, Q174","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q174"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('24fcccb2-3e0f-4832-a220-1996e34632fc'::uuid, '93edd90b-33fe-4600-ba68-2ccc182eac40'::uuid, 'The Google apps launcher', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('5b5a819e-6f38-4714-8c2a-4c27d417480f'::uuid, '93edd90b-33fe-4600-ba68-2ccc182eac40'::uuid, 'The message Subject field', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('b9406ccb-9538-4668-b012-ef5ec4fd205d'::uuid, '93edd90b-33fe-4600-ba68-2ccc182eac40'::uuid, 'The Spam button', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('7bb3349f-27af-4080-8147-0b235e108d2c'::uuid, '93edd90b-33fe-4600-ba68-2ccc182eac40'::uuid, 'The attachment filename', false, 3, now());

-- Question 131
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('64477b84-792e-4a86-9dd5-7a00cbd4179f'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'What is the purpose of the formatting toolbar in a new email-message window?', 'The formatting toolbar provides controls for text style, alignment, lists and related presentation features.', 'mcq', 130, 'application', 'medium', 'application', 'Email, VoIP, Messaging and Calendars', '8c4f6f5f3567ab53eb79a73bbe14d9436436806e26ab2051a3285be885bccc58', '{"sourceLabel":"Revision Questions 2025, Q175","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q175"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('73abef4b-7c9c-475f-992d-16a5131fad6e'::uuid, '64477b84-792e-4a86-9dd5-7a00cbd4179f'::uuid, 'To change the appearance and structure of message text', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('4c8c317f-3f33-4973-b3f0-87f32de17814'::uuid, '64477b84-792e-4a86-9dd5-7a00cbd4179f'::uuid, 'To change the recipient''s password', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('329da09a-3de3-48f1-8f0b-4e18ba0b2f68'::uuid, '64477b84-792e-4a86-9dd5-7a00cbd4179f'::uuid, 'To repair the Internet connection', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('92c033bc-47d6-419c-b5a8-daed9e44de87'::uuid, '64477b84-792e-4a86-9dd5-7a00cbd4179f'::uuid, 'To rename the sender''s account', false, 3, now());

-- Question 132
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('0139a7d3-ecb4-4dd3-9ff8-75817d002a85'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'How does an address book help when composing an email?', 'A contacts list stores addresses that can be inserted into recipient fields.', 'mcq', 131, 'recall', 'easy', 'recall', 'Email, VoIP, Messaging and Calendars', '24a5af1b97f5914bac747f5845f48ed34f4bcf9e111223e0fc12d907a923d835', '{"sourceLabel":"Revision Questions 2025, Q176","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q176"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('68edea79-3b86-4ebb-8039-04d5912d99e4'::uuid, '0139a7d3-ecb4-4dd3-9ff8-75817d002a85'::uuid, 'It supplies saved recipient addresses', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('8ca1f3a8-4a66-48a3-8dba-66d4510acbb9'::uuid, '0139a7d3-ecb4-4dd3-9ff8-75817d002a85'::uuid, 'It writes the complete message automatically', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('5256119d-e5c5-42b0-809c-be754405d775'::uuid, '0139a7d3-ecb4-4dd3-9ff8-75817d002a85'::uuid, 'It guarantees delivery', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('6283d512-762d-4180-9822-7bf9794469a2'::uuid, '0139a7d3-ecb4-4dd3-9ff8-75817d002a85'::uuid, 'It removes every attachment', false, 3, now());

-- Question 133
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('a4cd900c-a550-47b4-b8c5-9c1444b7d2d7'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'Why should an email be proofread after automatic spelling review?', 'A spell checker may accept a valid word even when the writer intended a different word.', 'mcq', 132, 'application', 'medium', 'application', 'Email, VoIP, Messaging and Calendars', '6349db37860fc21d23a0c39c05593da88b6fdabbfc9cf49a136aba7cdb82a99e', '{"sourceLabel":"Revision Questions 2025, Q177","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q177"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('0af52161-730b-4fdf-b8a9-b5dc7e90b59f'::uuid, 'a4cd900c-a550-47b4-b8c5-9c1444b7d2d7'::uuid, 'Correctly spelled words may still be wrong in context', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('27a9c43f-8b71-4989-9a9c-9700a082eeeb'::uuid, 'a4cd900c-a550-47b4-b8c5-9c1444b7d2d7'::uuid, 'Spell checking always deletes attachments', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('084b00a1-27b8-4725-a64b-c47d178ae874'::uuid, 'a4cd900c-a550-47b4-b8c5-9c1444b7d2d7'::uuid, 'Proofreading encrypts the message', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('d395582e-f4ab-454d-89e1-c3a8fc047c04'::uuid, 'a4cd900c-a550-47b4-b8c5-9c1444b7d2d7'::uuid, 'The spelling checker cannot examine any text', false, 3, now());

-- Question 134
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('6bfd40ef-5d66-415f-9842-99a442884c93'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'An email thread contains information needed by a colleague who was not among the original recipients. Which command is appropriate?', 'Forward sends the existing message or thread to a new recipient, whereas Reply addresses an existing sender or group.', 'mcq', 133, 'scenario_analysis', 'hard', 'analysis', 'Email, VoIP, Messaging and Calendars', '7b92aac8d8c0bcd4fb13e1928d6b1ac7d62d66e17b6a3b0358c8fe3c7757eb36', '{"sourceLabel":"Revision Questions 2025, Q178","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q178"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('5283b12d-dbb6-4f7b-9648-dd87db1bd2b2'::uuid, '6bfd40ef-5d66-415f-9842-99a442884c93'::uuid, 'Forward', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('efa4c7be-d957-4c05-8b4f-41015ec9e006'::uuid, '6bfd40ef-5d66-415f-9842-99a442884c93'::uuid, 'Reply', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('cf7860fa-0761-48af-aca8-dddc093f9187'::uuid, '6bfd40ef-5d66-415f-9842-99a442884c93'::uuid, 'Archive', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('a29ec7f0-3e68-4798-bffb-35b49a14cd10'::uuid, '6bfd40ef-5d66-415f-9842-99a442884c93'::uuid, 'Mark unread', false, 3, now());

-- Question 135
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('0cacc1e9-e6b0-4782-be3f-814d27f7d500'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'What should be checked before attaching a large file to an email?', 'Attachment limits, transfer cost, security and recipient need should be considered before sending a file.', 'mcq', 134, 'application', 'medium', 'application', 'Email, VoIP, Messaging and Calendars', '82b7a4bef0576129a8756dc92628cb36676cdcb1725ca0075d3bad76f0fcc422', '{"sourceLabel":"Revision Questions 2025, Q179","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q179"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('b1ae6947-fb40-4f3e-b8d8-1dbf72ed06d4'::uuid, '0cacc1e9-e6b0-4782-be3f-814d27f7d500'::uuid, 'Its size and relevance to the recipient', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('b285e1fe-b6d5-431f-953e-1d099ac7049e'::uuid, '0cacc1e9-e6b0-4782-be3f-814d27f7d500'::uuid, 'The monitor''s brightness', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('a834e77b-4265-460c-b307-88472533851e'::uuid, '0cacc1e9-e6b0-4782-be3f-814d27f7d500'::uuid, 'The sender''s desktop wallpaper', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('cfcf5a53-48ed-4dc1-8d52-31be629fbdf7'::uuid, '0cacc1e9-e6b0-4782-be3f-814d27f7d500'::uuid, 'The number of browser tabs', false, 3, now());

-- Question 136
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('18247ed6-2f79-4a78-920b-c2298c6027ad'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'What is an advantage of archiving an email instead of deleting it?', 'Archiving removes a message from the main inbox without permanently discarding it.', 'mcq', 135, 'recall', 'easy', 'recall', 'Email, VoIP, Messaging and Calendars', 'cf7fda555c2bf7fe496f2b8852d1809f875d3ddecae4d8e1e870e69c3820f115', '{"sourceLabel":"Revision Questions 2025, Q181","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q181"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('70b0ff8b-670b-4332-a48c-12f677459e9d'::uuid, '18247ed6-2f79-4a78-920b-c2298c6027ad'::uuid, 'It removes inbox clutter while keeping the message searchable', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('a91acd94-1826-4e11-9dcc-ea659f1a9e6f'::uuid, '18247ed6-2f79-4a78-920b-c2298c6027ad'::uuid, 'It permanently destroys the message', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('9dee1e9a-13fa-4833-b6fc-298b77630fcb'::uuid, '18247ed6-2f79-4a78-920b-c2298c6027ad'::uuid, 'It automatically prints the message', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('de0c43fa-8a32-4186-a586-606eb2553ae2'::uuid, '18247ed6-2f79-4a78-920b-c2298c6027ad'::uuid, 'It makes the message anonymous', false, 3, now());

-- Question 137
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('ac45a44f-7dc8-44c8-9b75-972771ec177e'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'Which calendar feature should be used for a meeting that occurs every Monday for ten weeks?', 'A recurring event automatically creates the repeated schedule according to a defined pattern.', 'mcq', 136, 'application', 'medium', 'application', 'Email, VoIP, Messaging and Calendars', '93ce4ac69b58eba6908c4c163c8914be73511a5d784f21c630e7409bb58ea96a', '{"sourceLabel":"Revision Questions 2025, Q182-185","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q182-185"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('cc33ba70-5fe4-4f63-91c9-fbd48feb56b6'::uuid, 'ac45a44f-7dc8-44c8-9b75-972771ec177e'::uuid, 'A recurring event', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('0e08220e-f4bb-494b-8154-98c6d1afd9c9'::uuid, 'ac45a44f-7dc8-44c8-9b75-972771ec177e'::uuid, 'A deleted event', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('60b62315-5e0d-421e-a08a-b92ba1e6ed03'::uuid, 'ac45a44f-7dc8-44c8-9b75-972771ec177e'::uuid, 'A browser bookmark', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('fde9eaef-66fb-4105-bc71-29e68379b4dc'::uuid, 'ac45a44f-7dc8-44c8-9b75-972771ec177e'::uuid, 'A one-time draft email', false, 3, now());

-- Question 138
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('e3e8521f-8661-42bf-ac08-0998ef142f1e'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'Which social platform is especially known for photographs and videos designed to disappear after viewing?', 'Snapchat popularized temporary photo and video messages.', 'mcq', 137, 'recall', 'easy', 'recall', 'Social Media and Digital Identity', '87746e6831f7761a3d4ea8a5f5d56980a7f93a7b3ee84a455c5a1514604dcb6c', '{"sourceLabel":"Revision Questions 2025, Q187","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q187"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('e5fd60a6-7d2f-48b6-91ab-ed747d754041'::uuid, 'e3e8521f-8661-42bf-ac08-0998ef142f1e'::uuid, 'LinkedIn', false, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('f9b0f242-238d-4863-b420-7ee794be96c0'::uuid, 'e3e8521f-8661-42bf-ac08-0998ef142f1e'::uuid, 'Snapchat', true, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('6b07a396-e1e0-4ef3-a00a-6a96ed9eaeeb'::uuid, 'e3e8521f-8661-42bf-ac08-0998ef142f1e'::uuid, 'Wikipedia', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('159bf55a-bcbb-4238-965d-3a91146f36bc'::uuid, 'e3e8521f-8661-42bf-ac08-0998ef142f1e'::uuid, 'Google Drive', false, 3, now());

-- Question 139
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('a5837363-4e25-4933-b331-dba078619b4c'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'Which platform was created primarily for professional networking and career profiles?', 'LinkedIn focuses on professional identities, employment history and business connections.', 'mcq', 138, 'application', 'medium', 'application', 'Social Media and Digital Identity', '6cb3e832355a556d3ffcbdb0d0c6e2027987e1250588f7a626a87507065bb34d', '{"sourceLabel":"Revision Questions 2025, Q189; Revision Guide, p.5","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q189; Revision Guide, p.5"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('3ca2e7d9-9cd6-4f8b-b0a2-c74283ecabee'::uuid, 'a5837363-4e25-4933-b331-dba078619b4c'::uuid, 'Snapchat', false, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('14346343-6f00-4ca1-99d9-66a9dd61fdea'::uuid, 'a5837363-4e25-4933-b331-dba078619b4c'::uuid, 'LinkedIn', true, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('7196d1a3-f2cf-41b7-a068-9aefb68cb55b'::uuid, 'a5837363-4e25-4933-b331-dba078619b4c'::uuid, 'Dropbox', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('ecc60444-3a05-4e8d-a721-e9cd0172bc93'::uuid, 'a5837363-4e25-4933-b331-dba078619b4c'::uuid, 'WhatsApp', false, 3, now());

-- Question 140
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('fd8e29fe-8e6a-4ba8-a67a-8dbecf0a1ef2'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'Which description best defines a person''s digital identity?', 'A digital identity includes profiles, posts, images, interactions and other online information about a person.', 'mcq', 139, 'application', 'medium', 'application', 'Social Media and Digital Identity', '74816a3fcb670a3202ef9835efd9d6ba6be6605921dfecbc99f54697214d72e2', '{"sourceLabel":"Revision Questions 2025, Q190; Revision Guide, pp.3-4","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q190; Revision Guide, pp.3-4"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('f39c64dd-47f2-46b7-b9ab-611f9adc090c'::uuid, 'fd8e29fe-8e6a-4ba8-a67a-8dbecf0a1ef2'::uuid, 'Only the person''s main username', false, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('7a83c29a-a3fc-46ae-b15b-d231cee238b7'::uuid, 'fd8e29fe-8e6a-4ba8-a67a-8dbecf0a1ef2'::uuid, 'The collection of information about the person available online', true, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('07bcc98e-5228-492d-949e-fd4bd1edaa58'::uuid, 'fd8e29fe-8e6a-4ba8-a67a-8dbecf0a1ef2'::uuid, 'The device''s physical serial number', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('0210af8c-6fdc-491f-982e-f12ba8ac20f6'::uuid, 'fd8e29fe-8e6a-4ba8-a67a-8dbecf0a1ef2'::uuid, 'A single private password', false, 3, now());

-- Question 141
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('16c52a29-22dc-4537-ae76-6c734b9a359b'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'After deleting a photograph from her own profile, can Helen guarantee that it has disappeared from the Internet?', 'Copies shared or downloaded by other people can remain outside the original poster''s control.', 'mcq', 140, 'recall', 'easy', 'recall', 'Social Media and Digital Identity', 'f909a4630613dbd25d4d8fc1dbb1eb08288d8b2575bcc222fd463f0ee957fc9d', '{"sourceLabel":"Revision Questions 2025, Q191; Revision Guide, p.4","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q191; Revision Guide, p.4"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('ccbb392e-639d-4bfa-bae3-da6cedfaaa66'::uuid, '16c52a29-22dc-4537-ae76-6c734b9a359b'::uuid, 'Yes, deletion removes every copy immediately', false, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('d30ac191-dc94-4e49-abb8-9d7a62c4ab1c'::uuid, '16c52a29-22dc-4537-ae76-6c734b9a359b'::uuid, 'No, other people may already have copied or shared it', true, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('07f34f11-b942-4617-ad1b-e6e9406c8298'::uuid, '16c52a29-22dc-4537-ae76-6c734b9a359b'::uuid, 'Yes, if the photograph had no caption', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('2ccfc5d2-d315-4874-a991-a716d5f3d60c'::uuid, '16c52a29-22dc-4537-ae76-6c734b9a359b'::uuid, 'No, because social networks never permit deletion', false, 3, now());

-- Question 142
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('95870e98-5b7f-4e50-97a1-8fc262a8f6bf'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'Which is a legitimate reason for using an online alias?', 'The guide recognizes aliases for gaming, privacy and separating personal and professional identities, not for deception or abuse.', 'mcq', 141, 'scenario_analysis', 'hard', 'analysis', 'Social Media and Digital Identity', 'd1456b2b4e2f715756960cd0d41a9865cff527e30285b8c8bc78cb354ca820ba', '{"sourceLabel":"Revision Questions 2025, Q192; Revision Guide, p.6","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q192; Revision Guide, p.6"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('dce81c89-c18a-4b48-9f37-2198dce83891'::uuid, '95870e98-5b7f-4e50-97a1-8fc262a8f6bf'::uuid, 'To avoid responsibility for harmful conduct', false, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('57228efa-8aa5-489b-8d0c-857771562e95'::uuid, '95870e98-5b7f-4e50-97a1-8fc262a8f6bf'::uuid, 'To maintain a separate gaming or professional identity without exposing a personal name', true, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('4537eba5-9f3a-4606-afa4-d43345784fba'::uuid, '95870e98-5b7f-4e50-97a1-8fc262a8f6bf'::uuid, 'To obtain another person''s account', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('3c17c013-c5d1-4375-9768-e017760f8791'::uuid, '95870e98-5b7f-4e50-97a1-8fc262a8f6bf'::uuid, 'To make false qualifications appear genuine', false, 3, now());

-- Question 143
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('d702bb71-2d13-405d-b769-1c63d64bb56c'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'Which action contributes most directly to a positive professional identity online?', 'Constructive professional content and a well-managed profile help others form a positive and accurate impression.', 'mcq', 142, 'application', 'medium', 'application', 'Social Media and Digital Identity', '23308b2221d5d1b22b181cf5e986418daee21a20aa40cd9ad61b7b0160a46f5c', '{"sourceLabel":"Revision Questions 2025, Q193; Revision Guide, pp.5-6","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q193; Revision Guide, pp.5-6"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('ec407cda-f176-4f3b-b3f0-8e3f1bd7c488'::uuid, 'd702bb71-2d13-405d-b769-1c63d64bb56c'::uuid, 'Publishing useful work-related material and maintaining an accurate LinkedIn profile', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('4abc59fc-9a8d-4c69-8e71-3ce6c3a82739'::uuid, 'd702bb71-2d13-405d-b769-1c63d64bb56c'::uuid, 'Posting every angry thought immediately', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('9755440f-fcf2-4d3f-8c3c-e96256934283'::uuid, 'd702bb71-2d13-405d-b769-1c63d64bb56c'::uuid, 'Sharing another person''s work without credit', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('888ab06f-9361-492a-9d02-4bc2346ef316'::uuid, 'd702bb71-2d13-405d-b769-1c63d64bb56c'::uuid, 'Using the same password everywhere', false, 3, now());

-- Question 144
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('bd6d8f4c-5594-4b4f-96c0-83c26db2de7d'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'Which action is a clear example of cyberbullying?', 'Cyberbullying involves harmful digital behaviour such as repeated threats, harassment or humiliation.', 'mcq', 143, 'recall', 'easy', 'recall', 'Social Media and Digital Identity', '10b2c28c7a40b71d4ec6f3eb961a1a9cb32ea2ac3c00970b88b3ec49bdac5cb2', '{"sourceLabel":"Revision Questions 2025, Q194","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q194"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('ce63c5b4-f852-40dd-be68-344b4b67b5f6'::uuid, 'bd6d8f4c-5594-4b4f-96c0-83c26db2de7d'::uuid, 'Respectfully disagreeing in a discussion', false, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('c841af5e-4fe5-40cc-bbe4-1285ea81be7a'::uuid, 'bd6d8f4c-5594-4b4f-96c0-83c26db2de7d'::uuid, 'Repeatedly sending threatening and humiliating messages to another person', true, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('54109f96-0bb3-4017-a3b2-804dd303b8c1'::uuid, 'bd6d8f4c-5594-4b4f-96c0-83c26db2de7d'::uuid, 'Reporting content that violates platform rules', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('86272c36-a63c-45a6-9903-3adc4bbb070d'::uuid, 'bd6d8f4c-5594-4b4f-96c0-83c26db2de7d'::uuid, 'Declining a friend request', false, 3, now());

-- Question 145
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('89913092-5d96-4b24-b752-63e34052e134'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'What is the main purpose of a hashtag on social media?', 'Hashtags label related conversations and make topic-based discovery easier.', 'mcq', 144, 'application', 'medium', 'application', 'Social Media and Digital Identity', '8e089ed5543b55f6908b584265af00b57a1eb56e6664eab516924a842c0915c6', '{"sourceLabel":"Revision Questions 2025, Q154","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q154"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('051c8fa5-ea4f-4a14-af9d-bcd3378e5296'::uuid, '89913092-5d96-4b24-b752-63e34052e134'::uuid, 'To group and discover posts about a related topic', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('f79939e0-0dc8-4131-ad12-e44e59855f19'::uuid, '89913092-5d96-4b24-b752-63e34052e134'::uuid, 'To encrypt every post', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('82344a53-8197-4fdf-895a-5f30d455adcf'::uuid, '89913092-5d96-4b24-b752-63e34052e134'::uuid, 'To increase the device''s storage', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('fc8acd48-1165-4cfd-8965-4ec40ca0bcde'::uuid, '89913092-5d96-4b24-b752-63e34052e134'::uuid, 'To hide the author''s account', false, 3, now());

-- Question 146
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('de14df6b-2d76-48d3-9d65-c024604e907b'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'Which behaviour most strongly suggests unhealthy Internet dependence?', 'Loss of control and serious interference with normal responsibilities are stronger warning signs than ordinary Internet use.', 'mcq', 145, 'scenario_analysis', 'hard', 'analysis', 'Social Media and Digital Identity', '2e3d7a73e334d53c4e956ebbb16fc07a48e3a49a2727c92bf6e4b74578add0dc', '{"sourceLabel":"Revision Questions 2025, Q195","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Questions 2025, Q195"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('efb08e61-c35d-4793-99a8-a3c45318345c'::uuid, 'de14df6b-2d76-48d3-9d65-c024604e907b'::uuid, 'Checking email during scheduled work', false, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('c0e8057a-c522-49f7-b67d-e5c2e887ee20'::uuid, 'de14df6b-2d76-48d3-9d65-c024604e907b'::uuid, 'Repeatedly neglecting sleep, study and relationships because of uncontrolled Internet use', true, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('9003808b-ce92-4ea6-bb8f-7042764143ff'::uuid, 'de14df6b-2d76-48d3-9d65-c024604e907b'::uuid, 'Using cloud storage for an assignment', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('6deb45f8-bd4a-410c-bd93-c4b8138a2b73'::uuid, 'de14df6b-2d76-48d3-9d65-c024604e907b'::uuid, 'Attending one video conference', false, 3, now());

-- Question 147
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('b15b8841-bffc-4584-abe3-cb7f1e7650f9'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'What is a potential benefit of maintaining separate personal and professional online identities?', 'Separate identities can help a person manage how personal and professional activities are presented to different audiences.', 'mcq', 146, 'application', 'medium', 'application', 'Social Media and Digital Identity', '3bd122772f9b93e8e1842d02ce188c62c889aac8059b2b9f6c65756dc0b04871', '{"sourceLabel":"Revision Guide, p.6","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Guide, p.6"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('85160576-0397-4765-8e15-4de8fc6dc4d2'::uuid, 'b15b8841-bffc-4584-abe3-cb7f1e7650f9'::uuid, 'Each identity can present content appropriate to its intended audience', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('84378287-7b7d-47cb-a834-cc0c2cdc602d'::uuid, 'b15b8841-bffc-4584-abe3-cb7f1e7650f9'::uuid, 'It guarantees that no information can ever be copied', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('60391740-7fb4-4488-b28b-c40d83ba5964'::uuid, 'b15b8841-bffc-4584-abe3-cb7f1e7650f9'::uuid, 'It removes the need for account security', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('0d36ad4c-f008-4789-8e58-e72e4d3bfda1'::uuid, 'b15b8841-bffc-4584-abe3-cb7f1e7650f9'::uuid, 'It permits false claims without consequences', false, 3, now());

-- Question 148
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('0419f591-7855-4011-91b5-8e3052e62b53'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'Why does the guide advise against posting or sending a message while angry?', 'A message sent impulsively may be copied, shared and later damage relationships or reputation.', 'mcq', 147, 'application', 'medium', 'application', 'Social Media and Digital Identity', 'dc27e35526b67d4e39d52abab385f8e2a5292574bb7f461a34c923be5f16e9dd', '{"sourceLabel":"Revision Guide, pp.5-6","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Guide, pp.5-6"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('3d49c698-54eb-4010-9670-3836f7784999'::uuid, '0419f591-7855-4011-91b5-8e3052e62b53'::uuid, 'The communication can become a permanent harmful part of the sender''s digital record', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('4d0c17bd-244c-4fe0-bc4c-89f0e839bbc2'::uuid, '0419f591-7855-4011-91b5-8e3052e62b53'::uuid, 'Angry messages cannot contain text', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('781c47f8-7556-4b8c-9568-99646c1093ec'::uuid, '0419f591-7855-4011-91b5-8e3052e62b53'::uuid, 'Every angry message automatically deletes the account', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('b7b1cd1d-afdc-4939-8bb0-2fb09c45c19c'::uuid, '0419f591-7855-4011-91b5-8e3052e62b53'::uuid, 'The Internet stops working when emotions are expressed', false, 3, now());

-- Question 149
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('345fb891-22c2-44e3-b8f8-425b570e1168'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'Which statement best distinguishes a digital footprint from a single online profile?', 'Digital footprints accumulate from posts, likes, uploads, searches and other actions across online environments.', 'mcq', 148, 'application', 'medium', 'application', 'Social Media and Digital Identity', '070d0d6d2bb97ee5642dabdb8232c88ef7ad8c712b968ffa633939173afe3b06', '{"sourceLabel":"Revision Guide, pp.3-4","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Guide, pp.3-4"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('4dcb358a-e9be-4d9b-a5b0-5e80d2c4a1e2'::uuid, '345fb891-22c2-44e3-b8f8-425b570e1168'::uuid, 'A digital footprint includes traces left across many online actions and services', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('3b0a40de-1493-4818-ae27-8d7b00d35dda'::uuid, '345fb891-22c2-44e3-b8f8-425b570e1168'::uuid, 'A digital footprint is only the profile photograph', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('9a311740-cfc5-474c-bf32-8180dea4ed1c'::uuid, '345fb891-22c2-44e3-b8f8-425b570e1168'::uuid, 'A profile includes every action performed anywhere online', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('74ef3674-179a-43c7-b53e-a41ce8e02882'::uuid, '345fb891-22c2-44e3-b8f8-425b570e1168'::uuid, 'They both mean an account password', false, 3, now());

-- Question 150
INSERT INTO public.study_quiz_questions
  (id, set_id, prompt, explanation, question_type, position, question_kind, difficulty_level, cognitive_level, source_topic, question_fingerprint, study_ref, generation_meta, published, created_at)
VALUES ('5aef576a-f897-4cca-bec4-6b511387d353'::uuid, '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid, 'Why should a student review public online content before applying for employment?', 'Public posts and associations can influence the impression formed by employers, schools and other decision-makers.', 'mcq', 149, 'application', 'medium', 'application', 'Social Media and Digital Identity', '6589495669424d1ae924cb7c8a6a8d62da140275652b574e80efac9bd0206a2b', '{"sourceLabel":"Revision Guide, p.5","reviewedFromLocalPdf":true}'::jsonb, '{"import":"codex_gns121_150_v1","sourceReference":"Revision Guide, p.5"}'::jsonb, true, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('ba8e4420-f66c-4404-b069-9c87a2b93aff'::uuid, '5aef576a-f897-4cca-bec4-6b511387d353'::uuid, 'Employers may use public information when assessing the student''s judgement and suitability', true, 0, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('d39d4419-214d-416f-a890-5c8c35a4b51c'::uuid, '5aef576a-f897-4cca-bec4-6b511387d353'::uuid, 'Reviewing content guarantees employment', false, 1, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('4a847769-2b12-4592-b8bd-9111a1a698e4'::uuid, '5aef576a-f897-4cca-bec4-6b511387d353'::uuid, 'Employers cannot access any public profile', false, 2, now());
INSERT INTO public.study_quiz_options (id, question_id, text, is_correct, position, created_at)
VALUES ('cbc59193-942b-4a4c-89bd-51f572ecc72d'::uuid, '5aef576a-f897-4cca-bec4-6b511387d353'::uuid, 'Online conduct has no connection to reputation', false, 3, now());

UPDATE public.study_quiz_sets
SET questions_count = 150, time_limit_minutes = 40, published = false, visibility = 'private', updated_at = now()
WHERE id = '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid;

COMMIT;

-- Verification summary: should return 150 questions, 600 options, 150 correct options.
SELECT
  count(DISTINCT q.id) AS questions,
  count(o.id) AS options,
  count(o.id) FILTER (WHERE o.is_correct) AS correct_options,
  count(DISTINCT q.id) FILTER (WHERE q.exam_verified_at IS NOT NULL) AS human_verified
FROM public.study_quiz_questions q
LEFT JOIN public.study_quiz_options o ON o.question_id = q.id
WHERE coalesce(q.set_id, q.quiz_set_id) = '5a4b65e8-6904-4cf5-87f9-1973824982bb'::uuid;

