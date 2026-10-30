from __future__ import annotations

import json
from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from django.db import connection
from rest_framework.exceptions import PermissionDenied


PAGE_SIZE_MAX = 100


RESOURCE_ROLES = {
    "admin_agents": {
        "admin",
        "super_admin",
    },
    "admin_users": {
        "admin",
        "super_admin",
    },
    "admin_zones": {
        "admin",
        "super_admin",
    },
    "admin_beacons": {
        "admin",
        "super_admin",
    },
    "admin_analytics": {
        "admin",
        "super_admin",
    },
    "admin_audit": {
        "admin",
        "super_admin",
    },
    "admin_justificatifs": {
        "admin",
        "super_admin",
    },
    "cms_overview": {
        "admin",
        "super_admin",
    },
    "cms_posts": {
        "admin",
        "super_admin",
    },
    "cms_faq": {
        "admin",
        "super_admin",
    },
    "cms_pages": {
        "admin",
        "super_admin",
    },
    "cms_plans": {
        "admin",
        "super_admin",
    },
    "cms_translations": {
        "admin",
        "super_admin",
    },
    "supervisor_consultations": {
        "supervisor",
        "admin",
        "super_admin",
    },
    "supervisor_available_beacons": {
        "supervisor",
        "admin",
        "super_admin",
    },
    "supervisor_installations": {
        "supervisor",
        "admin",
        "super_admin",
    },
    "supervisor_planning": {
        "supervisor",
        "admin",
        "super_admin",
    },
    "supervisor_installation_report": {
        "supervisor",
        "admin",
        "super_admin",
    },
    "supervisor_reports": {
        "supervisor",
        "admin",
        "super_admin",
    },
    "supervisor_claims": {
        "supervisor",
        "admin",
        "super_admin",
    },
    "ops_beacons": {
        "ops",
        "admin",
        "super_admin",
    },
    "ops_stock": {
        "ops",
        "admin",
        "super_admin",
    },
    "ops_procurement": {
        "ops",
        "admin",
        "super_admin",
    },
    "ops_exports": {
        "ops",
        "admin",
        "super_admin",
    },
    "sales_subscriptions": {
        "sales",
        "admin",
        "super_admin",
    },
    "sales_clients": {
        "sales",
        "admin",
        "super_admin",
    },
    "sales_orders": {
        "sales",
        "admin",
        "super_admin",
    },
    "sales_installations": {
        "sales",
        "admin",
        "super_admin",
    },
    "sales_offers": {
        "sales",
        "admin",
        "super_admin",
    },
    "support_reports": {
        "support",
        "admin",
        "super_admin",
    },
}


