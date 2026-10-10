from __future__ import annotations

import json
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase
from rest_framework.test import (
    APIRequestFactory,
    force_authenticate,
)

from entitlements import (
    ADDRESS_NUMBER,
    DETAILED_ACCESS_NOTE,
    PHYSICAL_PLATE,
    legacy_address_capabilities,
)
from owner_portal.services import (
    OwnerCapabilityDeniedError,
    get_owner_address_capabilities,
    list_owner_beacons,
    require_owner_address_capability,
    update_owner_beacon,
)
from owner_portal.views import (
    OwnerBeaconDetailView,
)


def cursor_context(cursor):
    context = MagicMock()
    context.__enter__.return_value = cursor
    context.__exit__.return_value = False
    return context


class OwnerCapabilityResolverTests(
    SimpleTestCase
):
    @patch(
        "owner_portal.services.connection"
    )
    def test_paid_snapshot_is_used(
        self,
        connection_mock,
    ):
        cursor = MagicMock()
        cursor.fetchone.return_value = (
            "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            "active",
            "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
            "cccccccc-cccc-cccc-cccc-cccccccccccc",
            json.dumps(
                [
                    {
                        "capabilities": [
                            ADDRESS_NUMBER,
                            PHYSICAL_PLATE,
                        ]
                    }
                ]
            ),
        )

        connection_mock.cursor.return_value = (
            cursor_context(cursor)
        )

        result = (
            get_owner_address_capabilities(
                user_id=(
                    "dddddddd-dddd-dddd-dddd-dddddddddddd"
                ),
                address_id=(
                    "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
                ),
            )
        )

        self.assertEqual(
            result["source"],
            "order_snapshot",
        )

        self.assertEqual(
            result[
                "effective_capabilities"
            ],
            [
                ADDRESS_NUMBER,
                PHYSICAL_PLATE,
            ],
        )

    @patch(
        "owner_portal.services.connection"
    )
    def test_legacy_address_gets_conservative_baseline(
        self,
        connection_mock,
    ):
        cursor = MagicMock()
        cursor.fetchone.return_value = (
            "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            "active",
            "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
            None,
            None,
        )

        connection_mock.cursor.return_value = (
            cursor_context(cursor)
        )

        result = (
            get_owner_address_capabilities(
                user_id=(
                    "dddddddd-dddd-dddd-dddd-dddddddddddd"
                ),
                address_id=(
                    "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
                ),
            )
        )

        self.assertEqual(
            result["source"],
            "legacy_baseline",
        )

        self.assertEqual(
            result[
                "effective_capabilities"
            ],
            legacy_address_capabilities(),
        )

    @patch(
        "owner_portal.services.connection"
    )
    def test_paid_order_without_snapshot_uses_legacy_baseline(
        self,
        connection_mock,
    ):
        cursor = MagicMock()
        cursor.fetchone.return_value = (
            "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            "active",
            "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
            "cccccccc-cccc-cccc-cccc-cccccccccccc",
            json.dumps(
                [
                    {
                        "fulfillment_kind": (
                            "digital_address"
                        )
                    }
                ]
            ),
        )

        connection_mock.cursor.return_value = (
            cursor_context(cursor)
        )

        result = (
            get_owner_address_capabilities(
                user_id=(
                    "dddddddd-dddd-dddd-dddd-dddddddddddd"
                ),
                address_id=(
                    "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
                ),
            )
        )

        self.assertEqual(
            result[
                "effective_capabilities"
            ],
            legacy_address_capabilities(),
        )
        self.assertEqual(
            result["source"],
            "legacy_order_without_snapshot",
        )

    @patch(
        "owner_portal.services.connection"
    )
    def test_inactive_address_suspends_effective_rights(
        self,
        connection_mock,
    ):
        cursor = MagicMock()
        cursor.fetchone.return_value = (
            "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            "suspended",
            "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
            None,
            None,
        )

        connection_mock.cursor.return_value = (
            cursor_context(cursor)
        )

        result = (
            get_owner_address_capabilities(
                user_id=(
                    "dddddddd-dddd-dddd-dddd-dddddddddddd"
                ),
                address_id=(
                    "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
                ),
            )
        )

        self.assertEqual(
            result[
                "effective_capabilities"
            ],
            [],
        )

    @patch(
        (
            "owner_portal.services."
            "get_owner_address_capabilities"
        )
    )
    def test_require_capability_denies_missing_right(
        self,
        resolver_mock,
    ):
        resolver_mock.return_value = {
            "effective_capabilities": [
                ADDRESS_NUMBER,
            ]
        }

        with self.assertRaises(
            OwnerCapabilityDeniedError
        ):
            require_owner_address_capability(
                user_id=(
                    "dddddddd-dddd-dddd-dddd-dddddddddddd"
                ),
                address_id=(
                    "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
                ),
                capability=PHYSICAL_PLATE,
            )


class OwnerCapabilityExposureTests(
    SimpleTestCase
):
    @patch(
        "owner_portal.services.connection"
    )
    def test_owner_list_exposes_paid_snapshot_capabilities(
        self,
        connection_mock,
    ):
        address_cursor = MagicMock()
        address_cursor.fetchall.return_value = [
            (
                "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
                "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
                "GN-CKY-123456",
                "Maison Test",
                "habitation",
                "private",
                "verified",
                "active",
                "Repère historique",
                None,
                "cccccccc-cccc-cccc-cccc-cccccccccccc",
                json.dumps(
                    [
                        {
                            "capabilities": [
                                ADDRESS_NUMBER,
                                DETAILED_ACCESS_NOTE,
                            ]
                        }
                    ]
                ),
            )
        ]

        search_cursor = MagicMock()
        search_cursor.fetchall.return_value = []

        connection_mock.cursor.side_effect = [
            cursor_context(
                address_cursor
            ),
            cursor_context(
                search_cursor
            ),
        ]

        items = list_owner_beacons(
            user_id=(
                "dddddddd-dddd-dddd-dddd-dddddddddddd"
            ),
        )

        self.assertEqual(
            items[0][
                "effective_capabilities"
            ],
            [
                ADDRESS_NUMBER,
                DETAILED_ACCESS_NOTE,
            ],
        )


