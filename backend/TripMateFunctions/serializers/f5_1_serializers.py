from rest_framework import serializers
from ..models import TripPhoto


class F51TripPhotoSerializer(serializers.ModelSerializer):
    class Meta:
        model = TripPhoto
        fields = [
            "id",
            "trip",
            "user",
            "itinerary_item",
            "file_url",
            "caption",
            "lat",
            "lon",
            "taken_at",
            "created_at",
        ]
        read_only_fields = ["id", "user", "created_at"]
    
    def create(self, validated_data):
        """
        ✅ 自动从 itinerary_item 获取坐标
        """
        # 如果前端没有发送 lat/lon，或者发送的是 None
        if not validated_data.get('lat') or not validated_data.get('lon'):
            itinerary_item = validated_data.get('itinerary_item')
            if itinerary_item and itinerary_item.lat and itinerary_item.lon:
                validated_data['lat'] = itinerary_item.lat
                validated_data['lon'] = itinerary_item.lon
                print(f"✅ Auto-set coordinates from {itinerary_item.title}: "
                      f"({validated_data['lat']}, {validated_data['lon']})")
        
        return super().create(validated_data)
    
    def update(self, instance, validated_data):
        """
        ✅ 更新照片时，如果 itinerary_item 改变，更新坐标
        """
        # 如果更改了 itinerary_item
        if 'itinerary_item' in validated_data:
            itinerary_item = validated_data['itinerary_item']
            if itinerary_item and itinerary_item.lat and itinerary_item.lon:
                validated_data['lat'] = itinerary_item.lat
                validated_data['lon'] = itinerary_item.lon
                print(f"✅ Updated coordinates from {itinerary_item.title}: "
                      f"({validated_data['lat']}, {validated_data['lon']})")
            else:
                # 如果取消关联，清除坐标
                validated_data['lat'] = None
                validated_data['lon'] = None
        
        return super().update(instance, validated_data)