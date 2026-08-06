DO $$
DECLARE
  v_lot_id uuid;
  i int;
BEGIN
  SELECT id INTO v_lot_id FROM public.lots WHERE code = 'LOT-DEMO-001';

  IF v_lot_id IS NULL THEN
    INSERT INTO public.lots (code, quantity, supplier, status, received_at)
    VALUES ('LOT-DEMO-001', 10, 'Pilote interne', 'received', now())
    RETURNING id INTO v_lot_id;
  END IF;

  FOR i IN 1..10 LOOP
    INSERT INTO public.beacons (public_number, status, lot_id)
    VALUES ('GN-CKY-1000' || lpad(i::text, 2, '0'), 'generated', v_lot_id)
    ON CONFLICT (public_number) DO NOTHING;
  END LOOP;
END $$;