class OwnerDetailedAccessNoteEnforcementTests(
    SimpleTestCase
):
    def _update_core(self):
        return getattr(
            update_owner_beacon,
            "__wrapped__",
            update_owner_beacon,
        )

    @patch(
        "owner_portal.services.connection"
    )
    @patch(
        (
            "owner_portal.services."
            "require_owner_address_capability"
        )
    )
    @patch(
        "owner_portal.services._lock_owned_address"
    )
    def test_unchanged_note_does_not_require_premium(
        self,
        lock_mock,
        require_mock,
        connection_mock,
    ):
        lock_mock.return_value = (
            "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
            "dddddddd-dddd-dddd-dddd-dddddddddddd",
            "Maison Test",
            "habitation",
            "private",
            "active",
            "Repère historique",
        )

        cursor = MagicMock()
        cursor.rowcount = 1
        connection_mock.cursor.return_value = (
            cursor_context(cursor)
        )

        result = self._update_core()(
            user_id=(
                "dddddddd-dddd-dddd-dddd-dddddddddddd"
            ),
            address_id=(
                "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
            ),
            name="Maison Test",
            category="habitation",
            visibility="private",
            access_point_note=(
                " Repère historique "
            ),
            access_point_note_provided=True,
        )

        require_mock.assert_not_called()
        self.assertTrue(
            result["ok"]
        )

    @patch(
        "owner_portal.services.connection"
    )
    @patch(
        (
            "owner_portal.services."
            "require_owner_address_capability"
        )
    )
    @patch(
        "owner_portal.services._lock_owned_address"
    )
    def test_changed_note_requires_detailed_access_note(
        self,
        lock_mock,
        require_mock,
        connection_mock,
    ):
        lock_mock.return_value = (
            "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
            "dddddddd-dddd-dddd-dddd-dddddddddddd",
            "Maison Test",
            "habitation",
            "private",
            "active",
            "Repère historique",
        )

        cursor = MagicMock()
        cursor.rowcount = 1
        connection_mock.cursor.return_value = (
            cursor_context(cursor)
        )

        self._update_core()(
            user_id=(
                "dddddddd-dddd-dddd-dddd-dddddddddddd"
            ),
            address_id=(
                "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
            ),
            name="Maison Test",
            category="habitation",
            visibility="private",
            access_point_note=(
                "Nouveau repère"
            ),
            access_point_note_provided=True,
        )

        require_mock.assert_called_once_with(
            user_id=(
                "dddddddd-dddd-dddd-dddd-dddddddddddd"
            ),
            address_id=(
                "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
            ),
            capability=(
                DETAILED_ACCESS_NOTE
            ),
        )

    @patch(
        "owner_portal.services.connection"
    )
    @patch(
        (
            "owner_portal.services."
            "require_owner_address_capability"
        )
    )
    @patch(
        "owner_portal.services._lock_owned_address"
    )
    def test_omitted_note_preserves_legacy_value_without_guard(
        self,
        lock_mock,
        require_mock,
        connection_mock,
    ):
        lock_mock.return_value = (
            "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
            "dddddddd-dddd-dddd-dddd-dddddddddddd",
            "Maison Test",
            "habitation",
            "private",
            "active",
            "Repère historique",
        )

        cursor = MagicMock()
        cursor.rowcount = 1
        connection_mock.cursor.return_value = (
            cursor_context(cursor)
        )

        self._update_core()(
            user_id=(
                "dddddddd-dddd-dddd-dddd-dddddddddddd"
            ),
            address_id=(
                "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
            ),
            name="Maison Test",
            category="habitation",
            visibility="private",
            access_point_note=None,
            access_point_note_provided=False,
        )

        require_mock.assert_not_called()

        params = (
            cursor.execute
            .call_args_list[0]
            .args[1]
        )

        self.assertEqual(
            params[3],
            "Repère historique",
        )


class OwnerCapabilityViewTests(
    SimpleTestCase
):
    @patch(
        "owner_portal.views.update_owner_beacon"
    )
    def test_update_maps_capability_denial_to_403(
        self,
        update_mock,
    ):
        update_mock.side_effect = (
            OwnerCapabilityDeniedError(
                "Cette fonctionnalité n'est pas disponible "
                "pour cette adresse."
            )
        )

        factory = APIRequestFactory()

        request = factory.patch(
            (
                "/api/v1/owner/addresses/"
                "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/"
            ),
            {
                "category": "habitation",
                "visibility": "private",
                "access_point_note": (
                    "Nouveau repère"
                ),
            },
            format="json",
        )

        force_authenticate(
            request,
            user=SimpleNamespace(
                id=(
                    "dddddddd-dddd-dddd-dddd-dddddddddddd"
                ),
                is_authenticated=True,
            ),
        )

        response = (
            OwnerBeaconDetailView
            .as_view()(
                request,
                address_id=(
                    "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
                ),
            )
        )

        self.assertEqual(
            response.status_code,
            403,
        )

        self.assertIn(
            "fonctionnalité",
            response.data["detail"],
        )
