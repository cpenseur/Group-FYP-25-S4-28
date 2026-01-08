// frontend/src/lib/videoGenerator.ts
// OPTIMIZED VERSION - Faster, smoother, more like reference video

import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

interface Photo {
  id: number;
  url: string;
  caption?: string;
}

interface Stop {
  id: number;
  title: string;
  lat: number;
  lon: number;
}

interface PhotoGroup {
  stop: Stop;
  photos: Photo[];
}

interface GenerateVideoOptions {
  groups: PhotoGroup[];
  transportModes: Record<string, string>;
  title: string;
  onProgress?: (progress: number, status: string) => void;
  startingLocation?: { title: string; lat: number; lon: number };
  firstStopTransport?: string;
  musicUrl?: string;
}

const CANVAS_WIDTH = 1280; // 🔥 Reduced from 1920 (saves 44% space)
const CANVAS_HEIGHT = 720;  // 🔥 Reduced from 1080 (720p instead of 1080p)
const FPS = 24; // 🔥 Reduced from 30 (saves 20% frames)
const TRAVEL_DURATION = 3; // 🔥 REDUCED: 3 seconds instead of 5
const PHOTO_DURATION = 2.5; // 🔥 OPTIMIZED: 2.5 seconds per photo
const TRANSITION_DURATION = 0.5; // 🔥 FASTER: 0.5 seconds transitions
const TITLE_DURATION = 2; // 🔥 SHORTER: 2 second title

const transportEmojis: Record<string, string> = {
  plane: "✈️",
  train: "🚄", 
  car: "🚗",
  ship: "🚢",
};

