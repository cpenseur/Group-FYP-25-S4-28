# Generated manually to add TripGuideMetadata and SavedTripGuide tables
from django.db import migrations, models
import django.utils.timezone
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("TripMateFunctions", "0004_merge_20260126_0201"),
    ]

    operations = [
        migrations.CreateModel(
            name="TripGuideMetadata",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("is_published_as_guide", models.BooleanField(default=False, help_text="Is this trip published in the recommendations system?")),
                ("is_featured", models.BooleanField(default=False, help_text="Show in featured guides section?")),
                ("views", models.IntegerField(default=0, help_text="Number of times viewed as a guide")),
                ("saves", models.IntegerField(default=0, help_text="Number of users who saved this as a guide")),
                ("published_at", models.DateTimeField(blank=True, help_text="When this trip was first published as a guide", null=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("trip", models.OneToOneField(help_text="The trip that is being used as a guide", on_delete=django.db.models.deletion.CASCADE, related_name="guide_metadata", to="TripMateFunctions.trip")),
            ],
            options={
                "db_table": "trip_guide_metadata",
                "verbose_name": "Trip Guide Metadata",
                "verbose_name_plural": "Trip Guide Metadata",
                "indexes": [
                    models.Index(fields=["is_published_as_guide", "-views"], name="tgmeta_pub_views_idx"),
                    models.Index(fields=["is_featured"], name="tgmeta_featured_idx"),
                    models.Index(fields=["-saves"], name="tgmeta_saves_idx"),
                ],
            },
        ),
        migrations.CreateModel(
            name="SavedTripGuide",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("trip", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="saved_as_guide_by", to="TripMateFunctions.trip")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="saved_trip_guides", to="TripMateFunctions.appuser")),
            ],
            options={
                "db_table": "saved_trip_guide",
                "ordering": ["-created_at"],
                "unique_together": {("user", "trip")},
                "indexes": [
                    models.Index(fields=["user", "-created_at"], name="savedguide_user_created_idx"),
                ],
            },
        ),
    ]
