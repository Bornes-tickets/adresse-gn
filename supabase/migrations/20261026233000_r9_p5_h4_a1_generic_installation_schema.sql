-- =================================================================================================
-- R9-P5-H4-A1 — GENERIC INSTALLATION SCHEMA FOUNDATION
--
-- Additive foundation only.
-- Creates the generic business request + terrain task layer.
--
-- Explicitly out of scope:
--   * no backfill from pending_installations;
--   * no payment-flow cutover;
--   * no Supervisor cutover;
--   * no Agent cutover;
--   * no mutation of existing business rows.
-- =================================================================================================

BEGIN;


-- -------------------------------------------------------------------------------------------------
-- 0. STRICT PRECONDITIONS
-- -------------------------------------------------------------------------------------------------

DO $h4_a1_preconditions$
BEGIN
    IF to_regclass('public.installation_requests') IS NOT NULL THEN
        RAISE EXCEPTION
            'H4-A1: public.installation_requests already exists';
    END IF;

    IF to_regclass('public.installation_tasks') IS NOT NULL THEN
        RAISE EXCEPTION
            'H4-A1: public.installation_tasks already exists';
    END IF;

    IF to_regclass('public.orders') IS NULL
       OR to_regclass('public.order_sites') IS NULL
       OR to_regclass('public.profiles') IS NULL
       OR to_regclass('public.business_profiles') IS NULL
       OR to_regclass('public.beacon_categories') IS NULL
       OR to_regclass('public.communes') IS NULL
       OR to_regclass('public.districts') IS NULL
       OR to_regclass('public.sectors') IS NULL
       OR to_regclass('public.beacons') IS NULL
       OR to_regclass('public.agents') IS NULL
       OR to_regclass('public.installations') IS NULL THEN
        RAISE EXCEPTION
            'H4-A1: required dependency table is missing';
    END IF;

    IF to_regprocedure(
        'private.current_role_is(text[])'
    ) IS NULL THEN
        RAISE EXCEPTION
            'H4-A1: private.current_role_is(text[]) is missing';
    END IF;

    IF to_regprocedure(
        'private.current_account_is_active()'
    ) IS NULL THEN
        RAISE EXCEPTION
            'H4-A1: private.current_account_is_active() is missing';
    END IF;
END
$h4_a1_preconditions$;


-- -------------------------------------------------------------------------------------------------
-- 1. BUSINESS-LEVEL INSTALLATION REQUEST
-- -------------------------------------------------------------------------------------------------

