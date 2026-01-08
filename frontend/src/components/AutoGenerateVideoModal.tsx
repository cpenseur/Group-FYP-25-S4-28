// frontend/src/components/AutoGenerateVideoModal.tsx
// ENHANCED: Starting location + background music

import React, { useState, useEffect } from "react";
import { X, MapPin, Music, Upload as UploadIcon, Plane, Train, Car, Ship } from "lucide-react";

interface Photo {
  id: number;
  url: string;
  caption?: string;
  itinerary_item?: number;
}

interface Stop {
  id: number;
  title: string;
  lat: number | null;
  lon: number | null;
}

interface PhotoGroup {
  stop: Stop;
  photos: Photo[];
}

interface AutoGenerateVideoModalProps {
  show: boolean;
  onClose: () => void;
  photos: Photo[];
  stops: Stop[];
  onGenerate: (
    groups: PhotoGroup[], 
    transportModes: Record<string, string>, 
    title: string,
    generateReal: boolean,
    startingLocation?: { title: string; lat: number; lon: number },
    firstStopTransport?: string,
    musicUrl?: string
  ) => void;
  generating?: boolean;
  generateProgress?: number;
  generateStatus?: string;
}

const transportOptions = [
  { value: "plane", label: "Airplane ✈️", icon: Plane },
  { value: "train", label: "Train 🚄", icon: Train },
  { value: "car", label: "Car 🚗", icon: Car },
  { value: "ship", label: "Ship 🚢", icon: Ship },
];

// Popular airports/stations for quick selection
const popularStartingPoints = [
  { title: "KLIA (Kuala Lumpur)", lat: 2.7456, lon: 101.7072 },
  { title: "Singapore Changi Airport", lat: 1.3644, lon: 103.9915 },
  { title: "Bangkok Suvarnabhumi", lat: 13.6900, lon: 100.7501 },
  { title: "Tokyo Narita", lat: 35.7720, lon: 140.3929 },
  { title: "Hong Kong Airport", lat: 22.3080, lon: 113.9185 },
  { title: "Seoul Incheon", lat: 37.4602, lon: 126.4407 },
];

