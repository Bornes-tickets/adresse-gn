from django.test import SimpleTestCase

from backoffice.serializers import AccountReactivateSerializer
from owner_portal.serializers import (
    OwnerAccountDeactivateSerializer,
)


class OwnerAccountDeactivateSerializerTests(SimpleTestCase):
    def test_exact_confirmation_is_valid(self):
        serializer = OwnerAccountDeactivateSerializer(
            data={"confirm": "DESACTIVER"}
        )

        self.assertTrue(
            serializer.is_valid(),
            serializer.errors,
        )

    def test_wrong_confirmation_is_rejected(self):
        serializer = OwnerAccountDeactivateSerializer(
            data={"confirm": "desactiver"}
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("confirm", serializer.errors)


class AccountReactivateSerializerTests(SimpleTestCase):
    def valid_payload(self, method="document"):
        return {
            "confirm": "REACTIVER",
            "verification_method": method,
            "verification_note": "Identité vérifiée.",
        }

    def test_exact_confirmation_is_valid(self):
        serializer = AccountReactivateSerializer(
            data=self.valid_payload()
        )

        self.assertTrue(
            serializer.is_valid(),
            serializer.errors,
        )

    def test_wrong_confirmation_is_rejected(self):
        payload = self.valid_payload()
        payload["confirm"] = "reactiver"

        serializer = AccountReactivateSerializer(
            data=payload
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("confirm", serializer.errors)

    def test_blank_verification_note_is_rejected(self):
        payload = self.valid_payload()
        payload["verification_note"] = "   "

        serializer = AccountReactivateSerializer(
            data=payload
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn(
            "verification_note",
            serializer.errors,
        )

    def test_invalid_verification_method_is_rejected(self):
        serializer = AccountReactivateSerializer(
            data=self.valid_payload("unknown")
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn(
            "verification_method",
            serializer.errors,
        )

    def test_all_supported_verification_methods_are_valid(
        self,
    ):
        methods = [
            "email",
            "phone",
            "document",
            "in_person",
            "other",
        ]

        for method in methods:
            with self.subTest(method=method):
                serializer = AccountReactivateSerializer(
                    data=self.valid_payload(method)
                )

                self.assertTrue(
                    serializer.is_valid(),
                    serializer.errors,
                )
