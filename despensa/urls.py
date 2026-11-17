from rest_framework.routers import DefaultRouter

from .views import AlacenaViewSet, PlanSemanalViewSet

router = DefaultRouter()
router.register("alacena", AlacenaViewSet, basename="alacena")
router.register("planes", PlanSemanalViewSet, basename="planes")
urlpatterns = router.urls
