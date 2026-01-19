// frontend/src/pages/mediaHighlights.tsx
// ✅ HYBRID SYNC: Immediate local updates + Realtime for others
// ✅ Self upload: Shows immediately (optimistic update)
// ✅ Others upload: Realtime sync

import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/apiClient";
import { supabase } from "../lib/supabaseClient";
import { generateMapTripVideo } from "../lib/videoGenerator";
import TripSubHeader from "../components/TripSubHeader";
import ItineraryMap, { MapItineraryItem } from "../components/ItineraryMap";
import AutoGenerateVideoModal from "../components/AutoGenerateVideoModal";
import {
  Upload,
  Play,
  X,
  MapPin,
  Clock,
  Image as ImageIcon,
  Video,
  Trash2,
  Edit,
  Calendar,
  Download,
} from "lucide-react";

// Types (same as before)
interface TripPhoto {
  id: number;
  trip: number;
  user: number;
  itinerary_item?: number;
  file_url: string;
  caption?: string;
  lat?: number;
  lon?: number;
  taken_at?: string;
  created_at: string;
}

interface MediaHighlight {
  id: number;
  trip: number;
  user: number;
  title: string;
  video_url: string;
  metadata: any;
  created_at: string;
}

interface ItineraryItem {
  id: number;
  title: string;
  address: string | null;
  lat: number | null;
  lon: number | null;
  sort_order: number;
  day: number | null;
}

interface TripDay {
  id: number;
  trip: number;
  date: string | null;
  day_index: number;
}

interface Trip {
  id: number;
  title?: string;
  name?: string;
  main_city?: string;
  main_country?: string;
  start_date?: string;
  end_date?: string;
  items?: ItineraryItem[];
  days?: TripDay[];
}

interface PhotoFormData {
  file: File;
  caption: string;
  taken_at: string;
  itinerary_item: number | null;
}

interface PhotosByDay {
  dayId: number;
  dayIndex: number;
  date: string | null;
  photos: TripPhoto[];
}