RESOURCE_CONFIGS = {
    "admin_agents": {
        "order_by": (
            "active DESC, "
            "badge_number ASC"
        ),
        "sql": """
            SELECT
                ag.id::text AS id,
                ag.badge_number,
                p.full_name,
                au.email,
                p.phone,
                ag.zone_id::text AS zone_id,
                c.name AS zone_name,
                ag.active,
                ag.hired_at,
                COUNT(i.id)::integer
                    AS installations,
                MAX(i.installed_at)
                    AS derniere_installation
            FROM public.agents ag
            LEFT JOIN public.profiles p
                ON p.id = ag.id
            LEFT JOIN auth.users au
                ON au.id = ag.id
            LEFT JOIN public.communes c
                ON c.id = ag.zone_id
            LEFT JOIN public.installations i
                ON i.agent_id = ag.id
            GROUP BY
                ag.id,
                ag.badge_number,
                p.full_name,
                au.email,
                p.phone,
                ag.zone_id,
                c.name,
                ag.active,
                ag.hired_at
        """,
    },
    "admin_users": {
        "order_by": (
            "created_at DESC NULLS LAST, "
            "email ASC NULLS LAST"
        ),
        "sql": """
            SELECT
                p.id::text AS id,
                au.email,
                p.full_name,
                p.phone,
                p.role,
                p.account_status,
                p.created_at,
                p.deactivated_at,
                p.session_valid_after
            FROM public.profiles p
            LEFT JOIN auth.users au
                ON au.id = p.id
        """,
    },
    "admin_zones": {
        "order_by": (
            "niveau ASC, "
            "name ASC"
        ),
        "sql": """
            SELECT
                'region'::text AS niveau,
                r.id::text AS id,
                r.code,
                r.name,
                NULL::text AS parent_name,
                r.stat_code,
                NULL::text AS administrative_type,
                r.is_active
            FROM public.regions r

            UNION ALL

            SELECT
                'prefecture'::text AS niveau,
                p.id::text AS id,
                p.code,
                p.name,
                r.name AS parent_name,
                p.stat_code,
                NULL::text AS administrative_type,
                p.is_active
            FROM public.prefectures p
            LEFT JOIN public.regions r
                ON r.id = p.region_id

            UNION ALL

            SELECT
                'commune'::text AS niveau,
                c.id::text AS id,
                c.code,
                c.name,
                p.name AS parent_name,
                c.stat_code,
                c.administrative_type,
                c.is_active
            FROM public.communes c
            LEFT JOIN public.prefectures p
                ON p.id = c.prefecture_id

            UNION ALL

            SELECT
                'district'::text AS niveau,
                d.id::text AS id,
                d.code,
                d.name,
                c.name AS parent_name,
                NULL::text AS stat_code,
                d.kind AS administrative_type,
                d.is_active
            FROM public.districts d
            LEFT JOIN public.communes c
                ON c.id = d.commune_id

            UNION ALL

            SELECT
                'sector'::text AS niveau,
                s.id::text AS id,
                s.code,
                s.name,
                d.name AS parent_name,
                NULL::text AS stat_code,
                NULL::text AS administrative_type,
                s.is_active
            FROM public.sectors s
            LEFT JOIN public.districts d
                ON d.id = s.district_id
        """,
    },
    "admin_beacons": {
        "order_by": (
            "created_at DESC NULLS LAST, "
            "public_number ASC"
        ),
        "sql": """
            SELECT
                b.id::text AS id,
                b.public_number,
                b.status,
                b.category,
                b.numbering_version,
                b.commune_code_at_issue,
                b.national_id,
                b.check_digit,
                l.code AS lot_code,
                b.created_at,
                b.activated_at
            FROM public.beacons b
            LEFT JOIN public.lots l
                ON l.id = b.lot_id
        """,
    },
    "admin_analytics": {
        "order_by": "metric ASC",
        "sql": """
            SELECT
                'adresses'::text AS metric,
                COUNT(*)::bigint AS valeur
            FROM public.addresses

            UNION ALL

            SELECT
                'balises',
                COUNT(*)::bigint
            FROM public.beacons

            UNION ALL

            SELECT
                'installations',
                COUNT(*)::bigint
            FROM public.installations

            UNION ALL

            SELECT
                'recherches',
                COUNT(*)::bigint
            FROM public.search_logs

            UNION ALL

            SELECT
                'itinéraires lancés',
                COUNT(*)::bigint
            FROM public.route_logs

            UNION ALL

            SELECT
                'commandes',
                COUNT(*)::bigint
            FROM public.orders

            UNION ALL

            SELECT
                'paiements réussis',
                COUNT(*)::bigint
            FROM public.payments
            WHERE status = 'success'
        """,
    },
    "admin_audit": {
        "order_by": (
            "created_at DESC NULLS LAST"
        ),
        "sql": """
            SELECT
                al.id::text AS id,
                al.action,
                al.entity,
                al.entity_id::text
                    AS entity_id,
                al.actor_id::text
                    AS actor_id,
                p.full_name
                    AS actor_name,
                al.before,
                al.after,
                al.created_at
            FROM public.audit_logs al
            LEFT JOIN public.profiles p
                ON p.id = al.actor_id
        """,
    },
    "admin_justificatifs": {
        "order_by": (
            "created_at DESC NULLS LAST"
        ),
        "sql": """
            SELECT
                d.id::text AS id,
                d.pending_installation_id::text
                    AS pending_installation_id,
                pi.status
                    AS installation_status,
                d.kind,
                d.label,
                d.mime_type,
                d.size_bytes,
                d.status,
                d.review_note,
                d.storage_path,
                d.uploaded_by::text
                    AS uploaded_by,
                d.reviewed_by::text
                    AS reviewed_by,
                d.reviewed_at,
                d.created_at
            FROM public.pending_installation_docs d
            LEFT JOIN public.pending_installations pi
                ON pi.id = d.pending_installation_id
        """,
    },
    "cms_overview": {
        "order_by": "module ASC",
        "sql": """
            SELECT
                'Blog'::text AS module,
                COUNT(*)::bigint AS total
            FROM public.cms_posts

            UNION ALL

            SELECT
                'FAQ',
                COUNT(*)::bigint
            FROM public.cms_faq

            UNION ALL

            SELECT
                'Pages',
                COUNT(*)::bigint
            FROM public.cms_pages

            UNION ALL

            SELECT
                'Tarifs',
                COUNT(*)::bigint
            FROM public.cms_plans

            UNION ALL

            SELECT
                'Traductions',
                COUNT(*)::bigint
            FROM public.cms_translations
        """,
    },
    "cms_posts": {
        "order_by": (
            "created_at DESC NULLS LAST"
        ),
        "sql": """
            SELECT
                id::text AS id,
                slug,
                status,
                category,
                title,
                excerpt,
                body,
                seo_title,
                seo_description,
                cover_url,
                published_at,
                created_at,
                updated_at
            FROM public.cms_posts
        """,
    },
    "cms_faq": {
        "order_by": (
            "position ASC, "
            "created_at DESC NULLS LAST"
        ),
        "sql": """
            SELECT
                id::text AS id,
                category,
                question,
                answer,
                position,
                published,
                created_at,
                updated_at
            FROM public.cms_faq
        """,
    },
    "cms_pages": {
        "order_by": (
            "position ASC, "
            "created_at DESC NULLS LAST"
        ),
        "sql": """
            SELECT
                id::text AS id,
                slug,
                status,
                title,
                excerpt,
                body,
                seo_title,
                seo_description,
                cover_url,
                position,
                published_at,
                created_at,
                updated_at
            FROM public.cms_pages
        """,
    },
    "cms_plans": {
        "order_by": (
            "position ASC, "
            "name ASC"
        ),
        "sql": """
            SELECT
                id::text AS id,
                code,
                name,
                description,
                features,
                audience,
                price_gnf,
                price_from_gnf,
                price_to_gnf,
                recurring_price_gnf,
                period,
                billing_period,
                active,
                popular,
                requires_quote,
                plate_available,
                plate_included,
                installation_required,
                max_addresses,
                fulfillment_kind,
                capabilities,
                position
            FROM public.cms_plans
        """,
    },
    "cms_translations": {
        "order_by": (
            "namespace ASC, "
            "key ASC"
        ),
        "sql": """
            SELECT
                id::text AS id,
                namespace,
                key,
                fr,
                en,
                ar,
                created_at,
                updated_at
            FROM public.cms_translations
        """,
    },
    "supervisor_consultations": {
        "order_by": "module ASC",
        "sql": """
            SELECT
                'Adresses'::text AS module,
                COUNT(*)::bigint AS total,
                COUNT(*) FILTER (
                    WHERE status = 'active'
                )::bigint AS actifs
            FROM public.addresses

            UNION ALL

            SELECT
                'Balises',
                COUNT(*)::bigint,
                COUNT(*) FILTER (
                    WHERE status = 'active'
                )::bigint
            FROM public.beacons

            UNION ALL

            SELECT
                'Lots',
                COUNT(*)::bigint,
                COUNT(*) FILTER (
                    WHERE status = 'received'
                )::bigint
            FROM public.lots

            UNION ALL

            SELECT
                'Agents',
                COUNT(*)::bigint,
                COUNT(*) FILTER (
                    WHERE active IS TRUE
                )::bigint
            FROM public.agents

            UNION ALL

            SELECT
                'Communes',
                COUNT(*)::bigint,
                COUNT(*) FILTER (
                    WHERE is_active IS TRUE
                )::bigint
            FROM public.communes
        """,
    },
    "supervisor_available_beacons": {
        "order_by": (
            "commune_code_at_issue ASC, "
            "category ASC, "
            "public_number ASC"
        ),
        "sql": """
            SELECT
                b.id::text AS id,
                b.public_number,
                b.status,
                b.category,
                b.numbering_version,
                b.commune_code_at_issue,
                l.code AS lot_code,
                l.status AS lot_status,
                l.received_at,
                l.supplier,
                b.created_at
            FROM public.beacons b
            JOIN public.lots l
              ON l.id = b.lot_id
            WHERE
                b.numbering_version = 'v1'
                AND b.status = 'available'
                AND b.assigned_agent_id IS NULL
                AND b.category <> 'digital_only'
        """,
    },
    "supervisor_installations": {
        "order_by": (
            "activity_at DESC NULLS LAST, "
            "id ASC"
        ),
        "sql": """
            SELECT
                it.id::text AS id,
                'dispatch'::text AS record_kind,
                it.status,
                it.beacon_id::text AS beacon_id,
                it.assigned_agent_id::text AS assigned_agent_id,
                COALESCE(o.order_ref, ir.reference) AS order_ref,
                b.public_number,
                b.numbering_version,
                b.status AS beacon_status,
                ag.badge_number AS agent_badge,
                p.full_name AS agent_name,
                it.scheduled_at,
                it.completed_at,
                NULL::numeric AS gps_lat,
                NULL::numeric AS gps_lng,
                NULL::numeric AS accuracy_m,
                NULL::text AS photo_url,
                NULL::timestamptz AS installed_at,
                NULL::timestamptz AS validated_at,
                NULL::text AS validation_status,
                NULL::timestamptz AS uninstalled_at,
                it.notes AS note,
                it.updated_at AS activity_at
            FROM public.installation_tasks it
            JOIN public.installation_requests ir
                ON ir.id = it.request_id
            LEFT JOIN public.orders o
                ON o.id = ir.order_id
            LEFT JOIN public.beacons b
                ON b.id = it.beacon_id
            LEFT JOIN public.agents ag
                ON ag.id = it.assigned_agent_id
            LEFT JOIN public.profiles p
                ON p.id = it.assigned_agent_id
            LEFT JOIN public.pending_installations legacy_pi
                ON ir.source_type = 'customer_order'
               AND legacy_pi.order_id = ir.order_id
            WHERE
                ir.status IN ('approved', 'in_progress')
                AND it.status IN ('pending', 'assigned', 'planned')
                AND (
                    ir.source_type <> 'customer_order'
                    OR legacy_pi.id IS NULL
                    OR legacy_pi.status IN ('pending', 'assigned', 'planned')
                )

            UNION ALL

            SELECT
                pi.id::text AS id,
                'dispatch'::text AS record_kind,
                pi.status,
                pi.beacon_id::text AS beacon_id,
                pi.assigned_agent_id::text AS assigned_agent_id,
                o.order_ref,
                b.public_number,
                b.numbering_version,
                b.status AS beacon_status,
                ag.badge_number AS agent_badge,
                p.full_name AS agent_name,
                pi.scheduled_at,
                pi.completed_at,
                NULL::numeric AS gps_lat,
                NULL::numeric AS gps_lng,
                NULL::numeric AS accuracy_m,
                NULL::text AS photo_url,
                NULL::timestamptz AS installed_at,
                NULL::timestamptz AS validated_at,
                NULL::text AS validation_status,
                NULL::timestamptz AS uninstalled_at,
                pi.note,
                pi.created_at AS activity_at
            FROM public.pending_installations pi
            LEFT JOIN public.orders o
                ON o.id = pi.order_id
            LEFT JOIN public.beacons b
                ON b.id = pi.beacon_id
            LEFT JOIN public.agents ag
                ON ag.id = pi.assigned_agent_id
            LEFT JOIN public.profiles p
                ON p.id = pi.assigned_agent_id
            WHERE
                pi.status IN ('pending', 'assigned', 'planned')
                AND NOT EXISTS (
                    SELECT 1
                    FROM public.installation_requests irx
                    JOIN public.installation_tasks itx
                      ON itx.request_id = irx.id
                    WHERE
                        irx.source_type = 'customer_order'
                        AND irx.order_id = pi.order_id
                        AND itx.status <> 'cancelled'
                )

            UNION ALL

            SELECT
                i.id::text AS id,
                'qc'::text AS record_kind,
                NULL::text AS status,
                i.beacon_id::text AS beacon_id,
                i.agent_id::text AS assigned_agent_id,
                o.order_ref,
                b.public_number,
                b.numbering_version,
                b.status AS beacon_status,
                ag.badge_number AS agent_badge,
                p.full_name AS agent_name,
                NULL AS scheduled_at,
                NULL AS completed_at,
                i.gps_lat,
                i.gps_lng,
                i.accuracy_m,
                i.photo_url,
                i.installed_at,
                i.validated_at,
                CASE
                    WHEN i.uninstalled_at IS NOT NULL THEN 'uninstalled'
                    WHEN i.validated_at IS NOT NULL THEN 'validated'
                    ELSE 'pending'
                END AS validation_status,
                i.uninstalled_at,
                NULL::text AS note,
                i.installed_at AS activity_at
            FROM public.installations i
            LEFT JOIN public.beacons b
                ON b.id = i.beacon_id
            LEFT JOIN public.agents ag
                ON ag.id = i.agent_id
            LEFT JOIN public.profiles p
                ON p.id = i.agent_id
            LEFT JOIN public.order_sites os
                ON os.id = i.order_site_id
            LEFT JOIN public.orders o
                ON o.id = os.order_id
        """,
    },
    "supervisor_planning": {
        "order_by": (
            "scheduled_date DESC, "
            "created_at DESC"
        ),
        "sql": """
            SELECT
                it.id::text AS id,
                'generic_task'::text AS record_kind,
                it.beacon_id::text AS beacon_id,
                it.assigned_agent_id::text AS agent_id,
                it.commune_id::text AS commune_id,
                it.scheduled_at::date AS scheduled_date,
                it.status,
                b.public_number,
                ag.badge_number AS agent_badge,
                p.full_name AS agent_name,
                c.name AS commune_name,
                it.address_line AS address_hint,
                it.notes,
                it.created_at,
                it.updated_at
            FROM public.installation_tasks it
            JOIN public.installation_requests ir
                ON ir.id = it.request_id
            LEFT JOIN public.beacons b
                ON b.id = it.beacon_id
            LEFT JOIN public.agents ag
                ON ag.id = it.assigned_agent_id
            LEFT JOIN public.profiles p
                ON p.id = it.assigned_agent_id
            LEFT JOIN public.communes c
                ON c.id = it.commune_id
            LEFT JOIN public.pending_installations legacy_pi
                ON ir.source_type = 'customer_order'
               AND legacy_pi.order_id = ir.order_id
            WHERE
                ir.status IN ('approved', 'in_progress')
                AND it.status = 'planned'
                AND it.scheduled_at IS NOT NULL
                AND (
                    ir.source_type <> 'customer_order'
                    OR legacy_pi.id IS NULL
                    OR legacy_pi.status = 'planned'
                )

            UNION ALL

            SELECT
                ip.id::text AS id,
                'legacy_plan'::text AS record_kind,
                ip.beacon_id::text AS beacon_id,
                ip.agent_id::text AS agent_id,
                ip.commune_id::text AS commune_id,
                ip.scheduled_date,
                ip.status,
                b.public_number,
                ag.badge_number AS agent_badge,
                p.full_name AS agent_name,
                c.name AS commune_name,
                ip.address_hint,
                ip.notes,
                ip.created_at,
                ip.updated_at
            FROM public.installation_plans ip
            LEFT JOIN public.beacons b
                ON b.id = ip.beacon_id
            LEFT JOIN public.agents ag
                ON ag.id = ip.agent_id
            LEFT JOIN public.profiles p
                ON p.id = ip.agent_id
            LEFT JOIN public.communes c
                ON c.id = ip.commune_id
        """,
    },
    "supervisor_installation_report": {
        "order_by": (
            "installed_at DESC NULLS LAST"
        ),
        "sql": """
            SELECT
                i.id::text AS id,
                b.public_number,
                b.category
                    AS beacon_category,
                ag.badge_number
                    AS agent_badge,
                c.name
                    AS commune_name,
                a.name
                    AS address_name,
                i.gps_lat,
                i.gps_lng,
                i.accuracy_m,
                i.installed_at,
                i.validated_at,
                i.uninstalled_at
            FROM public.installations i
            LEFT JOIN public.beacons b
                ON b.id = i.beacon_id
            LEFT JOIN public.agents ag
                ON ag.id = i.agent_id
            LEFT JOIN public.addresses a
                ON a.beacon_id = i.beacon_id
            LEFT JOIN public.communes c
                ON c.id = a.commune_id
        """,
    },
    "supervisor_reports": {
        "order_by": (
            "created_at DESC NULLS LAST"
        ),
        "sql": """
            SELECT
                r.id::text AS id,
                b.public_number,
                r.reason,
                r.description,
                r.status,
                reporter.full_name
                    AS reporter_name,
                r.created_at
            FROM public.reports r
            LEFT JOIN public.beacons b
                ON b.id = r.beacon_id
            LEFT JOIN public.profiles reporter
                ON reporter.id = r.reporter_id
        """,
    },
    "supervisor_claims": {
        "order_by": (
            "created_at DESC NULLS LAST"
        ),
        "sql": """
            SELECT
                cr.id::text AS id,
                b.public_number,
                cr.status,
                requester.full_name
                    AS requester_name,
                au.email
                    AS requester_email,
                requester.phone
                    AS requester_phone,
                cr.evidence,
                cr.decision_note,
                cr.created_at,
                cr.decided_at,
                decider.full_name
                    AS decided_by_name
            FROM public.claim_requests cr
            LEFT JOIN public.beacons b
                ON b.id = cr.beacon_id
            LEFT JOIN public.profiles requester
                ON requester.id = cr.requester_id
            LEFT JOIN auth.users au
                ON au.id = cr.requester_id
            LEFT JOIN public.profiles decider
                ON decider.id = cr.decided_by
        """,
    },
    "ops_beacons": {
        "order_by": (
            "created_at DESC NULLS LAST"
        ),
        "sql": """
            SELECT
                b.id::text AS id,
                b.public_number,
                b.status,
                b.category,
                b.numbering_version,
                b.commune_code_at_issue,
                l.code AS lot_code,
                ag.badge_number
                    AS assigned_agent,
                b.created_at,
                b.activated_at
            FROM public.beacons b
            LEFT JOIN public.lots l
                ON l.id = b.lot_id
            LEFT JOIN public.agents ag
                ON ag.id = b.assigned_agent_id
        """,
    },
    "ops_stock": {
        "order_by": (
            "received_at DESC NULLS LAST, "
            "code ASC"
        ),
        "sql": """
            SELECT
                l.id::text AS id,
                l.code,
                l.category,
                l.supplier,
                l.status,
                l.received_at,
                l.quantity
                    AS quantity_ordered,
                COUNT(b.id) FILTER (
                    WHERE b.status = 'generated'
                )::integer
                    AS quantity_generated,
                COUNT(b.id) FILTER (
                    WHERE b.status = 'available'
                )::integer
                    AS quantity_available,
                COUNT(b.id) FILTER (
                    WHERE b.status = 'assigned'
                )::integer
                    AS quantity_assigned,
                COUNT(b.id) FILTER (
                    WHERE b.status = 'installed'
                )::integer
                    AS quantity_installed,
                COUNT(b.id) FILTER (
                    WHERE b.status = 'active'
                )::integer
                    AS quantity_active,
                COUNT(b.id) FILTER (
                    WHERE b.status = 'suspended'
                )::integer
                    AS quantity_suspended,
                COUNT(b.id) FILTER (
                    WHERE b.status = 'cancelled'
                )::integer
                    AS quantity_cancelled,
                CASE
                    WHEN l.quantity > 0
                    THEN ROUND(
                        (
                            (
                                COUNT(b.id) FILTER (
                                    WHERE b.status
                                    IN (
                                        'assigned',
                                        'installed',
                                        'active'
                                    )
                                )
                            )::numeric
                            / l.quantity::numeric
                        ) * 100
                    )
                    ELSE 0
                END AS taux_consommation
            FROM public.lots l
            LEFT JOIN public.beacons b
                ON b.lot_id = l.id
            GROUP BY
                l.id,
                l.code,
                l.category,
                l.supplier,
                l.status,
                l.received_at,
                l.quantity
        """,
    },
    "ops_procurement": {
        "order_by": (
            "lot_received_at DESC NULLS LAST, "
            "lot_code ASC"
        ),
        "sql": """
            SELECT
                l.id::text AS id,
                po.id::text AS po_id,
                s.id::text AS supplier_id,
                dn.id::text AS dn_id,
                pi.id::text AS invoice_id,
                l.code AS lot_code,
                l.quantity,
                l.category,
                l.status AS lot_status,
                l.supplier
                    AS legacy_supplier,
                l.received_at
                    AS lot_received_at,
                l.expected_delivery,
                po.po_number,
                po.status
                    AS purchase_order_status,
                po.payment_terms,
                po.notes AS po_notes,
                s.name
                    AS supplier_name,
                po.amount_ttc
                    AS purchase_order_amount_ttc,
                po.issued_at,
                dn.dn_number,
                dn.received_at
                    AS delivery_received_at,
                dn.qc_passed,
                receipt.delivery_count,
                receipt.quantity_received_total,
                receipt.quantity_accepted_total,
                GREATEST(
                    l.quantity
                    - receipt.quantity_accepted_total,
                    0
                )::integer
                    AS quantity_remaining,
                pi.invoice_number,
                pi.payment_status,
                pi.amount_ttc
                    AS invoice_amount_ttc,
                pi.amount_paid
            FROM public.lots l
            LEFT JOIN LATERAL (
                SELECT current_po.*
                FROM public.purchase_orders current_po
                WHERE current_po.lot_id = l.id
                ORDER BY current_po.created_at DESC
                LIMIT 1
            ) po ON TRUE
            LEFT JOIN public.suppliers s
                ON s.id = po.supplier_id
            LEFT JOIN LATERAL (
                SELECT current_dn.*
                FROM public.delivery_notes current_dn
                WHERE current_dn.lot_id = l.id
                ORDER BY current_dn.created_at DESC
                LIMIT 1
            ) dn ON TRUE
            LEFT JOIN LATERAL (
                SELECT
                    COUNT(*)::integer
                        AS delivery_count,
                    COALESCE(
                        SUM(r.quantity_received),
                        0
                    )::integer
                        AS quantity_received_total,
                    COALESCE(
                        SUM(r.quantity_received) FILTER (
                            WHERE r.qc_passed IS TRUE
                        ),
                        0
                    )::integer
                        AS quantity_accepted_total
                FROM public.delivery_notes r
                WHERE r.lot_id = l.id
            ) receipt ON TRUE
            LEFT JOIN LATERAL (
                SELECT current_pi.*
                FROM public.purchase_invoices current_pi
                WHERE current_pi.lot_id = l.id
                ORDER BY current_pi.created_at DESC
                LIMIT 1
            ) pi ON TRUE
        """,
    },
    "ops_exports": {
        "order_by": (
            "received_at DESC NULLS LAST, "
            "code ASC"
        ),
        "sql": """
            SELECT
                l.id::text AS id,
                l.code,
                l.category,
                l.status,
                l.quantity,
                l.supplier,
                l.received_at,
                COUNT(b.id)::integer
                    AS balises_total,
                COUNT(b.id) FILTER (
                    WHERE b.qr_token IS NOT NULL
                )::integer
                    AS qr_disponibles
            FROM public.lots l
            LEFT JOIN public.beacons b
                ON b.lot_id = l.id
            GROUP BY
                l.id,
                l.code,
                l.category,
                l.status,
                l.quantity,
                l.supplier,
                l.received_at
        """,
    },
    "sales_subscriptions": {
        "order_by": (
            "start_date DESC NULLS LAST"
        ),
        "sql": """
            SELECT
                s.id::text AS id,
                s.plan_code,
                s.status,
                s.price_gnf,
                s.auto_renew,
                s.start_date,
                s.end_date,
                s.next_billing_date,
                p.full_name
                    AS client_name,
                au.email
                    AS client_email,
                p.phone
                    AS client_phone
            FROM public.subscriptions s
            LEFT JOIN public.profiles p
                ON p.id = s.customer_id
            LEFT JOIN auth.users au
                ON au.id = s.customer_id
        """,
    },
    "sales_clients": {
        "order_by": (
            "created_at DESC NULLS LAST"
        ),
        "sql": """
            SELECT
                p.id::text AS id,
                p.full_name,
                au.email,
                p.phone,
                p.role,
                p.account_status,
                p.created_at,
                COUNT(o.id)::integer
                    AS commandes,
                COALESCE(
                    SUM(o.amount_gnf),
                    0
                )::bigint
                    AS montant_commandes_gnf
            FROM public.profiles p
            LEFT JOIN auth.users au
                ON au.id = p.id
            LEFT JOIN public.orders o
                ON o.customer_id = p.id
            WHERE
                p.role IN (
                    'user',
                    'sales',
                    'supervisor',
                    'admin',
                    'super_admin'
                )
            GROUP BY
                p.id,
                p.full_name,
                au.email,
                p.phone,
                p.role,
                p.account_status,
                p.created_at
        """,
    },
    "sales_orders": {
        "order_by": (
            "created_at DESC NULLS LAST"
        ),
        "sql": """
            SELECT
                o.id::text AS id,
                o.order_ref,
                o.status,
                COALESCE(
                    cp.code,
                    o.offer_code,
                    o.formule_code
                ) AS offre,
                COALESCE(
                    cp.name->>'fr',
                    cp.name->>'en',
                    cp.name->>'ar',
                    o.formule_label,
                    cp.code,
                    o.offer_code,
                    o.formule_code
                ) AS offre_label,
                o.client_type,
                COALESCE(
                    o.full_name,
                    p.full_name
                ) AS client_name,
                COALESCE(
                    o.email,
                    au.email
                ) AS client_email,
                COALESCE(
                    o.phone,
                    p.phone
                ) AS client_phone,
                o.nb_adresses,
                o.amount_gnf,
                o.prix_ttc,
                o.payment_method,
                o.devis_demande,
                o.created_at,
                o.submitted_at,
                o.confirmed_at,
                o.installed_at
            FROM public.orders o
            LEFT JOIN public.cms_plans cp
                ON cp.id = o.plan_id
            LEFT JOIN public.profiles p
                ON p.id = o.customer_id
            LEFT JOIN auth.users au
                ON au.id = COALESCE(
                    o.user_id,
                    o.customer_id
                )
        """,
    },
    "sales_installations": {
        "order_by": (
            "created_at DESC NULLS LAST"
        ),
        "sql": """
            SELECT
                pi.id::text AS id,
                pi.status,
                o.order_ref,
                b.public_number,
                COALESCE(
                    o.full_name,
                    customer.full_name
                ) AS client_name,
                COALESCE(
                    pi.phone,
                    o.phone,
                    customer.phone
                ) AS phone,
                ag.badge_number
                    AS assigned_agent,
                agent_profile.full_name
                    AS agent_name,
                pi.scheduled_at,
                pi.completed_at,
                pi.note,
                pi.created_at,
                pi.updated_at
            FROM public.pending_installations pi
            LEFT JOIN public.orders o
                ON o.id = pi.order_id
            LEFT JOIN public.beacons b
                ON b.id = pi.beacon_id
            LEFT JOIN public.profiles customer
                ON customer.id = pi.customer_id
            LEFT JOIN public.agents ag
                ON ag.id = pi.assigned_agent_id
            LEFT JOIN public.profiles agent_profile
                ON agent_profile.id = pi.assigned_agent_id
        """,
    },
    "sales_offers": {
        "order_by": (
            "position ASC, "
            "name ASC"
        ),
        "sql": """
            SELECT
                id::text AS id,
                code,
                name,
                audience,
                description,
                price_gnf,
                price_from_gnf,
                price_to_gnf,
                recurring_price_gnf,
                billing_period,
                requires_quote,
                active,
                popular,
                plate_available,
                plate_included,
                installation_required,
                max_addresses,
                fulfillment_kind,
                capabilities,
                position
            FROM public.cms_plans
        """,
    },
    "support_reports": {
        "order_by": (
            "created_at DESC NULLS LAST"
        ),
        "sql": """
            SELECT
                r.id::text AS id,
                b.public_number,
                r.reason,
                r.description,
                r.status,
                reporter.full_name
                    AS reporter_name,
                au.email
                    AS reporter_email,
                reporter.phone
                    AS reporter_phone,
                r.created_at
            FROM public.reports r
            LEFT JOIN public.beacons b
                ON b.id = r.beacon_id
            LEFT JOIN public.profiles reporter
                ON reporter.id = r.reporter_id
            LEFT JOIN auth.users au
                ON au.id = r.reporter_id
        """,
    },
}


