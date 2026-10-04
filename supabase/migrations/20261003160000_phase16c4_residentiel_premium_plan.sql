-- C6-C2-C6-A4C-R9
-- Activate Residential Premium as a real checkout catalog plan.

INSERT INTO public.cms_plans (
    code,
    name,
    description,
    features,
    price_gnf,
    period,
    popular,
    active,
    position,
    audience,
    price_from_gnf,
    price_to_gnf,
    recurring_price_gnf,
    billing_period,
    requires_quote,
    plate_available,
    plate_included,
    installation_required,
    max_addresses,
    fulfillment_kind
)
VALUES (
    'residentiel_premium',
    jsonb_build_object(
        'fr', 'Résidentiel Premium',
        'en', 'Residential Premium'
    ),
    jsonb_build_object(
        'fr', 'Adresse GN résidentielle renforcée avec plaque physique et prise en charge prioritaire.',
        'en', 'Enhanced GN residential address with physical plate and priority handling.'
    ),
    jsonb_build_object(
        'fr', jsonb_build_array(
            'Numéro Adresse GN',
            'QR Code',
            'Localisation GPS',
            'Balise renforcée longue durée',
            'Pose prioritaire sous 72 h',
            'Note d''accès détaillée',
            'Assistance au remplacement 12 mois',
            'Google Maps / Waze'
        ),
        'en', jsonb_build_array(
            'GN Address number',
            'QR Code',
            'GPS location',
            'Enhanced long-life plate',
            'Priority installation within 72 hours',
            'Detailed access note',
            '12-month replacement assistance',
            'Google Maps / Waze'
        )
    ),
    300000,
    'once',
    false,
    true,
    30,
    'residential',
    300000,
    300000,
    0,
    'none',
    false,
    true,
    true,
    true,
    NULL,
    'physical_installation'
);
