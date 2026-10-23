-- ================================================================================================
-- AGENT-I3-P2-P1 ? GPS RAW MEASUREMENT CONTRACT V1
--
-- Historical compatibility:
--   * Existing installation_measures rows are NOT rewritten.
--   * Existing rows keep sequence_no = NULL.
--   * Historical accuracy values above 3.0 m remain valid.
--
-- Agent V1:
--   * New Agent raw GPS rows MUST provide sequence_no 1, 2, 3.
--   * Rows carrying sequence_no are subject to strict coordinate,
--     accuracy and timestamp guards.
--   * Exactly-three cardinality is enforced transactionally by
--     the Django Agent completion service.
-- ================================================================================================

ALTER TABLE public.installation_measures
ADD COLUMN sequence_no smallint;


COMMENT ON COLUMN public.installation_measures.sequence_no IS
'Agent GPS V1 capture order (1..3). NULL identifies historical or legacy rows.';


ALTER TABLE public.installation_measures
ADD CONSTRAINT installation_measures_sequence_no_v1_check
CHECK (
    sequence_no IS NULL
    OR sequence_no BETWEEN 1 AND 3
);


ALTER TABLE public.installation_measures
ADD CONSTRAINT installation_measures_agent_v1_payload_check
CHECK (
    sequence_no IS NULL
    OR (
        installation_id IS NOT NULL

        AND lat IS NOT NULL
        AND lat BETWEEN -90 AND 90

        AND lng IS NOT NULL
        AND lng BETWEEN -180 AND 180

        AND accuracy_m IS NOT NULL
        AND accuracy_m >= 0
        AND accuracy_m <= 3.0

        AND taken_at IS NOT NULL
    )
);


CREATE UNIQUE INDEX installation_measures_installation_sequence_v1_uidx
ON public.installation_measures (
    installation_id,
    sequence_no
)
WHERE sequence_no IS NOT NULL;
