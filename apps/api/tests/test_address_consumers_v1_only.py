from unittest import TestCase
from unittest.mock import patch

import addresses.services as address_services
import owner_portal.services as owner_services


V1 = "BFA01-100000000"

BEACON_ID = (
    "11111111-1111-1111-1111-111111111111"
)

FAVORITE_ID = (
    "22222222-2222-2222-2222-222222222222"
)

USER_ID = (
    "33333333-3333-3333-3333-333333333333"
)


class FakeCursor:

    def __init__(
        self,
        fetchone_results,
    ):
        self.fetchone_results = list(
            fetchone_results
        )
        self.executed = []

    def execute(
        self,
        sql,
        params=None,
    ):
        self.executed.append(
            (
                " ".join(
                    str(sql).split()
                ),
                params,
            )
        )

    def fetchone(self):
        if not self.fetchone_results:
            return None

        return self.fetchone_results.pop(0)

    def __enter__(self):
        return self

    def __exit__(
        self,
        exc_type,
        exc,
        tb,
    ):
        return False


def _address_result(number):
    return {
        "public_number": number,
        "name": "Adresse test",
        "category": "other",
        "visibility": "public",
        "verification_level": "basic",
        "access_point_note": None,
        "lat": 9.5,
        "lng": -13.7,
        "business_name": None,
        "phone": None,
        "opening_hours": None,
        "description": None,
        "cover_url": None,
    }


class AddressConsumersV1OnlyTests(
    TestCase
):

    def test_address_detail_accepts_v1(self):
        with patch.object(
            address_services,
            "_search_by_number",
            return_value=(
                _address_result(
                    V1
                )
            ),
        ) as search_mock:
            with patch.object(
                address_services,
                "_beacon_id",
                return_value=BEACON_ID,
            ) as beacon_mock:

                result = (
                    address_services
                    .get_address_detail(
                        "BFA01100000000"
                    )
                )

        self.assertEqual(
            result["status"],
            "found",
        )

        self.assertEqual(
            result["beacon_id"],
            BEACON_ID,
        )

        self.assertEqual(
            result["result"][
                "public_number"
            ],
            V1,
        )

        search_mock.assert_called_once_with(
            V1
        )

        beacon_mock.assert_called_once_with(
            V1
        )

    def test_address_detail_rejects_legacy_before_lookup(self):
        values = (
            "GN-CKY-582741",
            "GNCKY582741",
            "582741",
        )

        for value in values:
            with self.subTest(
                value=value
            ):
                with patch.object(
                    address_services,
                    "_search_by_number",
                ) as search_mock:
                    with patch.object(
                        address_services,
                        "_beacon_id",
                    ) as beacon_mock:

                        result = (
                            address_services
                            .get_address_detail(
                                value
                            )
                        )

                self.assertEqual(
                    result["status"],
                    "invalid",
                )

                search_mock.assert_not_called()
                beacon_mock.assert_not_called()

    def test_public_search_rejects_legacy_before_database(self):
        values = (
            "GN-CKY-582741",
            "GNCKY582741",
            "582741",
            "100000000",
        )

        for value in values:
            with self.subTest(
                value=value
            ):
                with patch.object(
                    address_services,
                    "_check_miss_block",
                ) as block_mock:
                    with patch.object(
                        address_services,
                        "_increment_rate_limit",
                    ) as rate_mock:
                        with patch.object(
                            address_services,
                            "_search_by_number",
                        ) as search_mock:

                            result = (
                                address_services
                                .search_address(
                                    raw_number=value,
                                    ip="127.0.0.1",
                                )
                            )

                self.assertEqual(
                    result["status"],
                    "invalid",
                )

                block_mock.assert_not_called()
                rate_mock.assert_not_called()
                search_mock.assert_not_called()

    def test_owner_favorite_rejects_legacy_before_database(self):
        core = getattr(
            owner_services
            .create_owner_favorite,
            "__wrapped__",
            owner_services
            .create_owner_favorite,
        )

        values = (
            "GN-CKY-582741",
            "GNCKY582741",
            "582741",
        )

        for value in values:
            with self.subTest(
                value=value
            ):
                with patch.object(
                    owner_services.connection,
                    "cursor",
                ) as cursor_mock:

                    with self.assertRaises(
                        owner_services
                        .OwnerFavoriteInputError
                    ):
                        core(
                            user_id=USER_ID,
                            raw_number=value,
                            alias="Test",
                        )

                cursor_mock.assert_not_called()

    def test_owner_favorite_accepts_v1(self):
        fake = FakeCursor(
            [
                (
                    BEACON_ID,
                ),
                (
                    FAVORITE_ID,
                    None,
                ),
            ]
        )

        core = getattr(
            owner_services
            .create_owner_favorite,
            "__wrapped__",
            owner_services
            .create_owner_favorite,
        )

        with patch.object(
            owner_services.connection,
            "cursor",
            return_value=fake,
        ):
            result = core(
                user_id=USER_ID,
                raw_number=(
                    "BFA01-100 000 000"
                ),
                alias="Test",
            )

        self.assertTrue(
            result["ok"]
        )

        self.assertEqual(
            result["status"],
            "created",
        )

        self.assertEqual(
            len(fake.executed),
            2,
        )

        select_sql, select_params = (
            fake.executed[0]
        )

        self.assertIn(
            "FROM public.beacons",
            select_sql,
        )

        self.assertEqual(
            select_params,
            [
                V1,
            ],
        )