export default function AutoGenerateVideoModal({
  show,
  onClose,
  photos,
  stops,
  onGenerate,
  generating = false,
  generateProgress = 0,
  generateStatus = "",
}: AutoGenerateVideoModalProps) {
  const [title, setTitle] = useState("");
  const [photoGroups, setPhotoGroups] = useState<PhotoGroup[]>([]);
  const [transportModes, setTransportModes] = useState<Record<string, string>>({});
  const [excludedPhotos, setExcludedPhotos] = useState<Set<number>>(new Set());
  
  // 🆕 Starting location states
  const [useStartingLocation, setUseStartingLocation] = useState(false);
  const [startingLocation, setStartingLocation] = useState<string>("");
  const [customStartLat, setCustomStartLat] = useState("");
  const [customStartLon, setCustomStartLon] = useState("");
  const [firstStopTransport, setFirstStopTransport] = useState("plane");
  
  // 🆕 Music states
  const [useMusicMode, setUseMusicMode] = useState<"none" | "youtube" | "upload">("none");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [uploadedAudioUrl, setUploadedAudioUrl] = useState("");

  useEffect(() => {
    if (show) {
      autoGroupPhotos();
    }
  }, [show, photos, stops]);

  const autoGroupPhotos = () => {
    const stopsWithPhotos = stops
      .map(stop => ({
        stop,
        photos: photos.filter(p => p.itinerary_item === stop.id && !excludedPhotos.has(p.id)),
      }))
      .filter(group => group.photos.length > 0);

    setPhotoGroups(stopsWithPhotos);

    // Auto-set transport modes between stops
    const modes: Record<string, string> = {};
    for (let i = 0; i < stopsWithPhotos.length - 1; i++) {
      const from = stopsWithPhotos[i].stop;
      const to = stopsWithPhotos[i + 1].stop;
      modes[`${from.id}-${to.id}`] = "plane";
    }
    setTransportModes(modes);
  };

  const handleGenerate = async (generateReal: boolean) => {
    if (photoGroups.length === 0) {
      alert("Please upload photos first");
      return;
    }

    const invalidStops = photoGroups.filter(g => 
      g.stop.lat === null || g.stop.lon === null
    );
    
    if (invalidStops.length > 0 && generateReal) {
      alert(`Cannot generate map video: ${invalidStops.length} stop(s) missing GPS coordinates`);
      return;
    }

    // 🆕 Prepare starting location
    let startLocation = undefined;
    if (useStartingLocation && generateReal) {
      const selected = popularStartingPoints.find(p => p.title === startingLocation);
      if (selected) {
        startLocation = selected;
      } else if (customStartLat && customStartLon) {
        startLocation = {
          title: startingLocation || "Starting Point",
          lat: parseFloat(customStartLat),
          lon: parseFloat(customStartLon),
        };
      }
    }

    // 🆕 Prepare music URL
    let musicUrl = undefined;
    if (generateReal) {
      if (useMusicMode === "youtube" && youtubeUrl) {
        musicUrl = youtubeUrl;
      } else if (useMusicMode === "upload" && uploadedAudioUrl) {
        musicUrl = uploadedAudioUrl;
      }
    }

    const defaultTitle = photoGroups.length > 0
      ? `Trip to ${photoGroups[photoGroups.length - 1].stop.title}`
      : "Trip Video";

    onGenerate(
      photoGroups, 
      transportModes, 
      title || defaultTitle, 
      generateReal,
      startLocation,
      firstStopTransport,
      musicUrl
    );
  };

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.match(/^audio\//)) {
      alert("Please upload an audio file");
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      alert("Audio file too large (max 20MB)");
      return;
    }

    setAudioFile(file);
    // Create temporary URL for preview
    const url = URL.createObjectURL(file);
    setUploadedAudioUrl(url);
  };

  if (!show) return null;

  const totalPhotos = photoGroups.reduce((sum, g) => sum + g.photos.length, 0);

  return (
    <div style={modalOverlay} onClick={onClose}>
      <div style={modalContent} onClick={(e) => e.stopPropagation()}>
        <div style={modalHeader}>
          <div style={modalTitle}>Create Trip Video 🎬</div>
          <button onClick={onClose} style={closeButton} disabled={generating}>
            <X size={20} />
          </button>
        </div>

        <div style={modalBody}>
          {/* Video Title */}
          <div style={section}>
            <label style={label}>Video Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Amazing Japan Trip"
              style={input}
              disabled={generating}
            />
          </div>

          {/* 🆕 Starting Location Section */}
          <div style={section}>
            <div style={sectionHeader}>
              <MapPin size={18} style={{ color: "#f59e0b" }} />
              <span style={sectionTitle}>Starting Location (Optional)</span>
            </div>
            
            <label style={checkboxLabel}>
              <input
                type="checkbox"
                checked={useStartingLocation}
                onChange={(e) => setUseStartingLocation(e.target.checked)}
                style={checkbox}
                disabled={generating}
              />
              <span>Add starting location (airport/station)</span>
            </label>

            {useStartingLocation && (
              <div style={subSection}>
                <label style={smallLabel}>Select or enter location:</label>
                <select
                  value={startingLocation}
                  onChange={(e) => setStartingLocation(e.target.value)}
                  style={select}
                  disabled={generating}
                >
                  <option value="">Select popular location...</option>
                  {popularStartingPoints.map(point => (
                    <option key={point.title} value={point.title}>
                      {point.title}
                    </option>
                  ))}
                  <option value="custom">Custom location...</option>
                </select>

                {startingLocation === "custom" && (
                  <div style={customLocationGrid}>
                    <input
                      type="text"
                      placeholder="Location name"
                      value={startingLocation}
                      onChange={(e) => setStartingLocation(e.target.value)}
                      style={input}
                      disabled={generating}
                    />
                    <input
                      type="number"
                      step="0.0001"
                      placeholder="Latitude"
                      value={customStartLat}
                      onChange={(e) => setCustomStartLat(e.target.value)}
                      style={input}
                      disabled={generating}
                    />
                    <input
                      type="number"
                      step="0.0001"
                      placeholder="Longitude"
                      value={customStartLon}
                      onChange={(e) => setCustomStartLon(e.target.value)}
                      style={input}
                      disabled={generating}
                    />
                  </div>
                )}

                <label style={smallLabel}>Transport to first stop:</label>
                <div style={transportGrid}>
                  {transportOptions.map(option => (
                    <button
                      key={option.value}
                      onClick={() => setFirstStopTransport(option.value)}
                      style={{
                        ...transportButton,
                        ...(firstStopTransport === option.value ? transportButtonActive : {}),
                      }}
                      disabled={generating}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 🆕 Background Music Section */}
          <div style={section}>
            <div style={sectionHeader}>
              <Music size={18} style={{ color: "#8b5cf6" }} />
              <span style={sectionTitle}>Background Music (Optional)</span>
            </div>

            <div style={musicModeButtons}>
              <button
                onClick={() => setUseMusicMode("none")}
                style={{
                  ...musicModeButton,
                  ...(useMusicMode === "none" ? musicModeButtonActive : {}),
                }}
                disabled={generating}
              >
                No Music
              </button>
              <button
                onClick={() => setUseMusicMode("youtube")}
                style={{
                  ...musicModeButton,
                  ...(useMusicMode === "youtube" ? musicModeButtonActive : {}),
                }}
                disabled={generating}
              >
                YouTube Link
              </button>
              <button
                onClick={() => setUseMusicMode("upload")}
                style={{
                  ...musicModeButton,
                  ...(useMusicMode === "upload" ? musicModeButtonActive : {}),
                }}
                disabled={generating}
              >
                Upload Audio
              </button>
            </div>

            {useMusicMode === "youtube" && (
              <div style={subSection}>
                <label style={smallLabel}>YouTube URL:</label>
                <input
                  type="url"
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  style={input}
                  disabled={generating}
                />
                <div style={hint}>
                  ℹ️ Note: YouTube audio extraction requires server-side processing
                </div>
              </div>
            )}

            {useMusicMode === "upload" && (
              <div style={subSection}>
                <label style={uploadLabel}>
                  <UploadIcon size={16} />
                  <span>{audioFile ? audioFile.name : "Choose audio file (MP3, WAV, OGG)"}</span>
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={handleAudioUpload}
                    style={{ display: "none" }}
                    disabled={generating}
                  />
                </label>
                {audioFile && (
                  <audio controls style={audioPreview}>
                    <source src={uploadedAudioUrl} type={audioFile.type} />
                  </audio>
                )}
                <div style={hint}>
                  Max 20MB • MP3, WAV, OGG supported
                </div>
              </div>
            )}
          </div>

          {/* Auto-Generated Route */}
          <div style={section}>
            <div style={routeHeader}>
              <span style={routeTitle}>Auto-Generated Route</span>
              <div style={routeStats}>
                • {photoGroups.length} stops with photos
                <br />
                • {totalPhotos} photos total
                <br />
                • Estimated duration: ~{Math.round((totalPhotos * 2.5 + photoGroups.length * 5 + 4))}s
              </div>
            </div>

            {photoGroups.map((group, idx) => (
              <div key={group.stop.id} style={stopCard}>
                <div style={stopNumber}>{idx + 1}</div>
                <div style={stopInfo}>
                  <div style={stopName}>{group.stop.title}</div>
                  <div style={stopPhotos}>{group.photos.length} photo{group.photos.length > 1 ? 's' : ''}</div>
                </div>
                
                {/* Transport selection between stops */}
                {idx < photoGroups.length - 1 && (
                  <div style={transportSelector}>
                    <div style={transportLabel}>Travel by:</div>
                    <div style={transportGrid}>
                      {transportOptions.map(option => {
                        const key = `${group.stop.id}-${photoGroups[idx + 1].stop.id}`;
                        return (
                          <button
                            key={option.value}
                            onClick={() => setTransportModes({ ...transportModes, [key]: option.value })}
                            style={{
                              ...transportButton,
                              ...(transportModes[key] === option.value ? transportButtonActive : {}),
                            }}
                            disabled={generating}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Generation Progress */}
          {generating && (
            <div style={progressSection}>
              <div style={progressBar}>
                <div style={{ ...progressFill, width: `${generateProgress}%` }} />
              </div>
              <div style={progressText}>
                {Math.round(generateProgress)}% - {generateStatus}
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div style={modalFooter}>
          <button
            onClick={() => handleGenerate(false)}
            style={placeholderButton}
            disabled={generating || photoGroups.length === 0}
          >
            Quick Generate (Placeholder)
          </button>
          <button
            onClick={() => handleGenerate(true)}
            style={realButton}
            disabled={generating || photoGroups.length === 0}
          >
            {generating ? "Generating..." : "Generate Real Video"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Styles
const modalOverlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0, 0, 0, 0.6)",
  backdropFilter: "blur(4px)",
  display: "grid",
  placeItems: "center",
  zIndex: 2000,
  overflow: "auto",
  padding: "20px",
};

const modalContent: React.CSSProperties = {
  background: "white",
  borderRadius: 20,
  width: "100%",
  maxWidth: 700,
  maxHeight: "90vh",
  display: "flex",
  flexDirection: "column",
  boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
};

const modalHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "24px 28px",
  borderBottom: "1px solid #e5e7eb",
};

const modalTitle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 800,
  color: "#111827",
};

const closeButton: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 8,
  border: "none",
  background: "#f3f4f6",
  display: "grid",
  placeItems: "center",
  cursor: "pointer",
  color: "#6b7280",
};

const modalBody: React.CSSProperties = {
  padding: "24px 28px",
  overflowY: "auto",
  flex: 1,
};

const section: React.CSSProperties = {
  marginBottom: 24,
};

const sectionHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  marginBottom: 12,
};

const sectionTitle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  color: "#111827",
};

const label: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 600,
  color: "#374151",
  marginBottom: 8,
};

const smallLabel: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: "#6b7280",
  marginBottom: 6,
  marginTop: 12,
};

const input: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #e5e7eb",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
};

const select: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #e5e7eb",
  fontSize: 14,
  outline: "none",
  background: "white",
  boxSizing: "border-box",
};

const checkboxLabel: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontSize: 14,
  color: "#374151",
  cursor: "pointer",
};

const checkbox: React.CSSProperties = {
  width: 18,
  height: 18,
  cursor: "pointer",
};

const subSection: React.CSSProperties = {
  marginTop: 12,
  padding: 16,
  background: "#f9fafb",
  borderRadius: 12,
};

const customLocationGrid: React.CSSProperties = {
  display: "grid",
  gap: 8,
  marginTop: 8,
};

const transportGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, 1fr)",
  gap: 8,
  marginTop: 8,
};

const transportButton: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid #e5e7eb",
  background: "white",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  transition: "all 0.2s",
};

const transportButtonActive: React.CSSProperties = {
  background: "#f59e0b",
  color: "white",
  borderColor: "#f59e0b",
};

const musicModeButtons: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: 8,
  marginBottom: 12,
};

