import mimetypes

from rest_framework import serializers


REPORT_REASONS = (
    "wrong_location",
    "closed",
    "damaged_beacon",
    "other",
)


class AddressSearchSerializer(serializers.Serializer):
    number = serializers.CharField(
        max_length=32,
        trim_whitespace=True,
        required=True,
        allow_blank=False,
    )


class RouteLogSerializer(serializers.Serializer):
    provider = serializers.ChoiceField(
        choices=(
            "google_maps",
            "waze",
        ),
    )


class AddressReportSerializer(serializers.Serializer):
    reason = serializers.ChoiceField(
        choices=REPORT_REASONS,
    )

    description = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
        trim_whitespace=True,
    )

class AddressClaimSerializer(serializers.Serializer):
    owner_name = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=120,
        trim_whitespace=True,
    )

    phone = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=30,
        trim_whitespace=True,
    )

    details = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=1000,
        trim_whitespace=True,
    )

    evidence_file = serializers.FileField(
        required=False,
        allow_null=True,
    )

    def validate(self, attrs):
        owner_name = (
            attrs.get("owner_name")
            or ""
        ).strip()

        phone = (
            attrs.get("phone")
            or ""
        ).strip()

        details = (
            attrs.get("details")
            or ""
        ).strip()

        parts = []

        if owner_name:
            parts.append(
                "Propriétaire déclaré : "
                f"{owner_name}"
            )

        if phone:
            parts.append(
                f"Téléphone : {phone}"
            )

        if details:
            parts.append(
                details
            )

        explanation = (
            "\n".join(parts)
            .strip()
        )

        if len(explanation) < 10:
            raise serializers.ValidationError(
                (
                    "Merci de détailler votre demande "
                    "(10 caractères minimum)."
                )
            )

        evidence_file = attrs.get(
            "evidence_file"
        )

        if evidence_file is not None:
            content_type = (
                getattr(
                    evidence_file,
                    "content_type",
                    None,
                )
                or mimetypes.guess_type(
                    evidence_file.name
                )[0]
                or ""
            )

            valid_type = (
                content_type.startswith(
                    "image/"
                )
                or content_type
                == "application/pdf"
            )

            if not valid_type:
                raise serializers.ValidationError(
                    {
                        "evidence_file": (
                            "La pièce justificative "
                            "doit être une image "
                            "ou un fichier PDF."
                        )
                    }
                )

            max_size = (
                6
                * 1024
                * 1024
            )

            if (
                evidence_file.size
                > max_size
            ):
                raise serializers.ValidationError(
                    {
                        "evidence_file": (
                            "Pièce justificative "
                            "trop volumineuse "
                            "(6 Mo maximum)."
                        )
                    }
                )

        attrs["explanation"] = (
            explanation[:1000]
        )

        return attrs