export default function MediaHighlights() {
  const { tripId } = useParams();
  const navigate = useNavigate();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [items, setItems] = useState<ItineraryItem[]>([]);
  const [days, setDays] = useState<TripDay[]>([]);
  const [mapItems, setMapItems] = useState<MapItineraryItem[]>([]);
  const [photos, setPhotos] = useState<TripPhoto[]>([]);
  const [highlights, setHighlights] = useState<MediaHighlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Modals
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  // Upload state
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [photoForms, setPhotoForms] = useState<Map<number, PhotoFormData>>(new Map());
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // Edit state
  const [editingPhoto, setEditingPhoto] = useState<TripPhoto | null>(null);
  const [editCaption, setEditCaption] = useState("");
  const [editTakenAt, setEditTakenAt] = useState("");
  const [editItemId, setEditItemId] = useState<number | null>(null);

  // Generate highlight state
  const [generating, setGenerating] = useState(false);
  const [generateProgress, setGenerateProgress] = useState(0);
  const [generateStatus, setGenerateStatus] = useState("");
  const [downloading, setDownloading] = useState<number | null>(null);

  // Map state
  const [selectedPhoto, setSelectedPhoto] = useState<TripPhoto | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const getDateTimeFromItem = (itemId: number | null): string => {
    if (!itemId) {
      return new Date().toISOString().slice(0, 16);
    }

    const item = items.find(i => i.id === itemId);
    if (!item || !item.day) {
      return new Date().toISOString().slice(0, 16);
    }

    const day = days.find(d => d.id === item.day);
    if (!day || !day.date) {
      return new Date().toISOString().slice(0, 16);
    }

    const date = new Date(day.date);
    date.setHours(12, 0, 0, 0);
    
    return date.toISOString().slice(0, 16);
  };

  useEffect(() => {
    async function getCurrentUser() {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (error) {
          console.error("❌ Supabase auth error:", error);
          return;
        }
        
        if (user) {
          console.log("✅ Supabase user:", user.id, user.email);
          setCurrentUserId(user.id);
        }
      } catch (error) {
        console.error("❌ Failed to get current user:", error);
      }
    }
    
    getCurrentUser();
  }, []);

  // ✅ REALTIME: Only for events from OTHER users
  useEffect(() => {
    if (!tripId || !currentUserId) return;

    console.log("🔌 Setting up Realtime subscription for trip", tripId);

    const channel = supabase
      .channel(`trip-photos-${tripId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'trip_photo', // ✅ Your table name
          filter: `trip=eq.${tripId}`,
        },
        (payload) => {
          console.log('📡 Realtime event received:', payload);

          // ✅ Check if event is from another user
          const photoUserId = payload.new?.user || payload.old?.user;
          const isOwnEvent = photoUserId === parseInt(currentUserId);
          
          if (isOwnEvent) {
            console.log('⏭️  Skipping own event (already updated locally)');
            return;
          }

          // Handle events from OTHER users
          if (payload.eventType === 'INSERT') {
            const newPhoto = payload.new as TripPhoto;
            console.log('➕ Adding photo from another user:', newPhoto.id);
            
            setPhotos(prev => {
              if (prev.some(p => p.id === newPhoto.id)) {
                console.log('⚠️  Photo already exists, skipping');
                return prev;
              }
              return [...prev, newPhoto];
            });
          } 
          else if (payload.eventType === 'UPDATE') {
            const updatedPhoto = payload.new as TripPhoto;
            console.log('✏️ Updating photo from another user:', updatedPhoto.id);
            
            setPhotos(prev =>
              prev.map(p => p.id === updatedPhoto.id ? updatedPhoto : p)
            );
          } 
          else if (payload.eventType === 'DELETE') {
            const deletedPhoto = payload.old as TripPhoto;
            console.log('🗑️ Removing photo deleted by another user:', deletedPhoto.id);
            
            setPhotos(prev => prev.filter(p => p.id !== deletedPhoto.id));
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Subscription status:', status);
      });

    return () => {
      console.log("🔌 Cleaning up Realtime subscription...");
      supabase.removeChannel(channel);
    };
  }, [tripId, currentUserId]);

  // Load initial data
  useEffect(() => {
    if (!tripId) return;

    const loadData = async () => {
      try {
        setLoading(true);

        console.log("=== 📦 Loading Media Highlights Data ===");
        console.log(`Trip ID: ${tripId}`);

        const tripData = await apiFetch(`/f1/trips/${tripId}/`, { method: "GET" });
        console.log("Trip loaded:", {
          id: tripData.id,
          title: tripData.title,
          main_city: tripData.main_city,
          days: tripData.days?.length,
          items: tripData.items?.length,
        });

        const safeDays = Array.isArray(tripData?.days) ? tripData.days : [];
        const safeItems = Array.isArray(tripData?.items) ? tripData.items : [];

        setTrip(tripData);
        setItems(safeItems);
        setDays(safeDays);
        
        console.log(`✅ Set ${safeItems.length} items and ${safeDays.length} days to state`);

        const dayIndexMap = new Map<number, number>();
        safeDays.forEach((d: TripDay) => dayIndexMap.set(d.id, d.day_index));

        const mapped: MapItineraryItem[] = safeItems
          .filter((it: ItineraryItem) => it.lat != null && it.lon != null)
          .sort((a: ItineraryItem, b: ItineraryItem) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
          .map((it: ItineraryItem) => ({
            id: it.id,
            title: it.title,
            address: it.address ?? null,
            lat: it.lat!,
            lon: it.lon!,
            sort_order: it.sort_order ?? null,
            day_index: it.day ? dayIndexMap.get(it.day) ?? null : null,
            stop_index: null,
          }));

        setMapItems(mapped);
        console.log(`🗺️ Set ${mapped.length} map items`);

        const photosData = await apiFetch(`/f5/photos/?trip=${tripId}`, { method: "GET" });
        const photosList = Array.isArray(photosData) ? photosData : photosData?.results || [];
        
        const tripPhotos = photosList.filter((p: TripPhoto) => p.trip === parseInt(tripId));
        console.log(`📸 Photos loaded: ${tripPhotos.length} (filtered from ${photosList.length})`);
        
        setPhotos(tripPhotos);

        const highlightsData = await apiFetch(`/f5/highlights/?trip=${tripId}`, { method: "GET" });
        setHighlights(Array.isArray(highlightsData) ? highlightsData : highlightsData?.results || []);
        
        console.log("=== ✅ Data Loading Complete ===\n");
      } catch (error) {
        console.error("Failed to load data:", error);
        setTrip(null);
        setDays([]);
        setItems([]);
        setMapItems([]);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [tripId]);

  const deleteHighlight = async (highlightId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!confirm("Delete this video highlight?")) return;

    try {
      await apiFetch(`/f5/highlights/${highlightId}/`, { method: "DELETE" });
      setHighlights(prev => prev.filter(h => h.id !== highlightId));
      alert("✅ Video deleted successfully!");
    } catch (error) {
      console.error("Failed to delete highlight:", error);
      alert("❌ Failed to delete video.");
    }
  };

  const downloadHighlight = async (highlight: MediaHighlight, e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      setDownloading(highlight.id);

      const response = await fetch(highlight.video_url);
      const blob = await response.blob();

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${highlight.title.replace(/[^a-z0-9]/gi, '_')}.webm`;
      document.body.appendChild(a);
      a.click();
      
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      alert("✅ Video downloaded successfully!");
    } catch (error) {
      console.error("Download failed:", error);
      alert("❌ Failed to download video. Please try again.");
    } finally {
      setDownloading(null);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files).filter((file) =>
      file.type.match(/^image\/(jpeg|jpg|png)$/)
    );
    addFiles(files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files).filter((file) =>
        file.type.match(/^image\/(jpeg|jpg|png)$/)
      );
      addFiles(files);
    }
  };

  const addFiles = (files: File[]) => {
    const newForms = new Map(photoForms);
    const currentLength = selectedFiles.length;
    
    const defaultItemId = items.length > 0 ? items[0].id : null;
    
    files.forEach((file, idx) => {
      const index = currentLength + idx;
      newForms.set(index, {
        file,
        caption: file.name.replace(/\.[^/.]+$/, ""),
        taken_at: getDateTimeFromItem(defaultItemId),
        itinerary_item: defaultItemId,
      });
    });

    setSelectedFiles((prev) => [...prev, ...files]);
    setPhotoForms(newForms);
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    const newForms = new Map(photoForms);
    newForms.delete(index);
    setPhotoForms(newForms);
  };

  const updatePhotoForm = (index: number, field: keyof PhotoFormData, value: any) => {
    const newForms = new Map(photoForms);
    const existing = newForms.get(index);
    if (existing) {
      const updated = { ...existing, [field]: value };
      
      if (field === 'itinerary_item') {
        updated.taken_at = getDateTimeFromItem(value as number | null);
        console.log(`📅 Auto-updated date for item ${value}:`, updated.taken_at);
      }
      
      newForms.set(index, updated);
      setPhotoForms(newForms);
    }
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0 || !tripId) return;

    try {
      setUploading(true);

      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const formData = photoForms.get(i);
        if (!formData) continue;

        if (file.size > 10 * 1024 * 1024) {
          console.error(`File ${file.name} is too large`);
          continue;
        }

        const fileExt = file.name.split(".").pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${fileName}`;

        try {
          const { error: uploadError } = await supabase.storage
            .from("trip-media")
            .upload(filePath, file, { cacheControl: '3600', upsert: false });

          if (uploadError) throw uploadError;

          const { data: urlData } = supabase.storage
            .from("trip-media")
            .getPublicUrl(filePath);

          const selectedItem = items.find(item => item.id === formData.itinerary_item);
          const photoLat = selectedItem?.lat || null;
          const photoLon = selectedItem?.lon || null;

          const photoData = {
            trip: parseInt(tripId),
            file_url: urlData.publicUrl,
            caption: formData.caption,
            taken_at: formData.taken_at,
            itinerary_item: formData.itinerary_item,
            lat: photoLat,
            lon: photoLon,
          };

          // ✅ POST to API
          const createdPhoto = await apiFetch("/f5/photos/", {
            method: "POST",
            body: JSON.stringify(photoData),
          });
          
          console.log("✅ Photo created:", createdPhoto);

          // ✅ IMMEDIATELY add to local state (optimistic update)
          setPhotos(prev => {
            // Check if already exists (prevent duplicates)
            if (prev.some(p => p.id === createdPhoto.id)) {
              return prev;
            }
            return [...prev, createdPhoto];
          });
          
        } catch (storageError: any) {
          console.error("Storage error:", storageError);
          alert(`Upload failed: ${storageError.message || 'Storage bucket may not exist.'}`);
          break;
        }
      }

      // Reload trip data (items and days)
      const tripData = await apiFetch(`/f1/trips/${tripId}/`, { method: "GET" });
      setItems(tripData.items || []);
      setDays(tripData.days || []);

      setSelectedFiles([]);
      setPhotoForms(new Map());
      setShowUploadModal(false);
    } catch (error: any) {
      console.error("Upload failed:", error);
      alert(`Failed to upload files: ${error?.message || error}`);
    } finally {
      setUploading(false);
    }
  };

  const deletePhoto = async (photoId: number) => {
    if (!confirm("Delete this photo?")) return;

    try {
      // ✅ IMMEDIATELY remove from local state (optimistic update)
      setPhotos(prev => prev.filter(p => p.id !== photoId));
      
      // Then delete from backend
      await apiFetch(`/f5/photos/${photoId}/`, { method: "DELETE" });
      console.log("✅ Photo deleted:", photoId);
      
    } catch (error) {
      console.error("Failed to delete photo:", error);
      alert("Failed to delete photo.");
      
      // ✅ On error, reload photos to restore deleted photo
      const photosData = await apiFetch(`/f5/photos/?trip=${tripId}`, { method: "GET" });
      const photosList = Array.isArray(photosData) ? photosData : photosData?.results || [];
      const tripPhotos = photosList.filter((p: TripPhoto) => p.trip === parseInt(tripId!));
      setPhotos(tripPhotos);
    }
  };

  const openEditModal = (photo: TripPhoto) => {
    setEditingPhoto(photo);
    setEditCaption(photo.caption || "");
    setEditTakenAt(photo.taken_at || "");
    setEditItemId(photo.itinerary_item || null);
    setShowEditModal(true);
  };

  const handleEditPhoto = async () => {
    if (!editingPhoto || !tripId) return;

    try {
      const selectedItem = items.find(item => item.id === editItemId);
      const photoLat = selectedItem?.lat || null;
      const photoLon = selectedItem?.lon || null;

      const updateData = {
        caption: editCaption,
        taken_at: editTakenAt,
        itinerary_item: editItemId,
        lat: photoLat,
        lon: photoLon,
      };

      const updatedPhoto = await apiFetch(`/f5/photos/${editingPhoto.id}/`, {
        method: "PATCH",
        body: JSON.stringify(updateData),
      });

      console.log("✅ Photo updated:", updatedPhoto);

      // ✅ IMMEDIATELY update local state (optimistic update)
      setPhotos(prev =>
        prev.map(p => p.id === updatedPhoto.id ? updatedPhoto : p)
      );

      setShowEditModal(false);
      setEditingPhoto(null);
    } catch (error: any) {
      console.error("Failed to update photo:", error);
      alert(`Failed to update photo: ${error?.message || error}`);
    }
  };

  const handleGenerateWithSegments = async (
    segments: any[], 
    videoTitle: string, 
    generateReal: boolean
  ) => {
    try {
      setGenerating(true);
      setGenerateProgress(0);
      setGenerateStatus("Starting...");

      const allPhotoIds = new Set<number>();
      segments.forEach(seg => {
        seg.photo_ids.forEach((id: number) => allPhotoIds.add(id));
      });

      const selectedPhotos = photos.filter(p => allPhotoIds.has(p.id));

      let videoUrl = "https://placeholder.com/advanced-video.mp4";
      let videoDuration = 0;

      if (generateReal) {
        console.log("🎬 Generating real video with map animation...");
        
        const groups = segments.map(seg => {
          const stopItem = items.find(i => i.id === seg.stop_id);
          return {
            stop: {
              id: seg.stop_id,
              title: seg.stop_title,
              lat: stopItem?.lat || 0,
              lon: stopItem?.lon || 0,
            },
            photos: selectedPhotos
              .filter(p => seg.photo_ids.includes(p.id))
              .map(p => ({
                id: p.id,
                url: p.file_url,
                caption: p.caption,
              })),
          };
        });

        const transportModes: Record<string, string> = {};
        segments.forEach((seg, idx) => {
          if (idx < segments.length - 1 && seg.transport_mode) {
            const key = `${seg.stop_id}-${segments[idx + 1].stop_id}`;
            transportModes[key] = seg.transport_mode;
          }
        });

        const videoBlob = await generateMapTripVideo({
          groups,
          transportModes,
          title: videoTitle,
          onProgress: (progress, status) => {
            setGenerateProgress(progress);
            setGenerateStatus(status);
            console.log(`📊 Progress: ${progress.toFixed(1)}% - ${status}`);
          },
        });

        console.log("✅ Video generated! Size:", (videoBlob.size / 1024 / 1024).toFixed(2), "MB");

        setGenerateStatus("Uploading video to storage...");
        const fileName = `trip_${tripId}_${Date.now()}.webm`;
        const filePath = `videos/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("trip-media")
          .upload(filePath, videoBlob, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          console.error("Upload error:", uploadError);
          throw new Error(`Upload failed: ${uploadError.message}`);
        }

        const { data: urlData } = supabase.storage
          .from("trip-media")
          .getPublicUrl(filePath);

        videoUrl = urlData.publicUrl;
        
        videoDuration = 
          3 + 
          (segments.length - 1) * 5 + 
          selectedPhotos.length * 3 + 
          3;
        
        console.log("☁️ Video uploaded to:", videoUrl);
        setGenerateStatus("Saving to database...");
      }

      const highlightData = {
        trip: parseInt(tripId!),
        title: videoTitle,
        video_url: videoUrl,
        metadata: {
          segments: segments,
          all_photos: selectedPhotos.map(p => ({
            id: p.id,
            url: p.file_url,
            caption: p.caption,
          })),
          duration: videoDuration,
          generated_with_map: generateReal,
          photo_count: selectedPhotos.length,
          stop_count: segments.length,
        },
      };

      console.log("💾 Saving highlight to database...");

      await apiFetch("/f5/highlights/", {
        method: "POST",
        body: JSON.stringify(highlightData),
      });

      const highlightsData = await apiFetch(`/f5/highlights/?trip=${tripId}`, { method: "GET" });
      setHighlights(Array.isArray(highlightsData) ? highlightsData : highlightsData?.results || []);

      setShowGenerateModal(false);
      
      const message = generateReal 
        ? "✅ Real video created successfully! You can now watch it."
        : "✅ Placeholder video created successfully!";
      
      alert(message);
    } catch (error: any) {
      console.error("❌ Failed:", error);
      const errorMsg = error?.message || "Unknown error occurred";
      alert(`Failed to generate video: ${errorMsg}`);
    } finally {
      setGenerating(false);
      setGenerateProgress(0);
      setGenerateStatus("");
    }
  };

  const handleModalGenerate = (
    groups: any,
    transportModes: any,
    title: string,
    generateReal: boolean
  ) => {
    const segments = Array.isArray(groups) ? groups.map((group: any, idx: number) => ({
      stop_id: group.stop?.id || group.id,
      stop_title: group.stop?.title || group.title,
      photo_ids: group.photos?.map((p: any) => p.id) || [],
      transport_mode: idx < groups.length - 1 
        ? transportModes[`${group.stop?.id || group.id}-${groups[idx + 1]?.stop?.id || groups[idx + 1]?.id}`]
        : undefined,
    })) : [];

    handleGenerateWithSegments(segments, title, generateReal);
  };

  function formatDateTime(dateStr: string) {
    if (!dateStr) return "";
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return "";
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  }

  function getStopTitle(itemId: number | undefined): string {
    if (!itemId) return "";
    const item = trip?.items?.find(i => i.id === itemId);
    return item?.title || "";
  }

  const photoMarkers = React.useMemo(() => {
    return photos
      .filter((p: TripPhoto) => p.lat && p.lon && p.trip === parseInt(tripId || "0"))
      .map((p: TripPhoto) => ({
        id: p.id,
        file_url: p.file_url,
        lat: p.lat!,
        lon: p.lon!,
        caption: p.caption,
      }));
  }, [photos, tripId]);

  const photosByDay: PhotosByDay[] = React.useMemo(() => {
    if (days.length === 0) return [];
    
    const dayMap = new Map<number, PhotosByDay>();

    days.forEach(day => {
      dayMap.set(day.id, {
        dayId: day.id,
        dayIndex: day.day_index,
        date: day.date,
        photos: [],
      });
    });

    photos.forEach(photo => {
      if (photo.itinerary_item) {
        const item = items.find(i => i.id === photo.itinerary_item);
        if (item?.day) {
          const dayGroup = dayMap.get(item.day);
          if (dayGroup) {
            dayGroup.photos.push(photo);
          }
        }
      }
    });

    return Array.from(dayMap.values())
      .filter(day => day.photos.length > 0)
      .sort((a, b) => a.dayIndex - b.dayIndex);
  }, [photos, days, items]);

  if (loading) {
    return (
      <>
        <TripSubHeader />
        <div style={loadingContainer}>
          <div className="spinner" />
          <div style={{ marginTop: 16, fontSize: 14, color: "#6b7280" }}>Loading media...</div>
        </div>
      </>
    );
  }

  return (
    <>
      <TripSubHeader />

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spinner {
          width: 40px;
          height: 40px;
          border: 4px solid rgba(245, 158, 11, 0.2);
          border-top-color: #f59e0b;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
      `}</style>

      <div style={pageContainer}>
        <div style={{
          maxWidth: 1400,
          margin: "0 auto",
          padding: 24,
          display: "grid",
          gridTemplateColumns: "1.2fr 0.8fr",
          gap: 20,
          alignItems: "start",
        }}>
          <div style={{
            background: "#fff",
            borderRadius: 18,
            border: "1px solid #e8edff",
            boxShadow: "0 8px 24px rgba(24, 49, 90, 0.08)",
            overflow: "hidden",
            minHeight: 700,
          }}>
            <ItineraryMap items={mapItems} photos={photoMarkers} />
          </div>

          <div style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}>
            <div style={actionButtons}>
              <button onClick={() => setShowUploadModal(true)} style={uploadButton}>
                <Upload size={16} strokeWidth={2.5} />
                Upload Photo
              </button>
              <button 
                onClick={() => {
                  if (photos.length === 0) {
                    alert("⚠️ Please upload photos first!");
                    return;
                  }
                  setShowGenerateModal(true);
                }} 
                style={{
                  ...generateButton,
                  opacity: photos.length === 0 || generating ? 0.5 : 1,
                  cursor: photos.length === 0 || generating ? 'not-allowed' : 'pointer',
                }} 
                disabled={photos.length === 0 || generating}
              >
                <Video size={16} strokeWidth={2.5} />
                {generating ? "Generating..." : "Create Highlight Video"}
              </button>
            </div>

            <div style={timelineCard}>
              <div style={cardTitle}>
                <Clock size={18} />
                Trip Timeline by Day
              </div>

              {photosByDay.length === 0 ? (
                <div style={emptyState}>
                  <ImageIcon size={40} strokeWidth={1.5} />
                  <div style={{ marginTop: 12, fontSize: 14, fontWeight: 600 }}>No photos yet</div>
                  <div style={{ marginTop: 6, fontSize: 12, color: "#6b7280" }}>
                    Upload photos to start
                  </div>
                </div>
              ) : (
                <div style={photoList}>
                  {photosByDay.map((dayGroup) => (
                    <div key={dayGroup.dayId} style={{ marginBottom: 16 }}>
                      <div style={dayHeader}>
                        <Calendar size={14} />
                        Day {dayGroup.dayIndex}
                        {dayGroup.date && (
                          <span style={{ marginLeft: 8, fontSize: 11, color: "#6b7280" }}>
                            {new Date(dayGroup.date).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        )}
                        <span style={{ marginLeft: "auto", fontSize: 11, color: "#6b7280" }}>
                          {dayGroup.photos.length} photo{dayGroup.photos.length !== 1 ? "s" : ""}
                        </span>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
                        {dayGroup.photos.map((photo) => (
                          <div key={photo.id} style={photoItem}>
                            <div
                              style={{
                                width: 60,
                                height: 60,
                                borderRadius: 8,
                                backgroundImage: `url(${photo.file_url})`,
                                backgroundSize: "cover",
                                backgroundPosition: "center",
                                flexShrink: 0,
                                cursor: "pointer",
                              }}
                              onClick={() => setSelectedPhoto(photo)}
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={photoItemTitle}>
                                {photo.caption || "Photo"}
                              </div>
                              <div style={photoItemMeta}>
                                <Clock size={10} style={{ display: "inline", marginRight: 4 }} />
                                {formatDateTime(photo.taken_at || photo.created_at)}
                              </div>
                              {photo.itinerary_item && (
                                <div style={photoItemLocation}>
                                  <MapPin size={12} />
                                  {getStopTitle(photo.itinerary_item)}
                                </div>
                              )}
                            </div>
                            <div style={{ display: "flex", gap: 4 }}>
                              <button onClick={() => openEditModal(photo)} style={editButton}>
                                <Edit size={14} />
                              </button>
                              <button onClick={() => deletePhoto(photo.id)} style={deleteButton}>
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={highlightsCard}>
              <div style={cardTitle}>
                <Play size={18} />
                Trip Highlights
              </div>

              {highlights.length === 0 ? (
                <div style={emptyState}>
                  <Video size={40} strokeWidth={1.5} />
                  <div style={{ marginTop: 12, fontSize: 14, fontWeight: 600 }}>
                    No highlights yet
                  </div>
                  <div style={{ marginTop: 6, fontSize: 12, color: "#6b7280" }}>
                    Create a highlight video
                  </div>
                </div>
              ) : (
                <div style={highlightsList}>
                  {highlights.map((highlight) => (
                    <div 
                      key={highlight.id} 
                      style={highlightItem}
                    >
                      <div 
                        style={highlightMainContent}
                        onClick={() => navigate(`/trip/${tripId}/highlight/${highlight.id}`)}
                      >
                        <div style={highlightThumbnail}>
                          <Play size={28} style={{ opacity: 0.9 }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={highlightTitleStyle}>{highlight.title}</div>
                          <div style={highlightMeta}>
                            {highlight.metadata?.photo_count || highlight.metadata?.all_photos?.length || 0} photos •{" "}
                            {highlight.metadata?.duration || 0}s
                            {highlight.metadata?.generated_with_map && " • Map"}
                          </div>
                        </div>
                      </div>

                      <div style={highlightActions}>
                        <button 
                          onClick={(e) => downloadHighlight(highlight, e)} 
                          style={highlightDownloadBtn}
                          disabled={downloading === highlight.id}
                          title="Download video"
                        >
                          <Download size={14} />
                        </button>
                        <button 
                          onClick={(e) => deleteHighlight(highlight.id, e)} 
                          style={highlightDeleteBtn}
                          title="Delete video"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Rest of modals - same as before */}
      {selectedPhoto && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000,
            padding: "20px",
          }}
          onClick={() => setSelectedPhoto(null)}
        >
          <button
            onClick={() => setSelectedPhoto(null)}
            style={{
              position: "absolute",
              top: 20,
              right: 20,
              width: 44,
              height: 44,
              borderRadius: "50%",
              border: "none",
              background: "rgba(255,255,255,0.9)",
              color: "#111827",
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
              zIndex: 2001,
            }}
          >
            <X size={24} />
          </button>

          <div
            style={{
              maxWidth: "90vw",
              maxHeight: "90vh",
              background: "white",
              borderRadius: "16px",
              overflow: "hidden",
              boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={selectedPhoto.file_url}
              alt={selectedPhoto.caption || "Trip photo"}
              style={{
                width: "100%",
                height: "auto",
                maxHeight: "calc(90vh - 120px)",
                objectFit: "contain",
                display: "block",
              }}
            />
            
            {(selectedPhoto.caption || selectedPhoto.itinerary_item) && (
              <div
                style={{
                  padding: "20px",
                  background: "white",
                  borderTop: "1px solid #e5e7eb",
                }}
              >
                {selectedPhoto.caption && (
                  <div
                    style={{
                      fontSize: "16px",
                      color: "#111827",
                      fontWeight: 600,
                      marginBottom: 8,
                    }}
                  >
                    {selectedPhoto.caption}
                  </div>
                )}
                
                {selectedPhoto.itinerary_item && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: "13px",
                      color: "#6b7280",
                    }}
                  >
                    <MapPin size={14} />
                    {getStopTitle(selectedPhoto.itinerary_item)}
                  </div>
                )}
                
                {selectedPhoto.taken_at && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: "13px",
                      color: "#6b7280",
                      marginTop: 4,
                    }}
                  >
                    <Clock size={14} />
                    {formatDateTime(selectedPhoto.taken_at)}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {showUploadModal && (
        <div style={modalOverlay} onClick={() => setShowUploadModal(false)}>
          <div style={modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeader}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Upload Photos</h2>
              <button onClick={() => setShowUploadModal(false)} style={closeButton}>
                <X size={20} />
              </button>
            </div>

            <div
              style={{
                ...dropZone,
                ...(dragActive ? dropZoneActive : {}),
              }}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={40} strokeWidth={1.5} />
              <div style={{ marginTop: 12, fontSize: 14, fontWeight: 600 }}>
                Drop photos here or click to browse
              </div>
              <div style={{ marginTop: 6, fontSize: 12, color: "#6b7280" }}>
                JPG, PNG up to 10MB each
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/jpeg,image/jpg,image/png"
                onChange={handleFileSelect}
                style={{ display: "none" }}
              />
            </div>

            {selectedFiles.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
                  {selectedFiles.length} photo{selectedFiles.length !== 1 ? "s" : ""} selected
                </div>

                <div style={filesList}>
                  {selectedFiles.map((file, index) => {
                    const form = photoForms.get(index);
                    if (!form) return null;

                    return (
                      <div key={index} style={fileItem}>
                        <div
                          style={{
                            width: 60,
                            height: 60,
                            borderRadius: 8,
                            backgroundImage: `url(${URL.createObjectURL(file)})`,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                            flexShrink: 0,
                          }}
                        />

                        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                          <input
                            value={form.caption}
                            onChange={(e) => updatePhotoForm(index, "caption", e.target.value)}
                            placeholder="Caption"
                            style={inputStyle}
                          />

                          <input
                            type="datetime-local"
                            value={form.taken_at}
                            onChange={(e) => updatePhotoForm(index, "taken_at", e.target.value)}
                            style={inputStyle}
                          />

                          <select
                            value={form.itinerary_item || ""}
                            onChange={(e) =>
                              updatePhotoForm(index, "itinerary_item", parseInt(e.target.value))
                            }
                            style={inputStyle}
                          >
                            <option value="">No location</option>
                            {items.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.title}
                              </option>
                            ))}
                          </select>
                        </div>

                        <button onClick={() => removeFile(index)} style={deleteButton}>
                          <X size={16} />
                        </button>
                      </div>
                    );
                  })}
                </div>

                <button
                  onClick={handleUpload}
                  disabled={uploading}
                  style={{
                    ...uploadButton,
                    width: "100%",
                    marginTop: 16,
                    opacity: uploading ? 0.6 : 1,
                  }}
                >
                  {uploading ? "Uploading..." : "Upload All Photos"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {showEditModal && editingPhoto && (
        <div style={modalOverlay} onClick={() => setShowEditModal(false)}>
          <div style={modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeader}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Edit Photo</h2>
              <button onClick={() => setShowEditModal(false)} style={closeButton}>
                <X size={20} />
              </button>
            </div>

            <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 12 }}>
              <div
                style={{
                  width: "100%",
                  height: 200,
                  borderRadius: 12,
                  backgroundImage: `url(${editingPhoto.file_url})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              />

              <input
                value={editCaption}
                onChange={(e) => setEditCaption(e.target.value)}
                placeholder="Caption"
                style={inputStyle}
              />

              <input
                type="datetime-local"
                value={editTakenAt}
                onChange={(e) => setEditTakenAt(e.target.value)}
                style={inputStyle}
              />

              <select
                value={editItemId || ""}
                onChange={(e) => setEditItemId(parseInt(e.target.value))}
                style={inputStyle}
              >
                <option value="">No location</option>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>

              <button
                onClick={handleEditPhoto}
                style={{ ...uploadButton, width: "100%", marginTop: 8 }}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {showGenerateModal && (
        <AutoGenerateVideoModal
          show={showGenerateModal}
          stops={items.map(item => ({
            id: item.id,
            title: item.title,
            lat: item.lat || 0,
            lon: item.lon || 0,
          }))}
          photos={photos.map(p => ({
            id: p.id,
            url: p.file_url,
            caption: p.caption,
            itinerary_item: p.itinerary_item,
          }))}
          onClose={() => {
            setShowGenerateModal(false);
          }}
          onGenerate={handleModalGenerate}
          generating={generating}
          generateProgress={generateProgress}
          generateStatus={generateStatus}
        />
      )}
    </>
  );
}

