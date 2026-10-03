-- Commander professional contact role.
-- Existing orders columns reused: raison_sociale, rccm, nif, site_web, nb_adresses.

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS fonction_contact text;

COMMENT ON COLUMN public.orders.fonction_contact IS
    'Fonction du contact saisie lors d une commande professionnelle ou institutionnelle.';

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS instructions_particulieres text;

COMMENT ON COLUMN public.orders.instructions_particulieres IS
    'Instructions particulières facultatives saisies lors de la commande.';

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS professional_offer_tier text;

COMMENT ON COLUMN public.orders.professional_offer_tier IS
    'Palier professionnel demande: pro_basic, pro_plus ou multi_sites.';
