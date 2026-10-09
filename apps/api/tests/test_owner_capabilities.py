from __future__ import annotations

import json
from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase

from entitlements import (
    ADDRESS_NUMBER,
    PHYSICAL_PLATE,
    legacy_address_capabilities,
)
from owner_portal.services import (
    OwnerCapabilityDeniedError,
    get_owner_address_capabilities,
    require_owner_address_capability,
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
