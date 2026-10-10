-- MAPS-FOUNDATION-M1
-- Additive internal metadata foundation for Adresse GN Maps.
-- No road graph, no routing engine, no OSM import, no Core-table mutation.

CREATE SCHEMA IF NOT EXISTS maps;

REVOKE ALL ON SCHEMA maps FROM PUBLIC;
REVOKE ALL ON SCHEMA maps FROM anon, authenticated;
GRANT USAGE ON SCHEMA maps TO service_role;

CREATE TABLE maps.datasets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source_provider text NOT NULL,
    source_name text NOT NULL,
    source_version text NOT NULL,
    source_reference text NULL,
    source_timestamp timestamptz NOT NULL,
    checksum_sha256 text NOT NULL,
    license_name text NOT NULL,
    license_url text NULL,
    acquired_at timestamptz NOT NULL,
    imported_at timestamptz NULL,
    coverage_bbox geography(Polygon,4326) NULL,
    status text NOT NULL,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT maps_datasets_source_identity_key
        UNIQUE (source_provider, source_name, source_version, checksum_sha256),

    CONSTRAINT maps_datasets_source_provider_not_blank
        CHECK (btrim(source_provider) <> ''),

    CONSTRAINT maps_datasets_source_name_not_blank
        CHECK (btrim(source_name) <> ''),

    CONSTRAINT maps_datasets_source_version_not_blank
        CHECK (btrim(source_version) <> ''),

    CONSTRAINT maps_datasets_checksum_sha256_format
        CHECK (checksum_sha256 ~ '^[0-9a-f]{64}$'),

    CONSTRAINT maps_datasets_license_name_not_blank
        CHECK (btrim(license_name) <> ''),

    CONSTRAINT maps_datasets_status_check
        CHECK (
            status IN (
                'registered',
                'validated',
                'importing',
                'imported',
                'failed',
                'superseded'
            )
        ),

    CONSTRAINT maps_datasets_metadata_is_object
        CHECK (jsonb_typeof(metadata) = 'object'),

    CONSTRAINT maps_datasets_imported_after_acquired
        CHECK (imported_at IS NULL OR imported_at >= acquired_at)
);

CREATE INDEX maps_datasets_status_idx
    ON maps.datasets (status);

CREATE INDEX maps_datasets_source_timestamp_idx
    ON maps.datasets (source_timestamp DESC);

CREATE INDEX maps_datasets_coverage_bbox_idx
    ON maps.datasets
    USING gist (coverage_bbox)
    WHERE coverage_bbox IS NOT NULL;

ALTER TABLE maps.datasets
ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE maps.datasets FROM PUBLIC;
REVOKE ALL ON TABLE maps.datasets FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE maps.datasets
TO service_role;

COMMENT ON TABLE maps.datasets IS
'Versioned geodata dataset registry for Adresse GN Maps. Internal backend access only.';

COMMENT ON COLUMN maps.datasets.coverage_bbox IS
'Optional source coverage envelope in WGS84 geography Polygon, SRID 4326.';

COMMENT ON COLUMN maps.datasets.checksum_sha256 IS
'Lowercase SHA-256 checksum of the immutable source snapshot.';

CREATE TABLE maps.import_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_id uuid NOT NULL
        REFERENCES maps.datasets(id)
        ON DELETE RESTRICT,
    importer_name text NOT NULL,
    importer_version text NOT NULL,
    started_at timestamptz NOT NULL DEFAULT now(),
    finished_at timestamptz NULL,
    status text NOT NULL,
    rows_read bigint NOT NULL DEFAULT 0,
    rows_written bigint NOT NULL DEFAULT 0,
    rows_rejected bigint NOT NULL DEFAULT 0,
    error_summary text NULL,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT maps_import_runs_importer_name_not_blank
        CHECK (btrim(importer_name) <> ''),

    CONSTRAINT maps_import_runs_importer_version_not_blank
        CHECK (btrim(importer_version) <> ''),

    CONSTRAINT maps_import_runs_status_check
        CHECK (
            status IN (
                'pending',
                'running',
                'succeeded',
                'failed',
                'cancelled'
            )
        ),

    CONSTRAINT maps_import_runs_rows_read_nonnegative
        CHECK (rows_read >= 0),

    CONSTRAINT maps_import_runs_rows_written_nonnegative
        CHECK (rows_written >= 0),

    CONSTRAINT maps_import_runs_rows_rejected_nonnegative
        CHECK (rows_rejected >= 0),

    CONSTRAINT maps_import_runs_metadata_is_object
        CHECK (jsonb_typeof(metadata) = 'object'),

    CONSTRAINT maps_import_runs_finished_after_started
        CHECK (finished_at IS NULL OR finished_at >= started_at)
);

CREATE INDEX maps_import_runs_dataset_id_idx
    ON maps.import_runs (dataset_id);

CREATE INDEX maps_import_runs_status_idx
    ON maps.import_runs (status);

CREATE INDEX maps_import_runs_started_at_idx
    ON maps.import_runs (started_at DESC);

ALTER TABLE maps.import_runs
ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE maps.import_runs FROM PUBLIC;
REVOKE ALL ON TABLE maps.import_runs FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE maps.import_runs
TO service_role;

COMMENT ON TABLE maps.import_runs IS
'Audited import-attempt registry for versioned Adresse GN Maps datasets. Internal backend access only.';

COMMENT ON COLUMN maps.import_runs.error_summary IS
'Human-readable import failure summary; no secret material must be stored here.';