// Styles (same as before)
const loadingContainer: React.CSSProperties = { minHeight: "calc(100vh - 90px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#f9fafb" };
const pageContainer: React.CSSProperties = { background: "#f5f7fb", minHeight: "100vh", padding: 0, fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' };
const actionButtons: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 10, background: "#fff", borderRadius: 16, padding: "16px 18px", boxShadow: "0 8px 24px rgba(24, 49, 90, 0.08)", border: "1px solid #e8edff" };
const uploadButton: React.CSSProperties = { padding: "10px 16px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #f59e0b 0%, #f97316 100%)", color: "white", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", boxShadow: "0 4px 12px rgba(245, 158, 11, 0.25)" };
const generateButton: React.CSSProperties = { padding: "10px 16px", borderRadius: 12, border: "1px solid #e5e7eb", background: "white", color: "#111827", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer" };
const timelineCard: React.CSSProperties = { background: "#fff", borderRadius: 16, padding: "16px 18px", border: "1px solid #e8edff", boxShadow: "0 8px 24px rgba(24, 49, 90, 0.08)" };
const cardTitle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, fontSize: 15, fontWeight: 700, color: "#1a2b4d", marginBottom: 12 };
const photoList: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 10, maxHeight: 400, overflowY: "auto" };
const dayHeader: React.CSSProperties = { display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", background: "#f3f4f6", borderRadius: 8, fontSize: 13, fontWeight: 700, color: "#374151" };
const photoItem: React.CSSProperties = { display: "flex", alignItems: "center", gap: 12, padding: 10, background: "white", borderRadius: 12, border: "1px solid #e5e7eb", transition: "all 0.2s ease", position: "relative" };
const photoItemTitle: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
const photoItemMeta: React.CSSProperties = { fontSize: 11, color: "#6b7280", marginTop: 2 };
const photoItemLocation: React.CSSProperties = { fontSize: 11, color: "#f59e0b", marginTop: 2, display: "flex", alignItems: "center", gap: 4 };
const editButton: React.CSSProperties = { width: 28, height: 28, borderRadius: 8, border: "none", background: "#dbeafe", color: "#2563eb", display: "grid", placeItems: "center", cursor: "pointer", flexShrink: 0 };
const deleteButton: React.CSSProperties = { width: 28, height: 28, borderRadius: 8, border: "none", background: "#fee2e2", color: "#ef4444", display: "grid", placeItems: "center", cursor: "pointer", flexShrink: 0 };
const highlightsCard: React.CSSProperties = { background: "#fff", borderRadius: 16, padding: "16px 18px", border: "1px solid #e8edff", boxShadow: "0 8px 24px rgba(24, 49, 90, 0.08)" };
const highlightsList: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 10 };
const highlightItem: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: 10, background: "white", borderRadius: 12, border: "1px solid #e5e7eb", transition: "all 0.2s ease" };
const highlightMainContent: React.CSSProperties = { display: "flex", alignItems: "center", gap: 12, flex: 1, cursor: "pointer" };
const highlightActions: React.CSSProperties = { display: "flex", gap: 4, marginLeft: 8 };
const highlightDownloadBtn: React.CSSProperties = { width: 32, height: 32, borderRadius: 8, border: "none", background: "#dcfce7", color: "#16a34a", display: "grid", placeItems: "center", cursor: "pointer", flexShrink: 0, transition: "all 0.2s ease" };
const highlightDeleteBtn: React.CSSProperties = { width: 32, height: 32, borderRadius: 8, border: "none", background: "#fee2e2", color: "#ef4444", display: "grid", placeItems: "center", cursor: "pointer", flexShrink: 0, transition: "all 0.2s ease" };
const highlightThumbnail: React.CSSProperties = { width: 60, height: 60, borderRadius: 8, background: "linear-gradient(135deg, #f59e0b, #f97316)", display: "grid", placeItems: "center", color: "white", flexShrink: 0 };
const highlightTitleStyle: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: "#111827" };
const highlightMeta: React.CSSProperties = { fontSize: 11, color: "#6b7280", marginTop: 2 };
const emptyState: React.CSSProperties = { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "30px 20px", color: "#9ca3af", textAlign: "center" };
const modalOverlay: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 };
const modalContent: React.CSSProperties = { background: "white", borderRadius: 16, padding: 24, maxWidth: 600, width: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" };
const modalHeader: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 };
const closeButton: React.CSSProperties = { width: 32, height: 32, borderRadius: 8, border: "none", background: "#f3f4f6", display: "grid", placeItems: "center", cursor: "pointer" };
const dropZone: React.CSSProperties = { border: "2px dashed #d1d5db", borderRadius: 12, padding: "40px 20px", textAlign: "center", cursor: "pointer", transition: "all 0.2s ease", color: "#6b7280" };
const dropZoneActive: React.CSSProperties = { borderColor: "#f59e0b", background: "#fffbeb", color: "#f59e0b" };
const filesList: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 12, maxHeight: 400, overflowY: "auto" };
const fileItem: React.CSSProperties = { display: "flex", gap: 12, padding: 12, border: "1px solid #e5e7eb", borderRadius: 12, background: "white" };
const inputStyle: React.CSSProperties = { width: "100%", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 13, outline: "none" };