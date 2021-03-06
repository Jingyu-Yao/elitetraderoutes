from rest_framework.decorators import detail_route
from rest_framework.response import Response
from common import permissions

from .models import System, Station, Commodity, StationCommodity
from .serializers import CommoditySerializer, StationSerializer, \
    SystemSerializer, MinimizedSystemSerializer, StationCommoditySerializer

import django_filters

from common.views import WrappedModelViewSet, wrap_response

# Create your views here.

class SystemViewSet(WrappedModelViewSet):
    permission_classes = (permissions.IsAdminOrReadOnly,)
    queryset = System.objects.all()
    serializer_class = SystemSerializer
    search_fields = ('name',)
    template_name = 'frontend/system/instance.html'
    list_template_name = 'frontend/system/list.html'

    @detail_route()
    def stations(self, request, *args, **kwargs):
        """
        A route to display only the stations this System contains.

        :param request:
        :param pk:
        :return:
        """
        system = self.get_object()
        stations = Station.objects.filter(system=system)

        serializer = StationSerializer(stations, context={'request': request}, many=True)
        return wrap_response(Response({'results': serializer.data}, template_name='frontend/system/list_station.html'))

    @detail_route()
    def min(self, request, *args, **kwargs):
        """
        A route to display the minimized System view.

        :param request:
        :param pk:
        :return:
        """
        serializer = MinimizedSystemSerializer(self.get_object(), context={'request': request})
        data = serializer.data
        data['min'] = True

        return wrap_response(Response(data))


class StationViewSet(WrappedModelViewSet):
    class StationFilter(django_filters.FilterSet):
        distance_to_star = django_filters.NumberFilter(lookup_type='lt')

        class Meta:
            model = Station
            fields = ('distance_to_star',)

    permission_classes = (permissions.IsAdminOrReadOnly,)
    queryset = Station.objects.all()
    serializer_class = StationSerializer
    filter_class = StationFilter
    search_fields = ('name', )
    template_name = 'frontend/station/instance.html'
    list_template_name = 'frontend/station/list.html'


class CommodityViewSet(WrappedModelViewSet):
    class CommodityFilter(django_filters.FilterSet):
        average_price = django_filters.NumberFilter(lookup_type='lt')
        name = django_filters.CharFilter(lookup_type='icontains')

        class Meta:
            model = Commodity
            fields = ('average_price', 'name')

    permission_classes = (permissions.IsAdminOrReadOnly,)
    queryset = Commodity.objects.all()
    serializer_class = CommoditySerializer
    filter_class = CommodityFilter
    search_fields = ('name',)
    template_name = 'frontend/commodity/instance.html'
    list_template_name = 'frontend/commodity/list.html'


class StationCommodityViewSet(WrappedModelViewSet):
    class StationCommodityFilter(django_filters.FilterSet):
        class Meta:
            model = StationCommodity
            fields = {
                'station': ['exact'],
                'commodity': ['exact'],
                'supply_level': ['exact'],
                'demand_level': ['exact'],
                'buy_price': ['lt', 'gt'],
                'sell_price': ['lt', 'gt'],
                'supply': ['lt', 'gt'],
                'demand': ['lt', 'gt'],
            }

    permission_classes = (permissions.IsAdminOrReadOnly,)
    queryset = StationCommodity.objects.all()
    serializer_class = StationCommoditySerializer
    template_name = 'frontend/station_commodity/instance.html'
    list_template_name = 'frontend/station_commodity/list.html'
    filter_class = StationCommodityFilter
    search_fields = ('commodity__name', 'station__name', 'commodity__category_name')