export class MapVideoGenerator {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private mapContainer: HTMLDivElement;
  private map: maplibregl.Map | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];

  constructor() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = CANVAS_WIDTH;
    this.canvas.height = CANVAS_HEIGHT;
    this.ctx = this.canvas.getContext("2d", { willReadFrequently: true })!;

    this.mapContainer = document.createElement("div");
    this.mapContainer.style.width = `${CANVAS_WIDTH}px`;
    this.mapContainer.style.height = `${CANVAS_HEIGHT}px`;
    this.mapContainer.style.position = "absolute";
    this.mapContainer.style.top = "-10000px";
    document.body.appendChild(this.mapContainer);
  }

  async generate(options: GenerateVideoOptions): Promise<Blob> {
    const { groups, transportModes, title, onProgress } = options;

    try {
      await this.initializeMap(groups);

      const stream = this.canvas.captureStream(FPS);
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: "video/webm;codecs=vp9",
        videoBitsPerSecond: 3000000, // 🔥 3 Mbps instead of 8 Mbps (saves 62% size!)
      });

      this.recordedChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      // Calculate total frames
      let totalFrames = FPS * TITLE_DURATION;
      for (let i = 0; i < groups.length; i++) {
        // Travel animation (skip for first stop)
        if (i > 0) {
          totalFrames += 5 * FPS; // 5 seconds for travel animation
        }
        // Photo display
        totalFrames += TRANSITION_DURATION * FPS; // Entry
        totalFrames += groups[i].photos.length * PHOTO_DURATION * FPS; // Photos
        totalFrames += TRANSITION_DURATION * FPS; // Exit
      }
      totalFrames += FPS * 2; // End slide

      let currentFrame = 0;

      this.mediaRecorder.start();

      // Title slide
      if (onProgress) onProgress((currentFrame / totalFrames) * 100, "Creating title...");
      await this.renderTitleSlide(title);
      currentFrame += FPS * TITLE_DURATION;

      // Journey
      for (let i = 0; i < groups.length; i++) {
        const group = groups[i];

        // 🔥 FIRST STOP: NO map animation - go straight to photos!
        if (i === 0) {
          if (onProgress) {
            const progress = (currentFrame / totalFrames) * 100;
            onProgress(progress, `Starting at ${group.stop.title}...`);
          }
          // Skip map completely for first stop - no frames added
        } else {
          // 🔥 TRAVEL ANIMATION: 5 seconds with clear transport icon
          const prevGroup = groups[i - 1];
          const key = `${prevGroup.stop.id}-${group.stop.id}`;
          const transport = transportModes[key] || "plane";

          if (onProgress) {
            const progress = (currentFrame / totalFrames) * 100;
            onProgress(progress, `${transportEmojis[transport]} to ${group.stop.title}...`);
          }

          // 5 SECONDS for clear visibility of route and transport
          await this.renderMapJourney(
            prevGroup.stop,
            group.stop,
            transport,
            5
          );
          currentFrame += 5 * FPS;
        }

        // Photos at this location
        if (onProgress) {
          const progress = (currentFrame / totalFrames) * 100;
          onProgress(progress, `Photos at ${group.stop.title}...`);
        }

        await this.render3DPhotoCarousel(group.photos, group.stop.title);
        currentFrame += 
          TRANSITION_DURATION * FPS + 
          group.photos.length * PHOTO_DURATION * FPS + 
          TRANSITION_DURATION * FPS;
      }

      // End slide
      if (onProgress) onProgress(95, "Finishing...");
      await this.renderEndSlide();
      currentFrame += FPS * 2;

      this.mediaRecorder.stop();

      return new Promise((resolve) => {
        this.mediaRecorder!.onstop = () => {
          const blob = new Blob(this.recordedChunks, { type: "video/webm" });
          if (onProgress) onProgress(100, "Complete!");
          resolve(blob);
        };
      });
    } catch (error) {
      console.error("Video generation failed:", error);
      throw error;
    }
  }

  private async initializeMap(groups: PhotoGroup[]) {
    const lats = groups.map(g => g.stop.lat);
    const lons = groups.map(g => g.stop.lon);
    const bounds = new maplibregl.LngLatBounds(
      [Math.min(...lons), Math.min(...lats)],
      [Math.max(...lons), Math.max(...lats)]
    );

    this.map = new maplibregl.Map({
      container: this.mapContainer,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap'
          }
        },
        layers: [{
          id: 'osm',
          type: 'raster',
          source: 'osm',
          minzoom: 0,
          maxzoom: 19
        }]
      },
      bounds: bounds,
      fitBoundsOptions: { padding: 100 },
    } as any);

    (this.map as any).preserveDrawingBuffer = true;

    await new Promise<void>((resolve) => {
      this.map!.on('load', () => {
        setTimeout(() => resolve(), 500); // Wait for tiles
      });
    });
  }

  private async renderTitleSlide(title: string) {
    const ctx = this.ctx;
    const frames = FPS * TITLE_DURATION;

    for (let i = 0; i < frames; i++) {
      const progress = i / frames;
      const opacity = progress < 0.3 ? progress / 0.3 : progress > 0.7 ? (1 - progress) / 0.3 : 1;

      const gradient = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      gradient.addColorStop(0, "#f59e0b");
      gradient.addColorStop(1, "#f97316");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.fillStyle = "white";
      ctx.font = "bold 120px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(title, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);

      ctx.font = "60px Arial";
      ctx.fillText("✈️ Trip Highlights 🎬", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 150);
      ctx.restore();

      await this.waitFrame();
    }
  }

  private async renderMapLocation(stop: Stop, duration: number) {
    const frames = duration * FPS;

    this.map!.flyTo({
      center: [stop.lon, stop.lat],
      zoom: 12,
      duration: duration * 1000,
      essential: true,
    });

    for (let i = 0; i < frames; i++) {
      const mapCanvas = this.map!.getCanvas();
      this.ctx.drawImage(mapCanvas, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      this.drawLocationLabel(stop.title, CANVAS_WIDTH / 2, 100);

      await this.waitFrame();
    }
  }

  private async renderMapJourney(
    from: Stop,
    to: Stop,
    transport: string,
    duration: number
  ) {
    const frames = duration * FPS;

    const routeCoords = this.interpolateRoute(from, to, 50);
    
    if (this.map!.getSource('route')) {
      this.map!.removeLayer('route');
      this.map!.removeSource('route');
    }

    this.map!.addSource('route', {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: routeCoords,
        },
      },
    });

    this.map!.addLayer({
      id: 'route',
      type: 'line',
      source: 'route',
      layout: {
        'line-join': 'round',
        'line-cap': 'round',
      },
      paint: {
        'line-color': '#f59e0b', // Orange color
        'line-width': 8, // 🔥 THICKER - 8px instead of 4px
        'line-dasharray': [3, 3], // 🔥 BIGGER dashes for better visibility
      },
    });

    const bounds = new maplibregl.LngLatBounds(
      [Math.min(from.lon, to.lon), Math.min(from.lat, to.lat)],
      [Math.max(from.lon, to.lon), Math.max(from.lat, to.lat)]
    );

    this.map!.fitBounds(bounds, {
      padding: 150,
      duration: duration * 1000,
      essential: true,
    });

    for (let i = 0; i < frames; i++) {
      const progress = i / frames;

      const mapCanvas = this.map!.getCanvas();
      this.ctx.drawImage(mapCanvas, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      const currentPos = this.interpolatePosition(from, to, progress);
      this.drawTransportIcon(
        transportEmojis[transport],
        currentPos[0],
        currentPos[1],
        progress
      );

      this.drawLocationLabel(from.title, 200, 100, 0.5);
      this.drawLocationLabel(to.title, CANVAS_WIDTH - 200, 100, progress);

      await this.waitFrame();
    }

    if (this.map!.getSource('route')) {
      this.map!.removeLayer('route');
      this.map!.removeSource('route');
    }
  }

  private async render3DPhotoCarousel(photos: Photo[], locationTitle: string) {
    const ctx = this.ctx;

    // 🔥 FASTER Entry animation
    const entryFrames = TRANSITION_DURATION * FPS;
    for (let i = 0; i < entryFrames; i++) {
      const progress = this.easeInOutCubic(i / entryFrames);

      const mapCanvas = this.map!.getCanvas();
      this.ctx.drawImage(mapCanvas, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      ctx.fillStyle = `rgba(0, 0, 0, ${progress * 0.7})`;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      const titleY = 100 * progress;
      this.drawLocationLabel(locationTitle, CANVAS_WIDTH / 2, titleY);

      await this.waitFrame();
    }

    // 🔥 ENHANCED 3D carousel - like reference video
    for (let photoIdx = 0; photoIdx < photos.length; photoIdx++) {
      const photo = photos[photoIdx];
      const img = await this.loadImage(photo.url);
      const frames = PHOTO_DURATION * FPS;

      // Preload next photos for smooth transitions
      const nextPhotos: HTMLImageElement[] = [];
      for (let offset = -1; offset <= 1; offset++) {
        const idx = photoIdx + offset;
        if (idx >= 0 && idx < photos.length && offset !== 0) {
          nextPhotos[offset] = await this.loadImage(photos[idx].url);
        }
      }

      for (let i = 0; i < frames; i++) {
        const progress = i / frames;

        // Dark background
        ctx.fillStyle = "rgba(17, 24, 39, 0.95)";
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // 🔥 3D carousel - show 3 photos at once
        for (let offset = -1; offset <= 1; offset++) {
          const idx = photoIdx + offset;
          if (idx < 0 || idx >= photos.length) continue;

          const isCenter = offset === 0;
          
          // 3D effect parameters
          const rotationY = offset * 25; // Rotation angle
          const perspective = 1 - Math.abs(offset) * 0.3;
          
          // 🔥 BREATHING animation on center photo
          const breathScale = isCenter 
            ? 1 + Math.sin(progress * Math.PI * 2) * 0.03 
            : 1;
          
          const baseScale = isCenter ? 0.65 : 0.45;
          const scale = baseScale * perspective * breathScale;
          const opacity = isCenter ? 1 : 0.5;
          
          const imgWidth = CANVAS_WIDTH * 0.7 * scale;
          const imgHeight = CANVAS_HEIGHT * 0.7 * scale;
          
          // Horizontal offset for 3D effect
          const offsetX = offset * 500 * (1 - Math.abs(offset) * 0.2);
          const imgX = (CANVAS_WIDTH - imgWidth) / 2 + offsetX;
          const imgY = (CANVAS_HEIGHT - imgHeight) / 2;

          ctx.save();
          ctx.globalAlpha = opacity;

          // Shadow
          ctx.fillStyle = "rgba(0,0,0,0.5)";
          ctx.fillRect(imgX + 15, imgY + 15, imgWidth, imgHeight);

          // Draw photo
          const imgToDraw = isCenter ? img : (nextPhotos[offset] || img);
          ctx.drawImage(imgToDraw, imgX, imgY, imgWidth, imgHeight);
          
          // Border
          if (isCenter) {
            ctx.strokeStyle = "white";
            ctx.lineWidth = 8;
            ctx.strokeRect(imgX, imgY, imgWidth, imgHeight);
          }
          
          ctx.restore();
        }

        // Location title
        this.drawLocationLabel(locationTitle, CANVAS_WIDTH / 2, 100);

        // Photo counter
        ctx.fillStyle = "white";
        ctx.font = "bold 48px Arial";
        ctx.textAlign = "center";
        ctx.fillText(
          `${photoIdx + 1} / ${photos.length}`,
          CANVAS_WIDTH / 2,
          CANVAS_HEIGHT - 100
        );

        // Caption
        if (photo.caption) {
          ctx.font = "36px Arial";
          ctx.fillText(photo.caption, CANVAS_WIDTH / 2, CANVAS_HEIGHT - 180);
        }

        await this.waitFrame();
      }
    }

    // 🔥 FASTER Exit animation
    const exitFrames = TRANSITION_DURATION * FPS;
    for (let i = 0; i < exitFrames; i++) {
      const progress = this.easeInOutCubic(i / exitFrames);

      const mapCanvas = this.map!.getCanvas();
      this.ctx.drawImage(mapCanvas, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      ctx.fillStyle = `rgba(0, 0, 0, ${(1 - progress) * 0.7})`;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      await this.waitFrame();
    }
  }

  private async renderEndSlide() {
    const ctx = this.ctx;
    const frames = FPS * 2;

    for (let i = 0; i < frames; i++) {
      const progress = i / frames;
      const opacity = progress < 0.3 ? progress / 0.3 : progress > 0.7 ? (1 - progress) / 0.3 : 1;

      const gradient = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      gradient.addColorStop(0, "#6366f1");
      gradient.addColorStop(1, "#8b5cf6");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.fillStyle = "white";
      ctx.font = "bold 100px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Thanks for watching! 🎉", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
      ctx.restore();

      await this.waitFrame();
    }
  }

  private drawLocationLabel(text: string, x: number, y: number, opacity: number = 1) {
    const ctx = this.ctx;
    
    ctx.save();
    ctx.globalAlpha = opacity;
    
    ctx.fillStyle = "rgba(17, 24, 39, 0.85)";
    ctx.beginPath();
    ctx.roundRect(x - 200, y - 35, 400, 70, 35);
    ctx.fill();

    ctx.fillStyle = "white";
    ctx.font = "bold 48px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x, y);
    
    ctx.restore();
  }

  private drawTransportIcon(emoji: string, lng: number, lat: number, progress: number) {
    if (!this.map) return;

    const point = this.map.project([lng, lat]);
    const ctx = this.ctx;

    // 🔥 BIGGER bounce for more visibility
    const bounce = Math.sin(progress * Math.PI * 3) * 20;

    ctx.save();
    
    // 🔥 BIGGER ICON - 120px instead of 80px
    const iconSize = 120;
    const yOffset = -80 + bounce;
    
    // 🔥 ADD BACKGROUND CIRCLE for better visibility
    ctx.fillStyle = "rgba(245, 158, 11, 0.9)"; // Orange background
    ctx.beginPath();
    ctx.arc(point.x, point.y + yOffset, iconSize/2 + 10, 0, Math.PI * 2);
    ctx.fill();
    
    // White border around circle
    ctx.strokeStyle = "white";
    ctx.lineWidth = 4;
    ctx.stroke();
    
    // 🔥 TRANSPORT ICON
    ctx.font = `${iconSize}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    
    // Shadow for depth
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fillText(emoji, point.x + 3, point.y + yOffset + 3);
    
    // Main icon
    ctx.fillStyle = "white";
    ctx.fillText(emoji, point.x, point.y + yOffset);
    
    ctx.restore();
  }

  private interpolateRoute(from: Stop, to: Stop, steps: number): number[][] {
    const coords: number[][] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      coords.push([
        from.lon + (to.lon - from.lon) * t,
        from.lat + (to.lat - from.lat) * t,
      ]);
    }
    return coords;
  }

  private interpolatePosition(from: Stop, to: Stop, progress: number): [number, number] {
    return [
      from.lon + (to.lon - from.lon) * progress,
      from.lat + (to.lat - from.lat) * progress,
    ];
  }

  private easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  private loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  }

  private waitFrame(): Promise<void> {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
  }

  cleanup() {
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      this.mediaRecorder.stop();
    }
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
    if (this.mapContainer.parentNode) {
      this.mapContainer.parentNode.removeChild(this.mapContainer);
    }
  }
}

export async function generateMapTripVideo(
  options: GenerateVideoOptions
): Promise<Blob> {
  const generator = new MapVideoGenerator();
  try {
    return await generator.generate(options);
  } finally {
    generator.cleanup();
  }
}