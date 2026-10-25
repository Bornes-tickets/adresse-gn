from __future__ import annotations

from typing import Any

from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from .action_admin import (
    account_deactivate,
    account_reactivate,
    account_set_role,
    address_reassign_owner,
    address_update,
    agent_update,
    doc_review,
    generate_beacon_batch,
    zone_deactivate,
    zone_save,
)
from .action_catalog import (
    ACTION_DEFINITIONS,
    catalog_for_role,
    definition,
)
from .action_cms import cms_delete, cms_save
from .action_external import (
    create_agent as external_create_agent,
    create_user as external_create_user,
    deactivate_account_synced,
    delete_install_document,
    reactivate_account_synced,
    reset_password as external_reset_password,
    upload_install_document,
    view_install_document,
)
from .export_payloads import (
    dn_export_payload,
    po_export_payload,
    qr_export_payload,
)
from .action_common import ActionError, optional_text, required_text
from .action_ops import (
    create_invoice,
    dispute,
    generate_dn,
    generate_po,
    lot_add_event,
    lot_set_status,
    record_payment,
    supplier_upsert,
    update_po,
)
from .action_supervisor import (
    claim_decide,
    installation_reject,
    installation_validate,
    planning_create,
    planning_delete,
    planning_update,
    qc_draw,
    report_update,
)
from .physical_installation_workflow import (
    PhysicalWorkflowNotFoundError,
    PhysicalWorkflowStateError,
    assign_physical_installation,
    reassign_physical_installation,
    schedule_physical_installation,
)


CMS_RESOURCES = {
    "cms_pages",
    "cms_posts",
    "cms_faq",
    "cms_translations",
    "cms_plans",
}


def _identity(request) -> dict[str, Any]:
    identity = getattr(request, "backoffice_identity", None)
    if not identity:
        raise ActionError("Identité back-office introuvable.", http_status=403)
    return identity


def get_action_catalog(request, *, resource: str) -> dict[str, Any]:
    identity = _identity(request)
    if resource not in ACTION_DEFINITIONS:
        return {"resource": resource, "role": identity.get("role"), "actions": []}
    return catalog_for_role(resource, str(identity.get("role")))


def _assert_access(
    request,
    *,
    resource: str,
    action: str,
) -> tuple[dict[str, Any], dict[str, Any]]:
    identity = _identity(request)
    item = definition(resource, action)
    if not item:
        raise ActionError("Action inconnue.", status="not_found", http_status=404)
    if identity.get("role") not in item["roles"]:
        raise ActionError("Accès refusé à cette action.", status="forbidden", http_status=403)
    return identity, item


def _physical_action(
    actor: dict[str, Any],
    row_id: str,
    action: str,
    data: dict[str, Any],
) -> dict[str, Any]:
    try:
        if action == "assign":
            return assign_physical_installation(
                pending_installation_id=row_id,
                actor_id=actor["user_id"],
                agent_id=required_text(data, "agent_id", "L’agent"),
            )
        if action == "reassign":
            return reassign_physical_installation(
                pending_installation_id=row_id,
                actor_id=actor["user_id"],
                agent_id=required_text(data, "agent_id", "L’agent"),
            )
        if action == "schedule":
            raw = required_text(data, "scheduled_at", "La date/heure")
            parsed = parse_datetime(raw)
            if parsed is None:
                raise ActionError("Date/heure de planification invalide.")
            if timezone.is_naive(parsed):
                parsed = timezone.make_aware(parsed, timezone.get_current_timezone())
            return schedule_physical_installation(
                pending_installation_id=row_id,
                actor_id=actor["user_id"],
                scheduled_at=parsed,
            )
    except PhysicalWorkflowNotFoundError as exc:
        raise ActionError(str(exc), status="not_found", http_status=404) from exc
    except PhysicalWorkflowStateError as exc:
        raise ActionError(str(exc), status="conflict", http_status=409) from exc
    raise ActionError("Action physique invalide.")


@transaction.atomic
def execute_action(
    request,
    *,
    resource: str,
    action: str,
    row_id: str | None,
    data: dict[str, Any],
) -> dict[str, Any]:
    actor, item = _assert_access(request, resource=resource, action=action)
    if item["scope"] == "row" and not row_id:
        raise ActionError("Identifiant de ligne obligatoire.")

    row = str(row_id) if row_id else None

    if resource == "admin_users":
        if action == "create_user":
            return external_create_user(actor, data)
        if action == "set_role":
            return account_set_role(actor, row, data)
        if action == "reset_password":
            return external_reset_password(actor, row, data)
        if action == "deactivate":
            return deactivate_account_synced(actor, row, data)
        if action == "reactivate":
            return reactivate_account_synced(actor, row, data)

    if resource == "admin_agents":
        if action == "create_agent":
            return external_create_agent(actor, data)
        if action == "update":
            return agent_update(actor, row, data)

    if resource == "admin_addresses":
        if action == "update":
            return address_update(actor, row, data)
        if action == "reassign_owner":
            return address_reassign_owner(actor, row, data)

    if resource == "admin_beacons":
        if action == "generate_batch":
            return generate_beacon_batch(actor, data)

    if resource == "admin_zones":
        if action == "save":
            return zone_save(actor, row, data)
        if action == "deactivate":
            return zone_deactivate(actor, row, data)

    if resource == "admin_justificatifs":
        if action == "upload":
            return upload_install_document(actor, data)
        if action == "view":
            return view_install_document(actor, row)
        if action == "delete":
            return delete_install_document(actor, row)
        if action == "review":
            return doc_review(actor, row, data)

    if resource == "supervisor_installations":
        if action in {"assign", "reassign", "schedule"}:
            return _physical_action(actor, row, action, data)
        if action == "draw_qc":
            return qc_draw(actor, data)
        if action == "validate":
            return installation_validate(actor, row)
        if action == "reject":
            return installation_reject(actor, row, data)

    if resource == "supervisor_planning":
        if action == "create":
            return planning_create(actor, data)
        if action == "update":
            return planning_update(actor, row, data)
        if action == "delete":
            return planning_delete(actor, row)

    if resource in {"supervisor_reports", "support_reports"} and action == "update":
        return report_update(actor, row, data)

    if resource == "supervisor_claims" and action == "decide":
        return claim_decide(actor, row, data)

    if resource == "ops_stock":
        if action == "set_status":
            return lot_set_status(actor, row, data)
        if action == "add_event":
            return lot_add_event(actor, row, data)

    if resource == "ops_exports":
        if action in {"qr_pdf", "qr_zip", "qr_csv"}:
            return qr_export_payload(row, kind=action)

    if resource == "ops_procurement":
        if action == "export_po_pdf":
            return po_export_payload(row)
        if action == "export_dn_pdf":
            return dn_export_payload(row)
        if action == "upsert_supplier":
            return supplier_upsert(actor, data)
        if action == "generate_po":
            return generate_po(actor, row)
        if action == "update_po":
            return update_po(actor, row, data)
        if action == "generate_dn":
            return generate_dn(actor, row, data)
        if action == "create_invoice":
            return create_invoice(actor, row, data)
        if action == "record_payment":
            return record_payment(actor, row, data)
        if action == "mark_dispute":
            return dispute(actor, row, data, resolve=False)
        if action == "resolve_dispute":
            return dispute(actor, row, data, resolve=True)

    if resource in CMS_RESOURCES:
        if action == "create":
            return cms_save(actor, resource, None, data)
        if action == "save":
            return cms_save(actor, resource, row, data)
        if action == "delete":
            return cms_delete(actor, resource, row)

    raise ActionError("Action non implémentée.", status="not_implemented", http_status=501)
