// src/lib/generateItineraryPDF.ts
import jsPDF from "jspdf";
import { apiFetch } from "./apiClient";

type ItineraryItem = {
  id: number;
  title: string;
  address: string | null;
  lat: number | null;
  lon: number | null;
  sort_order: number;
  day: number | null;
  start_time?: string | null;
  end_time?: string | null;
  thumbnail_url?: string | null;
  notes_summary?: string | null;
  item_type?: string | null;
  cost_amount?: number | null;
  cost_currency?: string | null;
  is_all_day?: boolean;
};

type TripDay = {
  id: number;
  trip: number;
  date: string | null;
  day_index: number;
  note: string | null;
};

type TripData = {
  id: number;
  title: string;
  main_city: string | null;
  main_country: string | null;
  start_date: string | null;
  end_date: string | null;
};

type TripBudget = {
  id: number;
  currency: string;
  planned_total: number | string;
};

type TripExpense = {
  id: number;
  description: string;
  category: string;
  amount: number;
  currency: string;
};

// Colors - matching TripSubHeader website theme
const COLORS = {
  primary: [29, 78, 216] as [number, number, number],      // #1d4ed8 - main blue
  secondary: [99, 102, 241] as [number, number, number],   // #6366f1 - indigo/purple
  dark: [17, 24, 39] as [number, number, number],          // #111827 - text dark
  gray: [107, 114, 128] as [number, number, number],       // #6b7280 - text gray
  lightGray: [229, 231, 235] as [number, number, number],  // #e5e7eb - borders
  accent: [16, 185, 129] as [number, number, number],      // #10b981 - green accent (matches website)
  accentLight: [236, 253, 243] as [number, number, number],// #ecfdf3 - light green bg
  white: [255, 255, 255] as [number, number, number],
  warmBg: [255, 250, 245] as [number, number, number],     // #fffaf5 - warm background
  coolBg: [248, 250, 252] as [number, number, number],     // #f8fafc - cool background
};

// Load an image and return it as an HTMLImageElement
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = url;
  });
}

// Convert lat/lon to pixel position at a given zoom level
function latLonToPixel(lat: number, lon: number, zoom: number): { x: number; y: number } {
  const n = Math.pow(2, zoom);
  const x = ((lon + 180) / 360) * n * 256;
  const latRad = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n * 256;
  return { x, y };
}

