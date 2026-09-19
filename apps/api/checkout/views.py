from __future__ import annotations

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import (
    CheckoutOrderCreateSerializer,
    CheckoutOrderCreatedSerializer,
)
from .services import (
    CheckoutAuthUserNotFoundError,
    CheckoutInputError,
    CheckoutOrderError,
    CheckoutPlanContractError,
    CheckoutPlanNotFoundError,
    CheckoutVerificationError,
    create_checkout_order,
)


class CheckoutOrderCreateView(APIView):
    permission_classes = [
        IsAuthenticated,
    ]

    @extend_schema(
        tags=["Checkout"],
        request=CheckoutOrderCreateSerializer,
        responses={
            201: CheckoutOrderCreatedSerializer,
        },
        description=(
            "Crée la commande Adresse GN canonique "
            "après authentification/OTP Supabase."
        ),
    )
    def post(self, request):
        serializer = CheckoutOrderCreateSerializer(
            data=request.data
        )
        serializer.is_valid(
            raise_exception=True
        )

        user_id = getattr(
            request.user,
            "id",
            None,
        )

        if not user_id:
            return Response(
                {
                    "detail": "Authentification requise.",
                    "code": "AUTH_REQUIRED",
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        try:
            result = create_checkout_order(
                user_id=str(user_id),
                payload=serializer.validated_data,
            )

        except CheckoutAuthUserNotFoundError as exc:
            return Response(
                {
                    "detail": str(exc),
                    "code": exc.code,
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        except CheckoutVerificationError as exc:
            return Response(
                {
                    "detail": str(exc),
                    "code": exc.code,
                },
                status=status.HTTP_409_CONFLICT,
            )

        except CheckoutPlanNotFoundError as exc:
            return Response(
                {
                    "detail": str(exc),
                    "code": exc.code,
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        except CheckoutPlanContractError as exc:
            return Response(
                {
                    "detail": str(exc),
                    "code": exc.code,
                },
                status=status.HTTP_409_CONFLICT,
            )

        except CheckoutInputError as exc:
            return Response(
                {
                    "detail": str(exc),
                    "code": exc.code,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        except CheckoutOrderError as exc:
            return Response(
                {
                    "detail": str(exc),
                    "code": exc.code,
                },
                status=(
                    status.HTTP_500_INTERNAL_SERVER_ERROR
                ),
            )

        return Response(
            result,
            status=status.HTTP_201_CREATED,
        )
