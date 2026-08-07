CREATE TABLE public.pending_installation_docs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pending_installation_id uuid NOT NULL REFERENCES public.pending_installations(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'photo',
  label text,
  storage_path text NOT NULL,
  mime_type text,
  size_bytes integer,
  status text NOT NULL DEFAULT 'pending',
  review_note text,
  uploaded_by uuid REFERENCES public.profiles(id),
  reviewed_by uuid REFERENCES public.profiles(id),
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_pi_docs_pending ON public.pending_installation_docs(pending_installation_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pending_installation_docs TO authenticated;
GRANT ALL ON public.pending_installation_docs TO service_role;

ALTER TABLE public.pending_installation_docs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff manage pending installation docs"
  ON public.pending_installation_docs FOR ALL TO authenticated
  USING (private.current_role_is(ARRAY['admin','super_admin','qc','supervisor']))
  WITH CHECK (private.current_role_is(ARRAY['admin','super_admin','qc','supervisor']));

CREATE POLICY "customer reads own pending installation docs"
  ON public.pending_installation_docs FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.pending_installations pi
    WHERE pi.id = pending_installation_docs.pending_installation_id
      AND pi.customer_id = auth.uid()
  ));

CREATE TRIGGER trg_pi_docs_updated_at
  BEFORE UPDATE ON public.pending_installation_docs
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER trg_pi_docs_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.pending_installation_docs
  FOR EACH ROW EXECUTE FUNCTION private.audit_trigger();
