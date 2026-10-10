from types import SimpleNamespace
from unittest.mock import patch

from django.test import SimpleTestCase
from django.urls import resolve
from rest_framework.test import (
    APIRequestFactory,
    force_authenticate,
)

from owner_portal.views import (
    OwnerBeaconDetailView,
    OwnerBeaconListView,
    OwnerBeaconSuspendView,
    OwnerMovingReportView,
)


ADDRESS_ID = (
    "11111111-1111-1111-1111-111111111111"
)
USER_ID = (
    "22222222-2222-2222-2222-222222222222"
)


class OwnerAddressAliasParityTests(
    SimpleTestCase
):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.user = SimpleNamespace(
            id=USER_ID,
            is_authenticated=True,
        )

    def _resolve(self, path):
        return resolve(
            path,
            urlconf="owner_portal.urls",
        )

    def _authenticated_request(
        self,
        method,
        path,
        data=None,
    ):
        request_factory = getattr(
            self.factory,
            method.lower(),
        )

        request = request_factory(
            path,
            data=data or {},
            format="json",
        )

        force_authenticate(
            request,
            user=self.user,
        )

        return request

    def _call(
        self,
        path,
        method,
        *,
        data=None,
        authenticated=True,
    ):
        match = self._resolve(
            path
        )

        request = (
            self._authenticated_request(
                method,
                path,
                data=data,
            )
            if authenticated
            else getattr(
                self.factory,
                method.lower(),
            )(
                path,
                data=data or {},
                format="json",
            )
        )

        return match.func(
            request,
            **match.kwargs,
        )

    def test_routes_resolve_to_same_views(
        self,
    ):
        pairs = [
            (
                "/addresses/",
                "/beacons/",
                OwnerBeaconListView,
                "owner-addresses",
                "owner-beacons",
            ),
            (
                (
                    "/addresses/"
                    + ADDRESS_ID
                    + "/"
                ),
                (
                    "/beacons/"
                    + ADDRESS_ID
                    + "/"
                ),
                OwnerBeaconDetailView,
                "owner-address-detail",
                "owner-beacon-detail",
            ),
            (
                (
                    "/addresses/"
                    + ADDRESS_ID
                    + "/suspend/"
                ),
                (
                    "/beacons/"
                    + ADDRESS_ID
                    + "/suspend/"
                ),
                OwnerBeaconSuspendView,
                "owner-address-suspend",
                "owner-beacon-suspend",
            ),
            (
                (
                    "/addresses/"
                    + ADDRESS_ID
                    + "/moving-report/"
                ),
                (
                    "/beacons/"
                    + ADDRESS_ID
                    + "/moving-report/"
                ),
                OwnerMovingReportView,
                "owner-address-moving-report",
                "owner-beacon-moving-report",
            ),
        ]

        for (
            canonical_path,
            legacy_path,
            expected_view,
            canonical_name,
            legacy_name,
        ) in pairs:
            canonical = self._resolve(
                canonical_path
            )
            legacy = self._resolve(
                legacy_path
            )

            self.assertIs(
                canonical.func.view_class,
                expected_view,
            )
            self.assertIs(
                legacy.func.view_class,
                expected_view,
            )
            self.assertEqual(
                canonical.url_name,
                canonical_name,
            )
            self.assertEqual(
                legacy.url_name,
                legacy_name,
            )

    def test_unauthenticated_list_parity(
        self,
    ):
        canonical = self._call(
            "/addresses/",
            "GET",
            authenticated=False,
        )
        legacy = self._call(
            "/beacons/",
            "GET",
            authenticated=False,
        )

        self.assertEqual(
            canonical.status_code,
            legacy.status_code,
        )
        self.assertEqual(
            canonical.data,
            legacy.data,
        )
        self.assertIn(
            canonical.status_code,
            {401, 403},
        )

    @patch(
        "owner_portal.views.list_owner_beacons"
    )
    def test_list_response_parity(
        self,
        list_owner_beacons,
    ):
        payload = [
            {
                "address_id": ADDRESS_ID,
                "public_number": "GN-CKY-582741",
            }
        ]

        list_owner_beacons.return_value = (
            payload
        )

        canonical = self._call(
            "/addresses/",
            "GET",
        )
        legacy = self._call(
            "/beacons/",
            "GET",
        )

        self.assertEqual(
            canonical.status_code,
            200,
        )
        self.assertEqual(
            legacy.status_code,
            200,
        )
        self.assertEqual(
            canonical.data,
            legacy.data,
        )
        self.assertEqual(
            canonical.data,
            {
                "items": payload,
            },
        )
        self.assertEqual(
            list_owner_beacons.call_count,
            2,
        )

    @patch(
        "owner_portal.views.update_owner_beacon"
    )
    def test_detail_patch_response_parity(
        self,
        update_owner_beacon,
    ):
        update_owner_beacon.return_value = {
            "address_id": ADDRESS_ID,
            "status": "active",
        }

        request_payload = {
            "name": "Domicile",
            "category": "habitation",
            "visibility": "private",
            "access_point_note": (
                "Portail principal"
            ),
        }

        canonical = self._call(
            (
                "/addresses/"
                + ADDRESS_ID
                + "/"
            ),
            "PATCH",
            data=request_payload,
        )
        legacy = self._call(
            (
                "/beacons/"
                + ADDRESS_ID
                + "/"
            ),
            "PATCH",
            data=request_payload,
        )

        self.assertEqual(
            canonical.status_code,
            200,
        )
        self.assertEqual(
            legacy.status_code,
            200,
        )
        self.assertEqual(
            canonical.data,
            legacy.data,
        )
        self.assertEqual(
            update_owner_beacon.call_count,
            2,
        )

    @patch(
        "owner_portal.views.suspend_owner_beacon"
    )
    def test_suspend_response_parity(
        self,
        suspend_owner_beacon,
    ):
        suspend_owner_beacon.return_value = {
            "address_id": ADDRESS_ID,
            "status": "suspended",
        }

        canonical = self._call(
            (
                "/addresses/"
                + ADDRESS_ID
                + "/suspend/"
            ),
            "POST",
        )
        legacy = self._call(
            (
                "/beacons/"
                + ADDRESS_ID
                + "/suspend/"
            ),
            "POST",
        )

        self.assertEqual(
            canonical.status_code,
            200,
        )
        self.assertEqual(
            legacy.status_code,
            200,
        )
        self.assertEqual(
            canonical.data,
            legacy.data,
        )
        self.assertEqual(
            suspend_owner_beacon.call_count,
            2,
        )

    @patch(
        (
            "owner_portal.views."
            "create_owner_moving_report"
        )
    )
    def test_moving_report_response_parity(
        self,
        create_owner_moving_report,
    ):
        create_owner_moving_report.return_value = {
            "address_id": ADDRESS_ID,
            "status": "submitted",
        }

        payload = {
            "description": (
                "Nouvelle localisation"
            ),
        }

        canonical = self._call(
            (
                "/addresses/"
                + ADDRESS_ID
                + "/moving-report/"
            ),
            "POST",
            data=payload,
        )
        legacy = self._call(
            (
                "/beacons/"
                + ADDRESS_ID
                + "/moving-report/"
            ),
            "POST",
            data=payload,
        )

        self.assertEqual(
            canonical.status_code,
            201,
        )
        self.assertEqual(
            legacy.status_code,
            201,
        )
        self.assertEqual(
            canonical.data,
            legacy.data,
        )
        self.assertEqual(
            create_owner_moving_report.call_count,
            2,
        )
