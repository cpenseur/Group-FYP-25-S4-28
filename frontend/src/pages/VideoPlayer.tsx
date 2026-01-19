// src/pages/VideoPlayer.tsx

import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/apiClient";
import TripSubHeader from "../components/TripSubHeader";
import { Play, Pause, Volume2, VolumeX, Maximize, ArrowLeft, Download } from "lucide-react";

interface MediaHighlight {
  id: number;
  trip: number;
  user: number;
  title: string;
  video_url: string;
  metadata: any;
  created_at: string;
}

export default function VideoPlayer() {
  const { tripId, highlightId } = useParams();
  const navigate = useNavigate();

  const [highlight, setHighlight] = useState<MediaHighlight | null>(null);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [downloading, setDownloading] = useState(false);

  const videoRef = React.useRef<HTMLVideoElement>(null);

  useEffect(() => {
    loadHighlight();
  }, [highlightId]);

  async function loadHighlight() {
    if (!highlightId) return;

    try {
      setLoading(true);
      const data = await apiFetch(`/f5/highlights/${highlightId}/`, { method: "GET" });
      setHighlight(data);
    } catch (error) {
      console.error("Failed to load highlight:", error);
      alert("Failed to load video");
    } finally {
      setLoading(false);
    }
  }

  const togglePlay = () => {
    if (!videoRef.current) return;

    if (playing) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setPlaying(!playing);
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !muted;
    setMuted(!muted);
  };

  const toggleFullscreen = () => {
    if (!videoRef.current) return;
    videoRef.current.requestFullscreen();
  };

  const handleDownload = async () => {
    if (!highlight) return;

    try {
      setDownloading(true);

      // Fetch the video blob
      const response = await fetch(highlight.video_url);
      const blob = await response.blob();

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${highlight.title.replace(/[^a-z0-9]/gi, '_')}.webm`;
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      alert("Video downloaded successfully!");
    } catch (error) {
      console.error("Download failed:", error);
      alert("Failed to download video. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    setCurrentTime(videoRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    setDuration(videoRef.current.duration);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    videoRef.current.currentTime = percent * duration;
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <>
        <TripSubHeader />
        <div style={loadingContainer}>
          <div className="spinner" />
        </div>
      </>
    );
  }

  if (!highlight) {
    return (
      <>
        <TripSubHeader />
        <div style={loadingContainer}>
          <div>Video not found</div>
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
        <div style={playerContainer}>
          {/* Back button */}
          <button
            onClick={() => navigate(`/trip/${tripId}/media`)}
            style={backButton}
          >
            <ArrowLeft size={20} />
            Back to Media
          </button>

          {/* Video title */}
          <div style={videoTitle}>{highlight.title}</div>

          {/*Download button */}
          <button
            onClick={handleDownload}
            style={downloadButton}
            disabled={downloading}
          >
            <Download size={20} />
            {downloading ? "Downloading..." : "Download Video"}
          </button>

          {/* Video player */}
          <div style={videoWrapper}>
            <video
              ref={videoRef}
              src={highlight.video_url}
              style={video}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={() => setPlaying(false)}
            />

            {/* Controls overlay */}
            <div style={controls}>
              {/* Progress bar */}
              <div style={progressBar} onClick={handleSeek}>
                <div
                  style={{
                    ...progressFill,
                    width: `${(currentTime / duration) * 100}%`,
                  }}
                />
              </div>

              {/* Control buttons */}
              <div style={controlButtons}>
                <div style={leftControls}>
                  <button onClick={togglePlay} style={controlBtn}>
                    {playing ? <Pause size={24} /> : <Play size={24} />}
                  </button>

                  <button onClick={toggleMute} style={controlBtn}>
                    {muted ? <VolumeX size={24} /> : <Volume2 size={24} />}
                  </button>

                  <div style={timeDisplay}>
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </div>
                </div>

                <div style={rightControls}>
                  <button onClick={toggleFullscreen} style={controlBtn}>
                    <Maximize size={24} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Video info */}
          <div style={videoInfo}>
            <div style={infoSection}>
              <div style={infoLabel}>Stops</div>
              <div style={infoValue}>
                {highlight.metadata?.stop_count || highlight.metadata?.segments?.length || 0}
              </div>
            </div>

            <div style={infoSection}>
              <div style={infoLabel}>Photos</div>
              <div style={infoValue}>
                {highlight.metadata?.photo_count || highlight.metadata?.all_photos?.length || 0}
              </div>
            </div>

            <div style={infoSection}>
              <div style={infoLabel}>Duration</div>
              <div style={infoValue}>
                {Math.round(duration)}s
              </div>
            </div>
          </div>

          {/* Journey details */}
          {highlight.metadata?.segments && (
            <div style={journeyCard}>
              <div style={journeyTitle}>Journey Route</div>
              {highlight.metadata.segments.map((segment: any, idx: number) => (
                <div key={idx} style={journeyStop}>
                  <div style={journeyNumber}>{idx + 1}</div>
                  <div style={journeyStopName}>{segment.stop_title}</div>
                  <div style={journeyPhotoCount}>{segment.photo_ids?.length || 0} photos</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// Styles
const loadingContainer: React.CSSProperties = {
  minHeight: "calc(100vh - 90px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#f9fafb",
};

const pageContainer: React.CSSProperties = {
  minHeight: "calc(100vh - 90px)",
  background: "#111827",
  padding: "40px 20px",
};

const playerContainer: React.CSSProperties = {
  maxWidth: 1200,
  margin: "0 auto",
};

const backButton: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "10px 16px",
  borderRadius: 10,
  border: "none",
  background: "rgba(255,255,255,0.1)",
  color: "white",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  marginBottom: 20,
};

const videoTitle: React.CSSProperties = {
  fontSize: 32,
  fontWeight: 800,
  color: "white",
  marginBottom: 24,
  textAlign: "center",
};

//Download button styles
const downloadButton: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  padding: "12px 24px",
  borderRadius: 12,
  border: "none",
  background: "linear-gradient(135deg, #10b981, #059669)",
  color: "white",
  fontSize: 16,
  fontWeight: 700,
  cursor: "pointer",
  marginBottom: 24,
  width: "100%",
  maxWidth: 300,
  margin: "0 auto 24px",
  boxShadow: "0 4px 12px rgba(16, 185, 129, 0.3)",
  transition: "all 0.2s ease",
};

const videoWrapper: React.CSSProperties = {
  position: "relative",
  borderRadius: 16,
  overflow: "hidden",
  background: "black",
  aspectRatio: "16/9",
};

const video: React.CSSProperties = {
  width: "100%",
  height: "100%",
  display: "block",
};

const controls: React.CSSProperties = {
  position: "absolute",
  bottom: 0,
  left: 0,
  right: 0,
  background: "linear-gradient(to top, rgba(0,0,0,0.8), transparent)",
  padding: "20px",
};

const progressBar: React.CSSProperties = {
  width: "100%",
  height: 6,
  background: "rgba(255,255,255,0.3)",
  borderRadius: 3,
  cursor: "pointer",
  marginBottom: 16,
};

const progressFill: React.CSSProperties = {
  height: "100%",
  background: "#f59e0b",
  borderRadius: 3,
  transition: "width 0.1s linear",
};

const controlButtons: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};

const leftControls: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
};

const rightControls: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
};

const controlBtn: React.CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 8,
  border: "none",
  background: "rgba(255,255,255,0.1)",
  color: "white",
  display: "grid",
  placeItems: "center",
  cursor: "pointer",
};

const timeDisplay: React.CSSProperties = {
  color: "white",
  fontSize: 14,
  fontWeight: 600,
};

const videoInfo: React.CSSProperties = {
  display: "flex",
  gap: 24,
  justifyContent: "center",
  marginTop: 32,
  padding: 24,
  background: "rgba(255,255,255,0.05)",
  borderRadius: 16,
};

const infoSection: React.CSSProperties = {
  textAlign: "center",
};

const infoLabel: React.CSSProperties = {
  fontSize: 12,
  color: "#9ca3af",
  marginBottom: 4,
  textTransform: "uppercase",
  letterSpacing: 1,
};

const infoValue: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 700,
  color: "white",
};

const journeyCard: React.CSSProperties = {
  marginTop: 32,
  background: "rgba(255,255,255,0.05)",
  borderRadius: 16,
  padding: 24,
};

const journeyTitle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  color: "white",
  marginBottom: 16,
};

const journeyStop: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: 12,
  background: "rgba(255,255,255,0.05)",
  borderRadius: 12,
  marginBottom: 8,
};

const journeyNumber: React.CSSProperties = {
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

const journeyStopName: React.CSSProperties = {
  flex: 1,
  fontSize: 15,
  fontWeight: 600,
  color: "white",
};

const journeyPhotoCount: React.CSSProperties = {
  fontSize: 13,
  color: "#9ca3af",
};