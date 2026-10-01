BEGIN;

CREATE OR REPLACE FUNCTION public.search_by_number(
    p_number text
)
RETURNS TABLE(
    public_number text,
    name text,
    category text,
    visibility text,
    verification_level text,
    access_point_note text,
    lat double precision,
    lng double precision,
    business_name text,
    phone text,
    opening_hours jsonb,
    description text,
    cover_url text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
    SELECT
        b.public_number,
        a.name,
        a.category,
        a.visibility,
        a.verification_level,
        a.access_point_note,
        ST_Y(a.location::geometry) AS lat,
        ST_X(a.location::geometry) AS lng,
        e.business_name,
        e.phone,
        e.opening_hours,
        e.description,
        e.cover_url
    FROM public.beacons b
    JOIN public.addresses a
      ON a.beacon_id = b.id
    LEFT JOIN public.establishments e
      ON e.address_id = a.id
    WHERE UPPER(b.public_number) = UPPER(p_number)
      AND b.status = 'active'
      AND a.status = 'active'
      AND a.visibility = 'public';
$function$;

COMMIT;