CREATE TABLE public.installation_requests (
    id uuid
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    reference text
        NOT NULL
        UNIQUE,

    source_type text
        NOT NULL,

    source_reference text,

    order_id uuid,

    customer_id uuid,

    business_id uuid,

    beneficiary_name text,

    beneficiary_phone text,

    beneficiary_email text,

    title text
        NOT NULL,

    reason text,

    priority text
        NOT NULL
        DEFAULT 'normal',

    status text
        NOT NULL
        DEFAULT 'draft',

    category text
        NOT NULL,

    quantity integer
        NOT NULL
        DEFAULT 1,

    commune_id uuid
        NOT NULL,

    district_id uuid,

    sector_id uuid,

    requested_location geography(Point, 4326),

    location_accuracy_m numeric(8, 2),

    address_line text,

    access_point_note text,

    requested_by uuid,

    approved_by uuid,

    approved_at timestamptz,

    completed_at timestamptz,

    cancelled_at timestamptz,

    metadata jsonb
        NOT NULL
        DEFAULT '{}'::jsonb,

    created_at timestamptz
        NOT NULL
        DEFAULT now(),

    updated_at timestamptz
        NOT NULL
        DEFAULT now(),

    CONSTRAINT installation_requests_source_type_check
        CHECK (
            source_type = ANY (
                ARRAY[
                    'customer_order'::text,
                    'institutional'::text,
                    'internal'::text,
                    'campaign'::text,
                    'replacement'::text,
                    'regularization'::text,
                    'other'::text
                ]
            )
        ),

    CONSTRAINT installation_requests_priority_check
        CHECK (
            priority = ANY (
                ARRAY[
                    'low'::text,
                    'normal'::text,
                    'high'::text,
                    'urgent'::text
                ]
            )
        ),

    CONSTRAINT installation_requests_status_check
        CHECK (
            status = ANY (
                ARRAY[
                    'draft'::text,
                    'pending_approval'::text,
                    'approved'::text,
                    'in_progress'::text,
                    'completed'::text,
                    'cancelled'::text
                ]
            )
        ),

    CONSTRAINT installation_requests_quantity_positive_check
        CHECK (
            quantity > 0
        ),

    CONSTRAINT installation_requests_location_accuracy_check
        CHECK (
            location_accuracy_m IS NULL
            OR location_accuracy_m >= 0
        ),

    CONSTRAINT installation_requests_customer_order_link_check
        CHECK (
            source_type <> 'customer_order'
            OR order_id IS NOT NULL
        ),

    CONSTRAINT installation_requests_approval_state_check
        CHECK (
            status NOT IN (
                'approved',
                'in_progress',
                'completed'
            )
            OR (
                approved_by IS NOT NULL
                AND approved_at IS NOT NULL
            )
        ),

    CONSTRAINT installation_requests_completed_state_check
        CHECK (
            (
                status = 'completed'
                AND completed_at IS NOT NULL
            )
            OR (
                status <> 'completed'
                AND completed_at IS NULL
            )
        ),

    CONSTRAINT installation_requests_cancelled_state_check
        CHECK (
            (
                status = 'cancelled'
                AND cancelled_at IS NOT NULL
            )
            OR (
                status <> 'cancelled'
                AND cancelled_at IS NULL
            )
        ),

    CONSTRAINT installation_requests_order_id_fkey
        FOREIGN KEY (order_id)
        REFERENCES public.orders(id),

    CONSTRAINT installation_requests_customer_id_fkey
        FOREIGN KEY (customer_id)
        REFERENCES public.profiles(id)
        ON DELETE SET NULL,

    CONSTRAINT installation_requests_business_id_fkey
        FOREIGN KEY (business_id)
        REFERENCES public.business_profiles(id)
        ON DELETE SET NULL,

    CONSTRAINT installation_requests_category_fkey
        FOREIGN KEY (category)
        REFERENCES public.beacon_categories(code),

    CONSTRAINT installation_requests_commune_id_fkey
        FOREIGN KEY (commune_id)
        REFERENCES public.communes(id),

    CONSTRAINT installation_requests_district_id_fkey
        FOREIGN KEY (district_id)
        REFERENCES public.districts(id)
        ON DELETE SET NULL,

    CONSTRAINT installation_requests_sector_id_fkey
        FOREIGN KEY (sector_id)
        REFERENCES public.sectors(id)
        ON DELETE SET NULL,

    CONSTRAINT installation_requests_requested_by_fkey
        FOREIGN KEY (requested_by)
        REFERENCES public.profiles(id)
        ON DELETE SET NULL,

    CONSTRAINT installation_requests_approved_by_fkey
        FOREIGN KEY (approved_by)
        REFERENCES public.profiles(id)
        ON DELETE SET NULL
);


COMMENT ON TABLE public.installation_requests IS
'Generic physical installation business request. A customer order is one possible source among institutional, internal, campaign, replacement, regularization and other requests.';

COMMENT ON COLUMN public.installation_requests.order_id IS
'Optional commercial origin. Required by business rule only when source_type = customer_order.';

COMMENT ON COLUMN public.installation_requests.quantity IS
'Authorized number of terrain installation tasks for this request. Task generation is implemented in H4-A2, not in this migration.';

COMMENT ON COLUMN public.installation_requests.requested_location IS
'Optional request-level default target. Individual terrain targets belong to installation_tasks.';


-- -------------------------------------------------------------------------------------------------
-- 2. TERRAIN EXECUTION UNIT
-- -------------------------------------------------------------------------------------------------

