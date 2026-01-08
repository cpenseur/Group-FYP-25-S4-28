// frontend/src/pages/mediaHighlights.tsx - FIXED VERSION

import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/apiClient";
import { supabase } from "../lib/supabaseClient";
import { generateMapTripVideo } from "../lib/videoGenerator";
import TripSubHeader from "../components/TripSubHeader";
import ItineraryMap from "../components/ItineraryMap";
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
} from "lucide-react";

// Types
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

export default function MediaHighlights() {
  const { tripId } = useParams();
  const navigate = useNavigate();

  const [trip, setTrip] = useState<Trip | null>(null);
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

  // Map state
  const [selectedPhoto, setSelectedPhoto] = useState<TripPhoto | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function getCurrentUser() {
      try {
        // Get user from Supabase directly (no Django backend call needed)
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
  }, []); // Remove tripId dependency

  useEffect(() => {
    if (!tripId) return;
    loadData();
  }, [tripId]);

  async function loadData() {
    if (!tripId) return;

    try {
      setLoading(true);

      const tripData = await apiFetch(`/f1/trips/${tripId}/`, { method: "GET" });
      setTrip(tripData);

      const photosData = await apiFetch(`/f5/photos/?trip=${tripId}`, { method: "GET" });
      const photosList = Array.isArray(photosData) ? photosData : photosData?.results || [];
      setPhotos(photosList);

      const highlightsData = await apiFetch(`/f5/highlights/?trip=${tripId}`, { method: "GET" });
      setHighlights(Array.isArray(highlightsData) ? highlightsData : highlightsData?.results || []);
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  }

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
    
    files.forEach((file, idx) => {
      const index = currentLength + idx;
      newForms.set(index, {
        file,
        caption: file.name.replace(/\.[^/.]+$/, ""),
        taken_at: new Date().toISOString().slice(0, 16),
        itinerary_item: trip?.items?.[0]?.id || null,
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
      newForms.set(index, { ...existing, [field]: value });
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

          const selectedItem = trip?.items?.find(item => item.id === formData.itinerary_item);
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

          await apiFetch("/f5/photos/", {
            method: "POST",
            body: JSON.stringify(photoData),
          });
        } catch (storageError: any) {
          console.error("Storage error:", storageError);
          alert(`Upload failed: ${storageError.message || 'Storage bucket may not exist.'}`);
          break;
        }
      }

      await loadData();
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
      await apiFetch(`/f5/photos/${photoId}/`, { method: "DELETE" });
      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
    } catch (error) {
      console.error("Failed to delete photo:", error);
      alert("Failed to delete photo.");
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
    if (!editingPhoto) return;

    try {
      const selectedItem = trip?.items?.find(item => item.id === editItemId);
      const photoLat = selectedItem?.lat || null;
      const photoLon = selectedItem?.lon || null;

      const updateData = {
        caption: editCaption,
        taken_at: editTakenAt,
        itinerary_item: editItemId,
        lat: photoLat,
        lon: photoLon,
      };

      await apiFetch(`/f5/photos/${editingPhoto.id}/`, {
        method: "PATCH",
        body: JSON.stringify(updateData),
      });

      await loadData();
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
        // Real video generation with MapLibre
        console.log("🎬 Generating real video with map animation...");
        
        // Prepare data for video generator
        const groups = segments.map(seg => {
          const stopItem = trip?.items?.find(i => i.id === seg.stop_id);
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

        // Generate video using Leaflet (no API key needed!)
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

        // Upload to Supabase Storage
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
        
        // Estimate duration based on segments
        videoDuration = 
          3 + // Title slide
          (segments.length - 1) * 5 + // Travel animations
          selectedPhotos.length * 3 + // Photos
          3; // End slide
        
        console.log("☁️ Video uploaded to:", videoUrl);
        setGenerateStatus("Saving to database...");
      }

      // Save to database
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

      await loadData();
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

  const dayIndexMap = new Map((trip?.days || []).map((d) => [d.id, d.day_index]));
  const items = trip?.items || [];
  
  const itemsInTripOrder = [...items].sort((a, b) => {
    const da = dayIndexMap.get(a.day ?? 0) ?? 0;
    const db = dayIndexMap.get(b.day ?? 0) ?? 0;
    if (da !== db) return da - db;
    return (a.sort_order ?? 0) - (b.sort_order ?? 0);
  });

  const mapItems = itemsInTripOrder.map((it, idx) => {
    const dayIdx = dayIndexMap.get(it.day ?? 0) ?? null;
    return {
      id: it.id,
      title: it.title,
      address: it.address,
      lat: it.lat,
      lon: it.lon,
      sort_order: idx + 1,
      day_index: dayIdx,
      stop_index: null,
    };
  });

  const photoMarkers = photos
    .filter((p) => p.lat && p.lon)
    .map((p) => ({
      id: p.id,
      file_url: p.file_url,
      lat: p.lat!,
      lon: p.lon!,
      caption: p.caption,
    }));

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
        <div style={mainGrid}>
          <div style={mapSection}>
            <ItineraryMap items={mapItems} photos={photoMarkers} />
          </div>

          <div style={sidebarSection}>
            <div style={actionButtons}>
              <button onClick={() => setShowUploadModal(true)} style={uploadButton}>
                <Upload size={16} strokeWidth={2.5} />
                Upload Photo
              </button>
              <button 
                onClick={() => setShowGenerateModal(true)} 
                style={generateButton} 
                disabled={photos.length === 0 || generating}
              >
                <Video size={16} strokeWidth={2.5} />
                {generating ? "Generating..." : "Create Highlight Video"}
              </button>
            </div>

            <div style={timelineCard}>
              <div style={cardTitle}>
                <Clock size={18} />
                Trip Timeline
              </div>

              {photos.length === 0 ? (
                <div style={emptyState}>
                  <ImageIcon size={40} strokeWidth={1.5} />
                  <div style={{ marginTop: 12, fontSize: 14, fontWeight: 600 }}>No photos yet</div>
                  <div style={{ marginTop: 6, fontSize: 12, color: "#6b7280" }}>
                    Upload photos to start
                  </div>
                </div>
              ) : (
                <div style={photoList}>
                  {photos.map((photo) => (
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
                          <Calendar size={10} style={{ display: "inline", marginRight: 4 }} />
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
                      style={{...highlightItem, cursor: "pointer"}}
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
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {selectedPhoto && (
        <div style={modalOverlay} onClick={() => setSelectedPhoto(null)}>
          <div style={photoPreviewCard} onClick={(e) => e.stopPropagation()}>
            <img
              src={selectedPhoto.file_url}
              alt={selectedPhoto.caption || "Trip photo"}
              style={photoPreviewImage}
            />
            {selectedPhoto.caption && (
              <div style={photoCaption}>{selectedPhoto.caption}</div>
            )}
          </div>
        </div>
      )}

      {showUploadModal && (
        <div style={modalOverlay} onClick={() => setShowUploadModal(false)}>
          <div style={uploadModalContent} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeader}>
              <div style={modalTitle}>Upload Photos</div>
              <button onClick={() => setShowUploadModal(false)} style={closeButton}>
                <X size={20} />
              </button>
            </div>

            <div
              style={{
                ...dropZone,
                borderColor: dragActive ? "#f59e0b" : "rgba(17, 24, 39, 0.1)",
                background: dragActive ? "rgba(245, 158, 11, 0.05)" : "#fafafa",
              }}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={40} style={{ color: "#f59e0b" }} />
              <div style={{ marginTop: 16, fontSize: 16, fontWeight: 600 }}>
                Drag and Drop here to Upload Photos
              </div>
              <div style={{ marginTop: 8, fontSize: 14, color: "#6b7280" }}>
                <span style={{ textDecoration: "underline", cursor: "pointer" }}>
                  Choose Files from your computer
                </span>
              </div>
              <div style={{ marginTop: 12, fontSize: 12, color: "#9ca3af" }}>
                Supports: JPG, PNG (max 10MB per file)
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
              <div style={filesSection}>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
                  Photo Details ({selectedFiles.length} photo{selectedFiles.length > 1 ? 's' : ''})
                </div>
                <div style={filesList}>
                  {selectedFiles.map((file, idx) => {
                    const formData = photoForms.get(idx);
                    if (!formData) return null;

                    return (
                      <div key={idx} style={photoFormCard}>
                        <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                          <img
                            src={URL.createObjectURL(file)}
                            alt=""
                            style={filePreview}
                            onLoad={(e) => URL.revokeObjectURL((e.target as HTMLImageElement).src)}
                          />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
                              {file.name}
                            </div>
                            <button onClick={() => removeFile(idx)} style={removePhotoButton}>
                              <Trash2 size={12} />
                              Remove
                            </button>
                          </div>
                        </div>

                        <div style={formGroup}>
                          <label style={formLabel}>Caption/Title</label>
                          <input
                            type="text"
                            value={formData.caption}
                            onChange={(e) => updatePhotoForm(idx, 'caption', e.target.value)}
                            style={formInput}
                            placeholder="Enter photo caption..."
                          />
                        </div>

                        <div style={formGroup}>
                          <label style={formLabel}>Date & Time</label>
                          <input
                            type="datetime-local"
                            value={formData.taken_at}
                            onChange={(e) => updatePhotoForm(idx, 'taken_at', e.target.value)}
                            style={formInput}
                          />
                        </div>

                        <div style={formGroup}>
                          <label style={formLabel}>Associated Stop</label>
                          <select
                            value={formData.itinerary_item || ""}
                            onChange={(e) => updatePhotoForm(idx, 'itinerary_item', e.target.value ? parseInt(e.target.value) : null)}
                            style={formSelect}
                          >
                            <option value="">No specific stop</option>
                            {itemsInTripOrder.map((item, itemIdx) => (
                              <option key={item.id} value={item.id}>
                                {itemIdx + 1}. {item.title}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={modalFooter}>
              <button onClick={() => setShowUploadModal(false)} style={cancelButton}>
                Cancel
              </button>
              <button
                onClick={handleUpload}
                style={saveButton}
                disabled={uploading || selectedFiles.length === 0}
              >
                {uploading ? "Uploading..." : `Upload ${selectedFiles.length} Photo${selectedFiles.length > 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && editingPhoto && (
        <div style={modalOverlay} onClick={() => setShowEditModal(false)}>
          <div style={editModalContent} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeader}>
              <div style={modalTitle}>Edit Photo</div>
              <button onClick={() => setShowEditModal(false)} style={closeButton}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: "24px 28px" }}>
              <img
                src={editingPhoto.file_url}
                alt=""
                style={{ width: "100%", height: 200, objectFit: "cover", borderRadius: 12, marginBottom: 20 }}
              />

              <div style={formGroup}>
                <label style={formLabel}>Caption/Title</label>
                <input
                  type="text"
                  value={editCaption}
                  onChange={(e) => setEditCaption(e.target.value)}
                  style={formInput}
                  placeholder="Enter photo caption..."
                />
              </div>

              <div style={formGroup}>
                <label style={formLabel}>Date & Time</label>
                <input
                  type="datetime-local"
                  value={editTakenAt}
                  onChange={(e) => setEditTakenAt(e.target.value)}
                  style={formInput}
                />
              </div>

              <div style={formGroup}>
                <label style={formLabel}>Associated Stop</label>
                <select
                  value={editItemId || ""}
                  onChange={(e) => setEditItemId(e.target.value ? parseInt(e.target.value) : null)}
                  style={formSelect}
                >
                  <option value="">No specific stop</option>
                  {itemsInTripOrder.map((item, idx) => (
                    <option key={item.id} value={item.id}>
                      {idx + 1}. {item.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={modalFooter}>
              <button onClick={() => setShowEditModal(false)} style={cancelButton}>
                Cancel
              </button>
              <button onClick={handleEditPhoto} style={saveButton}>
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      <AutoGenerateVideoModal  
        show={showGenerateModal}
        onClose={() => !generating && setShowGenerateModal(false)}
        photos={photos.map(p => ({
          id: p.id,
          url: p.file_url,
          caption: p.caption,
          itinerary_item: p.itinerary_item,
        }))}
        stops={trip?.items?.map(item => ({
          id: item.id,
          title: item.title,
          lat: item.lat,
          lon: item.lon,
        })) || []}
        onGenerate={(groups, transportModes, title, generateReal) => {
          const segments = groups.map((g, idx) => ({
            order: idx + 1,
            stop_id: g.stop.id,
            stop_title: g.stop.title,
            photo_ids: g.photos.map(p => p.id),
            transport_mode:
              idx < groups.length - 1
                ? (transportModes[`${g.stop.id}-${groups[idx + 1].stop.id}`] || "plane")
                : null,
          }));

          handleGenerateWithSegments(segments, title, generateReal);
        }}
        generating={generating}
        generateProgress={generateProgress}
        generateStatus={generateStatus}
      />
    </>
  );
}

// Styles
const loadingContainer: React.CSSProperties = { minHeight: "calc(100vh - 90px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#f9fafb" };
const pageContainer: React.CSSProperties = { background: "#f9fafb", minHeight: "calc(100vh - 90px)", padding: 0, fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' };
const mainGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 400px", height: "calc(100vh - 90px)", gap: 0 };
const mapSection: React.CSSProperties = { position: "relative", height: "100%" };
const sidebarSection: React.CSSProperties = { background: "white", borderLeft: "1px solid #e5e7eb", overflowY: "auto", padding: "20px", display: "flex", flexDirection: "column", gap: 16 };
const actionButtons: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 10 };
const uploadButton: React.CSSProperties = { padding: "10px 16px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #f59e0b 0%, #f97316 100%)", color: "white", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", boxShadow: "0 4px 12px rgba(245, 158, 11, 0.25)" };
const generateButton: React.CSSProperties = { padding: "10px 16px", borderRadius: 12, border: "1px solid #e5e7eb", background: "white", color: "#111827", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer" };
const timelineCard: React.CSSProperties = { background: "#fafafa", borderRadius: 16, padding: 16, border: "1px solid #e5e7eb" };
const cardTitle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 12 };
const photoList: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 10, maxHeight: 300, overflowY: "auto" };
const photoItem: React.CSSProperties = { display: "flex", alignItems: "center", gap: 12, padding: 10, background: "white", borderRadius: 12, border: "1px solid #e5e7eb", transition: "all 0.2s ease" };
const photoItemTitle: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
const photoItemMeta: React.CSSProperties = { fontSize: 11, color: "#6b7280", marginTop: 2 };
const photoItemLocation: React.CSSProperties = { fontSize: 11, color: "#f59e0b", marginTop: 2, display: "flex", alignItems: "center", gap: 4 };
const editButton: React.CSSProperties = { width: 28, height: 28, borderRadius: 8, border: "none", background: "#dbeafe", color: "#2563eb", display: "grid", placeItems: "center", cursor: "pointer", flexShrink: 0 };
const deleteButton: React.CSSProperties = { width: 28, height: 28, borderRadius: 8, border: "none", background: "#fee2e2", color: "#ef4444", display: "grid", placeItems: "center", cursor: "pointer", flexShrink: 0 };
const highlightsCard: React.CSSProperties = { background: "#fafafa", borderRadius: 16, padding: 16, border: "1px solid #e5e7eb" };
const highlightsList: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 10 };
const highlightItem: React.CSSProperties = { display: "flex", alignItems: "center", gap: 12, padding: 10, background: "white", borderRadius: 12, border: "1px solid #e5e7eb" };
const highlightThumbnail: React.CSSProperties = { width: 60, height: 60, borderRadius: 8, background: "linear-gradient(135deg, #f59e0b, #f97316)", display: "grid", placeItems: "center", color: "white", flexShrink: 0 };
const highlightTitleStyle: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: "#111827" };
const highlightMeta: React.CSSProperties = { fontSize: 11, color: "#6b7280", marginTop: 2 };
const emptyState: React.CSSProperties = { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "30px 20px", color: "#9ca3af", textAlign: "center" };
const modalOverlay: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(0, 0, 0, 0.5)", backdropFilter: "blur(4px)", display: "grid", placeItems: "center", zIndex: 1000 };
const photoPreviewCard: React.CSSProperties = { maxWidth: "90%", maxHeight: "90%", background: "white", borderRadius: "16px", overflow: "hidden", boxShadow: "0 20px 60px rgba(0, 0, 0, 0.5)" };
const photoPreviewImage: React.CSSProperties = { width: "100%", height: "auto", maxHeight: "70vh", objectFit: "contain" };
const photoCaption: React.CSSProperties = { padding: "16px", fontSize: "14px", color: "#111827", fontWeight: 600 };
const uploadModalContent: React.CSSProperties = { background: "white", borderRadius: 20, width: "90%", maxWidth: 700, maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)" };
const editModalContent: React.CSSProperties = { background: "white", borderRadius: 20, width: "90%", maxWidth: 500, maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)" };
const modalHeader: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "24px 28px", borderBottom: "1px solid rgba(17, 24, 39, 0.06)" };
const modalTitle: React.CSSProperties = { fontSize: 20, fontWeight: 800, color: "#111827" };
const closeButton: React.CSSProperties = { width: 32, height: 32, borderRadius: 8, border: "none", background: "#f3f4f6", display: "grid", placeItems: "center", cursor: "pointer", color: "#6b7280" };
const dropZone: React.CSSProperties = { margin: "24px 28px", padding: "40px 20px", border: "2px dashed rgba(17, 24, 39, 0.1)", borderRadius: 16, textAlign: "center", cursor: "pointer", transition: "all 0.2s ease" };
const filesSection: React.CSSProperties = { margin: "0 28px 24px", padding: "20px 0", borderTop: "1px solid rgba(17, 24, 39, 0.06)" };
const filesList: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 16 };
const filePreview: React.CSSProperties = { width: 80, height: 80, borderRadius: 8, objectFit: "cover" };
const photoFormCard: React.CSSProperties = { padding: 16, borderRadius: 12, background: "#fafafa", border: "1px solid #e5e7eb" };
const removePhotoButton: React.CSSProperties = { padding: "4px 8px", borderRadius: 6, border: "1px solid #fca5a5", background: "white", color: "#ef4444", fontSize: 11, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 };
const formGroup: React.CSSProperties = { marginBottom: 16 };
const formLabel: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 };
const formInput: React.CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 14, outline: "none", boxSizing: "border-box" };
const formSelect: React.CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 14, outline: "none", background: "white", boxSizing: "border-box" };
const modalFooter: React.CSSProperties = { display: "flex", justifyContent: "flex-end", gap: 12, padding: "20px 28px", borderTop: "1px solid rgba(17, 24, 39, 0.06)" };
const cancelButton: React.CSSProperties = { padding: "12px 24px", borderRadius: 12, border: "1px solid rgba(17, 24, 39, 0.1)", background: "white", color: "#111827", fontWeight: 700, fontSize: 14, cursor: "pointer" };
const saveButton: React.CSSProperties = { padding: "12px 24px", borderRadius: 12, border: "none", background: "#111827", color: "white", fontWeight: 700, fontSize: 14, cursor: "pointer" };