class OwnerLifecycleFakeCursor:

    def __init__(
        self,
        fetchone_results,
        rowcounts,
    ):
        self.fetchone_results = list(
            fetchone_results
        )

        self.rowcounts = list(
            rowcounts
        )

        self.executed = []

        self.rowcount = -1

    def execute(
        self,
        sql,
        params=None,
    ):
        self.executed.append(
            (
                " ".join(
                    str(sql).split()
                ),
                params,
            )
        )

        if self.rowcounts:
            self.rowcount = (
                self.rowcounts.pop(0)
            )
        else:
            self.rowcount = 1

    def fetchone(self):
        if not self.fetchone_results:
            return None

        return self.fetchone_results.pop(0)

    def __enter__(self):
        return self

    def __exit__(
        self,
        exc_type,
        exc,
        tb,
    ):
        return False


OWNER_LIFECYCLE_USER_ID = (
    "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
)

OWNER_LIFECYCLE_ADDRESS_ID = (
    "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
)

OWNER_LIFECYCLE_BEACON_ID = (
    "cccccccc-cccc-cccc-cccc-cccccccccccc"
)


def _owner_address_row(
    *,
    visibility="private",
    status="active",
    access_point_note=None,
):
    return (
        OWNER_LIFECYCLE_ADDRESS_ID,
        OWNER_LIFECYCLE_BEACON_ID,
        OWNER_LIFECYCLE_USER_ID,
        "Adresse test",
        "habitation",
        visibility,
        status,
        access_point_note,
    )