CREATE TABLE public.installation_tasks (
    id uuid
        PRIMARY KEY
        DEFAULT gen_random_uuid(),

    request_id uuid
        NOT NULL,

    sequence_no integer
        NOT NULL,

    source_order_site_id uuid,

    site_name text,

    contact_name text,

    contact_phone text,

    category text
        NOT NULL,

    commune_id uuid
        NOT NULL,

    district_id uuid,

    sector_id uuid,

    target_location geography(Point, 4326),

    target_accuracy_m numeric(8, 2),

    address_line text,

    access_point_note text,

    beacon_id uuid,

    assigned_agent_id uuid,

    installation_id uuid,

    status text
        NOT NULL
        DEFAULT 'pending',

    scheduled_at timestamptz,

    installed_at timestamptz,

    completed_at timestamptz,

    cancelled_at timestamptz,

    notes text,

    metadata jsonb
        NOT NULL
        DEFAULT '{}'::jsonb,

    created_at timestamptz
        NOT NULL
        DEFAULT now(),

    updated_at timestamptz
        NOT NULL
        DEFAULT now(),

    CONSTRAINT installation_tasks_sequence_positive_check
        CHECK (
            sequence_no > 0
        ),

    CONSTRAINT installation_tasks_status_check
        CHECK (
            status = ANY (
                ARRAY[
                    'pending'::text,
                    'assigned'::text,
                    'planned'::text,
                    'installed'::text,
                    'validated'::text,
                    'cancelled'::text
                ]
            )
        ),

    CONSTRAINT installation_tasks_target_accuracy_check
        CHECK (
            target_accuracy_m IS NULL
            OR target_accuracy_m >= 0
        ),

    CONSTRAINT installation_tasks_assignment_state_check
        CHECK (
            status = 'cancelled'
            OR (
                status = 'pending'
                AND beacon_id IS NULL
                AND assigned_agent_id IS NULL
                AND scheduled_at IS NULL
                AND installation_id IS NULL
                AND installed_at IS NULL
                AND completed_at IS NULL
            )
            OR (
                status = 'assigned'
                AND beacon_id IS NOT NULL
                AND assigned_agent_id IS NOT NULL
                AND scheduled_at IS NULL
                AND installation_id IS NULL
                AND installed_at IS NULL
                AND completed_at IS NULL
            )
            OR (
                status = 'planned'
                AND beacon_id IS NOT NULL
                AND assigned_agent_id IS NOT NULL
                AND scheduled_at IS NOT NULL
                AND installation_id IS NULL
                AND installed_at IS NULL
                AND completed_at IS NULL
            )
            OR (
                status = 'installed'
                AND beacon_id IS NOT NULL
                AND assigned_agent_id IS NOT NULL
                AND scheduled_at IS NOT NULL
                AND installation_id IS NOT NULL
                AND installed_at IS NOT NULL
                AND completed_at IS NULL
            )
            OR (
                status = 'validated'
                AND beacon_id IS NOT NULL
                AND assigned_agent_id IS NOT NULL
                AND scheduled_at IS NOT NULL
                AND installation_id IS NOT NULL
                AND installed_at IS NOT NULL
                AND completed_at IS NOT NULL
            )
        ),

    CONSTRAINT installation_tasks_cancelled_state_check
        CHECK (
            (
                status = 'cancelled'
                AND cancelled_at IS NOT NULL
            )
            OR (
                status <> 'cancelled'
                AND cancelled_at IS NULL
            )
        ),

    CONSTRAINT installation_tasks_request_id_fkey
        FOREIGN KEY (request_id)
        REFERENCES public.installation_requests(id)
        ON DELETE CASCADE,

    CONSTRAINT installation_tasks_source_order_site_id_fkey
        FOREIGN KEY (source_order_site_id)
        REFERENCES public.order_sites(id)
        ON DELETE SET NULL,

    CONSTRAINT installation_tasks_category_fkey
        FOREIGN KEY (category)
        REFERENCES public.beacon_categories(code),

    CONSTRAINT installation_tasks_commune_id_fkey
        FOREIGN KEY (commune_id)
        REFERENCES public.communes(id),

    CONSTRAINT installation_tasks_district_id_fkey
        FOREIGN KEY (district_id)
        REFERENCES public.districts(id)
        ON DELETE SET NULL,

    CONSTRAINT installation_tasks_sector_id_fkey
        FOREIGN KEY (sector_id)
        REFERENCES public.sectors(id)
        ON DELETE SET NULL,

    CONSTRAINT installation_tasks_beacon_id_fkey
        FOREIGN KEY (beacon_id)
        REFERENCES public.beacons(id)
        ON DELETE SET NULL,

    CONSTRAINT installation_tasks_assigned_agent_id_fkey
        FOREIGN KEY (assigned_agent_id)
        REFERENCES public.agents(id)
        ON DELETE SET NULL,

    CONSTRAINT installation_tasks_installation_id_fkey
        FOREIGN KEY (installation_id)
        REFERENCES public.installations(id)
        ON DELETE SET NULL,

    CONSTRAINT installation_tasks_request_sequence_key
        UNIQUE (request_id, sequence_no)
);