// Create a route map with OpenStreetMap tiles as background
async function createRouteMapCanvas(items: ItineraryItem[], width: number = 1000, height: number = 650): Promise<string | null> {
  const validItems = items.filter(it => it.lat != null && it.lon != null);
  if (validItems.length === 0) return null;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Layout: Map area on left, legend on right
  const legendWidth = 240;
  const mapAreaWidth = width - legendWidth - 10;
  const mapImgWidth = mapAreaWidth - 16;
  const mapImgHeight = height - 16;
  const mapX = 8;
  const mapY = 8;

  // Calculate bounds from all items
  const lats = validItems.map(it => it.lat!);
  const lons = validItems.map(it => it.lon!);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  
  // Add padding to bounds (15% on each side - smaller padding = more zoom)
  const latPadding = Math.max((maxLat - minLat) * 0.15, 0.005);
  const lonPadding = Math.max((maxLon - minLon) * 0.15, 0.005);
  const paddedMinLat = minLat - latPadding;
  const paddedMaxLat = maxLat + latPadding;
  const paddedMinLon = minLon - lonPadding;
  const paddedMaxLon = maxLon + lonPadding;
  
  // Calculate center of bounds
  const centerLat = (paddedMinLat + paddedMaxLat) / 2;
  const centerLon = (paddedMinLon + paddedMaxLon) / 2;
  
  // Find the best zoom level that fits all markers in the map area
  let zoom = 17;
  for (let z = 17; z >= 1; z--) {
    const topLeft = latLonToPixel(paddedMaxLat, paddedMinLon, z);
    const bottomRight = latLonToPixel(paddedMinLat, paddedMaxLon, z);
    const boundsWidth = bottomRight.x - topLeft.x;
    const boundsHeight = bottomRight.y - topLeft.y;
    
    // Use smaller margin (40px) for tighter fit = more zoom
    if (boundsWidth <= mapImgWidth - 40 && boundsHeight <= mapImgHeight - 40) {
      zoom = z;
      break;
    }
  }
  
  // Get center pixel position at this zoom
  const centerPixel = latLonToPixel(centerLat, centerLon, zoom);
  
  // Calculate the pixel bounds of our map view (what portion of the world map we're showing)
  const mapViewLeft = centerPixel.x - mapImgWidth / 2;
  const mapViewTop = centerPixel.y - mapImgHeight / 2;

  // === BACKGROUND ===
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(0, 0, width, height);

  // Try to load OpenStreetMap tiles
  let mapLoaded = false;
  try {
    // Calculate which tiles we need
    const startTileX = Math.floor(mapViewLeft / 256);
    const startTileY = Math.floor(mapViewTop / 256);
    const endTileX = Math.floor((mapViewLeft + mapImgWidth) / 256);
    const endTileY = Math.floor((mapViewTop + mapImgHeight) / 256);
    
    const tilesX = endTileX - startTileX + 1;
    const tilesY = endTileY - startTileY + 1;
    
    // Create a temporary canvas for the map tiles
    const tileCanvas = document.createElement('canvas');
    tileCanvas.width = tilesX * 256;
    tileCanvas.height = tilesY * 256;
    const tileCtx = tileCanvas.getContext('2d');
    
    if (tileCtx) {
      // Load tiles in parallel
      const tilePromises: Promise<{ img: HTMLImageElement; x: number; y: number } | null>[] = [];
      
      for (let ty = 0; ty < tilesY; ty++) {
        for (let tx = 0; tx < tilesX; tx++) {
          const tileX = startTileX + tx;
          const tileY = startTileY + ty;
          const tileUrl = `https://tile.openstreetmap.org/${zoom}/${tileX}/${tileY}.png`;
          
          tilePromises.push(
            loadImage(tileUrl)
              .then(img => ({ img, x: tx * 256, y: ty * 256 }))
              .catch(() => null)
          );
        }
      }
      
      const tiles = await Promise.all(tilePromises);
      let loadedCount = 0;
      
      tiles.forEach(tile => {
        if (tile) {
          tileCtx.drawImage(tile.img, tile.x, tile.y);
          loadedCount++;
        }
      });
      
      if (loadedCount > 0) {
        // Calculate where to crop from the tile canvas
        const cropX = mapViewLeft - startTileX * 256;
        const cropY = mapViewTop - startTileY * 256;
        
        // Draw the composited tiles onto main canvas
        ctx.drawImage(
          tileCanvas,
          cropX, cropY, mapImgWidth, mapImgHeight,
          mapX, mapY, mapImgWidth, mapImgHeight
        );
        mapLoaded = true;
      }
    }
  } catch {
    // Tile loading failed
  }

  // Fallback: Create a styled placeholder if map didn't load
  if (!mapLoaded) {
    const mapBg = ctx.createLinearGradient(0, 0, mapAreaWidth, height);
    mapBg.addColorStop(0, '#e8f4f8');
    mapBg.addColorStop(0.5, '#f0f9ff');
    mapBg.addColorStop(1, '#e0f2fe');
    ctx.fillStyle = mapBg;
    ctx.fillRect(mapX, mapY, mapImgWidth, mapImgHeight);
    
    // Grid pattern
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
    ctx.lineWidth = 1;
    const gridSize = 40;
    for (let x = mapX; x < mapX + mapImgWidth; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, mapY);
      ctx.lineTo(x, mapY + mapImgHeight);
      ctx.stroke();
    }
    for (let y = mapY; y < mapY + mapImgHeight; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(mapX, y);
      ctx.lineTo(mapX + mapImgWidth, y);
      ctx.stroke();
    }
    
    ctx.fillStyle = 'rgba(148, 163, 184, 0.3)';
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Route Map', mapX + mapImgWidth / 2, mapY + mapImgHeight / 2);
  }
  
  // Border around map area
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 2;
  ctx.strokeRect(mapX, mapY, mapImgWidth, mapImgHeight);
  
  // Convert lat/lon to canvas coordinates using the same tile system
  const toCanvasCoords = (lat: number, lon: number): [number, number] => {
    const pixel = latLonToPixel(lat, lon, zoom);
    const x = mapX + (pixel.x - mapViewLeft);
    const y = mapY + (pixel.y - mapViewTop);
    return [x, y];
  };

  // Calculate positions for all markers (no offset - exact locations)
  const positions = validItems.map((item, index) => ({
    coords: toCanvasCoords(item.lat!, item.lon!),
    index,
    title: item.title
  }));

  // Draw route lines - using primary blue
  if (positions.length > 1) {
    ctx.strokeStyle = '#1d4ed8'; // primary blue
    ctx.lineWidth = 2.5;
    ctx.setLineDash([10, 5]);
    ctx.beginPath();
    ctx.moveTo(positions[0].coords[0], positions[0].coords[1]);
    positions.forEach((pos, i) => {
      if (i > 0) ctx.lineTo(pos.coords[0], pos.coords[1]);
    });
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Draw markers (draw in reverse order so lower numbers appear on top)
  const sortedPositions = [...positions].reverse();
  sortedPositions.forEach(({ coords: [x, y], index }) => {
    // Shadow
    ctx.beginPath();
    ctx.arc(x + 2, y + 2, 16, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.fill();
    
    // White border
    ctx.beginPath();
    ctx.arc(x, y, 16, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#059669'; // emerald-600 border
    ctx.lineWidth = 2;
    ctx.stroke();

    // Colored center - green accent matching website
    ctx.beginPath();
    ctx.arc(x, y, 12, 0, Math.PI * 2);
    ctx.fillStyle = '#10b981'; // emerald-500
    ctx.fill();

    // Number
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((index + 1).toString(), x, y);
  });

  // === LEGEND PANEL on right ===
  const legendX = mapAreaWidth + 5;
  const legendY = 12;
  const legendH = height - 24;
  
  // Legend background with shadow effect
  ctx.shadowColor = 'rgba(0,0,0,0.1)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(legendX, legendY, legendWidth - 15, legendH, 10);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  
  // Border
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1;
  ctx.stroke();
  
  // Legend title
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 16px Arial';
  ctx.textAlign = 'left';
  ctx.fillText('Route Stops', legendX + 18, legendY + 30);
  
  // Subtitle with count
  ctx.fillStyle = '#64748b';
  ctx.font = '12px Arial';
  ctx.fillText(`${validItems.length} location${validItems.length !== 1 ? 's' : ''}`, legendX + 18, legendY + 48);
  
  // Divider
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(legendX + 15, legendY + 60);
  ctx.lineTo(legendX + legendWidth - 30, legendY + 60);
  ctx.stroke();
  
  // Legend items
  const itemHeight = 36;
  const startY = legendY + 75;
  const availableHeight = legendH - 90;
  const maxItems = Math.floor(availableHeight / itemHeight);
  const displayItems = validItems.slice(0, maxItems);
  
  displayItems.forEach((item, index) => {
    const itemY = startY + index * itemHeight;
    
    // Number badge - green accent
    ctx.beginPath();
    ctx.arc(legendX + 30, itemY + 10, 12, 0, Math.PI * 2);
    ctx.fillStyle = '#10b981'; // emerald-500
    ctx.fill();
    
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((index + 1).toString(), legendX + 30, itemY + 10);
    
    // Location name
    const maxNameLen = 20;
    const name = item.title.length > maxNameLen ? item.title.substring(0, maxNameLen - 2) + '…' : item.title;
    ctx.fillStyle = '#1e293b';
    ctx.font = '13px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, legendX + 50, itemY + 10);
  });
  
  if (validItems.length > maxItems) {
    const moreY = startY + maxItems * itemHeight;
    ctx.fillStyle = '#64748b';
    ctx.font = 'italic 12px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`+ ${validItems.length - maxItems} more stops...`, legendX + 30, moreY);
  }

  return canvas.toDataURL('image/png');
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function formatTime(timeStr: string | null | undefined): string {
  if (!timeStr) return "";
  try {
    const [h, m] = timeStr.split(":");
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    const h12 = hour % 12 || 12;
    return `${h12}:${m} ${ampm}`;
  } catch {
    return timeStr;
  }
}

function getItemsForDay(items: ItineraryItem[], dayId: number): ItineraryItem[] {
  return items
    .filter((it) => it.day === dayId)
    .sort((a, b) => a.sort_order - b.sort_order);
}

// Fetch budget data from trip overview (same source as TripSubHeader)
async function fetchBudgetData(tripId: number): Promise<{ plannedTotal: number; currencySymbol: string; totalSpent: number }> {
  try {
    // Get planned budget from trip overview
    const overview = await apiFetch(`/f1/trips/${tripId}/overview/`);
    const plannedTotal = overview.planned_total != null ? Number(overview.planned_total) : 0;
    const currencySymbol = overview.currency_symbol || "$";
    
    // Get expenses to calculate total spent
    const expenses = await apiFetch(`/f3/expenses/?trip=${tripId}`);
    const expenseList = Array.isArray(expenses) ? expenses : [];
    const totalSpent = expenseList.reduce((sum: number, e: TripExpense) => sum + Number(e.amount || 0), 0);
    
    return { plannedTotal, currencySymbol, totalSpent };
  } catch (err) {
    console.error("Failed to fetch budget data:", err);
    return { plannedTotal: 0, currencySymbol: "$", totalSpent: 0 };
  }
}

export async function generateItineraryPDF(
  trip: TripData,
  days: TripDay[],
  items: ItineraryItem[]
): Promise<void> {
  const pdf = new jsPDF("p", "mm", "a4");
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - 2 * margin;
  let y = margin;

  // Fetch budget data from trip overview
  const { plannedTotal: plannedBudget, currencySymbol: currency, totalSpent } = await fetchBudgetData(trip.id);

  // Sort days by day_index
  const sortedDays = [...days].sort((a, b) => a.day_index - b.day_index);
  
  // Create a map of day ID to day_index for sorting items
  const dayIndexMap = new Map<number, number>();
  sortedDays.forEach(day => dayIndexMap.set(day.id, day.day_index));
  
  // Sort items by day order first, then by sort_order within each day
  const sortedItems = [...items].sort((a, b) => {
    const dayIndexA = a.day != null ? (dayIndexMap.get(a.day) ?? 999) : 999;
    const dayIndexB = b.day != null ? (dayIndexMap.get(b.day) ?? 999) : 999;
    if (dayIndexA !== dayIndexB) return dayIndexA - dayIndexB;
    return a.sort_order - b.sort_order;
  });

  const checkPageBreak = (requiredHeight: number) => {
    if (y + requiredHeight > pageHeight - margin) {
      pdf.addPage();
      y = margin;
      return true;
    }
    return false;
  };

  // ==================== COVER PAGE ====================
  
  // Header bar with gradient-like appearance (matching website TripSubHeader)
  const headerHeight = 32;
  // Light gradient background (simulated with solid light color)
  pdf.setFillColor(...COLORS.coolBg);
  pdf.rect(0, 0, pageWidth, headerHeight, "F");
  // Bottom border line
  pdf.setDrawColor(...COLORS.lightGray);
  pdf.setLineWidth(0.5);
  pdf.line(0, headerHeight, pageWidth, headerHeight);

  // Title (dark text like website)
  pdf.setTextColor(...COLORS.dark);
  pdf.setFontSize(16);
  pdf.setFont("helvetica", "bold");
  const fullTitle = trip.title || "Trip Itinerary";
  const maxTitleWidth = pageWidth - margin * 2;
  
  // Split title into lines if needed
  const titleLines = pdf.splitTextToSize(fullTitle, maxTitleWidth);
  const displayTitleLines = titleLines.slice(0, 2); // Max 2 lines
  if (titleLines.length > 2) {
    displayTitleLines[1] = displayTitleLines[1].slice(0, -3) + "...";
  }
  
  // Position title
  const isSingleLine = displayTitleLines.length === 1;
  const titleY = isSingleLine ? 12 : 10;
  pdf.text(displayTitleLines, margin, titleY);

  // Info line below title (gray text like website stats)
  pdf.setFontSize(8);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(...COLORS.gray);
  
  // Build the info line with all stats
  const infoParts: string[] = [];
  
  // Location
  if (trip.main_city || trip.main_country) {
    infoParts.push([trip.main_city, trip.main_country].filter(Boolean).join(", "));
  }
  
  // Dates
  if (trip.start_date) {
    const shortDateFmt = (d: string) => {
      const date = new Date(d);
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    };
    const dateStr = trip.end_date 
      ? `${shortDateFmt(trip.start_date)} - ${shortDateFmt(trip.end_date)}`
      : shortDateFmt(trip.start_date);
    infoParts.push(dateStr);
  }
  
  // Duration and stops
  infoParts.push(`${sortedDays.length} day${sortedDays.length !== 1 ? "s" : ""}`);
  infoParts.push(`${sortedItems.length} stop${sortedItems.length !== 1 ? "s" : ""}`);
  
  // Budget
  if (plannedBudget > 0) {
    infoParts.push(`Budget: ${currency} ${plannedBudget.toLocaleString()}`);
  }
  
  // Join all parts with separator and position below title
  const infoLine = infoParts.join("  ·  ");
  const infoY = isSingleLine ? 20 : 21;
  pdf.text(infoLine, margin, infoY);

  // Add small accent bar at top
  pdf.setFillColor(...COLORS.primary);
  pdf.rect(0, 0, pageWidth, 3, "F");

  y = headerHeight + 6; // Start content with small gap below header

  // ==================== TRIP MAP (preserve aspect ratio) ====================
  const canvasWidth = 1000;
  const canvasHeight = 650;
  const mapImage = await createRouteMapCanvas(sortedItems, canvasWidth, canvasHeight);
  if (mapImage) {
    // Calculate height that preserves aspect ratio
    const aspectRatio = canvasHeight / canvasWidth;
    const mapHeight = contentWidth * aspectRatio; // ~110mm for proper proportions
    
    // Map section header with primary blue pill style
    pdf.setFillColor(...COLORS.primary);
    pdf.roundedRect(margin, y, contentWidth, 8, 2, 2, "F");
    pdf.setTextColor(...COLORS.white);
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    pdf.text("Trip Route Map", margin + 4, y + 5.5);
    y += 10;
    
    try {
      pdf.addImage(mapImage, "PNG", margin, y, contentWidth, mapHeight);
      y += mapHeight + 6;
    } catch {
      y += 3;
    }
  }

  y += 6; // Space before overview section

  // Quick overview heading (styled like website section headers)
  pdf.setTextColor(...COLORS.dark);
  pdf.setFontSize(12);
  pdf.setFont("helvetica", "bold");
  pdf.text("Day-by-Day Overview", margin, y);
  y += 8;

  // Day-by-day quick summary (compact) - use already sorted days
  for (const day of sortedDays) {
    checkPageBreak(14);
    
    const dayItems = getItemsForDay(sortedItems, day.id);
    
    // Soft background like website cards
    pdf.setFillColor(...COLORS.coolBg);
    pdf.roundedRect(margin, y, contentWidth, 12, 2, 2, "F");
    // Subtle border
    pdf.setDrawColor(...COLORS.lightGray);
    pdf.setLineWidth(0.3);
    pdf.roundedRect(margin, y, contentWidth, 12, 2, 2, "S");
    
    pdf.setTextColor(...COLORS.primary);
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "bold");
    pdf.text(`Day ${day.day_index}`, margin + 5, y + 8);
    
    pdf.setTextColor(...COLORS.gray);
    pdf.setFont("helvetica", "normal");
    if (day.date) {
      const shortDate = new Date(day.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
      pdf.text(shortDate, margin + 28, y + 8);
    }
    
    // Stop count badge with accent green
    pdf.setFillColor(...COLORS.accentLight);
    const stopText = `${dayItems.length} stop${dayItems.length !== 1 ? "s" : ""}`;
    pdf.setFontSize(8);
    const stopWidth = pdf.getTextWidth(stopText) + 6;
    pdf.roundedRect(margin + contentWidth - stopWidth - 5, y + 2.5, stopWidth, 7, 2, 2, "F");
    pdf.setTextColor(...COLORS.accent);
    pdf.setFont("helvetica", "bold");
    pdf.text(stopText, margin + contentWidth - stopWidth - 2, y + 7.5);
    
    y += 14;
  }

  // ==================== DETAILED ITINERARY ====================
  
  pdf.addPage();
  y = margin;

  // Section header - softer style matching website
  pdf.setFillColor(...COLORS.coolBg);
  pdf.rect(0, 0, pageWidth, 25, "F");
  // Top accent bar
  pdf.setFillColor(...COLORS.secondary);
  pdf.rect(0, 0, pageWidth, 3, "F");
  // Bottom border
  pdf.setDrawColor(...COLORS.lightGray);
  pdf.setLineWidth(0.5);
  pdf.line(0, 25, pageWidth, 25);
  
  pdf.setTextColor(...COLORS.dark);
  pdf.setFontSize(18);
  pdf.setFont("helvetica", "bold");
  pdf.text("Detailed Itinerary", margin, 17);
  
  y = 40;

  for (const day of sortedDays) {
    checkPageBreak(40);
    
    const dayItems = getItemsForDay(sortedItems, day.id);
    
    // Day header - softer style with left accent
    pdf.setFillColor(...COLORS.coolBg);
    pdf.roundedRect(margin, y, contentWidth, 16, 3, 3, "F");
    // Left accent bar
    pdf.setFillColor(...COLORS.primary);
    pdf.roundedRect(margin, y, 4, 16, 2, 2, "F");
    // Border
    pdf.setDrawColor(...COLORS.lightGray);
    pdf.setLineWidth(0.3);
    pdf.roundedRect(margin, y, contentWidth, 16, 3, 3, "S");
    
    pdf.setTextColor(...COLORS.primary);
    pdf.setFontSize(13);
    pdf.setFont("helvetica", "bold");
    pdf.text(`Day ${day.day_index}`, margin + 10, y + 11);
    
    if (day.date) {
      pdf.setTextColor(...COLORS.gray);
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.text(formatDate(day.date), margin + 45, y + 11);
    }
    
    y += 20;

    // Day note (if available)
    if (day.note && day.note.trim()) {
      pdf.setFillColor(254, 249, 195); // light yellow background
      const noteLines = pdf.splitTextToSize(day.note, contentWidth - 16);
      const noteHeight = Math.min(noteLines.length, 3) * 4 + 6;
      pdf.roundedRect(margin, y, contentWidth, noteHeight, 2, 2, "F");
      
      pdf.setTextColor(133, 77, 14); // amber-700
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "italic");
      
      // Show up to 3 lines
      const displayLines = noteLines.slice(0, 3);
      if (noteLines.length > 3) {
        displayLines[2] = displayLines[2].slice(0, -3) + "...";
      }
      
      let noteY = y + 5;
      for (const line of displayLines) {
        pdf.text(`📝 ${line}`, margin + 5, noteY);
        noteY += 4;
      }
      
      y += noteHeight + 3;
    }

    if (dayItems.length === 0) {
      pdf.setTextColor(...COLORS.gray);
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "italic");
      pdf.text("No stops planned for this day", margin + 10, y);
      y += 15;
      continue;
    }

    // Items for this day
    for (let i = 0; i < dayItems.length; i++) {
      const item = dayItems[i];
      const hasThumbnail = !!item.thumbnail_url;
      const hasNotes = !!item.notes_summary;
      const thumbnailSize = 18; // mm
      
      // Calculate item height based on content
      let baseHeight = 16; // title row
      if (item.address) baseHeight += 8; // address row
      if (item.start_time || item.end_time || item.is_all_day) baseHeight += 8; // time row
      if (hasNotes) {
        // Estimate notes height (roughly 4mm per line, max 3 lines)
        const notesLines = Math.min(Math.ceil((item.notes_summary?.length || 0) / 50), 3);
        baseHeight += 4 + (notesLines * 4);
      }
      const itemHeight = hasThumbnail ? Math.max(thumbnailSize + 4, baseHeight) : Math.max(baseHeight, 20);
      
      checkPageBreak(itemHeight + 8);

      // Try to load thumbnail
      let thumbnailLoaded = false;
      if (hasThumbnail && item.thumbnail_url) {
        try {
          const img = await loadImage(item.thumbnail_url);
          // Draw thumbnail on the right side
          const thumbX = margin + contentWidth - thumbnailSize - 5;
          const thumbY = y;
          
          // Draw rounded rectangle border
          pdf.setFillColor(245, 245, 245);
          pdf.roundedRect(thumbX - 1, thumbY - 1, thumbnailSize + 2, thumbnailSize + 2, 2, 2, "F");
          
          // Add the image
          pdf.addImage(img, "JPEG", thumbX, thumbY, thumbnailSize, thumbnailSize);
          
          // Add subtle border
          pdf.setDrawColor(229, 231, 235);
          pdf.setLineWidth(0.3);
          pdf.roundedRect(thumbX, thumbY, thumbnailSize, thumbnailSize, 1, 1, "S");
          
          thumbnailLoaded = true;
        } catch {
          // Thumbnail failed to load, continue without it
        }
      }

      // Stop number circle (green accent like website)
      pdf.setFillColor(...COLORS.accent);
      pdf.circle(margin + 6, y + 6, 5, "F");
      pdf.setTextColor(...COLORS.white);
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "bold");
      pdf.text(String(i + 1), margin + 6 - (i + 1 >= 10 ? 2.5 : 1.5), y + 8);

      // Calculate available width for content (leave space for thumbnail if present)
      const contentMaxWidth = thumbnailLoaded ? contentWidth - thumbnailSize - 30 : contentWidth - 25;
      const titleX = margin + 18;
      let currentY = y;
      
      // Item title
      pdf.setTextColor(...COLORS.dark);
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "bold");
      
      // Truncate title if needed
      let displayTitle = item.title || "Untitled Stop";
      while (pdf.getTextWidth(displayTitle) > contentMaxWidth && displayTitle.length > 10) {
        displayTitle = displayTitle.slice(0, -4) + "...";
      }
      pdf.text(displayTitle, titleX, currentY + 6);
      currentY += 10;

      // Time and type info row
      let hasTimeRow = false;
      if (item.is_all_day) {
        pdf.setFillColor(254, 243, 199); // yellow background
        const timeStr = "All Day";
        const timeWidth = pdf.getTextWidth(timeStr) + 6;
        pdf.roundedRect(titleX, currentY - 2, timeWidth, 6, 1, 1, "F");
        pdf.setTextColor(161, 98, 7); // amber text
        pdf.setFontSize(7);
        pdf.setFont("helvetica", "bold");
        pdf.text(timeStr, titleX + 3, currentY + 2);
        hasTimeRow = true;
      } else if (item.start_time || item.end_time) {
        const timeStr = item.start_time && item.end_time
          ? `${formatTime(item.start_time)} - ${formatTime(item.end_time)}`
          : formatTime(item.start_time || item.end_time);
        
        pdf.setFillColor(239, 246, 255);
        const timeWidth = pdf.getTextWidth(timeStr) + 6;
        pdf.roundedRect(titleX, currentY - 2, timeWidth, 6, 1, 1, "F");
        pdf.setTextColor(...COLORS.primary);
        pdf.setFontSize(7);
        pdf.setFont("helvetica", "normal");
        pdf.text(timeStr, titleX + 3, currentY + 2);
        hasTimeRow = true;
      }
      
      // Item type badge (if available)
      if (item.item_type) {
        const typeStr = item.item_type.charAt(0).toUpperCase() + item.item_type.slice(1);
        pdf.setFillColor(243, 244, 246);
        pdf.setFontSize(7);
        const typeWidth = pdf.getTextWidth(typeStr) + 6;
        const typeX = hasTimeRow ? titleX + 45 : titleX;
        pdf.roundedRect(typeX, currentY - 2, typeWidth, 6, 1, 1, "F");
        pdf.setTextColor(107, 114, 128);
        pdf.setFont("helvetica", "normal");
        pdf.text(typeStr, typeX + 3, currentY + 2);
        hasTimeRow = true;
      }
      
      if (hasTimeRow) currentY += 7;

      // Address
      if (item.address) {
        pdf.setTextColor(...COLORS.gray);
        pdf.setFontSize(8);
        pdf.setFont("helvetica", "normal");
        
        // Add location icon indicator
        pdf.text("📍", titleX - 1, currentY + 2);
        
        // Truncate long addresses
        let addr = item.address;
        while (pdf.getTextWidth(addr) > contentMaxWidth - 10 && addr.length > 20) {
          addr = addr.slice(0, -4) + "...";
        }
        pdf.text(addr, titleX + 5, currentY + 2);
        currentY += 6;
      }

      // Notes
      if (hasNotes && item.notes_summary) {
        pdf.setTextColor(100, 116, 139); // slate-500
        pdf.setFontSize(7);
        pdf.setFont("helvetica", "italic");
        
        // Split notes into lines
        const maxLineWidth = contentMaxWidth - 5;
        const words = item.notes_summary.split(' ');
        let lines: string[] = [];
        let currentLine = '';
        
        for (const word of words) {
          const testLine = currentLine ? `${currentLine} ${word}` : word;
          if (pdf.getTextWidth(testLine) < maxLineWidth) {
            currentLine = testLine;
          } else {
            if (currentLine) lines.push(currentLine);
            currentLine = word;
          }
        }
        if (currentLine) lines.push(currentLine);
        
        // Limit to 3 lines
        if (lines.length > 3) {
          lines = lines.slice(0, 3);
          lines[2] = lines[2].slice(0, -3) + "...";
        }
        
        for (const line of lines) {
          pdf.text(`"${line}"`, titleX, currentY + 2);
          currentY += 4;
        }
      }
      
      // Cost (if available) - green accent like website
      if (item.cost_amount && item.cost_amount > 0) {
        pdf.setTextColor(...COLORS.accent);
        pdf.setFontSize(8);
        pdf.setFont("helvetica", "bold");
        const costStr = `${item.cost_currency || '$'}${item.cost_amount.toLocaleString()}`;
        const costX = thumbnailLoaded 
          ? margin + contentWidth - thumbnailSize - pdf.getTextWidth(costStr) - 10
          : margin + contentWidth - pdf.getTextWidth(costStr) - 5;
        pdf.text(costStr, costX, y + 6);
      }

      // Vertical connector line (except for last item)
      if (i < dayItems.length - 1) {
        pdf.setDrawColor(...COLORS.lightGray);
        pdf.setLineWidth(0.5);
        pdf.line(margin + 6, y + 12, margin + 6, y + itemHeight + 3);
      }

      y += itemHeight + 3;
    }

    y += 10; // Space between days
  }

  // ==================== BUDGET SUMMARY SECTION ====================
  if (plannedBudget > 0) {
    checkPageBreak(50);
    
    // Section header - softer style
    pdf.setFillColor(...COLORS.primary);
    pdf.roundedRect(margin, y, contentWidth, 10, 2, 2, "F");
    pdf.setTextColor(...COLORS.white);
    pdf.setFontSize(12);
    pdf.setFont("helvetica", "bold");
    pdf.text("Budget Summary", margin + 5, y + 7);
    y += 15;
    
    // Budget box with soft background
    pdf.setFillColor(...COLORS.coolBg);
    pdf.roundedRect(margin, y, contentWidth, 35, 3, 3, "F");
    pdf.setDrawColor(...COLORS.lightGray);
    pdf.setLineWidth(0.3);
    pdf.roundedRect(margin, y, contentWidth, 35, 3, 3, "S");
    
    const budgetY = y + 12;
    const colWidth = contentWidth / 3;
    
    // Planned budget
    pdf.setTextColor(...COLORS.gray);
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "bold");
    pdf.text("PLANNED BUDGET", margin + 10, budgetY);
    pdf.setTextColor(...COLORS.dark);
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text(`${currency} ${plannedBudget.toLocaleString()}`, margin + 10, budgetY + 12);
    
    // Amount spent
    pdf.setTextColor(...COLORS.gray);
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "bold");
    pdf.text("AMOUNT SPENT", margin + colWidth + 10, budgetY);
    pdf.setTextColor(...COLORS.secondary);
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text(`${currency} ${totalSpent.toLocaleString()}`, margin + colWidth + 10, budgetY + 12);
    
    // Remaining
    const remaining = plannedBudget - totalSpent;
    pdf.setTextColor(...COLORS.gray);
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "bold");
    pdf.text("REMAINING", margin + colWidth * 2 + 10, budgetY);
    // Green if positive, red if negative
    if (remaining >= 0) {
      pdf.setTextColor(...COLORS.accent);
    } else {
      pdf.setTextColor(220, 38, 38); // red-600
    }
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text(`${currency} ${remaining.toLocaleString()}`, margin + colWidth * 2 + 10, budgetY + 12);
    
    y += 45;
  }

  // ==================== FOOTER ON LAST PAGE ====================
  
  const footerY = pageHeight - 15;
  pdf.setTextColor(...COLORS.gray);
  pdf.setFontSize(8);
  pdf.setFont("helvetica", "normal");
  pdf.text(
    `Generated by TripMate on ${new Date().toLocaleDateString()}`,
    margin,
    footerY
  );
  pdf.text(
    `Page ${pdf.getNumberOfPages()}`,
    pageWidth - margin - 15,
    footerY
  );

  // Add page numbers to all pages
  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setTextColor(...COLORS.gray);
    pdf.setFontSize(8);
    pdf.text(`Page ${i} of ${totalPages}`, pageWidth - margin - 20, pageHeight - 10);
  }

  // Save the PDF
  const fileName = `${(trip.title || "Trip").replace(/[^a-zA-Z0-9]/g, "_")}_Itinerary.pdf`;
  pdf.save(fileName);
}