class OwnerVisibilityLifecycleTests(
    TestCase
):

    def _update_core(self):
        return getattr(
            owner_services.update_owner_beacon,
            "__wrapped__",
            owner_services.update_owner_beacon,
        )

    def _suspend_core(self):
        return getattr(
            owner_services.suspend_owner_beacon,
            "__wrapped__",
            owner_services.suspend_owner_beacon,
        )

    def test_owner_cannot_publish_private_address_through_generic_update(
        self,
    ):
        fake = OwnerLifecycleFakeCursor(
            [
                _owner_address_row(
                    visibility="private",
                ),
            ],
            [
                1,
            ],
        )

        with patch.object(
            owner_services.connection,
            "cursor",
            return_value=fake,
        ):
            with self.assertRaises(
                owner_services.OwnerAddressStateError
            ):
                self._update_core()(
                    user_id=OWNER_LIFECYCLE_USER_ID,
                    address_id=OWNER_LIFECYCLE_ADDRESS_ID,
                    name="Adresse test",
                    category="habitation",
                    visibility="public",
                    access_point_note=None,
                )

        sql = "\n".join(
            item[0]
            for item in fake.executed
        )

        self.assertNotIn(
            "UPDATE public.addresses",
            sql,
        )

        self.assertNotIn(
            "address.publish.v1",
            sql,
        )

    def test_owner_can_unpublish_public_address_and_audit(
        self,
    ):
        fake = OwnerLifecycleFakeCursor(
            [
                _owner_address_row(
                    visibility="public",
                ),
            ],
            [
                1,
                1,
                1,
            ],
        )

        with patch.object(
            owner_services.connection,
            "cursor",
            return_value=fake,
        ):
            result = self._update_core()(
                user_id=OWNER_LIFECYCLE_USER_ID,
                address_id=OWNER_LIFECYCLE_ADDRESS_ID,
                name="Adresse test",
                category="habitation",
                visibility="private",
                access_point_note=None,
            )

        self.assertTrue(
            result["ok"]
        )

        self.assertEqual(
            result["visibility"],
            "private",
        )

        sql = "\n".join(
            item[0]
            for item in fake.executed
        )

        self.assertIn(
            "UPDATE public.addresses",
            sql,
        )

        self.assertIn(
            "'address.unpublish.v1'",
            sql,
        )

        self.assertNotIn(
            "'address.publish.v1'",
            sql,
        )

    def test_owner_same_visibility_update_does_not_create_publication_audit(
        self,
    ):
        fake = OwnerLifecycleFakeCursor(
            [
                _owner_address_row(
                    visibility="private",
                    access_point_note=(
                        "Portail bleu"
                    ),
                ),
            ],
            [
                1,
                1,
            ],
        )

        with patch.object(
            owner_services.connection,
            "cursor",
            return_value=fake,
        ):
            result = self._update_core()(
                user_id=OWNER_LIFECYCLE_USER_ID,
                address_id=OWNER_LIFECYCLE_ADDRESS_ID,
                name="Adresse renommée",
                category="habitation",
                visibility="private",
                access_point_note="Portail bleu",
            )

        self.assertTrue(
            result["ok"]
        )

        sql = "\n".join(
            item[0]
            for item in fake.executed
        )

        self.assertNotIn(
            "address.unpublish.v1",
            sql,
        )

        self.assertNotIn(
            "address.publish.v1",
            sql,
        )

    def test_owner_suspend_public_address_and_audit(
        self,
    ):
        fake = OwnerLifecycleFakeCursor(
            [
                _owner_address_row(
                    visibility="public",
                    status="active",
                ),
            ],
            [
                1,
                1,
                1,
            ],
        )

        with patch.object(
            owner_services.connection,
            "cursor",
            return_value=fake,
        ):
            result = self._suspend_core()(
                user_id=OWNER_LIFECYCLE_USER_ID,
                address_id=OWNER_LIFECYCLE_ADDRESS_ID,
            )

        self.assertTrue(
            result["ok"]
        )

        self.assertFalse(
            result["idempotent"]
        )

        sql = "\n".join(
            item[0]
            for item in fake.executed
        )

        self.assertIn(
            "SET status = 'suspended'",
            sql,
        )

        self.assertIn(
            "'address.suspend.v1'",
            sql,
        )

    def test_owner_suspend_replay_is_idempotent(
        self,
    ):
        fake = OwnerLifecycleFakeCursor(
            [
                _owner_address_row(
                    visibility="public",
                    status="suspended",
                ),
            ],
            [
                1,
            ],
        )

        with patch.object(
            owner_services.connection,
            "cursor",
            return_value=fake,
        ):
            result = self._suspend_core()(
                user_id=OWNER_LIFECYCLE_USER_ID,
                address_id=OWNER_LIFECYCLE_ADDRESS_ID,
            )

        self.assertTrue(
            result["ok"]
        )

        self.assertTrue(
            result["idempotent"]
        )

        self.assertEqual(
            len(fake.executed),
            1,
        )

        sql = "\n".join(
            item[0]
            for item in fake.executed
        )

        self.assertNotIn(
            "UPDATE public.addresses",
            sql,
        )

        self.assertNotIn(
            "address.suspend.v1",
            sql,
        )

    def test_owner_suspend_concurrent_update_is_rejected_without_audit(
        self,
    ):
        fake = OwnerLifecycleFakeCursor(
            [
                _owner_address_row(
                    visibility="public",
                    status="active",
                ),
            ],
            [
                1,
                0,
            ],
        )

        with patch.object(
            owner_services.connection,
            "cursor",
            return_value=fake,
        ):
            with self.assertRaises(
                owner_services.OwnerAddressStateError
            ):
                self._suspend_core()(
                    user_id=OWNER_LIFECYCLE_USER_ID,
                    address_id=OWNER_LIFECYCLE_ADDRESS_ID,
                )

        sql = "\n".join(
            item[0]
            for item in fake.executed
        )

        self.assertNotIn(
            "address.suspend.v1",
            sql,
        )