def _serialize(value):
    if value is None:
        return None

    if isinstance(
        value,
        (
            datetime,
            date,
        ),
    ):
        return value.isoformat()

    if isinstance(
        value,
        UUID,
    ):
        return str(value)

    if isinstance(
        value,
        Decimal,
    ):
        if value == value.to_integral_value():
            return int(value)

        return float(value)

    if isinstance(
        value,
        dict,
    ):
        return {
            str(key): _serialize(item)
            for key, item
            in value.items()
        }

    if isinstance(
        value,
        (
            list,
            tuple,
        ),
    ):
        return [
            _serialize(item)
            for item in value
        ]

    return value


def _column_label(
    key: str,
) -> str:
    labels = {
        "id": "ID",
        "public_number": "Numéro",
        "full_name": "Nom",
        "client_name": "Client",
        "client_email": "Email",
        "client_phone": "Téléphone",
        "agent_name": "Agent",
        "agent_badge": "Badge",
        "zone_name": "Zone",
        "commune_name": "Commune",
        "address_name": "Adresse",
        "created_at": "Créé le",
        "updated_at": "Mis à jour",
        "installed_at": "Installé le",
        "validated_at": "Validé le",
        "status": "Statut",
        "category": "Type",
        "numbering_version": "Codification",
        "commune_code_at_issue": "Code commune",
        "national_id": "Identifiant national",
        "check_digit": "Clé",
        "lot_code": "Lot",
    }

    return labels.get(
        key,
        key.replace(
            "_",
            " ",
        ).strip().capitalize(),
    )


