from django.urls import path

from .views import GoogleLoginView, LoginView, RefreshView, RegistroView, YoView

urlpatterns = [
    path("registro/", RegistroView.as_view(), name="registro"),
    path("login/", LoginView.as_view(), name="login"),
    path("google/", GoogleLoginView.as_view(), name="login-google"),
    path("refresh/", RefreshView.as_view(), name="token-refresh"),
    path("yo/", YoView.as_view(), name="yo"),
]