COMMENT ON TABLE public.installation_tasks IS
'One physical terrain execution unit. A request with quantity N can produce N tasks. Assignment, planning, installation and QC operate at task level.';

COMMENT ON COLUMN public.installation_tasks.source_order_site_id IS
'Optional compatibility link for customer-order origin. Generic non-commercial tasks do not require order_sites.';

COMMENT ON COLUMN public.installation_tasks.installation_id IS
'Optional link to the final immutable terrain installation evidence. Wiring is implemented after H4-A1.';


-- -------------------------------------------------------------------------------------------------
-- 3. INDEXES
-- -------------------------------------------------------------------------------------------------

CREATE UNIQUE INDEX installation_requests_one_per_order_uidx
    ON public.installation_requests (order_id)
    WHERE order_id IS NOT NULL;

CREATE INDEX idx_installation_requests_source_type
    ON public.installation_requests (source_type);

CREATE INDEX idx_installation_requests_status_created
    ON public.installation_requests (
        status,
        created_at DESC
    );

CREATE INDEX idx_installation_requests_commune_category
    ON public.installation_requests (
        commune_id,
        category
    );

CREATE INDEX idx_installation_requests_customer
    ON public.installation_requests (customer_id)
    WHERE customer_id IS NOT NULL;

CREATE INDEX idx_installation_requests_requested_by
    ON public.installation_requests (requested_by)
    WHERE requested_by IS NOT NULL;

CREATE INDEX idx_installation_requests_location
    ON public.installation_requests
    USING gist (requested_location);

CREATE INDEX idx_installation_tasks_request
    ON public.installation_tasks (
        request_id,
        sequence_no
    );

CREATE INDEX idx_installation_tasks_status_created
    ON public.installation_tasks (
        status,
        created_at DESC
    );

CREATE INDEX idx_installation_tasks_dispatch
    ON public.installation_tasks (
        commune_id,
        category,
        status
    );

CREATE INDEX idx_installation_tasks_agent
    ON public.installation_tasks (
        assigned_agent_id,
        status
    )
    WHERE assigned_agent_id IS NOT NULL;

CREATE INDEX idx_installation_tasks_schedule
    ON public.installation_tasks (scheduled_at)
    WHERE scheduled_at IS NOT NULL;

CREATE INDEX idx_installation_tasks_location
    ON public.installation_tasks
    USING gist (target_location);

CREATE UNIQUE INDEX installation_tasks_active_beacon_uidx
    ON public.installation_tasks (beacon_id)
    WHERE
        beacon_id IS NOT NULL
        AND status <> 'cancelled';

CREATE UNIQUE INDEX installation_tasks_installation_uidx
    ON public.installation_tasks (installation_id)
    WHERE installation_id IS NOT NULL;


-- -------------------------------------------------------------------------------------------------
-- 4. RLS + LEAST-PRIVILEGE TABLE GRANTS
-- -------------------------------------------------------------------------------------------------

ALTER TABLE public.installation_requests
    ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.installation_tasks
    ENABLE ROW LEVEL SECURITY;


REVOKE ALL
ON TABLE
    public.installation_requests,
    public.installation_tasks
FROM PUBLIC;

