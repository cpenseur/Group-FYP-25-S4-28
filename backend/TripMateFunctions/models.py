# models.py
from django.db import models
from django.contrib.postgres.fields import ArrayField
from django.utils import timezone as django_timezone
import secrets
import uuid

# --------------------------------------------------
# USERS & PROFILES
# --------------------------------------------------


class AppUser(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )    
    
    class Role(models.TextChoices):
        NORMAL = "normal", "Normal"
        ADMIN = "admin", "Admin"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        VERIFIED = "verified", "Verified"
        SUSPENDED = "suspended", "Suspended"
        DELETED = "deleted", "Deleted"

    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=255, blank=True, null=True)

    role = models.CharField(
        max_length=16,
        choices=Role.choices,
        default=Role.NORMAL,
    )
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.PENDING,
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_active_at = models.DateTimeField(blank=True, null=True)
    
    class Meta:
        db_table = "app_user"

    def __str__(self):
        return self.email or f"User {self.pk}"


class Profile(models.Model):
    id = models.UUIDField(primary_key=True)

    dob_day = models.TextField(blank=True, null=True)
    dob_month = models.TextField(blank=True, null=True)
    dob_year = models.TextField(blank=True, null=True)

    phone = models.TextField(blank=True, null=True)
    nationality = models.TextField(blank=True, null=True)
    address1 = models.TextField(blank=True, null=True)
    address2 = models.TextField(blank=True, null=True)

    updated_at = models.DateTimeField(blank=True, null=True)
    location = models.TextField(blank=True, null=True)

    interests = ArrayField(models.TextField(), blank=True, null=True)

    travel_pace = models.TextField(blank=True, null=True)
    budget_level = models.TextField(blank=True, null=True)
    diet_preference = models.TextField(blank=True, null=True)
    mobility_needs = models.TextField(blank=True, null=True)

    onboarding_completed = models.BooleanField(default=False)
    name = models.TextField(blank=True, null=True)

    class Meta:
        db_table = "profiles"
        managed = False 
        
# --------------------------------------------------
# DESTINATION & LOCALE
# --------------------------------------------------


class CountryInfo(models.Model):
    country_code = models.CharField(max_length=2, primary_key=True)
    country_name = models.CharField(max_length=255)

    currency_code = models.CharField(max_length=3, blank=True, null=True)
    visa_requirements = models.TextField(blank=True, null=True)
    holidays_json = models.JSONField(blank=True, null=True)
    travel_notes = models.TextField(blank=True, null=True)
    required_documents = models.TextField(blank=True, null=True)
    local_transport_info = models.TextField(blank=True, null=True)
    payment_notes = models.TextField(blank=True, null=True)
    is_sponsored = models.BooleanField(default=False)

    updated_at = models.DateTimeField(default=django_timezone.now)

    class Meta:
        db_table = "country_info"

    def __str__(self):
        return self.country_name


