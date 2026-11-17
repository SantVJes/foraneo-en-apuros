from django.urls import path

from . import views

urlpatterns = [
    path("pro/", views.EstadoProView.as_view(), name="pro"),
    path("pro/checkout/", views.CheckoutView.as_view(), name="pro-checkout"),
    path("pro/portal/", views.PortalView.as_view(), name="pro-portal"),
    path("pro/webhook/", views.WebhookStripeView.as_view(), name="pro-webhook"),
    path("ofertas/", views.OfertasView.as_view(), name="ofertas"),
    path("planes/<int:pk>/nutricion/", views.NutricionView.as_view(), name="nutricion"),
    path("ir/<str:token>/", views.IrView.as_view(), name="ir"),
]
