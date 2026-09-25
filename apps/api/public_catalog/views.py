from __future__ import annotations

from typing import Any

from django.db import connection
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView


def _dict_fetchall(cursor) -> list[dict[str, Any]]:
    columns = [column.name for column in cursor.description]
    return [dict(zip(columns, row)) for row in cursor.fetchall()]


class PublicPlansView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        sql = (
            "SELECT id, code, name, description, features, "
            "price_gnf, price_from_gnf, price_to_gnf, "
            "recurring_price_gnf, billing_period, audience, "
            "requires_quote, plate_available, plate_included, "
            "installation_required, popular, active, position "
            "FROM public.cms_plans "
            "WHERE active IS TRUE "
            "AND code IN ('numerique','residentiel_standard','pro') "
            "ORDER BY position, code"
        )

        with connection.cursor() as cursor:
            cursor.execute(sql)
            items = _dict_fetchall(cursor)

        return Response(
            {"items": items, "count": len(items)},
            status=status.HTTP_200_OK,
        )


REFERENCE = {
    "regions": {
        "table": "regions",
        "columns": ["id", "name", "code", "stat_code"],
        "parent": None,
    },
    "prefectures": {
        "table": "prefectures",
        "columns": [
            "id", "region_id", "name", "code", "stat_code", "is_special_zone"
        ],
        "parent": "region_id",
    },
    "communes": {
        "table": "communes",
        "columns": [
            "id", "region_id", "prefecture_id", "name",
            "code", "stat_code", "administrative_type"
        ],
        "parent": "prefecture_id",
    },
    "districts": {
        "table": "districts",
        "columns": ["id", "commune_id", "name", "code", "kind"],
        "parent": "commune_id",
    },
    "sectors": {
        "table": "sectors",
        "columns": ["id", "district_id", "name", "code"],
        "parent": "district_id",
    },
}


class PublicReferenceListView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request, level: str):
        spec = REFERENCE.get(str(level or "").strip().lower())

        if spec is None:
            return Response(
                {
                    "detail": "Niveau de référentiel inconnu.",
                    "code": "REFERENCE_LEVEL_INVALID",
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        table = spec["table"]
        columns = list(spec["columns"])
        parent = spec["parent"]

        where = ["is_active IS TRUE"]
        params: list[Any] = []

        if parent:
            parent_id = str(request.query_params.get(parent) or "").strip()

            if not parent_id:
                return Response(
                    {
                        "detail": f"Le paramètre {parent} est obligatoire.",
                        "code": "REFERENCE_PARENT_REQUIRED",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            where.append(f"{parent} = %s")
            params.append(parent_id)

        sql = (
            f"SELECT {', '.join(columns)} "
            f"FROM public.{table} "
            f"WHERE {' AND '.join(where)} "
            "ORDER BY name, id"
        )

        with connection.cursor() as cursor:
            cursor.execute(sql, params)
            items = _dict_fetchall(cursor)

        return Response(
            {"level": level, "items": items, "count": len(items)},
            status=status.HTTP_200_OK,
        )


class PublicCmsPageView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request, slug: str):
        normalized_slug = str(
            slug or ""
        ).strip().lower()

        if (
            not normalized_slug
            or len(normalized_slug) > 120
        ):
            return Response(
                {
                    "detail": "Page introuvable.",
                    "code": "CMS_PAGE_NOT_FOUND",
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        sql = (
            "SELECT "
            "id, slug, status, title, excerpt, body, "
            "seo_title, seo_description, cover_url, "
            "position, published_at, updated_at "
            "FROM public.cms_pages "
            "WHERE status = 'published' "
            "AND slug = %s "
            "LIMIT 1"
        )

        with connection.cursor() as cursor:
            cursor.execute(
                sql,
                [normalized_slug],
            )
            row = cursor.fetchone()

            if row is None:
                return Response(
                    {
                        "detail": "Page introuvable.",
                        "code": "CMS_PAGE_NOT_FOUND",
                    },
                    status=status.HTTP_404_NOT_FOUND,
                )

            columns = [
                column.name
                for column in cursor.description
            ]

            item = dict(
                zip(columns, row)
            )

        return Response(
            {"item": item},
            status=status.HTTP_200_OK,
        )


class PublicCmsFaqView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        sql = (
            "SELECT "
            "id, category, question, answer, "
            "position, published, updated_at "
            "FROM public.cms_faq "
            "WHERE published IS TRUE "
            "ORDER BY position, id"
        )

        with connection.cursor() as cursor:
            cursor.execute(sql)
            items = _dict_fetchall(cursor)

        return Response(
            {
                "items": items,
                "count": len(items),
            },
            status=status.HTTP_200_OK,
        )


class PublicCmsPostsView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        sql = (
            "SELECT "
            "id, slug, status, category, cover_url, "
            "title, excerpt, seo_title, seo_description, "
            "published_at, updated_at "
            "FROM public.cms_posts "
            "WHERE status = 'published' "
            "ORDER BY published_at DESC NULLS LAST, "
            "updated_at DESC, id"
        )

        with connection.cursor() as cursor:
            cursor.execute(sql)
            items = _dict_fetchall(cursor)

        return Response(
            {
                "items": items,
                "count": len(items),
            },
            status=status.HTTP_200_OK,
        )


class PublicCmsPostDetailView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request, slug: str):
        normalized_slug = str(
            slug or ""
        ).strip().lower()

        if (
            not normalized_slug
            or len(normalized_slug) > 120
        ):
            return Response(
                {
                    "detail": "Article introuvable.",
                    "code": "CMS_POST_NOT_FOUND",
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        sql = (
            "SELECT "
            "id, slug, status, category, cover_url, "
            "title, excerpt, body, seo_title, "
            "seo_description, published_at, updated_at "
            "FROM public.cms_posts "
            "WHERE status = 'published' "
            "AND slug = %s "
            "LIMIT 1"
        )

        with connection.cursor() as cursor:
            cursor.execute(
                sql,
                [normalized_slug],
            )
            row = cursor.fetchone()

            if row is None:
                return Response(
                    {
                        "detail": "Article introuvable.",
                        "code": "CMS_POST_NOT_FOUND",
                    },
                    status=status.HTTP_404_NOT_FOUND,
                )

            columns = [
                column.name
                for column in cursor.description
            ]

            item = dict(
                zip(columns, row)
            )

        return Response(
            {"item": item},
            status=status.HTTP_200_OK,
        )
