// frontend/src/components/AutoGenerateVideoModal.tsx
// ENHANCED: Starting location + background music + REMOVED PLACEHOLDER BUTTON

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
  
  // ✅ Starting location states (for airport/station before first stop)
  const [useStartingLocation, setUseStartingLocation] = useState(false);
  const [startingLocation, setStartingLocation] = useState<string>("");
  const [customStartLat, setCustomStartLat] = useState("");
  const [customStartLon, setCustomStartLon] = useState("");
  const [firstStopTransport, setFirstStopTransport] = useState("plane");

  useEffect(() => {
    if (show) {
      autoGroupPhotos();
    }
  }, [show, photos, stops]);

  const autoGroupPhotos = () => {
    // ✅ NEW: Show ALL stops, not just stops with photos
    const allStopsWithPhotos = stops.map(stop => ({
      stop,
      photos: photos.filter(p => p.itinerary_item === stop.id && !excludedPhotos.has(p.id)),
    }));
    // Don't filter out stops without photos - keep all stops
    
    setPhotoGroups(allStopsWithPhotos);

    // Auto-set transport modes between ALL consecutive stops
    const modes: Record<string, string> = {};
    for (let i = 0; i < allStopsWithPhotos.length - 1; i++) {
      const from = allStopsWithPhotos[i].stop;
      const to = allStopsWithPhotos[i + 1].stop;
      modes[`${from.id}-${to.id}`] = "plane";
    }
    setTransportModes(modes);
  };

  const handleGenerate = async () => {
    if (photoGroups.length === 0) {
      alert("Please add stops to your itinerary first");
      return;
    }

    const invalidStops = photoGroups.filter(g => 
      g.stop.lat === null || g.stop.lon === null
    );
    
    if (invalidStops.length > 0) {
      alert(`Cannot generate map video: ${invalidStops.length} stop(s) missing GPS coordinates`);
      return;
    }

    // ✅ Prepare starting location if selected
    let startLocation = undefined;
    if (useStartingLocation) {
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

    const defaultTitle = photoGroups.length > 0
      ? `Trip to ${photoGroups[photoGroups.length - 1].stop.title}`
      : "Trip Video";

    // ✅ Generate video with starting location
    onGenerate(
      photoGroups, 
      transportModes, 
      title || defaultTitle, 
      true,  // Always generate real video
      startLocation,  // Pass starting location
      firstStopTransport,  // Pass transport from starting location to first stop
      undefined   // No music
    );
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

          {/* Auto-Generated Route */}
          <div style={section}>
            <div style={routeHeader}>
              <span style={routeTitle}>Journey Route</span>
              <div style={routeStats}>
                • {photoGroups.length} stops total
                <br />
                • {photoGroups.filter(g => g.photos.length > 0).length} stops with photos
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
                  <div style={stopPhotos}>
                    {group.photos.length > 0 
                      ? `${group.photos.length} photo${group.photos.length > 1 ? 's' : ''}`
                      : 'No photos (map only)'}
                  </div>
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

        {/* Action Buttons - ✅ ONLY ONE BUTTON NOW */}
        <div style={modalFooter}>
          <button
            onClick={handleGenerate}
            style={generateButton}
            disabled={generating || photoGroups.length === 0}
          >
            {generating ? (
              <>🎬 Generating Video...</>
            ) : (
              <>🎬 Generate Video</>
            )}
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

// ✅ NEW: Single generate button style (full width, prominent)
const generateButton: React.CSSProperties = {
  width: "100%",
  padding: "14px 24px",
  borderRadius: 12,
  border: "none",
  background: "linear-gradient(135deg, #f59e0b, #f97316)",
  color: "white",
  fontWeight: 700,
  fontSize: 16,
  cursor: "pointer",
  boxShadow: "0 4px 12px rgba(245, 158, 11, 0.3)",
  transition: "all 0.2s ease",
};