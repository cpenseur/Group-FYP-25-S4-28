// frontend/src/lib/videoGenerator.ts
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

const CANVAS_WIDTH = 1280;
const CANVAS_HEIGHT = 720;
const FPS = 24;
const TRAVEL_DURATION = 7;        
const PHOTO_DURATION = 5;         
const TRANSITION_DURATION = 1.0;  
const TITLE_DURATION = 4;         

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

  private getSupportedMimeType(): string {
    // List of codecs to try, in order of preference
    const codecs = [
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm",
      "video/mp4;codecs=h264",
      "video/mp4",
    ];

    for (const codec of codecs) {
      if (MediaRecorder.isTypeSupported(codec)) {
        console.log(`Using video codec: ${codec}`);
        return codec;
      }
    }

    // Fallback - let the browser decide
    console.warn("No preferred codec supported, using browser default");
    return "";
  }

  async generate(options: GenerateVideoOptions): Promise<Blob> {
    const { groups, transportModes, title, onProgress } = options;

    try {
      await this.initializeMap(groups);

      const stream = this.canvas.captureStream(FPS);
      const mimeType = this.getSupportedMimeType();
      
      const recorderOptions: MediaRecorderOptions = {
        videoBitsPerSecond: 1500000,  // 1.5 Mbps for smaller files
      };
      
      if (mimeType) {
        recorderOptions.mimeType = mimeType;
      }
      
      this.mediaRecorder = new MediaRecorder(stream, recorderOptions);

      this.recordedChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      // Calculate total frames
      let totalFrames = FPS * TITLE_DURATION;
      for (let i = 0; i < groups.length; i++) {
        if (i > 0) {
          totalFrames += TRAVEL_DURATION * FPS;  // ✅ FIXED: Use constant
        }
        totalFrames += TRANSITION_DURATION * FPS;
        totalFrames += groups[i].photos.length * PHOTO_DURATION * FPS;
        totalFrames += TRANSITION_DURATION * FPS;
      }
      totalFrames += FPS * 2;

      let currentFrame = 0;

      this.mediaRecorder.start();

      // Title slide
      if (onProgress) onProgress((currentFrame / totalFrames) * 100, "Creating title...");
      await this.renderTitleSlide(title);
      currentFrame += FPS * TITLE_DURATION;

      // Journey
      for (let i = 0; i < groups.length; i++) {
        const group = groups[i];

        // FIRST STOP: Check if we have a starting location
        if (i === 0) {
          if (options.startingLocation) {
            // Show journey from starting location to first stop
            if (onProgress) {
              const progress = (currentFrame / totalFrames) * 100;
              const transport = options.firstStopTransport || "car";  // ✅ FIXED: Changed from "plane" to "car"
              onProgress(progress, `${transportEmojis[transport]} from ${options.startingLocation.title} to ${group.stop.title}...`);
            }

            await this.renderMapJourney(
              {
                id: -1,
                title: options.startingLocation.title,
                lat: options.startingLocation.lat,
                lon: options.startingLocation.lon,
              },
              group.stop,
              options.firstStopTransport || "car",  // ✅ FIXED: Changed from "plane" to "car"
              TRAVEL_DURATION  // ✅ FIXED: Use constant instead of hardcoded 5
            );
            currentFrame += TRAVEL_DURATION * FPS;  // ✅ FIXED: Use constant
          } else {
            // No starting location, just show first stop briefly
            if (onProgress) {
              const progress = (currentFrame / totalFrames) * 100;
              onProgress(progress, `Arriving at ${group.stop.title}...`);
            }
            await this.renderMapLocation(group.stop, 2);
            currentFrame += 2 * FPS;
          }
        } else {
          // TRAVEL ANIMATION between stops
          const prevGroup = groups[i - 1];
          const key = `${prevGroup.stop.id}-${group.stop.id}`;
          const transport = transportModes[key] || "car";  // ✅ FIXED: Changed from "plane" to "car"

          if (onProgress) {
            const progress = (currentFrame / totalFrames) * 100;
            onProgress(progress, `${transportEmojis[transport]} to ${group.stop.title}...`);
          }

          await this.renderMapJourney(
            prevGroup.stop,
            group.stop,
            transport,
            TRAVEL_DURATION  // ✅ FIXED: Use constant instead of hardcoded 5
          );
          currentFrame += TRAVEL_DURATION * FPS;  // ✅ FIXED: Use constant
        }

        // Photos at this location (if any)
        if (group.photos.length > 0) {
          if (onProgress) {
            const progress = (currentFrame / totalFrames) * 100;
            onProgress(progress, `Photos at ${group.stop.title}...`);
          }

          await this.render3DPhotoCarousel(group.photos, group.stop.title);
          currentFrame += 
            TRANSITION_DURATION * FPS + 
            group.photos.length * PHOTO_DURATION * FPS + 
            TRANSITION_DURATION * FPS;
        } else {
          // No photos - just show location briefly
          if (onProgress) {
            const progress = (currentFrame / totalFrames) * 100;
            onProgress(progress, `Visiting ${group.stop.title}...`);
          }
          
          await this.renderMapLocation(group.stop, 2);
          currentFrame += 2 * FPS;
        }
      }

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
        setTimeout(() => resolve(), 500);
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
      
      ctx.font = "bold 80px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      
      const maxWidth = CANVAS_WIDTH - 100;
      const words = title.split(' ');
      const lines: string[] = [];
      let currentLine = words[0];
      
      for (let j = 1; j < words.length; j++) {
        const testLine = currentLine + ' ' + words[j];
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth) {
          lines.push(currentLine);
          currentLine = words[j];
        } else {
          currentLine = testLine;
        }
      }
      lines.push(currentLine);
      
      // Draw lines centered
      const lineHeight = 90;
      const startY = CANVAS_HEIGHT / 2 - ((lines.length - 1) * lineHeight) / 2;
      lines.forEach((line, idx) => {
        ctx.fillText(line, CANVAS_WIDTH / 2, startY + idx * lineHeight);
      });

      ctx.font = "40px Arial";
      ctx.fillText("✈️ Trip Highlights 🎬", CANVAS_WIDTH / 2, startY + lines.length * lineHeight + 60);
      
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
        'line-color': '#f59e0b',
        'line-width': 8,
        'line-dasharray': [3, 3],
      },
    });

    const bounds = new maplibregl.LngLatBounds(
      [Math.min(from.lon, to.lon), Math.min(from.lat, to.lat)],
      [Math.max(from.lon, to.lon), Math.max(from.lat, to.lat)]
    );

    // ✅ FIXED: Match map animation duration to actual frame duration
    // Convert duration to milliseconds and match exactly
    const mapDuration = duration * 1000;
    
    this.map!.fitBounds(bounds, {
      padding: 150,
      duration: mapDuration,  // ✅ Use exact duration
      essential: true,
      easing: (t) => t,  // ✅ Linear easing for consistent speed
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

    for (let photoIdx = 0; photoIdx < photos.length; photoIdx++) {
      const photo = photos[photoIdx];
      const img = await this.loadImage(photo.url);
      const frames = PHOTO_DURATION * FPS;

      const nextPhotos: HTMLImageElement[] = [];
      for (let offset = -1; offset <= 1; offset++) {
        const idx = photoIdx + offset;
        if (idx >= 0 && idx < photos.length && offset !== 0) {
          nextPhotos[offset] = await this.loadImage(photos[idx].url);
        }
      }

      for (let i = 0; i < frames; i++) {
        const progress = i / frames;

        ctx.fillStyle = "rgba(17, 24, 39, 0.95)";
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        for (let offset = -1; offset <= 1; offset++) {
          const idx = photoIdx + offset;
          if (idx < 0 || idx >= photos.length) continue;

          const isCenter = offset === 0;
          
          const rotationY = offset * 25;
          const perspective = 1 - Math.abs(offset) * 0.3;
          
          const breathScale = isCenter 
            ? 1 + Math.sin(progress * Math.PI * 2) * 0.03 
            : 1;
          
          const baseScale = isCenter ? 0.65 : 0.45;
          const scale = baseScale * perspective * breathScale;
          const opacity = isCenter ? 1 : 0.5;
          
          const imgWidth = CANVAS_WIDTH * 0.7 * scale;
          const imgHeight = CANVAS_HEIGHT * 0.7 * scale;
          
          const offsetX = offset * 500 * (1 - Math.abs(offset) * 0.2);
          const imgX = (CANVAS_WIDTH - imgWidth) / 2 + offsetX;
          const imgY = (CANVAS_HEIGHT - imgHeight) / 2;

          ctx.save();
          ctx.globalAlpha = opacity;

          ctx.fillStyle = "rgba(0,0,0,0.5)";
          ctx.fillRect(imgX + 15, imgY + 15, imgWidth, imgHeight);

          const imgToDraw = isCenter ? img : (nextPhotos[offset] || img);
          ctx.drawImage(imgToDraw, imgX, imgY, imgWidth, imgHeight);
          
          if (isCenter) {
            ctx.strokeStyle = "white";
            ctx.lineWidth = 8;
            ctx.strokeRect(imgX, imgY, imgWidth, imgHeight);
          }
          
          ctx.restore();
        }

        this.drawLocationLabel(locationTitle, CANVAS_WIDTH / 2, 80);

        ctx.fillStyle = "white";
        ctx.font = "bold 36px Arial";
        ctx.textAlign = "center";
        ctx.fillText(
          `${photoIdx + 1} / ${photos.length}`,
          CANVAS_WIDTH / 2,
          CANVAS_HEIGHT - 80
        );

        if (photo.caption) {
          ctx.font = "28px Arial";
          
          // Word wrap for long captions
          const maxCaptionWidth = CANVAS_WIDTH - 200;
          const words = photo.caption.split(' ');
          const lines: string[] = [];
          let currentLine = words[0];
          
          for (let j = 1; j < words.length; j++) {
            const testLine = currentLine + ' ' + words[j];
            const metrics = ctx.measureText(testLine);
            if (metrics.width > maxCaptionWidth) {
              lines.push(currentLine);
              currentLine = words[j];
            } else {
              currentLine = testLine;
            }
          }
          lines.push(currentLine);
          
          // Draw caption lines
          lines.forEach((line, idx) => {
            ctx.fillText(line, CANVAS_WIDTH / 2, CANVAS_HEIGHT - 140 - (lines.length - 1 - idx) * 35);
          });
        }

        await this.waitFrame();
      }
    }

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
      
      ctx.font = "bold 70px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Thanks for watching! 🎉", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
      ctx.restore();

      await this.waitFrame();
    }
  }

  // Updated to handle very long text with smaller font and aggressive truncation
  private drawLocationLabel(text: string, x: number, y: number, opacity: number = 1) {
    const ctx = this.ctx;
    
    ctx.save();
    ctx.globalAlpha = opacity;
    
    // FURTHER REDUCED: Font size from 28px to 24px to prevent overflow
    ctx.font = "bold 24px Arial";
    
    // REDUCED: Limit label width to 60% of canvas width (was 70%)
    const maxWidth = CANVAS_WIDTH * 0.6;
    let displayText = text;
    let metrics = ctx.measureText(displayText);
    
    // Truncate with ellipsis if too long
    if (metrics.width > maxWidth) {
      while (metrics.width > maxWidth && displayText.length > 0) {
        displayText = displayText.slice(0, -1);
        metrics = ctx.measureText(displayText + "...");
      }
      displayText = displayText + "...";
    }
    
    const textWidth = metrics.width;
    const padding = 14;  // ✅ Reduced from 16 to 14
    const boxWidth = Math.min(textWidth + padding * 2, maxWidth + padding * 2);
    const boxHeight = 44;  // ✅ Reduced from 48 to 44
    
    ctx.fillStyle = "rgba(17, 24, 39, 0.85)";
    ctx.beginPath();
    ctx.roundRect(x - boxWidth/2, y - boxHeight/2, boxWidth, boxHeight, 22);  // ✅ Reduced border radius
    ctx.fill();

    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(displayText, x, y);
    
    ctx.restore();
  }

  private drawTransportIcon(emoji: string, lng: number, lat: number, progress: number) {
    if (!this.map) return;

    const point = this.map.project([lng, lat]);
    const ctx = this.ctx;

    const bounce = Math.sin(progress * Math.PI * 3) * 20;

    ctx.save();
    
    const iconSize = 120;
    const yOffset = -80 + bounce;
    
    ctx.fillStyle = "rgba(245, 158, 11, 0.9)";
    ctx.beginPath();
    ctx.arc(point.x, point.y + yOffset, iconSize/2 + 10, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.strokeStyle = "white";
    ctx.lineWidth = 4;
    ctx.stroke();
    
    ctx.font = `${iconSize}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fillText(emoji, point.x + 3, point.y + yOffset + 3);
    
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