REVOKE ALL
ON TABLE
    public.installation_requests,
    public.installation_tasks
FROM anon;

REVOKE ALL
ON TABLE
    public.installation_requests,
    public.installation_tasks
FROM authenticated;


GRANT
    SELECT,
    INSERT,
    UPDATE
ON TABLE
    public.installation_requests,
    public.installation_tasks
TO authenticated;


GRANT ALL
ON TABLE
    public.installation_requests,
    public.installation_tasks
TO service_role;


-- -------------------------------------------------------------------------------------------------
-- 5. REQUEST POLICIES
-- -------------------------------------------------------------------------------------------------

CREATE POLICY installation_requests_read_scope
ON public.installation_requests
FOR SELECT
TO authenticated
USING (
    (
        SELECT private.current_account_is_active()
    )
    AND (
        customer_id = auth.uid()
        OR requested_by = auth.uid()
        OR private.current_role_is(
            ARRAY[
                'sales'::text,
                'supervisor'::text,
                'admin'::text,
                'super_admin'::text
            ]
        )
    )
);


CREATE POLICY installation_requests_supervisor_insert
ON public.installation_requests
FOR INSERT
TO authenticated
WITH CHECK (
    private.current_role_is(
        ARRAY[
            'supervisor'::text,
            'admin'::text,
            'super_admin'::text
        ]
    )
);


CREATE POLICY installation_requests_supervisor_update
ON public.installation_requests
FOR UPDATE
TO authenticated
USING (
    private.current_role_is(
        ARRAY[
            'supervisor'::text,
            'admin'::text,
            'super_admin'::text
        ]
    )
)
WITH CHECK (
    private.current_role_is(
        ARRAY[
            'supervisor'::text,
            'admin'::text,
            'super_admin'::text
        ]
    )
);


-- -------------------------------------------------------------------------------------------------
-- 6. TASK POLICIES
-- -------------------------------------------------------------------------------------------------

CREATE POLICY installation_tasks_read_scope
ON public.installation_tasks
FOR SELECT
TO authenticated
USING (
    (
        SELECT private.current_account_is_active()
    )
    AND (
        assigned_agent_id = auth.uid()
        OR EXISTS (
            SELECT 1
            FROM public.installation_requests request_row
            WHERE
                request_row.id = installation_tasks.request_id
                AND request_row.customer_id = auth.uid()
        )
        OR private.current_role_is(
            ARRAY[
                'sales'::text,
                'supervisor'::text,
                'admin'::text,
                'super_admin'::text
            ]
        )
    )
);


CREATE POLICY installation_tasks_supervisor_insert
ON public.installation_tasks
FOR INSERT
TO authenticated
WITH CHECK (
    private.current_role_is(
        ARRAY[
            'supervisor'::text,
            'admin'::text,
            'super_admin'::text
        ]
    )
);


CREATE POLICY installation_tasks_supervisor_update
ON public.installation_tasks
FOR UPDATE
TO authenticated
USING (
    private.current_role_is(
        ARRAY[
            'supervisor'::text,
            'admin'::text,
            'super_admin'::text
        ]
    )
)
WITH CHECK (
    private.current_role_is(
        ARRAY[
            'supervisor'::text,
            'admin'::text,
            'super_admin'::text
        ]
    )
);


-- -------------------------------------------------------------------------------------------------
-- 7. STRICT POSTCONDITIONS
-- -------------------------------------------------------------------------------------------------

DO $h4_a1_postconditions$
DECLARE
    v_requests_rls boolean;
    v_tasks_rls boolean;
    v_request_policies integer;
    v_task_policies integer;
    v_request_rows bigint;
    v_task_rows bigint;