const musicModeButton: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #e5e7eb",
  background: "white",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  transition: "all 0.2s",
};

const musicModeButtonActive: React.CSSProperties = {
  background: "#8b5cf6",
  color: "white",
  borderColor: "#8b5cf6",
};

const uploadLabel: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  padding: "12px 16px",
  borderRadius: 8,
  border: "2px dashed #e5e7eb",
  background: "white",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  color: "#6b7280",
  transition: "all 0.2s",
};

const audioPreview: React.CSSProperties = {
  width: "100%",
  marginTop: 12,
};

const hint: React.CSSProperties = {
  fontSize: 11,
  color: "#9ca3af",
  marginTop: 8,
};

const routeHeader: React.CSSProperties = {
  background: "#fef3c7",
  padding: 16,
  borderRadius: 12,
  marginBottom: 16,
};

const routeTitle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  color: "#92400e",
  display: "block",
  marginBottom: 8,
};

const routeStats: React.CSSProperties = {
  fontSize: 12,
  color: "#78350f",
  lineHeight: 1.6,
};

const stopCard: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 12,
  padding: 16,
  background: "#fafafa",
  borderRadius: 12,
  marginBottom: 12,
  border: "1px solid #e5e7eb",
};

const stopNumber: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: "50%",
  background: "#f59e0b",
  color: "white",
  display: "grid",
  placeItems: "center",
  fontSize: 14,
  fontWeight: 700,
};

