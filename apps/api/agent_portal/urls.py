from django.urls import path

from .views import (
    AgentBadgeLoginView,
    AgentHistoryListView,
    AgentMeView,
    AgentTaskListView,
)


from .views import AgentTaskCompleteView


urlpatterns = [
    path(
        "login/",
        AgentBadgeLoginView.as_view(),
        name="agent-login",
    ),
    path(
        "me/",
        AgentMeView.as_view(),
        name="agent-me",
    ),
    path(
        "tasks/",
        AgentTaskListView.as_view(),
        name="agent-tasks",
    ),

    path(
        "history/",
        AgentHistoryListView.as_view(),
        name="agent-history",
    ),


    path(
        (
            "tasks/"
            "<uuid:pending_installation_id>/"
            "complete/"
        ),
        AgentTaskCompleteView.as_view(),
        name="agent-task-complete",
    ),

]