BEGIN
    IF to_regclass('public.installation_requests') IS NULL
       OR to_regclass('public.installation_tasks') IS NULL THEN
        RAISE EXCEPTION
            'H4-A1 post: generic installation tables missing';
    END IF;


    SELECT c.relrowsecurity
    INTO v_requests_rls
    FROM pg_class c
    JOIN pg_namespace n
      ON n.oid = c.relnamespace
    WHERE
        n.nspname = 'public'
        AND c.relname = 'installation_requests';

    SELECT c.relrowsecurity
    INTO v_tasks_rls
    FROM pg_class c
    JOIN pg_namespace n
      ON n.oid = c.relnamespace
    WHERE
        n.nspname = 'public'
        AND c.relname = 'installation_tasks';

    IF v_requests_rls IS NOT TRUE
       OR v_tasks_rls IS NOT TRUE THEN
        RAISE EXCEPTION
            'H4-A1 post: RLS is not enabled on both generic tables';
    END IF;


    SELECT COUNT(*)
    INTO v_request_policies
    FROM pg_policies
    WHERE
        schemaname = 'public'
        AND tablename = 'installation_requests';

    SELECT COUNT(*)
    INTO v_task_policies
    FROM pg_policies
    WHERE
        schemaname = 'public'
        AND tablename = 'installation_tasks';

    IF v_request_policies <> 3
       OR v_task_policies <> 3 THEN
        RAISE EXCEPTION
            'H4-A1 post: unexpected policy count requests=%, tasks=%',
            v_request_policies,
            v_task_policies;
    END IF;


    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE
            conname = 'installation_requests_customer_order_link_check'
            AND conrelid = 'public.installation_requests'::regclass
    ) THEN
        RAISE EXCEPTION
            'H4-A1 post: customer-order source guard missing';
    END IF;


    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE
            conname = 'installation_tasks_assignment_state_check'
            AND conrelid = 'public.installation_tasks'::regclass
    ) THEN
        RAISE EXCEPTION
            'H4-A1 post: task lifecycle guard missing';
    END IF;


    IF to_regclass(
        'public.installation_requests_one_per_order_uidx'
    ) IS NULL
       OR to_regclass(
        'public.installation_tasks_active_beacon_uidx'
    ) IS NULL
       OR to_regclass(
        'public.installation_tasks_installation_uidx'
    ) IS NULL THEN
        RAISE EXCEPTION
            'H4-A1 post: critical unique index missing';
    END IF;


    IF has_table_privilege(
        'anon',
        'public.installation_requests',
        'SELECT'
    )
       OR has_table_privilege(
        'anon',
        'public.installation_tasks',
        'SELECT'
    ) THEN
        RAISE EXCEPTION
            'H4-A1 post: anon access must remain disabled';
    END IF;


    IF NOT has_table_privilege(
        'authenticated',
        'public.installation_requests',
        'SELECT'
    )
       OR NOT has_table_privilege(
        'authenticated',
        'public.installation_requests',
        'INSERT'
    )
       OR NOT has_table_privilege(
        'authenticated',
        'public.installation_requests',
        'UPDATE'
    )
       OR has_table_privilege(
        'authenticated',
        'public.installation_requests',
        'DELETE'
    )
       OR NOT has_table_privilege(
        'authenticated',
        'public.installation_tasks',
        'SELECT'
    )
       OR NOT has_table_privilege(
        'authenticated',
        'public.installation_tasks',
        'INSERT'
    )
       OR NOT has_table_privilege(
        'authenticated',
        'public.installation_tasks',
        'UPDATE'
    )
       OR has_table_privilege(
        'authenticated',
        'public.installation_tasks',
        'DELETE'
    ) THEN
        RAISE EXCEPTION
            'H4-A1 post: authenticated grant contract invalid';
    END IF;


    IF NOT has_table_privilege(
        'service_role',
        'public.installation_requests',
        'DELETE'
    )
       OR NOT has_table_privilege(
        'service_role',
        'public.installation_tasks',
        'DELETE'
    ) THEN
        RAISE EXCEPTION
            'H4-A1 post: service_role ALL privilege missing';
    END IF;


    SELECT COUNT(*)
    INTO v_request_rows
    FROM public.installation_requests;

    SELECT COUNT(*)
    INTO v_task_rows
    FROM public.installation_tasks;

    IF v_request_rows <> 0
       OR v_task_rows <> 0 THEN
        RAISE EXCEPTION
            'H4-A1 post: foundation migration must not backfill business rows';
    END IF;
END
$h4_a1_postconditions$;


COMMIT;
