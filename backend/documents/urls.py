from django.urls import path
from .views import extract_pdf, ask_pdf

urlpatterns = [
    path("extract-pdf/", extract_pdf, name="extract_pdf"),
    path("ask-pdf/", ask_pdf, name="ask_pdf"),
]
