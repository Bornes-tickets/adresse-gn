from django.urls import path

from .views import (
    PublicCmsFaqView,
    PublicCmsPageView,
    PublicCmsPostDetailView,
    PublicCmsPostsView,
    PublicPlansView,
    PublicReferenceListView,
)

urlpatterns = [
    path(
        "plans/",
        PublicPlansView.as_view(),
        name="public-plans",
    ),
    path(
        "reference/<str:level>/",
        PublicReferenceListView.as_view(),
        name="public-reference-list",
    ),
    path(
        "content/pages/<slug:slug>/",
        PublicCmsPageView.as_view(),
        name="public-cms-page",
    ),
    path(
        "content/faq/",
        PublicCmsFaqView.as_view(),
        name="public-cms-faq",
    ),
    path(
        "content/posts/",
        PublicCmsPostsView.as_view(),
        name="public-cms-posts",
    ),
    path(
        "content/posts/<slug:slug>/",
        PublicCmsPostDetailView.as_view(),
        name="public-cms-post-detail",
    ),
]
