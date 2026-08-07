CREATE POLICY "staff read installation docs"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'installation-docs'
         AND private.current_role_is(ARRAY['admin','super_admin','qc','supervisor']));

CREATE POLICY "staff write installation docs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'installation-docs'
              AND private.current_role_is(ARRAY['admin','super_admin','qc','supervisor']));

CREATE POLICY "staff update installation docs"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'installation-docs'
         AND private.current_role_is(ARRAY['admin','super_admin','qc','supervisor']));

CREATE POLICY "staff delete installation docs"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'installation-docs'
         AND private.current_role_is(ARRAY['admin','super_admin','qc','supervisor']));
