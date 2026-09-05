from dataclasses import dataclass
import json
from functools import lru_cache
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

import jwt
from django.conf import settings
from jwt import InvalidTokenError, PyJWKClient
from rest_framework.authentication import (
    BaseAuthentication,
    get_authorization_header,
)
from rest_framework.exceptions import AuthenticationFailed


@dataclass(frozen=True)
class SupabasePrincipal:
    """
    Identité applicative issue d'un JWT Supabase Auth validé.

    Aucun utilisateur Django n'est créé : Supabase Auth reste
    l'unique source d'identité pour Adresse GN.
    """

    id: str
    email: str | None
    role: str | None
    claims: dict[str, Any]

    @property
    def is_authenticated(self) -> bool:
        return True

    @property
    def is_anonymous(self) -> bool:
        return False


@lru_cache(maxsize=1)
def _jwk_client() -> PyJWKClient:
    return PyJWKClient(
        settings.SUPABASE_JWKS_URL,
    )


def _validate_common_claims(
    claims: dict[str, Any],
) -> dict[str, Any]:
    subject = claims.get("sub")

    if not subject:
        raise AuthenticationFailed(
            "Jeton Supabase sans identifiant utilisateur."
        )

    issuer = claims.get("iss")

    if issuer != settings.SUPABASE_JWT_ISSUER:
        raise AuthenticationFailed(
            "Émetteur du jeton Supabase invalide."
        )

    role = claims.get("role")

    if role != "authenticated":
        raise AuthenticationFailed(
            "Ce jeton n'est pas un jeton utilisateur authentifié."
        )

    return claims


def _verify_asymmetric_token(
    token: str,
    algorithm: str,
) -> dict[str, Any]:
    try:
        signing_key = (
            _jwk_client()
            .get_signing_key_from_jwt(
                token
            )
        )

        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=[algorithm],
            audience=(
                settings.SUPABASE_JWT_AUDIENCE
            ),
            issuer=(
                settings.SUPABASE_JWT_ISSUER
            ),
            options={
                "require": [
                    "exp",
                    "iss",
                    "sub",
                ],
            },
        )

    except InvalidTokenError as exc:
        raise AuthenticationFailed(
            "Jeton Supabase invalide ou expiré."
        ) from exc

    except Exception as exc:
        raise AuthenticationFailed(
            "Impossible de vérifier le jeton Supabase."
        ) from exc

    return _validate_common_claims(
        claims
    )


def _verify_legacy_hs256_token(
    token: str,
) -> dict[str, Any]:
    """
    Les anciens projets Supabase peuvent encore signer en HS256.

    On ne copie jamais le JWT secret dans Django.
    Le jeton est validé par l'endpoint Auth /user avec la clé
    publishable publique, puis ses claims sont lus localement.
    """

    request = Request(
        (
            f"{settings.SUPABASE_URL}"
            "/auth/v1/user"
        ),
        headers={
            "Accept": "application/json",
            "apikey": (
                settings
                .SUPABASE_PUBLISHABLE_KEY
            ),
            "Authorization": (
                f"Bearer {token}"
            ),
        },
        method="GET",
    )

    try:
        with urlopen(
            request,
            timeout=8,
        ) as response:
            user_payload = json.loads(
                response
                .read()
                .decode("utf-8")
            )

    except (
        HTTPError,
        URLError,
        TimeoutError,
        json.JSONDecodeError,
    ) as exc:
        raise AuthenticationFailed(
            "Jeton Supabase invalide ou expiré."
        ) from exc

    try:
        claims = jwt.decode(
            token,
            options={
                "verify_signature": False,
                "verify_aud": False,
            },
        )

    except InvalidTokenError as exc:
        raise AuthenticationFailed(
            "Jeton Supabase illisible."
        ) from exc

    if str(
        user_payload.get("id")
    ) != str(
        claims.get("sub")
    ):
        raise AuthenticationFailed(
            "Identité Supabase incohérente."
        )

    return _validate_common_claims(
        claims
    )


def verify_supabase_access_token(
    token: str,
) -> dict[str, Any]:
    try:
        header = jwt.get_unverified_header(
            token
        )
    except InvalidTokenError as exc:
        raise AuthenticationFailed(
            "En-tête JWT Supabase invalide."
        ) from exc

    algorithm = str(
        header.get("alg") or ""
    )

    if algorithm == "HS256":
        return (
            _verify_legacy_hs256_token(
                token
            )
        )

    if algorithm not in {
        "RS256",
        "ES256",
        "EdDSA",
    }:
        raise AuthenticationFailed(
            "Algorithme JWT Supabase non autorisé."
        )

    return _verify_asymmetric_token(
        token,
        algorithm,
    )


class SupabaseJWTAuthentication(
    BaseAuthentication
):
    """
    Authentification DRF par Bearer token Supabase.

    - absence de header : requête anonyme autorisée si la vue le permet ;
    - Bearer invalide : 401 ;
    - Bearer valide : request.user devient SupabasePrincipal.
    """

    keyword = b"bearer"

    def authenticate(
        self,
        request,
    ):
        header = (
            get_authorization_header(
                request
            )
            .split()
        )

        if not header:
            return None

        if (
            len(header) != 2
            or header[0].lower()
            != self.keyword
        ):
            raise AuthenticationFailed(
                "Header Authorization Bearer invalide."
            )

        try:
            token = header[1].decode(
                "utf-8"
            )
        except UnicodeError as exc:
            raise AuthenticationFailed(
                "Jeton Bearer invalide."
            ) from exc

        claims = (
            verify_supabase_access_token(
                token
            )
        )

        principal = SupabasePrincipal(
            id=str(
                claims["sub"]
            ),
            email=claims.get(
                "email"
            ),
            role=claims.get(
                "role"
            ),
            claims=claims,
        )

        return (
            principal,
            claims,
        )

    def authenticate_header(
        self,
        request,
    ) -> str:
        return "Bearer"
