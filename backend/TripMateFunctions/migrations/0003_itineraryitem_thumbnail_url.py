from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("TripMateFunctions", "0002_alter_tripcollaborator_unique_together_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="itineraryitem",
            name="thumbnail_url",
            field=models.URLField(blank=True, null=True),
        ),
    ]

