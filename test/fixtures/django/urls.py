from django.urls import path, re_path, include
from . import views

urlpatterns = [
    path('users/', views.user_list),
    path('users/<int:pk>/', views.user_detail),
    path('items/<str:slug>/', views.item_detail),
    path('api/', include('api.urls')),
    re_path(r'^articles/(?P<year>[0-9]{4})/$', views.year_archive),
]