def assert_resource_access(
    request,
    resource: str,
) -> None:
    identity = getattr(
        request,
        "backoffice_identity",
        None,
    )

    role = (
        identity.get("role")
        if identity
        else None
    )

    allowed = RESOURCE_ROLES.get(
        resource
    )

    if not allowed:
        raise PermissionDenied(
            "Ressource back-office inconnue."
        )

    if role not in allowed:
        raise PermissionDenied(
            "Accès refusé à cette ressource."
        )


def list_resource_data(
    resource: str,
    *,
    q: str = "",
    page: int = 1,
    page_size: int = 25,
) -> dict:
    config = RESOURCE_CONFIGS.get(
        resource
    )

    if not config:
        raise KeyError(
            f"Unknown resource: {resource}"
        )

    page = max(
        1,
        int(page),
    )

    page_size = min(
        PAGE_SIZE_MAX,
        max(
            1,
            int(page_size),
        ),
    )

    query = str(
        q or ""
    ).strip()

    where_sql = ""
    where_params = []

    if query:
        where_sql = (
            "WHERE "
            "row_to_json(resource_rows)::text "
            "ILIKE %s"
        )

        where_params = [
            f"%{query}%"
        ]

    base_sql = (
        config["sql"]
        .strip()
        .rstrip(";")
    )

    order_by = config[
        "order_by"
    ]

    count_sql = f"""
        WITH resource_rows AS (
            {base_sql}
        )
        SELECT COUNT(*)
        FROM resource_rows
        {where_sql}
    """

    data_sql = f"""
        WITH resource_rows AS (
            {base_sql}
        )
        SELECT *
        FROM resource_rows
        {where_sql}
        ORDER BY {order_by}
        LIMIT %s
        OFFSET %s
    """

    offset = (
        page - 1
    ) * page_size

    with connection.cursor() as cursor:
        cursor.execute(
            count_sql,
            where_params,
        )

        total = int(
            cursor.fetchone()[0]
        )

        cursor.execute(
            data_sql,
            [
                *where_params,
                page_size,
                offset,
            ],
        )

        columns = [
            description[0]
            for description
            in cursor.description
        ]

        rows = [
            {
                key: _serialize(
                    value
                )
                for key, value
                in zip(
                    columns,
                    row,
                )
            }
            for row
            in cursor.fetchall()
        ]

    return {
        "resource": resource,
        "columns": [
            {
                "key": key,
                "label": _column_label(
                    key
                ),
            }
            for key in columns
        ],
        "items": rows,
        "total": total,
        "page": page,
        "page_size": page_size,
    }