class Destination(models.Model):
    name = models.CharField(max_length=255)
    address = models.TextField(blank=True, null=True)
    city = models.CharField(max_length=255, blank=True, null=True)
    country = models.CharField(max_length=255, blank=True, null=True)
    country_code = models.CharField(max_length=2, blank=True, null=True)

    lat = models.FloatField(blank=True, null=True)
    lon = models.FloatField(blank=True, null=True)
    timezone = models.CharField(max_length=64, blank=True, null=True)

    category = models.CharField(max_length=128, blank=True, null=True)
    subcategory = models.CharField(max_length=128, blank=True, null=True)
    description = models.TextField(blank=True, null=True)

    opening_hours_json = models.JSONField(blank=True, null=True)
    average_rating = models.FloatField(blank=True, null=True)
    rating_count = models.IntegerField(blank=True, null=True)

    external_ref = models.CharField(
        max_length=255, blank=True, null=True
    )  # e.g. OpenTripMap ID

    # ============================================================================
    # NEW FIELDS FOR F1.5b - Recommendations Page (OPTIONAL but recommended)
    # ============================================================================
    short_description = models.CharField(
        max_length=500, 
        blank=True, 
        null=True,
        help_text="Brief description for destination cards"
    )
    thumbnail_image = models.URLField(
        max_length=500, 
        blank=True, 
        null=True,
        help_text="Thumbnail image for destination cards"
    )
    best_time_to_visit = models.CharField(
        max_length=255, 
        blank=True, 
        null=True,
        help_text="Best time to visit (e.g., 'March-May, September-November')"
    )
    average_budget = models.CharField(
        max_length=255, 
        blank=True, 
        null=True,
        help_text="Average budget per day (e.g., '$100-150 per day')"
    )
    popular_activities = models.JSONField(
        blank=True, 
        null=True,
        help_text="Array of popular activity strings"
    )
    fun_facts = models.JSONField(
        blank=True, 
        null=True,
        help_text="Array of fun fact strings"
    )
    views = models.IntegerField(
        default=0,
        help_text="Number of times this destination was viewed"
    )
    is_active = models.BooleanField(
        default=True,
        help_text="Whether this destination is active in recommendations"
    )
    # ============================================================================

    created_at = models.DateTimeField(default=django_timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "destination"

    def __str__(self):
        return self.name


class LocalContextCache(models.Model):
    destination = models.ForeignKey(
        Destination, on_delete=models.CASCADE, null=True, blank=True
    )
    country_code = models.CharField(max_length=2, blank=True, null=True)
    currency_code = models.CharField(max_length=3, blank=True, null=True)
    data = models.JSONField(blank=True, null=True)  # currency, transport, GrabPay, etc.
    fetched_at = models.DateTimeField(default=django_timezone.now)

    class Meta:
        db_table = "local_context_cache"

    def __str__(self):
        return f"Context {self.id}"


class BookingSiteRecommendation(models.Model):
    country_code = models.CharField(max_length=2)
    site_name = models.CharField(max_length=255)
    url = models.URLField()
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    sort_order = models.IntegerField(default=0)

    class Meta:
        db_table = "booking_site_recommendation"
        ordering = ["sort_order", "site_name"]

    def __str__(self):
        return f"{self.country_code} - {self.site_name}"


# --------------------------------------------------
# TRIPS, DAYS, COLLABORATION
# --------------------------------------------------


class Trip(models.Model):
    class Visibility(models.TextChoices):
        PRIVATE = "private", "Private"
        SHARED = "shared", "Shared"
        PUBLIC = "public", "Public"

    owner = models.ForeignKey(
        AppUser,
        on_delete=models.CASCADE,
        related_name="owned_trips",
    )
    title = models.CharField(max_length=255)
    main_city = models.CharField(max_length=255, blank=True, null=True)
    main_country = models.CharField(max_length=255, blank=True, null=True)
    visibility = models.CharField(
        max_length=16,
        choices=Visibility.choices,
        default=Visibility.PRIVATE,
    )

    start_date = models.DateField(blank=True, null=True)
    end_date = models.DateField(blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    travel_type = models.CharField(max_length=64, blank=True, null=True)
    is_demo = models.BooleanField(default=False)

    created_at = models.DateTimeField(default=django_timezone.now)
    updated_at = models.DateTimeField(auto_now=True)
    is_flagged = models.BooleanField(default=False)
    flag_category = models.CharField(max_length=500, null=True, blank=True)
    flag_reason = models.TextField(null=True, blank=True)

    moderation_status = models.CharField(max_length=50, null=True, blank=True)
    moderated_at = models.DateTimeField(null=True, blank=True)
    class Meta:
        db_table = "trip"

    def __str__(self):
        return self.title


class TripCollaborator(models.Model):
    class Role(models.TextChoices):
        OWNER = "owner", "Owner"
        EDITOR = "editor", "Editor"
        VIEWER = "viewer", "Viewer"

    class Status(models.TextChoices):
        INVITED = "invited", "Invited"
        ACTIVE = "active", "Active"

    trip = models.ForeignKey(
        Trip,
        on_delete=models.CASCADE,
        related_name="collaborators",
    )

    user = models.ForeignKey(
        AppUser,
        on_delete=models.CASCADE,
        related_name="trip_collaborations",
        null=True,
        blank=True,
    )

    invited_email = models.EmailField(null=True, blank=True)   
    invite_token = models.CharField(max_length=64, unique=True, null=True, blank=True)

    role = models.CharField(max_length=16, choices=Role.choices, default=Role.EDITOR)

    status = models.CharField(max_length=16, choices=Status.choices,default=Status.INVITED,)

    invited_at = models.DateTimeField(default=django_timezone.now)
    accepted_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        db_table = "trip_collaborator"
        constraints = [
            # Only one collaborator row per (trip, user) when user is set
            models.UniqueConstraint(
                fields=["trip", "user"],
                name="uniq_trip_user",
                condition=models.Q(user__isnull=False),
            ),
            # Only one pending invite per (trip, invited_email) when email is set
            models.UniqueConstraint(
                fields=["trip", "invited_email"],
                name="uniq_trip_invited_email",
                condition=models.Q(invited_email__isnull=False),
            ),
            # Ensure at least one of user or invited_email exists
            models.CheckConstraint(
                check=models.Q(user__isnull=False) | models.Q(invited_email__isnull=False),
                name="chk_user_or_email_present",
            ),
        ]

    def ensure_token(self):
        if not self.invite_token:
            self.invite_token = secrets.token_urlsafe(32)

    def __str__(self):
        return f"{self.user_id} in Trip {self.trip_id}"


class TripShareLink(models.Model):
    class Permission(models.TextChoices):
        VIEW = "view", "View"
        EDIT = "edit", "Edit"

    trip = models.ForeignKey(
        Trip,
        on_delete=models.CASCADE,
        related_name="share_links",
    )
    token = models.CharField(max_length=64, unique=True)
    permission = models.CharField(
        max_length=8,
        choices=Permission.choices,
        default=Permission.VIEW,
    )
    expires_at = models.DateTimeField(blank=True, null=True)
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(default=django_timezone.now)

    class Meta:
        db_table = "trip_share_link"

    def __str__(self):
        return f"Link {self.token} for Trip {self.trip_id}"


class TripDay(models.Model):
    trip = models.ForeignKey(
        Trip,
        on_delete=models.CASCADE,
        related_name="days",
    )
    date = models.DateField(blank=True, null=True)
    day_index = models.IntegerField()  # 1..N
    note = models.TextField(blank=True, null=True)

    class Meta:
        db_table = "trip_day"
        unique_together = ("trip", "day_index")
        ordering = ["trip", "day_index"]

    def __str__(self):
        return f"Day {self.day_index} of Trip {self.trip_id}"


# --------------------------------------------------
# ITINERARY ITEMS, NOTES, TAGS
# --------------------------------------------------


class ItineraryItem(models.Model):
    trip = models.ForeignKey(
        Trip,
        on_delete=models.CASCADE,
        related_name="items",
    )
    day = models.ForeignKey(
        TripDay,
        on_delete=models.SET_NULL,
        related_name="items",
        null=True,
        blank=True,
    )
    destination = models.ForeignKey(
        Destination,
        on_delete=models.SET_NULL,
        related_name="itinerary_items",
        null=True,
        blank=True,
    )

    title = models.CharField(max_length=255)
    item_type = models.CharField(max_length=64, blank=True, null=True)  # food, activity, etc.

    start_time = models.DateTimeField(blank=True, null=True)
    end_time = models.DateTimeField(blank=True, null=True)

    lat = models.FloatField(blank=True, null=True)
    lon = models.FloatField(blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    thumbnail_url = models.URLField(max_length=2048, blank=True, null=True)  # Long URLs for image services

    notes_summary = models.TextField(blank=True, null=True)

    cost_amount = models.DecimalField(
        max_digits=12, decimal_places=2, blank=True, null=True
    )
    cost_currency = models.CharField(max_length=3, blank=True, null=True)
    booking_reference = models.CharField(max_length=255, blank=True, null=True)

    is_all_day = models.BooleanField(default=False)
    sort_order = models.IntegerField(default=0)

    created_at = models.DateTimeField(default=django_timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "itinerary_item"
        ordering = ["trip", "day", "sort_order", "start_time"]

    def __str__(self):
        return self.title


class ItineraryItemNote(models.Model):
    item = models.ForeignKey(
        ItineraryItem,
        on_delete=models.CASCADE,
        related_name="notes",
    )
    user = models.ForeignKey(
        AppUser,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="itinerary_notes",
    )
    content = models.TextField()

    created_at = models.DateTimeField(default=django_timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "itinerary_item_note"

    def __str__(self):
        return f"Note {self.id} on Item {self.item_id}"


class ItineraryItemTag(models.Model):
    item = models.ForeignKey(
        ItineraryItem,
        on_delete=models.CASCADE,
        related_name="tags",
    )
    tag = models.CharField(max_length=64)

    created_at = models.DateTimeField(default=django_timezone.now)

    class Meta:
        db_table = "itinerary_item_tag"
        unique_together = ("item", "tag")

    def __str__(self):
        return f"{self.tag} on {self.item_id}"


# --------------------------------------------------
# BUDGET & EXPENSES
# --------------------------------------------------


class TripBudget(models.Model):
    trip = models.OneToOneField(
        Trip,
        on_delete=models.CASCADE,
        related_name="budget",
    )
    currency = models.CharField(max_length=3)
    planned_total = models.DecimalField(
        max_digits=12, decimal_places=2, blank=True, null=True
    )
    actual_total = models.DecimalField(
        max_digits=12, decimal_places=2, blank=True, null=True
    )

    created_at = models.DateTimeField(default=django_timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "trip_budget"

    def __str__(self):
        return f"Budget for Trip {self.trip_id}"


class TripExpense(models.Model):
    trip = models.ForeignKey(
        Trip,
        on_delete=models.CASCADE,
        related_name="expenses",
    )
    payer = models.ForeignKey(
        AppUser,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="expenses_paid",
    )

    description = models.CharField(max_length=255)
    category = models.CharField(max_length=64, blank=True, null=True)

    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=3)

    paid_at = models.DateTimeField(blank=True, null=True)

    linked_day = models.ForeignKey(
        TripDay,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="expenses",
    )
    linked_item = models.ForeignKey(
        ItineraryItem,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="expenses",
    )

    created_at = models.DateTimeField(default=django_timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "trip_expense"

    def __str__(self):
        return self.description


class ExpenseSplit(models.Model):
    expense = models.ForeignKey(
        TripExpense,
        on_delete=models.CASCADE,
        related_name="splits",
    )
    user = models.ForeignKey(
        AppUser,
        on_delete=models.CASCADE,
        related_name="expense_splits",
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    is_settled = models.BooleanField(default=False)

    class Meta:
        db_table = "expense_split"
        unique_together = ("expense", "user")

    def __str__(self):
        return f"{self.user_id} owes {self.amount} on expense {self.expense_id}"


# --------------------------------------------------
# CHECKLISTS
# --------------------------------------------------


class Checklist(models.Model):
    class Type(models.TextChoices):
        PACKING = "packing", "Packing"
        BOOKINGS = "bookings", "Bookings"
        CUSTOM = "custom", "Custom"

    owner = models.ForeignKey(
        AppUser,
        on_delete=models.CASCADE,
        related_name="checklists",
    )
    trip = models.ForeignKey(
        Trip,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="checklists",
    )

    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    checklist_type = models.CharField(
        max_length=32,
        choices=Type.choices,
        default=Type.CUSTOM,
    )

    created_at = models.DateTimeField(default=django_timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "checklist"

    def __str__(self):
        return self.name


class ChecklistItem(models.Model):
    checklist = models.ForeignKey(
        Checklist,
        on_delete=models.CASCADE,
        related_name="items",
    )
    label = models.CharField(max_length=255)
    is_completed = models.BooleanField(default=False)
    sort_order = models.IntegerField(default=0)
    due_date = models.DateField(blank=True, null=True)

    created_at = models.DateTimeField(default=django_timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "checklist_item"
        ordering = ["checklist", "sort_order"]

    def __str__(self):
        return self.label


# --------------------------------------------------
# DOCUMENTS & MEDIA
# --------------------------------------------------


class TravelDocument(models.Model):
    class DocType(models.TextChoices):
        PASSPORT = "passport", "Passport"
        VISA = "visa", "Visa"
        TICKET = "ticket", "Ticket"
        INSURANCE = "insurance", "Insurance"
        OTHER = "other", "Other"

    trip = models.ForeignKey(
        Trip,
        on_delete=models.CASCADE,
        related_name="travel_documents",
    )
    user = models.ForeignKey(
        AppUser,
        on_delete=models.CASCADE,
        related_name="travel_documents",
    )
    document_type = models.CharField(
        max_length=32,
        choices=DocType.choices,
        default=DocType.OTHER,
    )
    file_url = models.URLField()
    filename = models.CharField(max_length=255, blank=True, null=True)
    mime_type = models.CharField(max_length=128, blank=True, null=True)
    uploaded_at = models.DateTimeField(default=django_timezone.now)
    notes = models.TextField(blank=True, null=True)

    class Meta:
        db_table = "travel_document"

    def __str__(self):
        return self.filename or f"Doc {self.id}"


class TripPhoto(models.Model):
    trip = models.ForeignKey(
        Trip,
        on_delete=models.CASCADE,
        related_name="photos",
    )
    user = models.ForeignKey(
        AppUser,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="trip_photos",
    )
    itinerary_item = models.ForeignKey(
        ItineraryItem,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="photos",
    )

    file_url = models.URLField()
    caption = models.TextField(blank=True, null=True)
    lat = models.FloatField(blank=True, null=True)
    lon = models.FloatField(blank=True, null=True)
    taken_at = models.DateTimeField(blank=True, null=True)

    created_at = models.DateTimeField(default=django_timezone.now)

    class Meta:
        db_table = "trip_photo"

    def __str__(self):
        return f"Photo {self.id}"


class TripMediaHighlight(models.Model):
    trip = models.ForeignKey(
        Trip,
        on_delete=models.CASCADE,
        related_name="media_highlights",
    )
    user = models.ForeignKey(
        AppUser,
        on_delete=models.CASCADE,
        related_name="media_highlights",
    )

    title = models.CharField(max_length=255, blank=True, null=True)
    video_url = models.URLField()
    metadata = models.JSONField(blank=True, null=True)

    created_at = models.DateTimeField(default=django_timezone.now)

    class Meta:
        db_table = "trip_media_highlight"

    def __str__(self):
        return self.title or f"Highlight {self.id}"


class TripHistoryEntry(models.Model):
    user = models.ForeignKey(
        AppUser,
        on_delete=models.CASCADE,
        related_name="trip_history_entries",
    )
    trip = models.ForeignKey(
        Trip,
        on_delete=models.CASCADE,
        related_name="history_entries",
    )
    media_highlight = models.ForeignKey(
        TripMediaHighlight,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="history_entries",
    )

    summary = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(default=django_timezone.now)

    class Meta:
        db_table = "trip_history_entry"

    def __str__(self):
        return f"History {self.id}"


# --------------------------------------------------
# COMMUNITY FAQ & Q&A
# --------------------------------------------------

class CommunityFAQ(models.Model):
    country = models.CharField(max_length=100)
    category = models.CharField(max_length=50)
    question = models.TextField()
    answer = models.TextField()

    is_published = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "community_faq"
        unique_together = ("country", "category", "question")
        indexes = [
            models.Index(fields=["country"]),
            models.Index(fields=["country", "category"]),
        ]

    def __str__(self):
        return f"{self.country} [{self.category}] {self.question[:40]}"

class DestinationFAQ(models.Model):
    class SourceType(models.TextChoices):
        AI = "ai", "AI"
        COMMUNITY = "community", "Community"
        ADMIN = "admin", "Admin"

    destination = models.ForeignKey(
        Destination,
        on_delete=models.CASCADE,
        related_name="faqs",
    )
    question = models.TextField()
    answer = models.TextField()
    source_type = models.CharField(
        max_length=16,
        choices=SourceType.choices,
        default=SourceType.COMMUNITY,
    )
    upvotes = models.IntegerField(default=0)
    is_published = models.BooleanField(default=True)

    created_at = models.DateTimeField(default=django_timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "destination_faq"

    def __str__(self):
        return self.question[:50]


class DestinationQA(models.Model):
    destination = models.ForeignKey(
        Destination,
        on_delete=models.CASCADE,
        related_name="qa_entries",
    )
    author = models.ForeignKey(
        AppUser,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="qa_entries",
    )
    question = models.TextField()
    answer = models.TextField(blank=True, null=True)
    upvotes = models.IntegerField(default=0)
    is_public = models.BooleanField(default=True)

    created_at = models.DateTimeField(default=django_timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "destination_qa"

    def __str__(self):
        return self.question[:50]


# --------------------------------------------------
# SUPPORT & LEGAL
# --------------------------------------------------


class SupportTicket(models.Model):
    user = models.ForeignKey(
        AppUser,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="support_tickets",
    )
    email = models.EmailField(blank=True, null=True)
    subject = models.CharField(max_length=255)
    message = models.TextField()
    status = models.CharField(max_length=32, default="open")

    created_at = models.DateTimeField(default=django_timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "support_ticket"

    def __str__(self):
        return self.subject


class LegalDocument(models.Model):
    doc_type = models.CharField(max_length=64)  # e.g. 'privacy', 'terms'
    content = models.TextField()
    version = models.CharField(max_length=32, blank=True, null=True)
    published_at = models.DateTimeField(default=django_timezone.now)
    is_current = models.BooleanField(default=True)

    class Meta:
        db_table = "legal_document"

    def __str__(self):
        return f"{self.doc_type} v{self.version or '1.0'}"


# ============================================================================
# ============================================================================
# F1.5b - RECOMMENDATIONS SYSTEM MODELS
# NEW MODELS ADDED HERE FOR F1.5 AI RECOMMENDATIONS
# ============================================================================
# ============================================================================


class Guide(models.Model):
    """
    User-created travel guides that can be shared publicly.
    Used in F1.5b Recommendations Page - Featured Guides section.
    
    UPDATED: Now includes view tracking and save count
    """
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        PUBLISHED = "published", "Published"
        ARCHIVED = "archived", "Archived"
    
    author = models.ForeignKey(
        AppUser,
        on_delete=models.CASCADE,
        related_name="created_guides"
    )
    title = models.CharField(max_length=255)
    main_destination = models.CharField(max_length=255)
    countries = models.CharField(
        max_length=500, 
        blank=True, 
        null=True,
        help_text="Comma-separated list of countries covered"
    )
    
    description = models.TextField(blank=True, null=True)
    cover_image = models.URLField(max_length=500, blank=True, null=True)
    
    duration_days = models.IntegerField(default=1)
    
    is_public = models.BooleanField(default=False)
    verified = models.BooleanField(
        default=False,
        help_text="Verified guides show a verification badge"
    )
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.DRAFT
    )
    
    # ============================================================================
    # TRACKING FIELDS (UPDATED)
    # ============================================================================
    views = models.IntegerField(
        default=0,
        help_text="Number of times this guide was viewed"
    )
    saves = models.IntegerField(
        default=0,
        help_text="Number of users who saved this guide"
    )
    # ============================================================================
    
    created_at = models.DateTimeField(default=django_timezone.now)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = "guide"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=['is_public', 'status']),
            models.Index(fields=['main_destination']),
            models.Index(fields=['-views']),
            models.Index(fields=['-saves']),  # NEW: Index for sorting by saves
        ]
    
    def __str__(self):
        return f"{self.title} by {self.author.email}"
    
    # ============================================================================
    # HELPER METHODS (NEW)
    # ============================================================================
    def increment_views(self):
        """Increment view count when guide is viewed"""
        self.views = models.F('views') + 1
        self.save(update_fields=['views'])
        self.refresh_from_db()
    
    def increment_saves(self):
        """Increment save count when guide is saved"""
        self.saves = models.F('saves') + 1
        self.save(update_fields=['saves'])
        self.refresh_from_db()
    
    def decrement_saves(self):
        """Decrement save count when guide is unsaved"""
        if self.saves > 0:
            self.saves = models.F('saves') - 1
            self.save(update_fields=['saves'])
            self.refresh_from_db()


class SavedGuide(models.Model):
    """
    Tracks which guides users have saved.
    M2M relationship between AppUser and Guide.
    
    UPDATED: Now automatically updates Guide.saves count
    """
    user = models.ForeignKey(
        AppUser,
        on_delete=models.CASCADE,
        related_name="saved_guides"
    )
    guide = models.ForeignKey(
        Guide,
        on_delete=models.CASCADE,
        related_name="savedguide_set"  # IMPORTANT: matches query in f1_5_views.py
    )
    
    created_at = models.DateTimeField(default=django_timezone.now)
    
    class Meta:
        db_table = "saved_guide"
        unique_together = [["user", "guide"]]
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=['user', '-created_at']),
        ]
    
    def __str__(self):
        return f"{self.user.email} saved {self.guide.title}"
    
    # ============================================================================
    # AUTO-UPDATE SAVE COUNT (NEW)
    # ============================================================================
    def save(self, *args, **kwargs):
        """Override save to increment guide save count"""
        is_new = self.pk is None
        super().save(*args, **kwargs)
        
        if is_new:
            # Increment save count on the guide
            self.guide.increment_saves()
    
    def delete(self, *args, **kwargs):
        """Override delete to decrement guide save count"""
        guide = self.guide
        super().delete(*args, **kwargs)
        
        # Decrement save count on the guide
        guide.decrement_saves()


class SavedDestination(models.Model):
    """
    Tracks which destinations users have saved.
    M2M relationship between AppUser and Destination.
    
    Note: This is a junction table for the Destination model (which already exists).
    This just tracks the save action.
    """
    user = models.ForeignKey(
        AppUser,
        on_delete=models.CASCADE,
        related_name="saved_destinations_f15"  # Unique name to avoid conflicts
    )
    destination = models.ForeignKey(
        Destination,
        on_delete=models.CASCADE,
        related_name="saveddestination_set"  # IMPORTANT: matches query in f1_5_views.py
    )
    
    created_at = models.DateTimeField(default=django_timezone.now)
    
    class Meta:
        db_table = "saved_destination"
        unique_together = [["user", "destination"]]
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=['user', '-created_at']),
        ]
    
    def __str__(self):
        return f"{self.user.email} saved {self.destination.name}"


# ============================================================================
# OPTIONAL: Trip-as-Guide Metadata (For using existing Trips as Guides)
# ============================================================================

class TripGuideMetadata(models.Model):
    """
    Optional: Tracks metadata when existing Trips are used as Guides.
    This allows you to use Trip data without creating separate Guide objects.
    
    Usage:
    - Trip is the actual trip data (already exists)
    - TripGuideMetadata tracks views/saves when that trip is shown as a guide
    
    This is for the "use existing Trip data" approach.
    """
    trip = models.OneToOneField(
        Trip,
        on_delete=models.CASCADE,
        related_name='guide_metadata',
        help_text="The trip that is being used as a guide"
    )
    
    # Is this trip published as a guide?
    is_published_as_guide = models.BooleanField(
        default=False,
        help_text="Is this trip published in the recommendations system?"
    )
    
    # Featured/Promoted
    is_featured = models.BooleanField(
        default=False,
        help_text="Show in featured guides section?"
    )
    
    # Stats
    views = models.IntegerField(
        default=0,
        help_text="Number of times viewed as a guide"
    )
    saves = models.IntegerField(
        default=0,
        help_text="Number of users who saved this as a guide"
    )
    
    # Timestamps
    published_at = models.DateTimeField(
        null=True, 
        blank=True,
        help_text="When this trip was first published as a guide"
    )
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = "trip_guide_metadata"
        verbose_name = "Trip Guide Metadata"
        verbose_name_plural = "Trip Guide Metadata"
        indexes = [
            models.Index(fields=['is_published_as_guide', '-views']),
            models.Index(fields=['is_featured']),
            models.Index(fields=['-saves']),
        ]
    
    def __str__(self):
        return f"Guide Metadata for: {self.trip.title}"
    
    def increment_views(self):
        """Increment view count"""
        self.views = models.F('views') + 1
        self.save(update_fields=['views'])
        self.refresh_from_db()
    
    def increment_saves(self):
        """Increment save count"""
        self.saves = models.F('saves') + 1
        self.save(update_fields=['saves'])
        self.refresh_from_db()
    
    def decrement_saves(self):
        """Decrement save count"""
        if self.saves > 0:
            self.saves = models.F('saves') - 1
            self.save(update_fields=['saves'])
            self.refresh_from_db()


class SavedTripGuide(models.Model):
    """
    Optional: Tracks when users save a Trip (as a guide).
    This is for the "use existing Trip data" approach.
    
    Automatically updates TripGuideMetadata.saves count.
    """
    user = models.ForeignKey(
        AppUser,
        on_delete=models.CASCADE,
        related_name="saved_trip_guides"
    )
    trip = models.ForeignKey(
        Trip,
        on_delete=models.CASCADE,
        related_name="saved_as_guide_by"
    )
    
    created_at = models.DateTimeField(default=django_timezone.now)
    
    class Meta:
        db_table = "saved_trip_guide"
        unique_together = [["user", "trip"]]
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=['user', '-created_at']),
        ]
    
    def __str__(self):
        return f"{self.user.email} saved trip {self.trip.title} as guide"
    
    def save(self, *args, **kwargs):
        """Override save to increment trip guide save count"""
        is_new = self.pk is None
        super().save(*args, **kwargs)
        
        if is_new:
            # Get or create metadata
            metadata, created = TripGuideMetadata.objects.get_or_create(
                trip=self.trip,
                defaults={
                    'is_published_as_guide': True,
                    'published_at': django_timezone.now()
                }
            )
            metadata.increment_saves()
    
    def delete(self, *args, **kwargs):
        """Override delete to decrement trip guide save count"""
        trip = self.trip
        super().delete(*args, **kwargs)
        
        # Decrement save count
        try:
            metadata = TripGuideMetadata.objects.get(trip=trip)
            metadata.decrement_saves()
        except TripGuideMetadata.DoesNotExist:
            pass

# F1.5 RECOMMENDATIONS MODELS

class GroupPreference(models.Model):
    """
    Stores individual user preferences for group trips.
    Multiple users can save their preferences for the same trip.
    """
    trip = models.ForeignKey(
        Trip,
        on_delete=models.CASCADE,
        related_name="group_preferences"
    )
    user = models.ForeignKey(
        AppUser,
        on_delete=models.CASCADE,
        related_name="group_preferences"
    )
    preferences = models.JSONField(default=list)  # Stores array of preference objects
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "group_preference"
        unique_together = [["trip", "user"]]  # One preference per user per trip

    def __str__(self):
        return f"Preferences for {self.user.email} on Trip {self.trip.id}"