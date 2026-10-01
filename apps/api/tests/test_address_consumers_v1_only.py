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