const stopInfo: React.CSSProperties = {
  flex: 1,
};

const stopName: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 600,
  color: "#111827",
  marginBottom: 4,
};

const stopPhotos: React.CSSProperties = {
  fontSize: 12,
  color: "#6b7280",
};

const transportSelector: React.CSSProperties = {
  marginTop: 12,
  paddingTop: 12,
  borderTop: "1px solid #e5e7eb",
};

const transportLabel: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "#6b7280",
  marginBottom: 8,
};

const progressSection: React.CSSProperties = {
  padding: 16,
  background: "#f0fdf4",
  borderRadius: 12,
  border: "1px solid #bbf7d0",
};

const progressBar: React.CSSProperties = {
  width: "100%",
  height: 8,
  background: "#dcfce7",
  borderRadius: 4,
  overflow: "hidden",
  marginBottom: 8,
};

const progressFill: React.CSSProperties = {
  height: "100%",
  background: "#22c55e",
  transition: "width 0.3s ease",
};

const progressText: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: "#166534",
  textAlign: "center",
};

const modalFooter: React.CSSProperties = {
  display: "flex",
  gap: 12,
  padding: "20px 28px",
  borderTop: "1px solid #e5e7eb",
};

const placeholderButton: React.CSSProperties = {
  flex: 1,
  padding: "12px 24px",
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  background: "white",
  color: "#111827",
  fontWeight: 700,
  fontSize: 14,
  cursor: "pointer",
};

const realButton: React.CSSProperties = {
  flex: 1,
  padding: "12px 24px",
  borderRadius: 12,
  border: "none",
  background: "linear-gradient(135deg, #f59e0b, #f97316)",
  color: "white",
  fontWeight: 700,
  fontSize: 14,
  cursor: "pointer",
  boxShadow: "0 4px 12px rgba(245, 158, 11, 0.3)",
};