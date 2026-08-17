// ---------------------------------------------------------------
// window.storage polyfill for standalone deployment (outside Claude.ai).
// Backed by localStorage — works per-browser/device only. No real
// "shared" scope without a backend, so shared and personal both map
// to the same local store for now. Swap this for a real database
// (e.g. Supabase) when you're ready for cross-device sync.
// ---------------------------------------------------------------
if (typeof window !== "undefined" && !window.storage) {
  const PREFIX = "niagara_estimator:";
  window.storage = {
    async get(key) {
      const raw = localStorage.getItem(PREFIX + key);
      if (raw === null) throw new Error("Key not found: " + key);
      return { key, value: raw, shared: false };
    },
    async set(key, value) {
      localStorage.setItem(PREFIX + key, value);
      return { key, value, shared: false };
    },
    async delete(key) {
      localStorage.removeItem(PREFIX + key);
      return { key, deleted: true, shared: false };
    },
    async list(prefix) {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(PREFIX)) {
          const bare = k.slice(PREFIX.length);
          if (!prefix || bare.startsWith(prefix)) keys.push(bare);
        }
      }
      return { keys, prefix, shared: false };
    },
  };
}

import { useState, useMemo, useRef, useEffect } from "react";
import {
  ChefHat, Bath, Layers, Home, Hammer, Paintbrush,
  ChevronRight, ChevronLeft, AlertTriangle, Info, Sparkles, MapPin,
  MessageCircle, Send, Loader2, Keyboard, Lock, Download, CalendarDays, CheckCircle2,
  Search, Phone, Briefcase, MessageSquare, RefreshCw, Mic, Volume2, VolumeX, Settings, Save, RotateCcw, Trash2, Plus, Wrench, X, ShoppingCart, Fence, Sofa, Grid3x3, PanelsTopLeft, Droplets,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

/* ---------------------------------------------------------------
   REFERENCE DATA — mirrors the Master Price List / Room Templates /
   Question Flow workbook, condensed for the live calculator.
----------------------------------------------------------------*/

const MUNICIPALITIES = [
  { id: "stcatharines", label: "St. Catharines", mult: 1.0 },
  { id: "niagarafalls", label: "Niagara Falls", mult: 1.0 },
  { id: "welland", label: "Welland", mult: 1.07 },
  { id: "notl", label: "Niagara-on-the-Lake", mult: 1.28 },
  { id: "fortErie", label: "Fort Erie", mult: 1.07 },
  { id: "portColborne", label: "Port Colborne", mult: 1.05 },
  { id: "grimsby", label: "Grimsby", mult: 1.08 },
];

const ROOM_ILLUSTRATIONS = {
  kitchen: (
    <svg viewBox="0 0 140 140" fill="none">
      <rect x="14" y="70" width="112" height="34" rx="2" stroke="white" strokeWidth="2" />
      <line x1="14" y1="86" x2="126" y2="86" stroke="white" strokeWidth="1.5" />
      <line x1="46" y1="70" x2="46" y2="104" stroke="white" strokeWidth="1.5" />
      <line x1="78" y1="70" x2="78" y2="104" stroke="white" strokeWidth="1.5" />
      <line x1="110" y1="70" x2="110" y2="104" stroke="white" strokeWidth="1.5" />
      <rect x="14" y="52" width="112" height="14" rx="1.5" stroke="white" strokeWidth="2" />
      <circle cx="34" cy="59" r="4" stroke="white" strokeWidth="1.5" />
      <circle cx="50" cy="59" r="4" stroke="white" strokeWidth="1.5" />
      <rect x="88" y="30" width="26" height="22" rx="2" stroke="white" strokeWidth="2" />
      <line x1="88" y1="41" x2="114" y2="41" stroke="white" strokeWidth="1.5" />
    </svg>
  ),
  bathroom: (
    <svg viewBox="0 0 140 140" fill="none">
      <rect x="16" y="62" width="52" height="34" rx="16" stroke="white" strokeWidth="2" />
      <line x1="16" y1="74" x2="68" y2="74" stroke="white" strokeWidth="1.5" />
      <rect x="86" y="40" width="30" height="56" rx="3" stroke="white" strokeWidth="2" />
      <line x1="101" y1="40" x2="101" y2="30" stroke="white" strokeWidth="2" />
      <circle cx="101" cy="26" r="4" stroke="white" strokeWidth="2" />
      <rect x="24" y="100" width="90" height="8" rx="2" stroke="white" strokeWidth="1.5" />
    </svg>
  ),
  basement: (
    <svg viewBox="0 0 140 140" fill="none">
      <path d="M20 100 L40 84 L60 100 L80 84 L100 100 L120 84" stroke="white" strokeWidth="2" strokeLinejoin="round" />
      <rect x="20" y="30" width="100" height="54" rx="2" stroke="white" strokeWidth="2" />
      <line x1="20" y1="57" x2="120" y2="57" stroke="white" strokeWidth="1.2" strokeDasharray="4 3" />
      <line x1="60" y1="30" x2="60" y2="84" stroke="white" strokeWidth="1.2" strokeDasharray="4 3" />
    </svg>
  ),
  fullhome: (
    <svg viewBox="0 0 140 140" fill="none">
      <path d="M24 68 L70 32 L116 68" stroke="white" strokeWidth="2" strokeLinejoin="round" />
      <rect x="34" y="68" width="72" height="42" stroke="white" strokeWidth="2" />
      <line x1="70" y1="68" x2="70" y2="110" stroke="white" strokeWidth="1.2" strokeDasharray="4 3" />
      <rect x="44" y="82" width="16" height="16" stroke="white" strokeWidth="1.5" />
      <rect x="80" y="82" width="16" height="16" stroke="white" strokeWidth="1.5" />
    </svg>
  ),
  roof: (
    <svg viewBox="0 0 140 140" fill="none">
      <path d="M18 74 L70 32 L122 74" stroke="white" strokeWidth="2" strokeLinejoin="round" />
      <line x1="30" y1="65" x2="110" y2="65" stroke="white" strokeWidth="1.2" />
      <line x1="38" y1="58" x2="102" y2="58" stroke="white" strokeWidth="1.2" />
      <line x1="46" y1="51" x2="94" y2="51" stroke="white" strokeWidth="1.2" />
      <rect x="24" y="74" width="92" height="30" stroke="white" strokeWidth="2" />
    </svg>
  ),
  paint: (
    <svg viewBox="0 0 140 140" fill="none">
      <rect x="30" y="28" width="46" height="24" rx="2" stroke="white" strokeWidth="2" />
      <rect x="42" y="52" width="22" height="14" stroke="white" strokeWidth="2" />
      <line x1="53" y1="66" x2="53" y2="82" stroke="white" strokeWidth="2" />
      <path d="M40 82 Q53 100 66 82 Z" stroke="white" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="95" cy="95" r="3" stroke="white" strokeWidth="1.5" />
      <circle cx="105" cy="105" r="2" stroke="white" strokeWidth="1.5" />
    </svg>
  ),
  fence: (
    <svg viewBox="0 0 140 140" fill="none">
      <line x1="20" y1="50" x2="20" y2="104" stroke="white" strokeWidth="2" />
      <line x1="44" y1="42" x2="44" y2="104" stroke="white" strokeWidth="2" />
      <line x1="68" y1="50" x2="68" y2="104" stroke="white" strokeWidth="2" />
      <line x1="92" y1="42" x2="92" y2="104" stroke="white" strokeWidth="2" />
      <line x1="116" y1="50" x2="116" y2="104" stroke="white" strokeWidth="2" />
      <line x1="16" y1="66" x2="120" y2="66" stroke="white" strokeWidth="2" />
      <line x1="16" y1="86" x2="120" y2="86" stroke="white" strokeWidth="2" />
    </svg>
  ),
  deck: (
    <svg viewBox="0 0 140 140" fill="none">
      <line x1="18" y1="60" x2="122" y2="60" stroke="white" strokeWidth="2" />
      <line x1="18" y1="72" x2="122" y2="72" stroke="white" strokeWidth="2" />
      <line x1="18" y1="84" x2="122" y2="84" stroke="white" strokeWidth="2" />
      <line x1="18" y1="96" x2="122" y2="96" stroke="white" strokeWidth="2" />
      <line x1="24" y1="40" x2="24" y2="60" stroke="white" strokeWidth="2" />
      <line x1="24" y1="40" x2="116" y2="40" stroke="white" strokeWidth="2" />
      <line x1="46" y1="40" x2="46" y2="60" stroke="white" strokeWidth="1.5" />
      <line x1="68" y1="40" x2="68" y2="60" stroke="white" strokeWidth="1.5" />
      <line x1="90" y1="40" x2="90" y2="60" stroke="white" strokeWidth="1.5" />
      <line x1="116" y1="40" x2="116" y2="60" stroke="white" strokeWidth="2" />
    </svg>
  ),
  interlocking: (
    <svg viewBox="0 0 140 140" fill="none">
      {[0, 1, 2, 3].map((row) =>
        [0, 1, 2, 3].map((col) => (
          <rect
            key={`${row}-${col}`}
            x={20 + col * 24 + (row % 2 === 1 ? 12 : 0)}
            y={30 + row * 20}
            width="22"
            height="18"
            stroke="white"
            strokeWidth="1.2"
          />
        ))
      )}
    </svg>
  ),
  glass: (
    <svg viewBox="0 0 140 140" fill="none">
      <rect x="34" y="26" width="72" height="88" rx="2" stroke="white" strokeWidth="2" />
      <line x1="34" y1="46" x2="106" y2="46" stroke="white" strokeWidth="1" strokeDasharray="3 3" />
      <line x1="34" y1="94" x2="106" y2="94" stroke="white" strokeWidth="1" strokeDasharray="3 3" />
      <circle cx="98" cy="70" r="2.5" stroke="white" strokeWidth="1.5" />
    </svg>
  ),
  flood: (
    <svg viewBox="0 0 140 140" fill="none">
      <path d="M24 62 L70 26 L116 62" stroke="white" strokeWidth="2" strokeLinejoin="round" />
      <rect x="34" y="62" width="72" height="30" stroke="white" strokeWidth="2" />
      <path d="M18 96 Q28 90 38 96 T58 96 T78 96 T98 96 T118 96" stroke="white" strokeWidth="2" />
      <path d="M18 108 Q28 102 38 108 T58 108 T78 108 T98 108 T118 108" stroke="white" strokeWidth="1.5" opacity="0.7" />
    </svg>
  ),
};

const ROOM_TYPES = [
  { id: "kitchen", label: "Kitchen", icon: ChefHat, blurb: "Cabinets, counters, layout changes", accent: ["#F97316", "#C2410C"] },
  { id: "bathroom", label: "Bathroom", icon: Bath, blurb: "Full gut or surface refresh", accent: ["#0EA5E9", "#0369A1"] },
  { id: "basement", label: "Basement", icon: Layers, blurb: "Finishing an unfinished space", accent: ["#64748B", "#334155"] },
  { id: "flood", label: "Flood Restoration", icon: Droplets, blurb: "Restore the space after demo & cleanup", accent: ["#2563EB", "#1E3A8A"] },
  { id: "paint", label: "Paint refresh", icon: Paintbrush, blurb: "Walls and ceilings only", accent: ["#A855F7", "#6B21A8"] },
  { id: "glass", label: "Glass", icon: PanelsTopLeft, blurb: "Shower glass, railings, custom glass work", accent: ["#06B6D4", "#0E7490"] },
  { id: "roof", label: "Roof / exterior", icon: Hammer, blurb: "Shingles, siding, decking", accent: ["#78350F", "#451A03"] },
  { id: "fence", label: "Fence", icon: Fence, blurb: "Linear footage, height, gates", accent: ["#65A30D", "#3F6212"] },
  { id: "deck", label: "Deck", icon: Sofa, blurb: "PT or composite, with railing", accent: ["#CA8A04", "#854D0E"] },
  { id: "interlocking", label: "Interlocking", icon: Grid3x3, blurb: "Paver patios and walkways", accent: ["#57534E", "#292524"] },
];

/* Per-room question sets — drawn straight from the Question Flow tab */
const QUESTIONS = {
  kitchen: [
    { id: "sqft", label: "What's the approximate kitchen size?", type: "number", unit: "sq ft", min: 60, max: 400, step: 5, default: 150 },
    { id: "layout", label: "Keeping the current layout, or moving plumbing/electrical (sink, stove, fridge)?", type: "select", options: ["Keep layout", "Moving plumbing/electrical"] },
    { id: "drywallNeeded", label: "Does the kitchen need new drywall?", type: "select", options: ["Yes", "No"] },
    { id: "cabinetType", label: "Stock/ready-made cabinets, or custom-made?", type: "select", options: ["Stock/ready-made", "Custom-made"] },
    { id: "cabinetCount", label: "How many cabinets?", type: "number", unit: "cabinets", min: 1, max: 30, step: 1, default: 12, visibleIf: (a) => a.cabinetType !== "Custom-made" },
    { id: "cabinetRunLength", label: "Total cabinet run length (for backsplash/countertop sizing)?", type: "number", unit: "linear ft", min: 4, max: 40, step: 1, default: 16 },
    { id: "needsCountertop", label: "Do you need a countertop?", type: "select", options: ["Yes", "No"] },
    { id: "backsplash", label: "Adding a tile backsplash?", type: "select", options: ["Yes", "No"] },
    { id: "flooring", label: "Flooring — keep existing, or replace?", type: "select", options: ["Keep existing", "Tile", "LVP", "Hardwood"] },
    {
      id: "oldFloorRemoval",
      label: "Is there existing floor tile that needs to come out first?",
      type: "select",
      options: ["Yes", "No"],
      visibleIf: (a) => a.flooring && a.flooring !== "Keep existing",
    },
    { id: "sinkReplace", label: "Replacing the kitchen sink?", type: "select", options: ["Yes", "No"] },
    { id: "dishwasherInstall", label: "Installing or replacing a dishwasher?", type: "select", options: ["Yes", "No"] },
    { id: "electricalPoints", label: "How many new or relocated outlets and light points?", type: "number", unit: "points", min: 0, max: 20, step: 1, default: 6 },
    { id: "repaint", label: "Repaint walls and ceiling?", type: "select", options: ["Yes", "No"] },
  ],
  bathroom: [
    { id: "length", label: "Bathroom length?", type: "number", unit: "ft", min: 4, max: 16, step: 1, default: 9 },
    { id: "width", label: "Bathroom width?", type: "number", unit: "ft", min: 4, max: 14, step: 1, default: 7 },
    { id: "scope", label: "Full gut renovation, or a surface-level refresh?", type: "select", options: ["Full renovation", "Surface refresh"] },
    { id: "framingNeeded", label: "Any new stud walls needed (e.g. moving a layout wall)?", type: "select", options: ["Yes", "No"], visibleIf: (a) => a.scope === "Full renovation" },
    { id: "wallFramingLength", label: "Roughly how much new wall, in linear feet?", type: "number", unit: "linear ft", min: 2, max: 30, step: 1, default: 8, visibleIf: (a) => a.framingNeeded === "Yes" },
    { id: "tubShower", label: "Tub, shower, or both?", type: "select", options: ["Tub", "Shower", "Both"] },
    {
      id: "showerBaseType",
      label: "Shower base — custom tiled/concrete, or a prefab acrylic stall?",
      type: "select",
      options: ["Custom tiled/concrete base", "Prefab acrylic stall"],
      visibleIf: (a) => a.tubShower === "Shower" || a.tubShower === "Both",
    },
    {
      id: "tileCoverage",
      label: "Tile just the shower area, or more of the bathroom walls?",
      type: "select",
      options: ["Just the shower area", "More of the bathroom (full room perimeter, floor to ceiling)"],
      visibleIf: (a) => (a.tubShower === "Shower" || a.tubShower === "Both") && a.showerBaseType === "Custom tiled/concrete base",
    },
    {
      id: "tileType",
      label: "Standard tile, or mosaic?",
      type: "select",
      options: ["Standard tile", "Mosaic tile"],
      visibleIf: (a) => (a.tubShower === "Shower" || a.tubShower === "Both") && a.showerBaseType === "Custom tiled/concrete base",
    },
    {
      id: "glassDoor",
      label: "Adding a glass shower door or enclosure?",
      type: "select",
      options: ["Yes", "No"],
      visibleIf: (a) => a.tubShower === "Shower" || a.tubShower === "Both",
    },
    {
      id: "extraDrywallNeeded",
      label: "Does drywall need replacing anywhere else in the bathroom, beyond the shower/tub area?",
      type: "select",
      options: ["Yes", "No"],
      visibleIf: (a) => a.scope === "Full renovation",
    },
    {
      id: "extraDrywallSheets",
      label: "Roughly how many sheets (4×8 ft)?",
      type: "number",
      unit: "sheets",
      min: 1,
      max: 20,
      step: 1,
      default: 2,
      visibleIf: (a) => a.scope === "Full renovation" && a.extraDrywallNeeded === "Yes",
    },
    { id: "electricalPoints", label: "How many outlets or switches need to move or get added?", type: "number", unit: "points", min: 0, max: 10, step: 1, default: 1 },
    { id: "sewerRelocation", label: "Does the sewer/drain need relocating (e.g. moving the toilet location)?", type: "select", options: ["Yes", "No"] },
    { id: "potLights", label: "How many pot lights are you adding?", type: "number", unit: "lights", min: 0, max: 10, step: 1, default: 1 },
    { id: "exhaustFan", label: "Exhaust fan — replace an existing one, install new where none exists, or skip?", type: "select", options: ["Replace existing", "New install (no existing duct)", "Skip"] },
    { id: "vanityReplace", label: "Vanity work — keep the existing one, or a full replacement?", type: "select", options: ["No vanity work", "Keep existing vanity", "Vanity replacement"] },
    {
      id: "vanityPlumbing",
      label: "While at it, also replace the shut-offs and supply lines?",
      type: "select",
      options: ["Yes", "No"],
      visibleIf: (a) => a.vanityReplace === "Keep existing vanity" || a.vanityReplace === "Vanity replacement",
    },
    { id: "floorTileReplace", label: "Replacing the floor?", type: "select", options: ["Yes", "No"] },
    { id: "floorMaterial", label: "Floor material — tile, or vinyl (LVP)?", type: "select", options: ["Tile", "Vinyl (LVP)"], visibleIf: (a) => a.floorTileReplace === "Yes" },
    {
      id: "oldTileRemoval",
      label: "Is there existing tile that needs to come out first?",
      type: "select",
      options: ["Yes", "No"],
      visibleIf: (a) => a.scope !== "Full renovation",
    },
    { id: "ceilingWork", label: "Ceiling — paint only, replace the drywall, or tile it?", type: "select", options: ["Paint only", "Replace drywall", "Tile"] },
    { id: "accessories", label: "New towel bars, robe hooks, TP holder, and a mirror?", type: "select", options: ["Yes", "No"] },
    { id: "heatedFloor", label: "Interested in heated floor?", type: "select", options: ["Yes", "No"] },
    { id: "doorWindowTrimReplace", label: "Also replacing door and window trim (not just baseboard)?", type: "select", options: ["Yes", "No — baseboard only"] },
  ],
  basement: [
    { id: "length", label: "Basement length?", type: "number", unit: "ft", min: 10, max: 60, step: 1, default: 30 },
    { id: "width", label: "Basement width?", type: "number", unit: "ft", min: 10, max: 50, step: 1, default: 20 },
    { id: "demoNeeded", label: "Does anything old need to be removed first?", type: "select", options: ["Yes", "No"] },
    { id: "bedroomCount", label: "How many bedrooms are you adding?", type: "number", unit: "bedrooms", min: 0, max: 4, step: 1, default: 1 },
    { id: "hasLaundry", label: "Adding a new laundry drain/vent down there?", type: "select", options: ["Yes", "No"] },
    { id: "hasBathroom", label: "Adding a bathroom down there?", type: "select", options: ["Yes", "No"] },
    { id: "bathLength", label: "Basement bathroom — length?", type: "number", unit: "ft", min: 4, max: 12, step: 1, default: 5, visibleIf: (a) => a.hasBathroom === "Yes" },
    { id: "bathWidth", label: "Basement bathroom — width?", type: "number", unit: "ft", min: 4, max: 12, step: 1, default: 8, visibleIf: (a) => a.hasBathroom === "Yes" },
    { id: "wallDrywallThickness", label: "Wall drywall — 1/2\" (standard) or 5/8\" (fire-rated)?", type: "select", options: ["1/2\" (standard, cheaper)", "5/8\" (fire-rated)"] },
    { id: "ceilingFireRated", label: "Does the ceiling need the fire-rated assembly (rockwool, resilient channel, 5/8\" drywall)?", type: "select", options: ["Yes", "No"] },
    {
      id: "fireRatedWallNeeded",
      label: "Does a fire-rated wall need to be built (e.g. separating a mechanical room)?",
      type: "select",
      options: ["Yes", "No"],
    },
    {
      id: "fireRatedWallLength",
      label: "How many linear feet of fire-rated wall?",
      type: "number",
      unit: "linear ft",
      min: 2,
      max: 60,
      step: 1,
      default: 12,
      visibleIf: (a) => a.fireRatedWallNeeded === "Yes",
    },
    { id: "waterSigns", label: "Any signs of water — dampness, efflorescence, past flooding?", type: "select", options: ["Yes", "No"] },
    { id: "flooring", label: "Flooring choice for a below-grade space?", type: "select", options: ["Vinyl (LVP)", "Laminate", "Tile", "Epoxy"] },
    { id: "doorCount", label: "How many interior doors?", type: "number", unit: "doors", min: 0, max: 10, step: 1, default: 3 },
    { id: "slidingClosetDoors", label: "How many sliding closet doors?", type: "number", unit: "doors", min: 0, max: 6, step: 1, default: 0 },
    { id: "foundationCracks", label: "How many foundation cracks need repair?", type: "number", unit: "cracks", min: 0, max: 10, step: 1, default: 0 },
    { id: "legalBedroom", label: "Do you want a legal bedroom down there? (needs an egress window)", type: "select", options: ["Yes", "No"] },
    { id: "secondaryUnit", label: "Turning this into a separate legal unit (needs water/utility separation)?", type: "select", options: ["Yes", "No"] },
    { id: "separateEntrance", label: "Need a separate entrance?", type: "select", options: ["Yes", "No"] },
    { id: "relocationNeeded", label: "Does anything need relocating (stairs, ductwork, panel)?", type: "select", options: ["Yes", "No"] },
  ],
  fullhome: [
    { id: "sqft", label: "Total square footage being renovated?", type: "number", unit: "sq ft", min: 400, max: 5000, step: 50, default: 1800 },
    { id: "wallsChanged", label: "Are any interior walls being removed or added?", type: "select", options: ["Yes", "No"] },
    { id: "panel", label: "Is the electrical panel original, or already upgraded?", type: "select", options: ["Original", "Upgraded"] },
    { id: "roofAge", label: "Roof age, if known?", type: "select", options: ["Under 15 years", "15–20 years", "20+ years / unknown"] },
  ],
  roof: [
    { id: "sqft", label: "Roof size in square feet?", type: "number", unit: "sq ft", min: 500, max: 4000, step: 50, default: 1800 },
    { id: "layers", label: "How many layers of existing shingles need tear-off?", type: "select", options: ["1", "2+"] },
    { id: "softSpots", label: "Any known soft spots or leaks in the decking?", type: "select", options: ["Yes", "No"] },
  ],
  paint: [
    { id: "areaMethod", label: "Do you know the total square footage, or should we estimate room by room?", type: "select", options: ["I know the total square footage", "Estimate room by room"] },
    { id: "totalSqft", label: "Total square footage (all rooms combined)?", type: "number", unit: "sq ft", min: 50, max: 5000, step: 50, default: 500, visibleIf: (a) => a.areaMethod === "I know the total square footage" },
    { id: "roomCount", label: "How many separate rooms/spaces? (up to 8 — for more, use the total square footage option instead)", type: "number", unit: "rooms", min: 1, max: 8, step: 1, default: 1, visibleIf: (a) => a.areaMethod === "Estimate room by room" },
    { id: "room1Length", label: "Room 1 — length?", type: "number", unit: "ft", min: 3, max: 40, step: 1, default: 12, visibleIf: (a) => a.areaMethod === "Estimate room by room" },
    { id: "room1Width", label: "Room 1 — width?", type: "number", unit: "ft", min: 3, max: 40, step: 1, default: 10, visibleIf: (a) => a.areaMethod === "Estimate room by room" },
    { id: "room2Length", label: "Room 2 — length?", type: "number", unit: "ft", min: 3, max: 40, step: 1, default: 12, visibleIf: (a) => a.areaMethod === "Estimate room by room" && (a.roomCount ?? 1) >= 2 },
    { id: "room2Width", label: "Room 2 — width?", type: "number", unit: "ft", min: 3, max: 40, step: 1, default: 10, visibleIf: (a) => a.areaMethod === "Estimate room by room" && (a.roomCount ?? 1) >= 2 },
    { id: "room3Length", label: "Room 3 — length?", type: "number", unit: "ft", min: 3, max: 40, step: 1, default: 12, visibleIf: (a) => a.areaMethod === "Estimate room by room" && (a.roomCount ?? 1) >= 3 },
    { id: "room3Width", label: "Room 3 — width?", type: "number", unit: "ft", min: 3, max: 40, step: 1, default: 10, visibleIf: (a) => a.areaMethod === "Estimate room by room" && (a.roomCount ?? 1) >= 3 },
    { id: "room4Length", label: "Room 4 — length?", type: "number", unit: "ft", min: 3, max: 40, step: 1, default: 12, visibleIf: (a) => a.areaMethod === "Estimate room by room" && (a.roomCount ?? 1) >= 4 },
    { id: "room4Width", label: "Room 4 — width?", type: "number", unit: "ft", min: 3, max: 40, step: 1, default: 10, visibleIf: (a) => a.areaMethod === "Estimate room by room" && (a.roomCount ?? 1) >= 4 },
    { id: "room5Length", label: "Room 5 — length?", type: "number", unit: "ft", min: 3, max: 40, step: 1, default: 12, visibleIf: (a) => a.areaMethod === "Estimate room by room" && (a.roomCount ?? 1) >= 5 },
    { id: "room5Width", label: "Room 5 — width?", type: "number", unit: "ft", min: 3, max: 40, step: 1, default: 10, visibleIf: (a) => a.areaMethod === "Estimate room by room" && (a.roomCount ?? 1) >= 5 },
    { id: "room6Length", label: "Room 6 — length?", type: "number", unit: "ft", min: 3, max: 40, step: 1, default: 12, visibleIf: (a) => a.areaMethod === "Estimate room by room" && (a.roomCount ?? 1) >= 6 },
    { id: "room6Width", label: "Room 6 — width?", type: "number", unit: "ft", min: 3, max: 40, step: 1, default: 10, visibleIf: (a) => a.areaMethod === "Estimate room by room" && (a.roomCount ?? 1) >= 6 },
    { id: "room7Length", label: "Room 7 — length?", type: "number", unit: "ft", min: 3, max: 40, step: 1, default: 12, visibleIf: (a) => a.areaMethod === "Estimate room by room" && (a.roomCount ?? 1) >= 7 },
    { id: "room7Width", label: "Room 7 — width?", type: "number", unit: "ft", min: 3, max: 40, step: 1, default: 10, visibleIf: (a) => a.areaMethod === "Estimate room by room" && (a.roomCount ?? 1) >= 7 },
    { id: "room8Length", label: "Room 8 — length?", type: "number", unit: "ft", min: 3, max: 40, step: 1, default: 12, visibleIf: (a) => a.areaMethod === "Estimate room by room" && (a.roomCount ?? 1) >= 8 },
    { id: "room8Width", label: "Room 8 — width?", type: "number", unit: "ft", min: 3, max: 40, step: 1, default: 10, visibleIf: (a) => a.areaMethod === "Estimate room by room" && (a.roomCount ?? 1) >= 8 },
    { id: "wallCondition", label: "New drywall (ready to paint), or existing painted walls?", type: "select", options: ["New drywall", "Existing painted walls"] },
    { id: "ceilingHeight", label: "Ceiling height?", type: "select", options: ["Standard (8 ft)", "Tall (9–10 ft)", "Vaulted / 10 ft+"] },
    { id: "sameColor", label: "Same colour on walls and ceiling, or different?", type: "select", options: ["Same colour", "Different colours"] },
    { id: "doors", label: "How many doors need painting?", type: "number", unit: "doors", min: 0, max: 20, step: 1, default: 3 },
    { id: "doorTrimChoice", label: "With the trim/casing, or just the door slab?", type: "select", options: ["With trim/casing", "Just the door slab"], visibleIf: (a) => (a.doors ?? 0) > 0 },
    { id: "windows", label: "How many windows need trim painted?", type: "number", unit: "windows", min: 0, max: 20, step: 1, default: 4 },
    { id: "patches", label: "How many drywall patches or repairs are needed before painting?", type: "select", options: ["None", "A few small ones", "Several / larger repairs"] },
  ],
  fence: [
    { id: "length", label: "How many linear feet of fence?", type: "number", unit: "linear ft", min: 10, max: 500, step: 5, default: 100 },
    { id: "height", label: "Fence height?", type: "select", options: ["6 ft (standard)", "8 ft (tall)"] },
    { id: "gateCount", label: "How many gates?", type: "number", unit: "gates", min: 0, max: 5, step: 1, default: 0 },
  ],
  deck: [
    { id: "sqft", label: "Deck size?", type: "number", unit: "sq ft", min: 50, max: 1000, step: 10, default: 200 },
    { id: "material", label: "Decking material?", type: "select", options: ["Pressure-treated", "Composite"] },
    { id: "railingLength", label: "How many linear feet of railing?", type: "number", unit: "linear ft", min: 0, max: 200, step: 5, default: 40 },
    { id: "railingMaterial", label: "Railing material?", type: "select", options: ["Wood", "Aluminum"], visibleIf: (a) => (a.railingLength ?? 0) > 0 },
  ],
  interlocking: [
    { id: "sqft", label: "How many square feet?", type: "number", unit: "sq ft", min: 50, max: 2000, step: 10, default: 300 },
    { id: "shapeType", label: "Regular/even shape, or irregular (lots of cuts)?", type: "select", options: ["Regular/even shape", "Irregular (lots of cuts)"] },
    { id: "excavationNeeded", label: "Is the base already prepared, or does it need excavation?", type: "select", options: ["Base already prepared", "Need to excavate"] },
    {
      id: "diggingMethod",
      label: "Digging by hand, or does it need an excavator?",
      type: "select",
      options: ["By hand", "Need an excavator"],
      visibleIf: (a) => a.excavationNeeded === "Need to excavate",
    },
    { id: "tileSource", label: "Use our standard paver, or are you supplying your own?", type: "select", options: ["Use standard paver (included)", "I'll supply my own paver"] },
  ],
  glass: [
    { id: "glassConfig", label: "Custom-cut glass, or a standard prefab kit (32×32, 36×36, slider up to 48in)?", type: "select", options: ["Custom-cut glass", "Standard prefab kit"] },
    {
      id: "glassApplication",
      label: "What's this glass for?",
      type: "select",
      options: ["Shower door/panel", "Fixed panel", "Glass wall"],
      visibleIf: (a) => a.glassConfig === "Custom-cut glass",
    },
    { id: "widthInches", label: "Glass width?", type: "number", unit: "inches", min: 20, max: 144, step: 1, default: 70 },
    { id: "heightInches", label: "Glass height?", type: "number", unit: "inches", min: 40, max: 100, step: 1, default: 74 },
    { id: "installComplexity", label: "Installation — standard, or a simpler construction?", type: "select", options: ["Standard", "Simple construction"] },
    { id: "doorType", label: "Door type?", type: "select", options: ["Hinged door", "Sliding door", "Fixed panel only (no door)"] },
    { id: "glassType", label: "Glass finish?", type: "select", options: ["Clear tempered", "Frosted / textured", "Low-iron (ultra-clear)"] },
  ],
  flood: [
    { id: "floodScope", label: "Does the basement need demolition, or is demo already done and it's restoration only?", type: "select", options: ["Needs demolition", "Demo already done — restoration only"] },
    {
      id: "demoExtent",
      label: "Full demo, or just a partial cleanup (some debris/nails, nothing already stripped)?",
      type: "select",
      options: ["Full demo", "Partial cleanup only"],
      visibleIf: (a) => a.floodScope === "Needs demolition",
    },
    { id: "roomCount", label: "How many rooms/spaces were flooded? (up to 5)", type: "number", unit: "rooms", min: 1, max: 5, step: 1, default: 1 },
    { id: "room1Length", label: "Room 1 — length?", type: "number", unit: "ft", min: 3, max: 40, step: 1, default: 20 },
    { id: "room1Width", label: "Room 1 — width?", type: "number", unit: "ft", min: 3, max: 40, step: 1, default: 20 },
    { id: "room2Length", label: "Room 2 — length?", type: "number", unit: "ft", min: 3, max: 40, step: 1, default: 12, visibleIf: (a) => (a.roomCount ?? 1) >= 2 },
    { id: "room2Width", label: "Room 2 — width?", type: "number", unit: "ft", min: 3, max: 40, step: 1, default: 10, visibleIf: (a) => (a.roomCount ?? 1) >= 2 },
    { id: "room3Length", label: "Room 3 — length?", type: "number", unit: "ft", min: 3, max: 40, step: 1, default: 12, visibleIf: (a) => (a.roomCount ?? 1) >= 3 },
    { id: "room3Width", label: "Room 3 — width?", type: "number", unit: "ft", min: 3, max: 40, step: 1, default: 10, visibleIf: (a) => (a.roomCount ?? 1) >= 3 },
    { id: "room4Length", label: "Room 4 — length?", type: "number", unit: "ft", min: 3, max: 40, step: 1, default: 12, visibleIf: (a) => (a.roomCount ?? 1) >= 4 },
    { id: "room4Width", label: "Room 4 — width?", type: "number", unit: "ft", min: 3, max: 40, step: 1, default: 10, visibleIf: (a) => (a.roomCount ?? 1) >= 4 },
    { id: "room5Length", label: "Room 5 — length?", type: "number", unit: "ft", min: 3, max: 40, step: 1, default: 12, visibleIf: (a) => (a.roomCount ?? 1) >= 5 },
    { id: "room5Width", label: "Room 5 — width?", type: "number", unit: "ft", min: 3, max: 40, step: 1, default: 10, visibleIf: (a) => (a.roomCount ?? 1) >= 5 },
    { id: "drywallCutHeight", label: "How high up the walls does drywall need cutting? (industry minimum is 2 ft)", type: "number", unit: "ft", min: 2, max: 8, step: 0.5, default: 2 },
    { id: "moldVisible", label: "Any visible mold already?", type: "select", options: ["Yes", "No"] },
    { id: "doorsAffected", label: "How many doors need removing (with trim/casing)?", type: "number", unit: "doors", min: 0, max: 10, step: 1, default: 0, visibleIf: (a) => a.floodScope !== "Demo already done — restoration only" },
    { id: "doorsToInstall", label: "How many new doors need installing (rebuild)?", type: "number", unit: "doors", min: 0, max: 10, step: 1, default: 0 },
    { id: "electricalOutlets", label: "How many outlets need replacing (old to new, same location)?", type: "number", unit: "outlets", min: 0, max: 30, step: 1, default: 0 },
    { id: "floodFlooringNeeded", label: "Does the floor need new flooring installed (as part of the rebuild)?", type: "select", options: ["Yes — vinyl (LVP)", "No — not part of this scope"] },
    { id: "foundationCracksFlood", label: "How many foundation cracks need repair?", type: "number", unit: "cracks", min: 0, max: 10, step: 1, default: 0 },
    { id: "floodHasBathroom", label: "Is there a bathroom that also needs work?", type: "select", options: ["Yes", "No"] },
    { id: "floodBathLength", label: "Bathroom — length?", type: "number", unit: "ft", min: 4, max: 12, step: 1, default: 5, visibleIf: (a) => a.floodHasBathroom === "Yes" },
    { id: "floodBathWidth", label: "Bathroom — width?", type: "number", unit: "ft", min: 4, max: 12, step: 1, default: 8, visibleIf: (a) => a.floodHasBathroom === "Yes" },
    { id: "builtInFurnitureDamaged", label: "Any built-in furniture damaged (vanity, kitchen cabinets)?", type: "select", options: ["Yes", "No"] },
    {
      id: "furnitureCondition",
      label: "Salvageable (remove, repair, reinstall), or a total loss (haul away)?",
      type: "select",
      options: ["Repairable", "Total loss"],
      visibleIf: (a) => a.builtInFurnitureDamaged === "Yes",
    },
    {
      id: "cabinetCount",
      label: "How many cabinets/units need removing and repairing?",
      type: "number",
      unit: "cabinets",
      min: 1,
      max: 30,
      step: 1,
      default: 10,
      visibleIf: (a) => a.builtInFurnitureDamaged === "Yes" && a.furnitureCondition === "Repairable",
    },
  ],
};

/* ---------------------------------------------------------------
   PRICE ENGINE — every rate below lives in a per-room ARRAY (not a
   fixed object), specifically so "My Prices" can add or delete
   positions, not just edit values. If a position is deleted, that
   line item simply won't appear in future estimates. If a new
   position is added, it shows up as an extra flat-cost line on
   every estimate for that room type.
----------------------------------------------------------------*/
const CEILING_HEIGHT_FACTOR = { "Standard (8 ft)": 1, "Tall (9–10 ft)": 1.15, "Vaulted / 10 ft+": 1.35 };
const CEILING_HEIGHT_FEET = { "Standard (8 ft)": 8, "Tall (9–10 ft)": 9.5, "Vaulted / 10 ft+": 11 };

const RATE_META = {
  kitchen: [
    { key: "demoFlat", label: "Full demo + haul-away", unit: "$ flat", value: 950 },
    { key: "drywallPerSqft", label: "Drywall + taping, ready for paint", unit: "$/sq ft", value: 3.2 },
    { key: "cabinetInstallEach", label: "Cabinet assembly & install", unit: "$/cabinet", value: 115 },
    { key: "countertopPerSqft", label: "Countertop (install, all-in)", unit: "$/sq ft", value: 62.5 },
    { key: "backsplashPerSqft", label: "Backsplash tile (mosaic/glass)", unit: "$/sq ft", value: 16.5 },
    { key: "floorTilePerSqft", label: "Floor — tile (with underlayment)", unit: "$/sq ft", value: 11.5 },
    { key: "floorTileRemovalPerSqft", label: "Old floor tile removal", unit: "$/sq ft", value: 3.75 },
    { key: "floorLVPPerSqft", label: "Floor — LVP", unit: "$/sq ft", value: 7.2 },
    { key: "floorHardwoodPerSqft", label: "Floor — hardwood", unit: "$/sq ft", value: 13.2 },
    { key: "sinkHookupFlat", label: "New sink plumbing hookup", unit: "$ flat", value: 143 },
    { key: "faucetInstallFlat", label: "Faucet install", unit: "$ flat", value: 80 },
    { key: "dishwasherHookupFlat", label: "Dishwasher hookup (electric, water, drain)", unit: "$ flat", value: 285 },
    { key: "electricalPointEach", label: "Outlet/light point", unit: "$/each", value: 90 },
    { key: "plumbingRelocationFlat", label: "Plumbing relocation (moving sink/stove location)", unit: "$ flat", value: 450 },
    { key: "paintPerSqft", label: "Paint (walls + ceiling)", unit: "$/sq ft", value: 3.6 },
  ],
  bathroom: [
    { key: "demoFlat", label: "Full demo", unit: "$ flat", value: 650 },
    { key: "disposalFlat", label: "Disposal / haul-away", unit: "$ flat", value: 150 },
    { key: "potLight", label: "Pot light", unit: "$/each", value: 60 },
    { key: "electricalPoint", label: "Outlet/switch", unit: "$/each", value: 50 },
    { key: "tileStandardPerSqft", label: "Tile — standard", unit: "$/sq ft", value: 10 },
    { key: "tileMosaicPerSqft", label: "Tile — mosaic", unit: "$/sq ft", value: 15 },
    { key: "tileRemovalPerSqft", label: "Old tile removal — floor", unit: "$/sq ft", value: 3 },
    { key: "wallTileRemovalPerSqft", label: "Old tile removal — wall (labour $1.50 + disposal $0.50)", unit: "$/sq ft", value: 2 },
    { key: "waterproofingPerSqft", label: "Waterproofing membrane", unit: "$/sq ft", value: 1.5 },
    { key: "drywallWallPerSqft", label: "Moisture-resistant drywall + taping, ready for paint", unit: "$/sq ft", value: 4 },
    { key: "extraDrywallPerSheetFlat", label: "Extra drywall, rest of bathroom (per sheet, minimum charge)", unit: "$/sheet", value: 100 },
    { key: "skimCoatPerSqft", label: "Skim coat (surface refresh)", unit: "$/sq ft", value: 1.35 },
    { key: "ceilingDrywallPerSqft", label: "Ceiling drywall replace", unit: "$/sq ft", value: 4 },
    { key: "ceilingTilePerSqft", label: "Ceiling tile", unit: "$/sq ft", value: 15 },
    { key: "vanityKeepInstall", label: "Vanity — keep existing (reset/reinstall)", unit: "$ flat", value: 100 },
    { key: "vanityInstall", label: "Vanity — full replacement, install", unit: "$ flat", value: 150 },
    { key: "vanityFaucetKeepOldFlat", label: "Vanity faucet — keep existing (detach/reattach labour)", unit: "$ flat", value: 80 },
    { key: "vanityFaucetInstall", label: "Vanity faucet — install new", unit: "$ flat", value: 80 },
    { key: "vanitySupplyLines", label: "New shut-offs & supply lines (2 @ $55)", unit: "$ flat", value: 110 },
    { key: "sewerRelocationFlat", label: "Sewer/drain relocation (moving toilet or fixture drain location)", unit: "$ flat", value: 550 },
    { key: "prefabShowerStall", label: "Prefab shower stall", unit: "$ flat", value: 190 },
    { key: "toiletReinstall", label: "Toilet removal & reinstall", unit: "$ flat", value: 125 },
    { key: "framingPerLinFt", label: "New stud wall framing (frame)", unit: "$/linear ft", value: 25 },
    { key: "showerValveInstall", label: "Shower valve/trim kit — Installation", unit: "$ flat", value: 312 },
    { key: "showerTrimKitSupplyFlat", label: "Shower trim kit — Supply", unit: "$ flat", value: 250 },
    { key: "concreteShowerPan", label: "Custom shower pan + drain", unit: "$ flat", value: 325 },
    { key: "paintPerSqft", label: "Paint (walls + ceiling)", unit: "$/sq ft", value: 2 },
    { key: "drywallPatch", label: "Drywall patch/repair", unit: "$/patch", value: 50 },
    { key: "accessorySet", label: "Towel bars/hooks/TP holder & mirror install", unit: "$ flat", value: 70 },
    { key: "exhaustFan", label: "Exhaust fan replacement (existing duct)", unit: "$ flat", value: 230 },
    { key: "exhaustFanNewInstall", label: "Exhaust fan, new install (no existing duct, fan unit included)", unit: "$ flat", value: 320 },
    { key: "heatedFloorPerSqft", label: "Heated floor (optional)", unit: "$/sq ft", value: 12 },
    { key: "floorVinylPerSqft", label: "Floor — vinyl (LVP), labour only", unit: "$/sq ft", value: 2.5 },
    { key: "tubInstallFlat", label: "Bathtub install", unit: "$ flat", value: 855 },
    { key: "wetZoneDrywallFlat", label: "Moisture-resistant drywall + taping — shower/tub zone only (~3 sheets)", unit: "$ flat", value: 350 },
    { key: "paintFlatBathroom", label: "Walls + ceiling paint — flat rate for a typical bathroom", unit: "$ flat", value: 300 },
    { key: "baseboardReplaceFlat", label: "Baseboard, window moldings & door trim replacement, whole bathroom", unit: "$ flat", value: 230 },
    { key: "glassDoorInstallFlat", label: "Glass shower door/enclosure — install labour (glass supplied separately)", unit: "$ flat", value: 180 },
    { key: "showerFloorTilePerSqft", label: "Shower floor tile (custom base, ~18 sq ft)", unit: "$/sq ft", value: 12 },
    { key: "quartzThresholdFlat", label: "Quartz threshold/curb cap (custom base)", unit: "$ flat", value: 120 },
  ],
  basement: [
    { key: "demoPerSqft", label: "Demo / removal", unit: "$/sq ft", value: 5 },
    { key: "framingPerLinFt", label: "Interior wall framing (frame)", unit: "$/linear ft", value: 26 },
    { key: "bulkheadPerLinFt", label: "Bulkheads (ductwork/pipe boxing — framing + drywall)", unit: "$/linear ft", value: 25 },
    { key: "soffitBoxFramingPerLinFt", label: "Soffit / small box framing (frame only, no drywall)", unit: "$/linear ft", value: 25 },
    { key: "wallInsulationPerSqft", label: "Wall insulation (Tyvek + batt + install + poly/tape)", unit: "$/sq ft", value: 4.25 },
    { key: "rockwoolInsulationPerSqft", label: "Fire-rated (rockwool) insulation", unit: "$/sq ft", value: 2.92 },
    { key: "resilientChannelPerSqft", label: "Resilient channel (material + install)", unit: "$/sq ft", value: 2.5 },
    { key: "fireDrywallPerSqft", label: "5/8\" fire-rated drywall, board + screw only (no taping)", unit: "$/sq ft", value: 3.35 },
    { key: "dryTapingPerSqft", label: "Taping (separate from hanging the board — placeholder, confirm rate)", unit: "$/sq ft per side", value: 1 },
    { key: "fireRatedWallPerSqft", label: "Fire-rated wall sandwich (frame + rockwool + channel + board both sides, no taping)", unit: "$/sq ft", value: 15.87 },
    { key: "fireRatedDoorFlat", label: "Fire-rated door, self-closing/self-latching, turnkey", unit: "$/each", value: 880 },
    { key: "drywallWallsPerSqft", label: "Drywall + taping (walls), 5/8\", ready for paint", unit: "$/sq ft", value: 3.2 },
    { key: "drywallHalfInchPerSqft", label: "Drywall + taping (walls), 1/2\" standard, ready for paint", unit: "$/sq ft", value: 2.7 },
    { key: "standardCeilingDrywallPerSqft", label: "Ceiling drywall + taping, standard (not fire-rated)", unit: "$/sq ft", value: 3.2 },
    { key: "electricalBaseFlat", label: "Electrical — 1 bedroom (base package)", unit: "$ flat", value: 6500 },
    { key: "electricalSecondBedroomFlat", label: "Electrical — 2nd bedroom add-on (extra devices + 3-in-1 smoke/CO/strobe)", unit: "$ flat", value: 1000 },
    { key: "electricalExtraBedroomFlat", label: "Electrical — each bedroom after the 2nd", unit: "$ flat", value: 550 },
    { key: "plumbingRoughInFlat", label: "Plumbing rough-in — wet bar (search/add manually, not auto-included)", unit: "$ flat", value: 5225 },
    { key: "shutoffValveReplaceFlat", label: "Shut-off valve replacement", unit: "$/each", value: 45 },
    { key: "unitSeparationFlat", label: "Utility separation for a secondary unit", unit: "$ flat", value: 3000 },
    { key: "newPipeRunPerLinFt", label: "New pipe run (supply/drain) — market-average estimate", unit: "$/linear ft", value: 20 },
    { key: "mainShutoffReplaceFlat", label: "Main water shut-off replacement (client arranges city shut-off)", unit: "$ flat", value: 190 },
    { key: "pipeSectionRepairFlat", label: "Damaged pipe section repair", unit: "$/each", value: 80 },
    { key: "drainHookupFlat", label: "Drain hookup (short run to existing stub — sink/dishwasher/etc.)", unit: "$ flat", value: 175 },
    { key: "fullRoughInFlat", label: "Full plumbing rough-in (consult a plumber directly — highly variable)", unit: "$ flat", value: 3800 },
    { key: "backwaterValveStandaloneFlat", label: "Backwater valve, standalone (break concrete, install, re-pour)", unit: "$ flat", value: 1900 },
    { key: "sumpPumpStandaloneFlat", label: "Sump pump, standalone (dig pit, install)", unit: "$ flat", value: 1900 },
    { key: "foundationCrackRepairStandaloneFlat", label: "Foundation crack repair, standalone job (not part of a larger project)", unit: "$/crack", value: 425 },
    { key: "floorDrainSimpleFlat", label: "Floor drain — surface connection only", unit: "$ flat", value: 350 },
    { key: "concreteCutInFlat", label: "Concrete cut-in (break slab, connect, backfill, re-pour) — minimum", unit: "$ flat", value: 950 },
    { key: "handymanHourlyRate", label: "General handyman rate for undefined/misc small jobs", unit: "$/hour", value: 50 },
    { key: "furnaceReplaceFlat", label: "Furnace replacement (subcontracted — reference price)", unit: "$ flat", value: 4750 },
    { key: "ductSupplyBranchFlat", label: "Add a supply duct branch (ceiling open)", unit: "$/each", value: 180 },
    { key: "registerVentPlasticEach", label: "Register vent — cheap plastic", unit: "$/each", value: 10 },
    { key: "registerVentMetalEach", label: "Register vent — metal, cut in", unit: "$/each", value: 55 },
    { key: "returnAirEach", label: "Return air duct, each", unit: "$/each", value: 325 },
    { key: "fireRatedExhaustBoxEach", label: "Fire-rated exhaust box (dryer/range hood/bath fan penetration, appliance not included)", unit: "$/each", value: 265 },
    { key: "ductBootReplaceFlat", label: "Duct boot replacement", unit: "$ flat", value: 450 },
    { key: "laundryDrainVentFlat", label: "Laundry drain + vent (new)", unit: "$ flat", value: 2800 },
    { key: "fireSeparationCaulkingFlat", label: "Lined fire separation + caulking (small sealing task)", unit: "$ flat", value: 230 },
    { key: "exhaustWithDuctEach", label: "Exhaust vent install with new duct (kitchen/laundry/bath)", unit: "$/each", value: 440 },
    { key: "handrailInstallFlat", label: "New stair handrail", unit: "$ flat", value: 390 },
    { key: "closetShelvingFlat", label: "Closet shelving", unit: "$ flat", value: 320 },
    { key: "stairsFinishingFlat", label: "Stairs finishing (treads/risers)", unit: "$ flat", value: 650 },
    { key: "subfloorRepairPerSqft", label: "Subfloor repair/replace", unit: "$/sq ft", value: 18 },
    { key: "sprayFoamInsulationPerSqft", label: "Spray foam insulation", unit: "$/sq ft", value: 5 },
    { key: "waterHeaterReplaceFlat", label: "Water heater replacement", unit: "$ flat", value: 2375 },
    { key: "exteriorDoorInstallFlat", label: "Exterior door install, turnkey", unit: "$/each", value: 1100 },
    { key: "windowReplaceFlat", label: "Window replacement, turnkey", unit: "$/each", value: 975 },
    { key: "eavestroughPerLinFt", label: "Eavestrough / gutters", unit: "$/linear ft", value: 12 },
    { key: "vinylSidingPerSqft", label: "Vinyl siding", unit: "$/sq ft", value: 7.5 },
    { key: "centralACInstallFlat", label: "Central A/C install", unit: "$ flat", value: 5250 },
    { key: "panelUpgrade200AFlat", label: "Panel upgrade to 200A, standalone", unit: "$ flat", value: 3500 },
    { key: "smokeDetectorEach", label: "Smoke detector (market-rate estimate)", unit: "$/each", value: 100 },
    { key: "potLightEach", label: "Pot light, individually (with wiring)", unit: "$/each", value: 55 },
    { key: "switchAddEach", label: "Add a switch", unit: "$/each", value: 120 },
    { key: "outletAddEach", label: "Add an outlet", unit: "$/each", value: 80 },
    { key: "breakerInstallEach", label: "New breaker (varies by type) — minimum", unit: "$/each", value: 50 },
    { key: "wireRunPerLinFt", label: "Run new wire, longer runs (market-rate estimate, confirm)", unit: "$/linear ft", value: 4 },
    { key: "furnaceFireShutdownFlat", label: "Furnace fire shutdown valve/interlock", unit: "$ flat", value: 660 },
    { key: "egressWindowFlat", label: "Egress window, turnkey (starting price)", unit: "$ flat", value: 1550 },
    { key: "separateEntranceFlat", label: "Separate entrance, permit-compliant turnkey (door + railings + inspections)", unit: "$ flat", value: 14000 },
    { key: "doorInstallEach", label: "Interior door, turnkey (frame + casing + lockset, materials incl.)", unit: "$/each", value: 400 },
    { key: "doorFrameLabourOnlyEach", label: "Door + frame install, labour only (client supplies the door)", unit: "$/each", value: 220 },
    { key: "doorSlabCutInEach", label: "Door slab replacement, cut in for hinges/lock", unit: "$/each", value: 140 },
    { key: "doorSlabSimpleEach", label: "Door slab replacement, pre-machined swap", unit: "$/each", value: 80 },
    { key: "doorTrimPaintEach", label: "Door trim paint", unit: "$/each", value: 100 },
    { key: "slidingClosetDoorFlat", label: "Sliding closet door", unit: "$/each", value: 490 },
    { key: "baseboardPerLinFt", label: "Baseboard (materials incl.)", unit: "$/linear ft", value: 3.75 },
    { key: "paintPerSqft", label: "Paint (walls + ceiling)", unit: "$/sq ft", value: 2 },
    { key: "waterproofingPerLinFt", label: "Exterior waterproofing", unit: "$/linear ft", value: 180 },
    { key: "foundationCrackRepairFlat", label: "Foundation crack repair", unit: "$/crack", value: 375 },
    { key: "floorLVPPerSqft", label: "Floor — vinyl/laminate install (labour only)", unit: "$/sq ft", value: 2 },
    { key: "floorTileBasementPerSqft", label: "Floor — tile (concrete slab, no underlayment)", unit: "$/sq ft", value: 9 },
    { key: "floorEpoxyPerSqft", label: "Floor — epoxy coating", unit: "$/sq ft", value: 5 },
    { key: "floorLaminatePerSqft", label: "Floor — vinyl/laminate install (labour only)", unit: "$/sq ft", value: 2 },
  ],
  fullhome: [
    { key: "perSqft", label: "Full home renovation", unit: "$/sq ft", value: 108 },
    { key: "structuralWallAllowanceFlat", label: "Structural wall removal (open concept)", unit: "$ flat", value: 4500 },
    { key: "panelUpgradeFlat", label: "Panel upgrade (flat part)", unit: "$ flat", value: 2850 },
    { key: "rewirePerSqft", label: "Rewire allowance", unit: "$/sq ft", value: 7.2 },
  ],
  roof: [
    { key: "shinglePerSqft", label: "Shingle replacement", unit: "$/sq ft", value: 5.4 },
    { key: "extraTearOffPerSqft", label: "Extra tear-off (2+ layers)", unit: "$/sq ft", value: 1.2 },
    { key: "deckRepairPerSqft", label: "Roof deck repair", unit: "$/sq ft", value: 9.6 },
  ],
  paint: [
    { key: "wallPerSqft", label: "Wall paint", unit: "$/sq ft", value: 2.0 },
    { key: "ceilingPerSqft", label: "Ceiling paint", unit: "$/sq ft", value: 1.4 },
    { key: "secondColourPerSqft", label: "Cutting in second colour", unit: "$/sq ft", value: 0.42 },
    { key: "doorWithTrimEach", label: "Door + trim/casing paint", unit: "$/each", value: 140 },
    { key: "doorSlabOnlyEach", label: "Door slab only (no trim)", unit: "$/each", value: 80 },
    { key: "windowTrimEach", label: "Window trim paint", unit: "$/each", value: 70 },
    { key: "baseboardPerLinFt", label: "Baseboard/trim paint", unit: "$/linear ft", value: 2 },
    { key: "baseboardTrimInstallPerLinFt", label: "Baseboard/trim install (with caulking, ready to paint)", unit: "$/linear ft", value: 2 },
    { key: "paintPrepOldPerSqft", label: "Prep for painting over old paint (patch, clean, sand)", unit: "$/sq ft of room", value: 1 },
    { key: "patchFewFlat", label: "Drywall patches — a few small (~3 patches)", unit: "$ flat", value: 143 },
    { key: "patchSeveralFlat", label: "Drywall patches — several/larger (~8 patches)", unit: "$ flat", value: 380 },
  ],
  fence: [
    { key: "standardPerLinFt", label: "Standard fence (6 ft, standard posts)", unit: "$/linear ft", value: 57 },
    { key: "tallPerLinFt", label: "Tall fence (8 ft)", unit: "$/linear ft", value: 67 },
    { key: "gateEach", label: "Gate", unit: "$/each", value: 350 },
  ],
  deck: [
    { key: "ptPerSqft", label: "Deck build — pressure-treated (from scratch, incl. footings)", unit: "$/sq ft", value: 42 },
    { key: "compositePerSqft", label: "Deck build — composite (from scratch, incl. footings)", unit: "$/sq ft", value: 47 },
    { key: "railingWoodPerLinFt", label: "Railing — wood", unit: "$/linear ft", value: 22.5 },
    { key: "railingAluminumPerLinFt", label: "Railing — aluminum", unit: "$/linear ft", value: 57.5 },
  ],
  interlocking: [
    { key: "readyBasePerSqft", label: "Paver install — base already prepared (materials + laying incl.)", unit: "$/sq ft", value: 21 },
    { key: "excavatePerSqft", label: "Paver install — needs excavation (materials + laying incl.)", unit: "$/sq ft", value: 27 },
    { key: "irregularSurchargePct", label: "Irregular shape surcharge (extra cuts)", unit: "% surcharge", value: 18 },
    { key: "excavatorSurchargeFlat", label: "Excavator rental surcharge (placeholder — confirm)", unit: "$ flat", value: 380 },
    { key: "ownPaverDiscountPerSqft", label: "Discount if client supplies their own paver", unit: "$/sq ft", value: 5 },
  ],
  glass: [
    { key: "glassCustomPerSqft", label: "Custom glass panel (material)", unit: "$/sq ft", value: 20 },
    { key: "glassHardwareFlat", label: "Hardware (clips, hinges, handles, track)", unit: "$ flat", value: 180 },
    { key: "glassStandardKitFlat", label: "Standard prefab kit (glass + hardware, standard sizes)", unit: "$ flat", value: 500 },
    { key: "glassInstallStandardPerSqft", label: "Installation — standard", unit: "$/sq ft", value: 10 },
    { key: "glassInstallSimplePerSqft", label: "Installation — simple construction", unit: "$/sq ft", value: 7 },
    { key: "glassDeliveryFlat", label: "Delivery", unit: "$ flat", value: 150 },
  ],
  flood: [
    { key: "floodFloorDemoPerSqft", label: "Floor demo (vinyl removal)", unit: "$/sq ft", value: 1 },
    { key: "floodBaseboardDemoPerLinFt", label: "Baseboard demo/removal", unit: "$/linear ft", value: 1 },
    { key: "floodDrywallDemoPerSqft", label: "Drywall demo (cut at flood line, contaminated handling)", unit: "$/sq ft", value: 1.3 },
    { key: "antimicrobialTreatmentFlat", label: "Antimicrobial/sanitizing treatment", unit: "$ flat", value: 200 },
    { key: "moldRemediationPerSqft", label: "Mold remediation", unit: "$/sq ft", value: 20 },
    { key: "floodDrywallRebuildPerSqft", label: "New drywall + taping (rebuild the cut band)", unit: "$/sq ft", value: 3.25 },
    { key: "floodInsulationRebuildPerSqft", label: "New insulation (rebuild the cut band)", unit: "$/sq ft", value: 2.25 },
    { key: "floodBaseboardReplacePerLinFt", label: "Baseboard replacement", unit: "$/linear ft", value: 3.75 },
    { key: "floodDoorRemovalEach", label: "Door removal (with trim/casing)", unit: "$/each", value: 75 },
    { key: "floodDoorInstallEach", label: "New door install, turnkey (frame, trim, lock, door)", unit: "$/each", value: 390 },
    { key: "floodFlooringVinylPerSqft", label: "New flooring, vinyl (LVP) — Installation", unit: "$/sq ft", value: 2 },
    { key: "floodOutletReplaceEach", label: "Outlet replacement (old to new, same location)", unit: "$/each", value: 17 },
    { key: "floodFoundationCrackRepairFlat", label: "Foundation crack repair", unit: "$/crack", value: 375 },
    { key: "floodPaintPerSqft", label: "Wall paint (full height repaint)", unit: "$/sq ft", value: 2 },
    { key: "floodBaseboardPaintPerLinFt", label: "Baseboard/trim paint", unit: "$/linear ft", value: 2 },
    { key: "floodDisposalFlat", label: "Disposal / haul-away (bin, dump runs)", unit: "$ flat", value: 275 },
    { key: "floodPartialCleanupFlat", label: "Partial cleanup (debris, nails, light haul-out — nothing already stripped)", unit: "$ flat", value: 350 },
    { key: "floodFurnitureRepairPerCabinet", label: "Built-in furniture — remove, repair, reinstall", unit: "$/cabinet", value: 180 },
    { key: "floodFurnitureHaulAwayFlat", label: "Built-in furniture — total loss, haul away (kitchen-scale)", unit: "$ flat", value: 950 },
  ],
};
const ROOM_LABELS = { kitchen: "Kitchen", bathroom: "Bathroom", basement: "Basement", fullhome: "Full home", roof: "Roof / exterior", paint: "Paint refresh", fence: "Fence", deck: "Deck", interlocking: "Interlocking", glass: "Glass", flood: "Flood Restoration" };

// Search helpers for Quick Job — plain substring matching misses common cases
// like "frame" vs "framing" (they only share a 4-letter stem) or everyday
// synonyms like "washroom" for "bathroom". This makes search forgiving.
const SEARCH_SYNONYMS = {
  washroom: ["bathroom", "washroom"],
  bathroom: ["bathroom", "washroom"],
  powder: ["bathroom", "washroom", "powder"],
  install: ["install", "installation", "reinstall", "replace", "add", "new", "put"],
  installation: ["install", "installation", "reinstall", "replace"],
  replace: ["replace", "install", "reinstall", "swap", "new"],
  reinstall: ["reinstall", "install", "replace"],
  remove: ["remove", "removal", "demo", "demolition", "tear", "strip", "rip"],
  removal: ["removal", "remove", "demo", "demolition"],
  demo: ["demo", "demolition", "remove", "removal", "tear"],
  repair: ["repair", "fix", "patch"],
  fix: ["fix", "repair", "patch"],
  paint: ["paint", "painting"],
  painting: ["paint", "painting"],
  electric: ["electric", "electrical"],
  reno: ["reno", "renovation"],
  toilet: ["toilet", "washroom"],
};
function fuzzyWordMatch(a, b) {
  if (a === b) return true;
  if (a.length < 3 || b.length < 3) return false;
  if (a.includes(b) || b.includes(a)) return true;
  const n = Math.min(a.length, b.length, 4);
  return n >= 4 && a.slice(0, n) === b.slice(0, n);
}
function wordMatchesAny(queryWord, labelWords) {
  const synonyms = SEARCH_SYNONYMS[queryWord] || [queryWord];
  return labelWords.some((lw) => synonyms.some((syn) => fuzzyWordMatch(syn, lw)));
}
function jobLabelWords(job) {
  return `${job.label} ${ROOM_LABELS[job.room] || ""}`
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

// Quick Job: when one of these is added to the cart, suggest its natural
// companion job (e.g. board-only fire-rated drywall → taping isn't bundled in).
const COMPANION_MAP = {
  "basement:fireDrywallPerSqft": { room: "basement", key: "dryTapingPerSqft" },
  "paint:baseboardTrimInstallPerLinFt": { room: "paint", key: "baseboardPerLinFt" },
};

// Deep-clone default rate lists so editing one room's draft never mutates the shared meta.
const DEFAULT_RATES = Object.fromEntries(
  Object.entries(RATE_META).map(([room, list]) => [room, list.map((f) => ({ ...f }))])
);
const KNOWN_KEYS = Object.fromEntries(Object.entries(RATE_META).map(([room, list]) => [room, new Set(list.map((f) => f.key))]));

// Turn a room's rate list into a plain {key: value} map for convenient dot-access.
// A deleted/missing key simply comes back as undefined, which every compute
// function below treats as "skip this line item."
function rateMap(list) {
  return Object.fromEntries((list || []).map((f) => [f.key, f.value]));
}
// Any entries in the list that aren't part of the known structural set are
// custom positions the user added — include them as flat extra line items.
function customItems(room, list) {
  const known = KNOWN_KEYS[room];
  return (list || [])
    .filter((f) => !known.has(f.key))
    .map((f) => ({ cat: "Custom", item: f.label, cost: f.value, note: "Custom line item you added in My Prices." }));
}

function computeKitchen(a, rates) {
  const list = rates.kitchen;
  const r = rateMap(list);
  const sqft = a.sqft ?? 150;
  const cabCount = a.cabinetCount ?? 12;
  const runLength = a.cabinetRunLength ?? 16;
  const isCustomCabinets = a.cabinetType === "Custom-made";
  const items = [];
  const flags = [];

  if (r.demoFlat != null) items.push({ cat: "Demolition & prep", item: "Full demo + haul-away", cost: r.demoFlat, note: "Ballpark for a typical kitchen — confirmed once we see it." });
  if (a.drywallNeeded === "Yes" && r.drywallPerSqft != null) {
    items.push({ cat: "Drywall", item: "Drywall + taping (walls & ceiling) — Labour & Supply", cost: sqft * 2.2 * r.drywallPerSqft, note: "Board, screws, tape, and compound all included." });
  }

  if (isCustomCabinets) {
    items.push({ cat: "Cabinets & counters", item: "Custom cabinets", cost: 0, note: "Custom cabinetry is priced separately — discuss the design and quote directly, not covered by this estimate." });
    flags.push("Custom cabinets aren't priced in this estimate — that needs a direct conversation about design and budget.");
  } else if (r.cabinetInstallEach != null) {
    items.push({ cat: "Cabinets & counters", item: `Cabinet assembly & install (${cabCount}) — Installation`, cost: cabCount * r.cabinetInstallEach, note: "Labour only — assembles and mounts cabinets. Cabinet boxes/doors themselves are priced separately, by whatever line you're sourcing them from.", buys: { name: "Cabinet boxes/doors", low: cabCount * 360, high: cabCount * 400 } });
  }

  if (a.needsCountertop === "Yes" && r.countertopPerSqft != null) {
    const ctSqft = runLength * 2; // assumes ~24" counter depth
    items.push({ cat: "Cabinets & counters", item: "Countertop — Labour & Supply", cost: ctSqft * r.countertopPerSqft, note: "Template, fabrication, and install — countertop material included." });
  }
  if (a.backsplash === "Yes" && r.backsplashPerSqft != null) {
    const bsSqft = runLength * 1.5;
    items.push({ cat: "Tile work", item: "Backsplash tile (mosaic/glass) — Installation", cost: bsSqft * r.backsplashPerSqft, note: "Tile labour with thinset, spacers, and grout included — mosaic or glass tile assumed. Tile itself priced separately.", buys: { name: "Backsplash tile", low: Math.round(bsSqft * 3), high: Math.round(bsSqft * 5) } });
  }

  if (a.flooring && a.flooring !== "Keep existing") {
    const floorRate = a.flooring === "Tile" ? r.floorTilePerSqft : a.flooring === "Hardwood" ? r.floorHardwoodPerSqft : r.floorLVPPerSqft;
    if (floorRate != null) {
      const isTileFloor = a.flooring === "Tile";
      items.push({
        cat: "Flooring",
        item: `Flooring (${a.flooring})${isTileFloor ? " — Installation" : " — Labour & Supply"}`,
        cost: sqft * floorRate,
        note: isTileFloor ? "Underlayment, thinset, and grout included — tile itself priced separately." : "Material and install labour bundled together.",
        buys: isTileFloor ? { name: "Kitchen floor tile", low: Math.round(sqft * 3), high: Math.round(sqft * 4) } : undefined,
      });
    }
    if (a.oldFloorRemoval === "Yes" && r.floorTileRemovalPerSqft != null) {
      items.push({ cat: "Demolition & prep", item: "Old floor tile removal", cost: sqft * r.floorTileRemovalPerSqft, note: "Strip and haul away the existing floor tile before the new floor goes down." });
    }
  }

  if (a.sinkReplace === "Yes") {
    if (r.sinkHookupFlat != null) items.push({ cat: "Plumbing", item: "New sink plumbing hookup — Labour & Supply", cost: r.sinkHookupFlat, note: "Supply and drain connection for the new sink." });
    if (r.faucetInstallFlat != null) items.push({ cat: "Plumbing", item: "Faucet — Installation", cost: r.faucetInstallFlat, note: "Labour only — faucet priced separately.", buys: { name: "Kitchen faucet", low: 120, high: 180 } });
  }
  if (a.dishwasherInstall === "Yes" && r.dishwasherHookupFlat != null) {
    items.push({ cat: "Plumbing", item: "Dishwasher hookup — Labour & Supply", cost: r.dishwasherHookupFlat, note: "Electrical, water, drain connection, and install." });
  }

  const pts = a.electricalPoints ?? 6;
  if (r.electricalPointEach != null) items.push({ cat: "Electrical", item: "Outlets & light points — Labour & Supply", cost: pts * r.electricalPointEach, note: "Labour, device, and cover plate. Decorative light fixtures themselves are priced separately, as an allowance you choose.", buys: { name: "Light fixtures (if any of the points above are lights)", low: 80, high: 120 } });
  if (a.layout === "Moving plumbing/electrical" && r.plumbingRelocationFlat != null) {
    items.push({ cat: "Plumbing", item: "Plumbing relocation — Labour & Supply", cost: r.plumbingRelocationFlat, note: "Moving supply/drain lines to a new sink or stove location. Exact scope gets confirmed on-site — this covers a typical move." });
  }
  if (a.repaint === "Yes" && r.paintPerSqft != null) {
    items.push({ cat: "Painting", item: "Walls + ceiling paint — Labour & Supply", cost: sqft * r.paintPerSqft, note: "Two coats plus primer where needed, paint included." });
  }
  items.push(...customItems("kitchen", list));
  return { items, flags };
}

function computeBathroom(a, rates) {
  const list = rates.bathroom;
  const BATH = rateMap(list);
  const length = a.length ?? 9;
  const width = a.width ?? 7;
  const sqft = length * width;
  const perimeter = 2 * (length + width);
  const wallArea = perimeter * 8; // 8 ft ceiling assumption
  const isFullReno = a.scope === "Full renovation";
  const hasShower = a.tubShower === "Shower" || a.tubShower === "Both";
  const tileRate = a.tileType === "Mosaic tile" ? BATH.tileMosaicPerSqft : BATH.tileStandardPerSqft;

  const items = [];
  const flags = ["Tile, toilet, vanity top/sink, and glass are priced separately — this total covers labour, consumables, and disposal."];

  if (isFullReno) {
    const STANDARD_BATH_SQFT = 63; // 9x7 reference size — flat rate up to here, scaled proportionally above it
    const sizeFactor = sqft > STANDARD_BATH_SQFT ? sqft / STANDARD_BATH_SQFT : 1;
    if (BATH.demoFlat != null) items.push({ cat: "Demolition & prep", item: "Full demo", cost: BATH.demoFlat * sizeFactor, note: sqft > STANDARD_BATH_SQFT ? `Scaled up for a larger-than-standard bathroom (${sqft} sq ft vs. ${STANDARD_BATH_SQFT} sq ft standard).` : "Ballpark for a typical bathroom — confirmed once we see it." });
    if (BATH.disposalFlat != null) items.push({ cat: "Demolition & prep", item: "Disposal / haul-away", cost: BATH.disposalFlat * sizeFactor, note: sqft > STANDARD_BATH_SQFT ? "Scaled up for a larger-than-standard bathroom." : "Bin or dump run for the demo debris." });
  }

  if (a.framingNeeded === "Yes" && BATH.framingPerLinFt != null) {
    const linFt = a.wallFramingLength ?? 8;
    items.push({ cat: "Framing & structure", item: "New stud wall — Labour & Supply", cost: linFt * BATH.framingPerLinFt, note: "For a layout change, e.g. relocating the shower or vanity wall." });
  }

  if (isFullReno) {
    if (BATH.wetZoneDrywallFlat != null) {
      items.push({ cat: "Drywall", item: "Moisture-resistant drywall + taping (shower/tub zone) — Labour & Supply", cost: BATH.wetZoneDrywallFlat, note: "Roughly 3 sheets (4×8 ft, ~32 sq ft each), board, screws, taping, and mudding included." });
    }
    if (a.extraDrywallNeeded === "Yes" && BATH.extraDrywallPerSheetFlat != null) {
      const sheets = a.extraDrywallSheets ?? 2;
      items.push({ cat: "Drywall", item: `Moisture-resistant drywall + taping, rest of bathroom (${sheets} sheets) — Labour & Supply`, cost: sheets * BATH.extraDrywallPerSheetFlat, note: "Flat per sheet (4×8 ft) — a partial sheet still counts as a full sheet." });
    }
  } else if (BATH.skimCoatPerSqft != null) {
    items.push({ cat: "Drywall", item: "Skim coat existing walls — Labour & Supply", cost: wallArea * BATH.skimCoatPerSqft, note: "Smooths existing walls for paint — no new drywall." });
  }

  let wallTileArea = 0;
  let showerFootprintSqft = 0;
  if (hasShower) {
    showerFootprintSqft = 18; // typical shower is 3x5 to 3x6 ft (15-18 sq ft) — using the higher end on purpose, subtracted from the main floor either way
    if (a.showerBaseType === "Prefab acrylic stall") {
      if (BATH.prefabShowerStall != null) items.push({ cat: "Bathroom fixtures", item: "Prefab acrylic shower stall — Labour & Supply", cost: BATH.prefabShowerStall, note: "Kit install — walls and base come as one unit, no separate tile needed." });
    } else {
      if (BATH.concreteShowerPan != null) items.push({ cat: "Bathroom fixtures", item: "Custom shower pan + drain — Labour & Supply", cost: BATH.concreteShowerPan, note: "Mortar bed base built to the drain, ready for tile." });
      if (BATH.showerFloorTilePerSqft != null) items.push({ cat: "Tile work", item: "Shower floor tile — Installation", cost: showerFootprintSqft * BATH.showerFloorTilePerSqft, note: "Always needed for a custom base, regardless of whether the rest of the floor is retiled — more precise work, priced higher per sq ft.", buys: { name: "Shower floor tile", low: Math.round(showerFootprintSqft * 3), high: Math.round(showerFootprintSqft * 4) } });
      if (BATH.quartzThresholdFlat != null) items.push({ cat: "Tile work", item: "Quartz threshold/curb cap — Labour & Supply", cost: BATH.quartzThresholdFlat, note: "Quartz cap panel over the shower curb." });
      const showerStallW = 6, showerStallD = 3; // typical alcove shower ~6x3 ft, matches the floor footprint
      const showerWallPerimeter = showerStallW + 2 * showerStallD; // 3 tiled walls: back + two sides = 12 linear ft
      wallTileArea = a.tileCoverage === "More of the bathroom (full room perimeter, floor to ceiling)" ? wallArea : showerWallPerimeter * 8;
      if (BATH.waterproofingPerSqft != null) items.push({ cat: "Tile work", item: "Waterproofing membrane — Labour & Supply", cost: wallTileArea * BATH.waterproofingPerSqft, note: "Goes on before tile, behind the shower walls. Sheet or liquid membrane — whichever suits the job, same price either way." });
      if (tileRate != null) items.push({ cat: "Tile work", item: `Wall tile (${a.tileType || "Standard tile"}) — Installation`, cost: wallTileArea * tileRate, note: "Install labour with thinset and grout included — tile itself priced separately.", buys: { name: "Wall/shower tile", low: Math.round(wallTileArea * 3), high: Math.round(wallTileArea * 5) } });
    }
    if (BATH.showerValveInstall != null) items.push({ cat: "Plumbing", item: "Shower valve/trim kit — Installation", cost: BATH.showerValveInstall, note: "Rough-in valve set before tile, trim kit installed after — one combined labour job." });
    if (BATH.showerTrimKitSupplyFlat != null) items.push({ cat: "Plumbing", item: "Shower trim kit — Supply", cost: BATH.showerTrimKitSupplyFlat, note: "We supply the trim kit — handle, head, and cover plate." });
    if (a.glassDoor === "Yes") {
      if (BATH.glassDoorInstallFlat != null) {
        items.push({ cat: "Bathroom fixtures", item: "Glass shower door/enclosure — Installation", cost: BATH.glassDoorInstallFlat, note: "Labour to install — the glass itself is supplied separately.", buys: { name: "Glass shower door/enclosure (supply)", low: 600, high: 600 } });
      }
    }
  } else if (a.tubShower === "Tub" && BATH.tubInstallFlat != null) {
    items.push({ cat: "Bathroom fixtures", item: "Bathtub — Labour & Supply", cost: BATH.tubInstallFlat, note: "General allowance for a standard alcove tub — ask if you want this calibrated to a real rate too." });
  }

  const mainFloorSqft = Math.max(0, sqft - showerFootprintSqft);
  if (a.floorTileReplace !== "No" && mainFloorSqft > 0) {
    if (a.floorMaterial === "Vinyl (LVP)" && BATH.floorVinylPerSqft != null) {
      items.push({ cat: "Flooring", item: "Floor — vinyl (LVP) — Installation", cost: mainFloorSqft * BATH.floorVinylPerSqft, note: "Labour only — vinyl material priced separately. Excludes the shower footprint, priced separately above.", buys: { name: "Vinyl (LVP) flooring material", low: Math.round(mainFloorSqft * 3), high: Math.round(mainFloorSqft * 4) } });
    } else if (tileRate != null) {
      items.push({ cat: "Flooring", item: `Floor tile (${a.tileType || "Standard tile"}) — Installation`, cost: mainFloorSqft * tileRate, note: "Install with underlayment, thinset, and grout included — tile itself priced separately. Excludes the shower footprint, priced separately above.", buys: { name: "Floor tile", low: Math.round(mainFloorSqft * 3), high: Math.round(mainFloorSqft * 4) } });
    }
  }

  if (!isFullReno && a.oldTileRemoval === "Yes") {
    if (BATH.tileRemovalPerSqft != null) {
      items.push({ cat: "Demolition & prep", item: "Old tile removal — floor", cost: sqft * BATH.tileRemovalPerSqft, note: "Strip existing floor tile. Not needed on top of a full demo — that already clears it." });
    }
    if (wallTileArea > 0 && BATH.wallTileRemovalPerSqft != null) {
      items.push({ cat: "Demolition & prep", item: "Old tile removal — wall", cost: wallTileArea * BATH.wallTileRemovalPerSqft, note: "Strip existing shower wall tile, includes disposal." });
    }
  }

  if (a.ceilingWork === "Replace drywall" && BATH.ceilingDrywallPerSqft != null) {
    items.push({ cat: "Drywall", item: "Ceiling drywall replace — Labour & Supply", cost: sqft * BATH.ceilingDrywallPerSqft, note: "Remove old board, install and finish new." });
  } else if (a.ceilingWork === "Tile" && BATH.ceilingTilePerSqft != null) {
    const ceilingTileArea = hasShower ? showerFootprintSqft : sqft;
    items.push({ cat: "Tile work", item: "Ceiling tile — Installation", cost: ceilingTileArea * BATH.ceilingTilePerSqft, note: hasShower ? "Sized to the shower footprint — tiled ceiling is typically just above the shower, not the whole room." : "Less common, priced like wall tile install." });
  }

  if ((isFullReno || a.floorTileReplace === "Yes") && BATH.toiletReinstall != null) {
    items.push({ cat: "Bathroom fixtures", item: "Toilet removal & reinstall — Installation", cost: BATH.toiletReinstall, note: "Comes out and goes back regardless of whether it's a new toilet or the old one — the floor work requires it either way. Labour only — the toilet itself is priced separately.", buys: { name: "Toilet", low: 250, high: 250 } });
  }

  if (a.vanityReplace === "Keep existing vanity" || a.vanityReplace === "Vanity replacement") {
    if (a.vanityReplace === "Keep existing vanity" && BATH.vanityKeepInstall != null) {
      items.push({ cat: "Bathroom fixtures", item: "Vanity — keep existing (reset/reinstall) — Installation", cost: BATH.vanityKeepInstall, note: "Labour to disconnect, protect, and reinstall the same vanity." });
    } else if (BATH.vanityInstall != null) {
      items.push({ cat: "Bathroom fixtures", item: "Vanity replacement — Installation", cost: BATH.vanityInstall, note: "Labour only — the vanity unit and top are priced separately.", buys: { name: "Vanity unit + top", low: 500, high: 600 } });
    }
    if (a.vanityReplace === "Vanity replacement" && BATH.vanityFaucetInstall != null) {
      items.push({ cat: "Plumbing", item: "Vanity faucet — Installation", cost: BATH.vanityFaucetInstall, note: "Automatically included with a new vanity. Labour only — faucet priced separately.", buys: { name: "Vanity faucet", low: 90, high: 130 } });
    }
    items.push({ cat: "Electrical", item: "Vanity light fixture", cost: 0, hideFromBreakdown: true, note: "Not included in labour above — priced and supplied separately, wired in as part of the electrical points.", buys: { name: "Vanity light fixture", low: 80, high: 120 } });
    if (a.vanityPlumbing === "Yes" && BATH.vanitySupplyLines != null) {
      items.push({ cat: "Plumbing", item: "New shut-offs & supply lines — Labour & Supply", cost: BATH.vanitySupplyLines, note: "Two shut-offs at $55 each — only needed if the existing lines are old or leaking." });
    }
  }
  if (a.sewerRelocation === "Yes" && BATH.sewerRelocationFlat != null) {
    items.push({ cat: "Plumbing", item: "Sewer/drain relocation — Labour & Supply", cost: BATH.sewerRelocationFlat, note: "Moving a fixture drain (e.g. toilet) to a new location under the slab or through the wall — scope confirmed on site." });
  }

  const outlets = a.electricalPoints ?? 1;
  if (outlets > 0 && BATH.electricalPoint != null) items.push({ cat: "Electrical", item: "Outlets/switches (new or relocated) — Labour & Supply", cost: outlets * BATH.electricalPoint, note: "Per point." });
  const lights = a.potLights ?? 1;
  if (lights > 0 && BATH.potLight != null) {
    items.push({ cat: "Electrical", item: "Pot lights — Labour & Supply", cost: lights * BATH.potLight, note: "Per light, housing and trim included." });
  } else {
    items.push({ cat: "Electrical", item: "Light fixture", cost: 0, hideFromBreakdown: true, note: "No pot lights selected — the room still needs a light fixture, supplied and installed separately.", buys: { name: "Bathroom light fixture", low: 100, high: 140 } });
  }

  if (a.exhaustFan === "Replace existing" && BATH.exhaustFan != null) {
    items.push({ cat: "Bathroom fixtures", item: "Exhaust fan replacement — Labour & Supply", cost: BATH.exhaustFan, note: "Fan unit, reusing the existing duct run." });
  } else if (a.exhaustFan === "New install (no existing duct)" && BATH.exhaustFanNewInstall != null) {
    items.push({ cat: "Bathroom fixtures", item: "Exhaust fan, new install — Labour & Supply", cost: BATH.exhaustFanNewInstall, note: "Fan unit, a new duct run to exterior, and a new switch to control it." });
  }
  if (a.accessories === "Yes" && BATH.accessorySet != null) {
    items.push({ cat: "Bathroom fixtures", item: "Towel bars, hooks, TP holder & mirror — Installation", cost: BATH.accessorySet, note: "Labour only — the hardware set and mirror themselves are priced separately.", buys: { name: "Towel bars/hooks/TP holder set", low: 50, high: 70 } });
    items.push({ cat: "Bathroom fixtures", item: "Mirror", cost: 0, hideFromBreakdown: true, note: "Hung as part of the accessory install above — the mirror itself is priced separately.", buys: { name: "Mirror", low: 130, high: 170 } });
  }

  if (BATH.paintFlatBathroom != null) items.push({ cat: "Painting", item: "Walls + ceiling paint — Labour & Supply", cost: BATH.paintFlatBathroom, note: "Two coats, paint included — flat rate for a typical bathroom." });

  if (BATH.baseboardReplaceFlat != null) {
    const includesTrim = a.doorWindowTrimReplace === "Yes";
    const trimCost = includesTrim ? BATH.baseboardReplaceFlat : BATH.baseboardReplaceFlat / 2;
    items.push({
      cat: "Trim & finish carpentry",
      item: includesTrim ? "Baseboard, window moldings & door trim replacement — Labour & Supply" : "Baseboard replacement only — Labour & Supply",
      cost: trimCost,
      note: includesTrim ? "Baseboard, window moldings, and door trim, whole bathroom. Materials included." : "Baseboard only — window and door trim not included. Materials included.",
    });
  }

  if (a.heatedFloor === "Yes" && BATH.heatedFloorPerSqft != null) {
    items.push({ cat: "Optional add-ons", item: "Heated floor — Labour & Supply", cost: sqft * BATH.heatedFloorPerSqft, note: "Shown separately — an upgrade, not a default inclusion." });
  }

  items.push(...customItems("bathroom", list));
  return { items, flags };
}

function computeBasement(a, rates) {
  const list = rates.basement;
  const r = rateMap(list);
  const length = a.length ?? 30;
  const width = a.width ?? 20;
  const sqft = length * width;
  const perimeter = 2 * (length + width);
  const wallArea = perimeter * 8; // 8 ft ceiling assumption
  const items = [];
  const flags = [];

  if (a.demoNeeded === "Yes" && r.demoPerSqft != null) {
    items.push({ cat: "Demolition & prep", item: "Demo / removal", cost: sqft * r.demoPerSqft, note: "Ballpark for a typical basement — confirmed once we see it." });
  }

  const bedroomCount = a.bedroomCount ?? 0;
  // Framing formula, calibrated against a real 1000 sq ft / 2 bedroom / furnace room / bathroom
  // basement worked out to ~250 lf: 1000*0.13 (open-space division) + 2*35 (bedrooms) + 25 (furnace) + 25 (bath) = 250.
  const furnaceRoomFraming = 25; // a furnace/mechanical room is basically always present — no need to ask
  const bathroomFraming = a.hasBathroom === "Yes" ? 25 : 0;
  const framingLinFt = sqft * 0.13 + bedroomCount * 35 + furnaceRoomFraming + bathroomFraming;
  if (framingLinFt > 0 && r.framingPerLinFt != null) {
    items.push({ cat: "Framing & structure", item: "Interior wall framing — Labour & Supply", cost: framingLinFt * r.framingPerLinFt, note: `Studs, plates, and fasteners — estimated from basement size (${Math.round(sqft)} sq ft), ${bedroomCount} bedroom${bedroomCount === 1 ? "" : "s"}, plus the furnace room and bathroom.` });
  }

  // Bulkheads (boxing in ductwork/pipes/beams) — the main beam typically runs
  // down the middle along the longer dimension, plus ~10 lf for smaller boxes elsewhere.
  const bulkheadLinFt = Math.max(length, width) + 10;
  if (r.bulkheadPerLinFt != null) {
    items.push({ cat: "Framing & structure", item: "Bulkheads (ductwork/pipe boxing) — Labour & Supply", cost: bulkheadLinFt * r.bulkheadPerLinFt, note: `Sized from the basement's longer side (${Math.max(length, width)} ft) plus ~10 lf for smaller boxes — framing and drywall to box in ductwork, pipes, and beams.` });
  }

  if (r.wallInsulationPerSqft != null) {
    items.push({ cat: "Insulation", item: "Wall insulation — Labour & Supply", cost: wallArea * r.wallInsulationPerSqft, note: "Tyvek air/vapour barrier, batt insulation, and taped poly." });
  }
  if (a.ceilingFireRated === "Yes") {
    if (r.rockwoolInsulationPerSqft != null) items.push({ cat: "Insulation", item: "Ceiling insulation (fire-rated rockwool) — Labour & Supply", cost: sqft * r.rockwoolInsulationPerSqft, note: "Material and install." });
    if (r.resilientChannelPerSqft != null) items.push({ cat: "Drywall", item: "Resilient channel — Labour & Supply", cost: sqft * r.resilientChannelPerSqft, note: "Material and install, spaced to code." });
    if (r.fireDrywallPerSqft != null) items.push({ cat: "Drywall", item: "5/8\" fire-rated ceiling drywall", cost: sqft * r.fireDrywallPerSqft, note: `Board and screws — hanging only. ~${Math.ceil(sqft / 32)} sheets (4×8 ft).`, sheets: { type: "5/8\" fire-rated", count: Math.ceil(sqft / 32) } });
    if (r.dryTapingPerSqft != null) items.push({ cat: "Drywall", item: "Taping (ceiling)", cost: sqft * r.dryTapingPerSqft, note: "Taping and mudding, ready for paint — priced separately from hanging the board." });
  } else if (r.standardCeilingDrywallPerSqft != null) {
    items.push({ cat: "Drywall", item: "Ceiling drywall + taping, standard — Labour & Supply", cost: sqft * r.standardCeilingDrywallPerSqft, note: `Not a legal-basement fire separation, so no rockwool/channel needed. ~${Math.ceil(sqft / 32)} sheets (4×8 ft).`, sheets: { type: "1/2\"/5/8\" standard ceiling", count: Math.ceil(sqft / 32) } });
  }
  if (a.fireRatedWallNeeded === "Yes" && r.fireRatedWallPerSqft != null) {
    const wallLen = a.fireRatedWallLength ?? 12;
    const fireWallSqft = wallLen * 8;
    items.push({ cat: "Drywall", item: "Fire-rated wall — Labour & Supply", cost: fireWallSqft * r.fireRatedWallPerSqft, note: "Framing, rockwool insulation, resilient channel, and 5/8\" fire-rated board on both sides — hanging only, not taped." });
    if (r.dryTapingPerSqft != null) {
      items.push({ cat: "Drywall", item: "Taping (fire-rated wall, both sides)", cost: fireWallSqft * r.dryTapingPerSqft * 2, note: "Taping and mudding both faces, ready for paint." });
    }
  }
  {
    const isHalfInch = a.wallDrywallThickness === "1/2\" (standard, cheaper)";
    const wallDrywallRate = isHalfInch ? r.drywallHalfInchPerSqft : r.drywallWallsPerSqft;
    if (wallDrywallRate != null) {
      items.push({ cat: "Drywall", item: `Drywall + taping (walls), ${isHalfInch ? "1/2\"" : "5/8\""} — Labour & Supply`, cost: wallArea * wallDrywallRate, note: `Board, screws, tape, and compound. ~${drywallSheets(perimeter, 8)} sheets (4×8 ft).`, sheets: { type: isHalfInch ? "1/2\" standard" : "5/8\" standard", count: drywallSheets(perimeter, 8) } });
    }
  }

  if (bedroomCount > 0 && r.electricalBaseFlat != null) {
    let electricalCost = r.electricalBaseFlat;
    if (bedroomCount >= 2 && r.electricalSecondBedroomFlat != null) electricalCost += r.electricalSecondBedroomFlat;
    if (bedroomCount >= 3 && r.electricalExtraBedroomFlat != null) electricalCost += r.electricalExtraBedroomFlat * (bedroomCount - 2);
    items.push({ cat: "Electrical", item: `Electrical (${bedroomCount} bedroom${bedroomCount > 1 ? "s" : ""}) — Labour & Supply`, cost: electricalCost, note: "Outlets, switches, lighting, and smoke/CO detection. Extra bedrooms mostly add devices, not a whole new package." });
  }
  if (a.hasLaundry === "Yes" && r.laundryDrainVentFlat != null) {
    items.push({ cat: "Plumbing", item: "Laundry drain + vent — Labour & Supply", cost: r.laundryDrainVentFlat, note: "New drain and vent for the laundry — the washer/dryer themselves are priced separately." });
  }

  if (a.hasBathroom === "Yes") {
    const bathAnswers = {
      length: a.bathLength ?? 5,
      width: a.bathWidth ?? 8,
      scope: "Full renovation",
      tubShower: "Shower",
      showerBaseType: "Custom tiled/concrete base",
      tileCoverage: "Just the shower area",
      tileType: "Standard tile",
      glassDoor: "No",
      floorTileReplace: "Yes",
      oldTileRemoval: "No",
      ceilingWork: "Paint only",
      vanityReplace: "Vanity replacement",
      vanityPlumbing: "No",
      electricalPoints: 1,
      potLights: 1,
      exhaustFan: "Replace existing",
      accessories: "Yes",
      framingNeeded: "No",
      heatedFloor: "No",
    };
    const bathResult = computeBathroom(bathAnswers, rates);
    bathResult.items.forEach((it) => items.push({ ...it, item: `Basement bathroom — ${it.item}` }));
  }

  const doorCount = a.doorCount ?? 0;
  if (doorCount > 0 && r.doorInstallEach != null) {
    items.push({ cat: "Doors & windows", item: `Interior doors (${doorCount}) — Labour & Supply`, cost: doorCount * r.doorInstallEach, note: "Turnkey, materials included." });
  }
  if (doorCount > 0 && r.doorTrimPaintEach != null) {
    items.push({ cat: "Painting", item: `Door trim paint (${doorCount}) — Labour & Supply`, cost: doorCount * r.doorTrimPaintEach, note: "Paint and labour." });
  }
  const slidingDoors = a.slidingClosetDoors ?? 0;
  if (slidingDoors > 0 && r.slidingClosetDoorFlat != null) {
    items.push({ cat: "Doors & windows", item: `Sliding closet doors (${slidingDoors}) — Labour & Supply`, cost: slidingDoors * r.slidingClosetDoorFlat, note: "Track-mounted bypass doors, installed." });
  }

  if (r.baseboardPerLinFt != null) {
    items.push({ cat: "Trim & finish carpentry", item: "Baseboard", cost: perimeter * r.baseboardPerLinFt, note: "Materials included." });
  }
  if (r.paintPerSqft != null) {
    items.push({ cat: "Painting", item: "Walls + ceiling paint — Labour & Supply", cost: (wallArea + sqft) * r.paintPerSqft, note: "Two coats, paint included." });
  }

  if (a.waterSigns === "Yes" && r.waterproofingPerLinFt != null) {
    items.push({ cat: "Foundation", item: "Exterior waterproofing membrane — Labour & Supply", cost: perimeter * r.waterproofingPerLinFt, note: "Excavation, membrane, and weeping tile tie-in." });
  }
  const crackCount = a.foundationCracks ?? 0;
  if (crackCount > 0 && r.foundationCrackRepairFlat != null) {
    items.push({ cat: "Foundation", item: `Foundation crack repair (${crackCount}) — Labour & Supply`, cost: crackCount * r.foundationCrackRepairFlat, note: "Epoxy or polyurethane injection, per crack." });
  }

  const floorRate =
    a.flooring === "Tile" ? r.floorTileBasementPerSqft : a.flooring === "Epoxy" ? r.floorEpoxyPerSqft : a.flooring === "Laminate" ? r.floorLaminatePerSqft : r.floorLVPPerSqft;
  if (floorRate != null) {
    const isTile = a.flooring === "Tile";
    const isEpoxy = a.flooring === "Epoxy";
    const labelSuffix = isEpoxy ? " — Labour & Supply" : " — Installation";
    items.push({
      cat: "Flooring",
      item: `Flooring (${a.flooring || "Vinyl (LVP)"})${labelSuffix}`,
      cost: sqft * floorRate,
      note: isTile ? "Concrete slab — no underlayment needed. Tile itself priced separately." : isEpoxy ? "All-in — coating material and application included." : "Labour only — material priced separately.",
      buys: isTile ? { name: "Floor tile", low: Math.round(sqft * 3), high: Math.round(sqft * 10) } : isEpoxy ? undefined : { name: `${a.flooring || "Vinyl (LVP)"} flooring material`, low: Math.round(sqft * (a.flooring === "Laminate" ? 2.5 : 3)), high: Math.round(sqft * (a.flooring === "Laminate" ? 3.5 : 4)) },
    });
  }

  if (a.legalBedroom === "Yes" && r.egressWindowFlat != null) {
    items.push({ cat: "Doors & windows", item: "Egress window — Labour & Supply", cost: r.egressWindowFlat, note: "Starting price — cutting the opening, window well, weeping tile, exterior trim, and the window itself. Can run higher depending on depth and soil conditions." });
  }
  if (a.secondaryUnit === "Yes" && r.unitSeparationFlat != null) {
    items.push({ cat: "Plumbing", item: "Utility separation for a secondary unit — Labour & Supply", cost: r.unitSeparationFlat, note: "Separate water supply/metering for a legal secondary unit." });
  }
  if (a.separateEntrance === "Yes" && r.separateEntranceFlat != null) {
    items.push({ cat: "Doors & windows", item: "Separate entrance — Labour & Supply", cost: r.separateEntranceFlat, note: "Permit-compliant, turnkey with door and railings — includes inspections. Only offered as a permitted job." });
  }
  if (a.relocationNeeded === "Yes") {
    flags.push("Relocating stairs, ductwork, or the panel needs a site visit to price properly.");
  }

  items.push(...customItems("basement", list));
  return { items, flags };
}

function computeFullHome(a, rates) {
  const list = rates.fullhome;
  const r = rateMap(list);
  const sqft = a.sqft ?? 1800;
  const items = [];
  if (r.perSqft != null) items.push({ cat: "Whole-house renovation", item: "Full home renovation", cost: sqft * r.perSqft, note: "Blended per-sq-ft rate across trades. Kitchen/bathroom finish upgrades can move this substantially — worth a room-by-room estimate too." });
  const flags = [];
  if (a.wallsChanged === "Yes" && r.structuralWallAllowanceFlat != null) {
    items.push({ cat: "Framing & structure", item: "Structural wall removal (open concept) — Labour & Supply", cost: r.structuralWallAllowanceFlat, note: "All-in: demo, structural reinforcement, beam with materials, and the drywall + paint touch-up after. Typical range $4,000-5,000 — an engineer's review confirms the final number." });
    flags.push("Load-bearing wall changes need an engineer's review before pricing firms up.");
  }
  if (a.panel === "Original" && r.panelUpgradeFlat != null && r.rewirePerSqft != null) {
    items.push({ cat: "Electrical", item: "Panel upgrade + rewire allowance — Labour & Supply", cost: r.panelUpgradeFlat + sqft * r.rewirePerSqft, note: "200A panel upgrade plus a wiring allowance for pre-1980 wiring types." });
  }
  if (a.roofAge === "20+ years / unknown") {
    flags.push("Roof is at or past typical lifespan — get a separate roofing estimate; not included in this total.");
  }
  items.push(...customItems("fullhome", list));
  return { items, flags };
}

function computeRoof(a, rates) {
  const list = rates.roof;
  const r = rateMap(list);
  const sqft = a.sqft ?? 1800;
  const items = [];
  if (r.shinglePerSqft != null) items.push({ cat: "Roofing", item: "Shingle replacement — Labour & Supply", cost: sqft * r.shinglePerSqft, note: "Tear-off (1 layer), underlayment, shingles, and flashing included." });
  if (a.layers === "2+" && r.extraTearOffPerSqft != null) {
    items.push({ cat: "Roofing", item: "Extra tear-off (2+ layers)", cost: sqft * r.extraTearOffPerSqft, note: "Additional labour and disposal for a second layer of shingles." });
  }
  if (a.softSpots === "Yes" && r.deckRepairPerSqft != null) {
    const deckArea = sqft * 0.2;
    items.push({ cat: "Roofing", item: "Roof deck repair (contingency) — Labour & Supply", cost: deckArea * r.deckRepairPerSqft, note: "Assumes about 20% of the deck needs sheathing replaced — confirmed once the old roof is off." });
  }
  items.push(...customItems("roof", list));
  return { items, flags: [] };
}

function computePaint(a, rates) {
  const list = rates.paint;
  const r = rateMap(list);
  const heightFeet = CEILING_HEIGHT_FEET[a.ceilingHeight || "Standard (8 ft)"];
  const heightFactor = CEILING_HEIGHT_FACTOR[a.ceilingHeight || "Standard (8 ft)"];

  let roomSqft, wallSqft, areaNote, baseboardLinFt;
  if (a.areaMethod === "I know the total square footage") {
    const totalSqft = a.totalSqft ?? 500;
    roomSqft = totalSqft;
    // typical wall-to-floor ratio for an average-shaped room at 8 ft, scaled for actual height
    wallSqft = totalSqft * 3.0 * (heightFeet / 8);
    baseboardLinFt = totalSqft * 0.3125; // calibrated: ~250 lf for an 800 sq ft space
    areaNote = `Based on ${totalSqft} sq ft total floor area (wall area estimated from a typical room shape).`;
  } else {
    const roomCount = a.roomCount ?? 1;
    const roomDims = [];
    for (let i = 1; i <= roomCount; i++) {
      roomDims.push({ length: a[`room${i}Length`] ?? 12, width: a[`room${i}Width`] ?? 10 });
    }
    roomSqft = roomDims.reduce((s, d) => s + d.length * d.width, 0);
    const totalPerimeter = roomDims.reduce((s, d) => s + 2 * (d.length + d.width), 0);
    wallSqft = totalPerimeter * heightFeet;
    baseboardLinFt = totalPerimeter; // each room's own perimeter, summed
    areaNote = `Based on ${roomCount} room${roomCount > 1 ? "s" : ""}, each sized individually.`;
  }
  const ceilSqft = roomSqft;
  const items = [];
  if (r.wallPerSqft != null) items.push({ cat: "Painting", item: "Wall paint — Labour & Supply", cost: wallSqft * r.wallPerSqft * heightFactor, note: `Primer plus two coats, paint included. ${areaNote}` });
  if (r.ceilingPerSqft != null) items.push({ cat: "Painting", item: "Ceiling paint — Labour & Supply", cost: ceilSqft * r.ceilingPerSqft * heightFactor, note: "Primer plus two coats." });
  if (a.wallCondition === "Existing painted walls" && r.paintPrepOldPerSqft != null) {
    items.push({ cat: "Demolition & prep", item: "Prep for painting over old paint", cost: roomSqft * r.paintPrepOldPerSqft, note: "Patching, cleaning, and sanding where the old paint needs it — priced per square foot of room, not wall area." });
  }
  if (a.sameColor === "Different colours" && r.secondColourPerSqft != null) {
    items.push({ cat: "Painting", item: "Cutting in a second colour — Labour & Supply", cost: wallSqft * r.secondColourPerSqft, note: "Extra time to cut a clean line where wall and ceiling colours meet." });
  }
  const doors = a.doors ?? 0;
  const doorSlabsOnly = a.doorSlabsOnly ?? 0;
  const windows = a.windows ?? 0;
  if (doors > 0 && r.doorWithTrimEach != null) items.push({ cat: "Trim & finish", item: `Door + trim paint (${doors}) — Labour & Supply`, cost: doors * r.doorWithTrimEach, note: "Includes caulking before paint." });
  if (doorSlabsOnly > 0 && r.doorSlabOnlyEach != null) items.push({ cat: "Trim & finish", item: `Door slab only (${doorSlabsOnly}) — Labour & Supply`, cost: doorSlabsOnly * r.doorSlabOnlyEach, note: "Just the door leaf, no trim/casing." });
  if (windows > 0 && r.windowTrimEach != null) items.push({ cat: "Trim & finish", item: `Window trim paint (${windows}) — Labour & Supply`, cost: windows * r.windowTrimEach, note: "Includes caulking before paint." });
  if (baseboardLinFt > 0 && r.baseboardPerLinFt != null) items.push({ cat: "Trim & finish", item: "Baseboard/trim paint — Labour & Supply", cost: baseboardLinFt * r.baseboardPerLinFt, note: `Paint and labour, existing baseboard/trim — estimated at ~${Math.round(baseboardLinFt)} linear ft from the space entered above.` });
  const patchMap2 = { None: 0, "A few small ones": r.patchFewFlat, "Several / larger repairs": r.patchSeveralFlat };
  const patchCost = patchMap2[a.patches || "None"];
  if (patchCost) items.push({ cat: "Demolition & prep", item: `Drywall patch/repair (${a.patches}) — Labour & Supply`, cost: patchCost, note: "Patch, sand, and spot-prime before painting." });
  items.push(...customItems("paint", list));
  return { items, flags: [] };
}

function computeFence(a, rates) {
  const list = rates.fence;
  const r = rateMap(list);
  const length = a.length ?? 100;
  const rate = a.height === "8 ft (tall)" ? r.tallPerLinFt : r.standardPerLinFt;
  const items = [];
  if (rate != null) {
    items.push({ cat: "Fence", item: `Fence (${a.height || "6 ft (standard)"}) — Labour & Supply`, cost: length * rate, note: "Starting price for a standard fence — 4x4 posts, standard spacing. Gates priced separately." });
  }
  const gates = a.gateCount ?? 0;
  if (gates > 0 && r.gateEach != null) {
    items.push({ cat: "Fence", item: `Gate (${gates}) — Labour & Supply`, cost: gates * r.gateEach, note: "Per opening element, hardware included." });
  }
  items.push(...customItems("fence", list));
  return { items, flags: [] };
}

function computeDeck(a, rates) {
  const list = rates.deck;
  const r = rateMap(list);
  const sqft = a.sqft ?? 200;
  const deckRate = a.material === "Composite" ? r.compositePerSqft : r.ptPerSqft;
  const items = [];
  if (deckRate != null) {
    items.push({ cat: "Deck", item: `Deck build (${a.material || "Pressure-treated"}) — Labour & Supply`, cost: sqft * deckRate, note: "From scratch — framing, footings, and decking included." });
  }
  const railingLength = a.railingLength ?? 0;
  if (railingLength > 0) {
    const railRate = a.railingMaterial === "Aluminum" ? r.railingAluminumPerLinFt : r.railingWoodPerLinFt;
    if (railRate != null) {
      items.push({ cat: "Deck", item: `Railing (${a.railingMaterial || "Wood"}) — Labour & Supply`, cost: railingLength * railRate, note: "Material and install." });
    }
  }
  items.push(...customItems("deck", list));
  return { items, flags: [] };
}

function computeInterlocking(a, rates) {
  const list = rates.interlocking;
  const r = rateMap(list);
  const sqft = a.sqft ?? 300;
  const needsExcavation = a.excavationNeeded === "Need to excavate";
  let rate = needsExcavation ? r.excavatePerSqft : r.readyBasePerSqft;
  const irregular = a.shapeType === "Irregular (lots of cuts)";
  if (irregular && rate != null && r.irregularSurchargePct != null) {
    rate = rate * (1 + r.irregularSurchargePct / 100);
  }
  const items = [];
  if (rate != null) {
    items.push({
      cat: "Interlocking",
      item: `Paver install${needsExcavation ? " (excavation)" : ""}${irregular ? ", irregular shape" : ""} — Labour & Supply`,
      cost: sqft * rate,
      note: needsExcavation ? "Excavation, base prep, materials, and laying." : "Base already prepared — materials and laying only.",
    });
  }
  if (a.diggingMethod === "Need an excavator" && r.excavatorSurchargeFlat != null) {
    items.push({ cat: "Interlocking", item: "Excavator rental", cost: r.excavatorSurchargeFlat, note: "Placeholder — confirm a real rate for this." });
  }
  if (a.tileSource === "I'll supply my own paver" && r.ownPaverDiscountPerSqft != null) {
    items.push({ cat: "Interlocking", item: "Client-supplied paver discount", cost: -sqft * r.ownPaverDiscountPerSqft, note: "Deducted since paver material isn't included.", buys: { name: "Interlocking paver", low: Math.round(sqft * 4), high: Math.round(sqft * 9) } });
  }
  items.push(...customItems("interlocking", list));
  return { items, flags: [] };
}

function computeGlass(a, rates) {
  const list = rates.glass || [];
  const r = rateMap(list);
  const width = a.widthInches ?? 70;
  const height = a.heightInches ?? 74;
  const sqft = (width * height) / 144;
  const isStandard = a.glassConfig === "Standard prefab kit";
  const items = [];

  if (isStandard) {
    if (r.glassStandardKitFlat != null) {
      items.push({ cat: "Glass", item: "Standard prefab kit (glass + hardware) — Supply", cost: r.glassStandardKitFlat, note: `Ready-made kit for standard sizes (32×32, 36×36, slider up to 48in) — ${width}″ × ${height}″ entered.` });
    }
  } else {
    if (r.glassCustomPerSqft != null) {
      items.push({ cat: "Glass", item: `Custom glass panel${a.glassApplication ? ` (${a.glassApplication})` : ""}${a.glassType ? ` — ${a.glassType}` : ""}`, cost: sqft * r.glassCustomPerSqft, note: `${width}″ × ${height}″ (${sqft.toFixed(1)} sq ft), custom-cut.` });
    }
    if (r.glassHardwareFlat != null) {
      items.push({ cat: "Glass", item: "Hardware (clips, hinges, handles, track) — Supply", cost: r.glassHardwareFlat, note: "Fixed cost regardless of panel size." });
    }
  }

  const installRate = a.installComplexity === "Simple construction" ? r.glassInstallSimplePerSqft : r.glassInstallStandardPerSqft;
  if (installRate != null) {
    items.push({ cat: "Glass", item: "Glass — Installation", cost: sqft * installRate, note: `Labour to install the ${a.doorType ? a.doorType.toLowerCase() : "panel"} — ${a.installComplexity === "Simple construction" ? "simple construction" : "standard"} rate.` });
  }
  if (r.glassDeliveryFlat != null) {
    items.push({ cat: "Glass", item: "Delivery", cost: r.glassDeliveryFlat, note: "Flat delivery charge for the glass." });
  }

  items.push(...customItems("glass", list));
  return { items, flags: [] };
}

function computeFlood(a, rates) {
  const list = rates.flood || [];
  const r = rateMap(list);
  const roomCount = a.roomCount ?? 1;
  const roomDims = [];
  for (let i = 1; i <= roomCount; i++) {
    roomDims.push({ length: a[`room${i}Length`] ?? 12, width: a[`room${i}Width`] ?? 10 });
  }
  const sqft = roomDims.reduce((s, d) => s + d.length * d.width, 0);
  const perimeter = roomDims.reduce((s, d) => s + 2 * (d.length + d.width), 0);
  const cutHeight = a.drywallCutHeight ?? 2;
  const cutBandSqft = perimeter * cutHeight;
  const needsDemo = a.floodScope !== "Demo already done — restoration only";
  const items = [];
  const flags = [];

  if (needsDemo) {
    if (a.demoExtent === "Partial cleanup only") {
      if (r.floodPartialCleanupFlat != null) {
        items.push({ cat: "Demolition & prep", item: "Partial cleanup", cost: r.floodPartialCleanupFlat, note: "Debris, nails, and light haul-out — the space wasn't already stripped, just needs tidying before rebuild." });
      }
    } else {
      if (r.floodFloorDemoPerSqft != null) {
        items.push({ cat: "Demolition & prep", item: "Floor demo", cost: sqft * r.floodFloorDemoPerSqft, note: "Affected flooring — bagged and hauled per contaminated-material handling." });
      }
      if (r.floodBaseboardDemoPerLinFt != null) {
        items.push({ cat: "Demolition & prep", item: "Baseboard demo/removal", cost: perimeter * r.floodBaseboardDemoPerLinFt, note: `${perimeter.toFixed(0)} linear ft total perimeter.` });
      }
      if (r.floodDrywallDemoPerSqft != null) {
        items.push({ cat: "Demolition & prep", item: `Drywall demo (cut at ${cutHeight} ft)`, cost: cutBandSqft * r.floodDrywallDemoPerSqft, note: `Perimeter × ${cutHeight} ft = ${cutBandSqft.toFixed(0)} sq ft cut and removed, contaminated handling.` });
      }
      if (r.floodDisposalFlat != null) {
        items.push({ cat: "Demolition & prep", item: "Disposal / haul-away", cost: r.floodDisposalFlat, note: "Bin rental and dump runs for everything removed above." });
      }
      const doorsAffected = a.doorsAffected ?? 0;
      if (doorsAffected > 0 && r.floodDoorRemovalEach != null) {
        items.push({ cat: "Demolition & prep", item: `Door removal (${doorsAffected})`, cost: doorsAffected * r.floodDoorRemovalEach, note: "Doors taken off with trim/casing — not a new install." });
      }
    }
  }

  if (a.builtInFurnitureDamaged === "Yes") {
    if (a.furnitureCondition === "Repairable") {
      const cabinetCount = a.cabinetCount ?? 10;
      if (r.floodFurnitureRepairPerCabinet != null) {
        items.push({ cat: "Demolition & prep", item: `Built-in furniture — remove, repair, reinstall (${cabinetCount}) — Installation`, cost: cabinetCount * r.floodFurnitureRepairPerCabinet, note: "Vanity/kitchen cabinets — removed, damaged parts repaired, reinstalled." });
      }
    } else if (r.floodFurnitureHaulAwayFlat != null) {
      items.push({ cat: "Demolition & prep", item: "Built-in furniture — total loss, haul away", cost: r.floodFurnitureHaulAwayFlat, note: "Not salvageable — demo and disposal at kitchen-equivalent scale." });
    }
  }

  if (r.antimicrobialTreatmentFlat != null) {
    items.push({ cat: "Mitigation", item: "Antimicrobial/preventive treatment", cost: r.antimicrobialTreatmentFlat, note: "Standard practice after any water event, even without visible mold." });
  }

  if (a.moldVisible === "Yes" && r.moldRemediationPerSqft != null) {
    items.push({ cat: "Mitigation", item: "Mold remediation", cost: sqft * r.moldRemediationPerSqft, note: "Containment, HEPA filtration, and removal of affected material." });
  }

  if (r.floodInsulationRebuildPerSqft != null) {
    items.push({ cat: "Rebuild", item: `New insulation (${cutHeight} ft band) — Labour & Supply`, cost: cutBandSqft * r.floodInsulationRebuildPerSqft, note: "Replaces insulation removed with the cut drywall." });
  }
  if (r.floodDrywallRebuildPerSqft != null) {
    items.push({ cat: "Rebuild", item: `New drywall + taping (${cutHeight} ft band) — Labour & Supply`, cost: cutBandSqft * r.floodDrywallRebuildPerSqft, note: `Board, screws, taping, and mudding for the cut band, ready for paint. ~${drywallSheets(perimeter, cutHeight)} sheets (4×8 ft).`, sheets: { type: "5/8\" (flood rebuild band)", count: drywallSheets(perimeter, cutHeight) } });
  }
  if (r.floodBaseboardReplacePerLinFt != null) {
    items.push({ cat: "Rebuild", item: "Baseboard replacement — Labour & Supply", cost: perimeter * r.floodBaseboardReplacePerLinFt, note: "Materials included." });
  }
  if (r.floodPaintPerSqft != null) {
    items.push({ cat: "Rebuild", item: "Wall paint (full height)", cost: perimeter * 7 * r.floodPaintPerSqft, note: "Walls repainted floor-to-ceiling, not just the cut band — perimeter × 7 ft." });
  }
  if (r.floodBaseboardPaintPerLinFt != null) {
    items.push({ cat: "Rebuild", item: "Baseboard/trim paint — Labour & Supply", cost: perimeter * r.floodBaseboardPaintPerLinFt, note: "Paint and labour on the new baseboard." });
  }
  const doorsToInstall = a.doorsToInstall ?? 0;
  if (doorsToInstall > 0 && r.floodDoorInstallEach != null) {
    items.push({ cat: "Rebuild", item: `New door install (${doorsToInstall}) — Labour & Supply`, cost: doorsToInstall * r.floodDoorInstallEach, note: "Turnkey — frame, trim, lock, and door." });
  }
  if (a.floodFlooringNeeded === "Yes — vinyl (LVP)" && r.floodFlooringVinylPerSqft != null) {
    items.push({ cat: "Rebuild", item: "New flooring, vinyl (LVP) — Installation", cost: sqft * r.floodFlooringVinylPerSqft, note: `${sqft.toFixed(0)} sq ft — labour only, vinyl material priced separately.`, buys: { name: "Vinyl (LVP) flooring material", low: Math.round(sqft * 3), high: Math.round(sqft * 4) } });
  }
  const electricalOutlets = a.electricalOutlets ?? 0;
  if (electricalOutlets > 0 && r.floodOutletReplaceEach != null) {
    items.push({ cat: "Rebuild", item: `Outlet replacement (${electricalOutlets}) — Installation`, cost: electricalOutlets * r.floodOutletReplaceEach, note: "Swapping old outlets for new in the same location — not new wire runs or boxes." });
  }
  const foundationCracksFlood = a.foundationCracksFlood ?? 0;
  if (foundationCracksFlood > 0 && r.floodFoundationCrackRepairFlat != null) {
    items.push({ cat: "Rebuild", item: `Foundation crack repair (${foundationCracksFlood}) — Labour & Supply`, cost: foundationCracksFlood * r.floodFoundationCrackRepairFlat, note: "Epoxy or polyurethane injection, per crack." });
  }

  if (a.floodHasBathroom === "Yes") {
    const bathAnswers = {
      length: a.floodBathLength ?? 5,
      width: a.floodBathWidth ?? 8,
      scope: needsDemo ? "Full renovation" : "Surface refresh",
      tubShower: "Shower",
      showerBaseType: "Custom tiled/concrete base",
      tileCoverage: "Just the shower area",
      tileType: "Standard tile",
      glassDoor: "No",
      floorTileReplace: "Yes",
      oldTileRemoval: "No",
      ceilingWork: "Paint only",
      vanityReplace: "Vanity replacement",
      vanityPlumbing: "No",
      electricalPoints: 1,
      potLights: 1,
      exhaustFan: "Replace existing",
      accessories: "Yes",
      framingNeeded: "No",
      heatedFloor: "No",
    };
    const bathResult = computeBathroom(bathAnswers, rates);
    bathResult.items.forEach((it) => items.push({ ...it, item: `Bathroom — ${it.item}` }));
  }

  flags.push("Paint and flooring beyond the cut band aren't included here — price the rest of the rebuild with the Basement estimator or Select Jobs Yourself once everything's dry.");

  items.push(...customItems("flood", list));
  return { items, flags };
}

const COMPUTE = {
  kitchen: computeKitchen,
  bathroom: computeBathroom,
  basement: computeBasement,
  fullhome: computeFullHome,
  roof: computeRoof,
  paint: computePaint,
  fence: computeFence,
  deck: computeDeck,
  interlocking: computeInterlocking,
  glass: computeGlass,
  flood: computeFlood,
};

// Shared storage isn't available in every session/sandbox. These helpers try
// shared first (so the whole team sees the same saved estimates), and fall
// back to personal storage so saving still works even when shared doesn't.
async function robustStorageSet(key, value) {
  if (!window.storage || typeof window.storage.set !== "function") {
    throw new Error("Storage isn't available in this session");
  }
  try {
    const saved = await window.storage.set(key, value, true);
    if (saved) return "shared";
  } catch (err) {
    // fall through to personal
  }
  const savedPersonal = await window.storage.set(key, value, false);
  if (!savedPersonal) throw new Error("Storage returned no result");
  return "personal";
}
async function robustStorageGet(key) {
  try {
    const r = await window.storage.get(key, true);
    if (r) return r;
  } catch (err) {
    // fall through to personal
  }
  return window.storage.get(key, false);
}
async function robustStorageList(prefix) {
  let sharedKeys = [];
  let personalKeys = [];
  try {
    const s = await window.storage.list(prefix, true);
    sharedKeys = s?.keys || [];
  } catch (err) {}
  try {
    const p = await window.storage.list(prefix, false);
    personalKeys = p?.keys || [];
  } catch (err) {}
  return [...new Set([...sharedKeys, ...personalKeys])];
}

// window.storage.list() can be unreliable in some sessions ("Unexpected
// response type"), even when get/set work fine. So we keep our own manual
// index of saved IDs under a fixed key instead of depending on list().
const ESTIMATE_INDEX_KEY = "L-index";
async function getEstimateIndex() {
  try {
    const r = await robustStorageGet(ESTIMATE_INDEX_KEY);
    if (r) return JSON.parse(r.value);
  } catch (err) {}
  return [];
}
async function addToEstimateIndex(id) {
  try {
    const idx = await getEstimateIndex();
    if (!idx.includes(id)) {
      idx.push(id);
      await robustStorageSet(ESTIMATE_INDEX_KEY, JSON.stringify(idx));
    }
  } catch (err) {
    // index is a convenience layer — a failure here shouldn't block the save itself
  }
}
async function removeFromEstimateIndex(id) {
  try {
    const idx = await getEstimateIndex();
    await robustStorageSet(ESTIMATE_INDEX_KEY, JSON.stringify(idx.filter((x) => x !== id)));
  } catch (err) {}
}

async function robustStorageDelete(key) {
  try {
    await window.storage.delete(key, true);
  } catch (err) {}
  try {
    await window.storage.delete(key, false);
  } catch (err) {}
}

// Standard drywall sheet = 4x8 ft = 32 sq ft. For a short band (height <= 4 ft),
// a sheet laid on its side covers 8 linear ft regardless of exact height (the
// leftover width is offcut, not a second sheet). For taller/full-height runs,
// sheets are figured from total area instead.
function drywallSheets(linearFeet, heightFeet) {
  if (heightFeet <= 4) return Math.ceil(linearFeet / 8);
  return Math.ceil((linearFeet * heightFeet) / 32);
}

function formatCAD(n) {
  return n.toLocaleString("en-CA", { style: "currency", currency: "CAD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* ---------------------------------------------------------------
   TIMELINE — rough day counts and phase ordering for the paid tier.
   Deliberately simple: category-level heuristics, not a real schedule.
----------------------------------------------------------------*/
const CATEGORY_DAYS = {
  "Demolition & prep": 1,
  "Framing & structure": 2,
  "Framing & drywall shell": 3,
  "Insulation": 1,
  "Drywall": 2,
  "Electrical": 1,
  "Plumbing": 1,
  "Flooring": 1,
  "Tile work": 2,
  "Painting": 1,
  "Cabinets & counters": 2,
  "Bathroom fixtures": 1,
  "Doors & windows": 1,
  "Trim & finish carpentry": 1,
  "Roofing": 2,
  "Siding & exterior": 2,
  "Foundation": 2,
  "HVAC": 1,
  "Optional add-ons": 0,
};

const PHASE_DEFS = [
  { title: "Protect & demo", cats: ["Demolition & prep"], desc: "Containment goes up, old finishes come out and get hauled away." },
  { title: "Rough-ins", cats: ["Framing & structure", "Framing & drywall shell", "Electrical", "Plumbing", "HVAC"], desc: "Framing, wiring, and pipes go in before anything gets closed up." },
  { title: "Insulate & close walls", cats: ["Insulation", "Drywall"], desc: "Insulation, drywall, taping, and sanding — ready to prime." },
  { title: "Tile & flooring", cats: ["Tile work", "Flooring"], desc: "Waterproofing where needed, then tile and finish flooring go down." },
  { title: "Cabinets & fixtures", cats: ["Cabinets & counters", "Bathroom fixtures", "Doors & windows"], desc: "Cabinets, counters, vanities, and doors — the parts that make it usable." },
  { title: "Paint & trim", cats: ["Painting", "Trim & finish carpentry"], desc: "Paint, baseboards, and casing — the finishing details." },
  { title: "Exterior & envelope", cats: ["Roofing", "Siding & exterior", "Foundation"], desc: "Anything touching the outside of the house." },
  { title: "Final walkthrough", cats: [], desc: "Punch list, cleanup, and sign-off." },
];

function estimateDays(roomType, chartData, answers) {
  if (roomType === "fullhome") {
    const sqft = answers.sqft ?? 1800;
    return Math.max(15, Math.round(sqft / 120));
  }
  let days = 0;
  chartData.forEach((c) => { days += CATEGORY_DAYS[c.name] ?? 1; });
  return Math.max(1, days);
}

function buildPhases(chartData) {
  const names = new Set(chartData.map((c) => c.name));
  return PHASE_DEFS.filter((p) => p.cats.length === 0 || p.cats.some((c) => names.has(c)));
}

/* ---------------------------------------------------------------
   AI ASSISTANT MODE — the model only ever *fills the same fields*
   the manual wizard uses. It never invents a price; it hands back
   field values that flow through the exact same COMPUTE functions.
----------------------------------------------------------------*/
function buildSystemPrompt(roomLabel, questions, answersSoFar) {
  const fieldList = questions
    .map((q) => {
      const spec = q.type === "number" ? `a number, in ${q.unit} (roughly ${q.min}-${q.max})` : `exactly one of: ${q.options.join(" | ")}`;
      const known = answersSoFar[q.id] !== undefined ? ` — ALREADY CONFIRMED: ${answersSoFar[q.id]}` : "";
      return `- "${q.id}" (${q.label}): ${spec}${known}`;
    })
    .join("\n");

  return `You are a friendly, sharp renovation estimator assistant helping a homeowner in the Niagara Region, Ontario scope a "${roomLabel}" project. Your only job is to collect confident values for the fields below, then hand them back as structured data — you never state a dollar price yourself, a separate price engine handles that.

Fields you must fill (use these exact ids and exact allowed values):
${fieldList}

How to behave:
- Ask about missing fields conversationally. You can combine a couple of related questions in one message, but keep messages short and warm — this is a chat, not a form.
- Never re-ask a field marked ALREADY CONFIRMED above.
- If the room or area is an irregular shape, help the user work it out: ask for the dimensions (in feet) of each rectangular section they can break it into, add or subtract as needed, show your arithmetic briefly, and confirm the resulting number with the user before locking it into "answers".
- For fields with a fixed option list, store only one of the exact allowed strings — never a paraphrase.
- Once every field above has a confirmed value, set "done": true and include all of them in "answers".

Reply with ONLY a JSON object, no markdown code fences, no text outside the JSON, in exactly this shape:
{"reply": "<what you say to the user next, conversational>", "done": <true only when every field has a confirmed value>, "answers": {"<field id>": <value>, ...}}`;
}

async function callEstimatorAssistant(history, systemPrompt) {
  return {
    reply: "Voice and text input are working, but I'm not connected to an AI yet on this version of the site — that needs a small secure backend to hold the API key safely. Use the form below for now, or ask about setting up that backend.",
    done: false,
    answers: {},
  };
}

/* ---------------------------------------------------------------
   UI
----------------------------------------------------------------*/
const INK = "#0F172A";
const CREAM = "#F8FBFF";
const WINE = "#2563EB";
const GREEN = "#0EA5E9";
const MIST = "#7DD3FC";
const AMBER = "#D97706";
const DISPLAY_FONT = "'Manrope', ui-sans-serif, system-ui, sans-serif";

export default function NiagaraEstimatorSite() {
  const [phase, setPhase] = useState("landing"); // landing | flow | result
  const [roomType, setRoomType] = useState(null);
  const [flowIndex, setFlowIndex] = useState(0); // 0 = municipality, 1.. = questions
  const [municipality, setMunicipality] = useState(null);
  const [answers, setAnswers] = useState({});
  const [showLead, setShowLead] = useState(false);
  const [leadSent, setLeadSent] = useState(false);
  const [email, setEmail] = useState("");
  const [leadClientName, setLeadClientName] = useState("");
  const [leadAddress, setLeadAddress] = useState("");
  const [leadProjectDesc, setLeadProjectDesc] = useState("");
  const [leadId, setLeadId] = useState(null);
  const [leadSaving, setLeadSaving] = useState(false);
  const [leadSaveError, setLeadSaveError] = useState(null);
  const [leadThread, setLeadThread] = useState([]);
  const [leadThreadInput, setLeadThreadInput] = useState("");
  const [leadThreadSending, setLeadThreadSending] = useState(false);

  const [projectsList, setProjectsList] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsDebug, setProjectsDebug] = useState(null);
  const [selectedLeadId, setSelectedLeadId] = useState(null);
  const [selectedLead, setSelectedLead] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const [showSaveEstimate, setShowSaveEstimate] = useState(false);
  const [estimateSaved, setEstimateSaved] = useState(false);
  const [savingEstimate, setSavingEstimate] = useState(false);
  const [saveEstimateError, setSaveEstimateError] = useState(null);
  const [estimateTextContent, setEstimateTextContent] = useState(null);
  const [saveClientName, setSaveClientName] = useState("");
  const [saveAddress, setSaveAddress] = useState("");
  const [saveDescription, setSaveDescription] = useState("");

  const [paid, setPaid] = useState(false);

  const [rates, setRates] = useState(DEFAULT_RATES);
  const [ratesLoaded, setRatesLoaded] = useState(false);
  const [ratesSaving, setRatesSaving] = useState(false);
  const [ratesSavedMsg, setRatesSavedMsg] = useState(false);
  const [rateDraft, setRateDraft] = useState(DEFAULT_RATES);
  const [expandedRateRooms, setExpandedRateRooms] = useState({});

  const [quickSearch, setQuickSearch] = useState("");
  const [quickCart, setQuickCart] = useState([]);
  const [extraItems, setExtraItems] = useState([]);
  const [showAddExtra, setShowAddExtra] = useState(false);
  const [extraSearch, setExtraSearch] = useState("");
  const [quickShowLead, setQuickShowLead] = useState(false);
  const [quickLeadSent, setQuickLeadSent] = useState(false);
  const [quickEmail, setQuickEmail] = useState("");
  const [quickSuggestion, setQuickSuggestion] = useState(null);

  const allJobs = useMemo(() => {
    const list = [];
    Object.entries(rates).forEach(([room, items]) => {
      (items || []).forEach((f) => list.push({ room, ...f }));
    });
    return list;
  }, [rates]);

  const quickResults = useMemo(() => {
    const q = quickSearch.trim().toLowerCase();
    if (!q) return [];
    const queryWords = q.split(/[^a-z0-9]+/).filter(Boolean);
    return allJobs
      .filter((j) => !quickCart.some((c) => c.room === j.room && c.key === j.key))
      .filter((j) => {
        const labelWords = jobLabelWords(j);
        return queryWords.every((qw) => wordMatchesAny(qw, labelWords));
      })
      .slice(0, 20);
  }, [quickSearch, allJobs, quickCart]);

  const quickSubtotal = quickCart.reduce((s, c) => s + c.value * (c.qty || 1), 0);
  const quickHst = quickSubtotal * 0.13;
  const quickTotal = quickSubtotal + quickHst;

  function addToCart(job) {
    setQuickCart((prev) => [...prev, { ...job, qty: 1 }]);
    setQuickSearch("");
    const companionKey = COMPANION_MAP[`${job.room}:${job.key}`];
    if (companionKey) {
      const companion = allJobs.find((j) => j.room === companionKey.room && j.key === companionKey.key);
      const alreadyInCart = quickCart.some((c) => c.room === companionKey.room && c.key === companionKey.key);
      if (companion && !alreadyInCart) {
        setQuickSuggestion(companion);
      } else {
        setQuickSuggestion(null);
      }
    } else {
      setQuickSuggestion(null);
    }
  }
  function acceptSuggestion() {
    if (!quickSuggestion) return;
    setQuickCart((prev) => [...prev, { ...quickSuggestion, qty: 1 }]);
    setQuickSuggestion(null);
  }
  function updateCartQty(room, key, qty) {
    setQuickCart((prev) => prev.map((c) => (c.room === room && c.key === key ? { ...c, qty } : c)));
  }
  function removeFromCart(room, key) {
    setQuickCart((prev) => prev.filter((c) => !(c.room === room && c.key === key)));
  }

  async function saveQuickLead() {
    setLeadSaving(true);
    const id = `L-${Date.now()}`;
    const lead = {
      id,
      createdAt: new Date().toISOString(),
      roomType: "quickjob",
      roomLabel: "À la carte jobs",
      total: quickTotal,
      items: quickCart.map((c) => ({ cat: ROOM_LABELS[c.room], item: c.label, cost: c.value * (c.qty || 1) })),
      email: quickEmail,
      clientName: leadClientName || "Untitled",
      address: leadAddress,
      description: leadProjectDesc,
      status: "New",
      messages: [{ from: "manager", text: "Thanks for the request — we'll follow up to schedule this in.", at: new Date().toISOString() }],
    };
    try {
      await robustStorageSet(id, JSON.stringify(lead));
      await addToEstimateIndex(id);
      setQuickLeadSent(true);
      setLeadSaveError(null);
    } catch (err) {
      setLeadSaveError(`Couldn't send — ${err && err.message ? err.message : "unknown error"}. Try again in a moment.`);
    } finally {
      setLeadSaving(false);
    }
  }
  async function saveQuickEstimateRecord() {
    if (quickCart.length === 0) return;
    setSavingEstimate(true);
    const id = `L-${Date.now()}`;
    const record = {
      id,
      createdAt: new Date().toISOString(),
      source: "manual",
      roomType: "quickjob",
      roomLabel: "À la carte jobs",
      municipality: "",
      total: quickTotal,
      days: null,
      items: quickCart.map((c) => ({ cat: ROOM_LABELS[c.room], item: c.label, cost: c.value * (c.qty || 1) })),
      phases: [],
      clientName: saveClientName || "Untitled",
      address: saveAddress,
      description: saveDescription,
      email: "",
      status: "Saved",
      messages: [],
    };
    try {
      await robustStorageSet(id, JSON.stringify(record));
      await addToEstimateIndex(id);
      setEstimateSaved(true);
      setSaveEstimateError(null);
    } catch (err) {
      setSaveEstimateError(`Couldn't save — ${err && err.message ? err.message : "unknown error"}. Try again in a moment.`);
    } finally {
      setSavingEstimate(false);
    }
  }
  const [addingToRoom, setAddingToRoom] = useState(null);
  const [newItemLabel, setNewItemLabel] = useState("");
  const [newItemUnit, setNewItemUnit] = useState("$ flat");
  const [newItemValue, setNewItemValue] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const existing = await window.storage.get("my-rates", false);
        if (existing) {
          const saved = JSON.parse(existing.value);
          setRates(saved);
          setRateDraft(saved);
        }
      } catch (err) {
        // no saved rates yet — defaults stay in place
      } finally {
        setRatesLoaded(true);
      }
    })();
  }, []);

  async function saveRates() {
    setRatesSaving(true);
    try {
      await window.storage.set("my-rates", JSON.stringify(rateDraft), false);
      setRates(rateDraft);
      setRatesSavedMsg(true);
      setTimeout(() => setRatesSavedMsg(false), 2500);
    } catch (err) {
      // keep it working locally even if persistence fails
      setRates(rateDraft);
    } finally {
      setRatesSaving(false);
    }
  }

  async function resetRates() {
    setRateDraft(DEFAULT_RATES);
    setRates(DEFAULT_RATES);
    try {
      await window.storage.set("my-rates", JSON.stringify(DEFAULT_RATES), false);
    } catch (err) {}
  }

  function updateRateValue(room, key, value) {
    setRateDraft((prev) => ({
      ...prev,
      [room]: prev[room].map((f) => (f.key === key ? { ...f, value } : f)),
    }));
  }

  function deleteRateItem(room, key) {
    setRateDraft((prev) => ({
      ...prev,
      [room]: prev[room].filter((f) => f.key !== key),
    }));
  }

  function addRateItem(room, label, unit, value) {
    if (!label.trim()) return;
    const key = `custom_${Date.now()}`;
    setRateDraft((prev) => ({
      ...prev,
      [room]: [...prev[room], { key, label: label.trim(), unit: unit.trim() || "$ flat", value }],
    }));
  }

  const [chatMessages, setChatMessages] = useState([]); // {role:'user'|'assistant', content:string}
  const [chatInput, setChatInput] = useState("");
  const [listening, setListening] = useState(false);
  const [micSupported, setMicSupported] = useState(true);
  const [micError, setMicError] = useState(null);
  const recognitionRef = useRef(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState(null);
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, chatLoading]);

  useEffect(() => {
    const SR = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SR) {
      setMicSupported(false);
      return;
    }
    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (e) => {
      let transcript = "";
      for (let i = 0; i < e.results.length; i++) transcript += e.results[i][0].transcript;
      setChatInput(transcript);
    };
    recognition.onerror = (e) => {
      setMicError(
        e.error === "not-allowed" || e.error === "service-not-allowed"
          ? "Microphone access was blocked — check your browser's site permissions."
          : "Couldn't catch that. Try again or type instead."
      );
      setListening(false);
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    return () => {
      try {
        recognition.stop();
      } catch (err) {}
    };
  }, []);

  function toggleMic() {
    if (!micSupported || !recognitionRef.current || chatLoading) return;
    if (listening) {
      recognitionRef.current.stop();
      setListening(false);
    } else {
      setMicError(null);
      setChatInput("");
      try {
        recognitionRef.current.start();
        setListening(true);
      } catch (err) {
        setMicError("Couldn't start the microphone.");
      }
    }
  }

  const questions = roomType ? QUESTIONS[roomType].filter((q) => !q.visibleIf || q.visibleIf(answers)) : [];
  const steps = ["municipality", ...questions.map((q) => q.id)];
  const currentStepId = steps[flowIndex];

  const [voiceOn, setVoiceOn] = useState(true);
  const [voiceSupported, setVoiceSupported] = useState(true);

  const currentQuestionText = useMemo(() => {
    if (currentStepId === "municipality") return "Which municipality?";
    const q = questions.find((qq) => qq.id === currentStepId);
    return q ? q.label : "";
  }, [currentStepId, questions]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      setVoiceSupported(false);
      return;
    }
    if (phase !== "flow" || !voiceOn || !currentQuestionText) {
      window.speechSynthesis.cancel();
      return;
    }
    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(currentQuestionText);
      utter.rate = 1;
      utter.lang = "en-US";
      window.speechSynthesis.speak(utter);
    } catch (err) {
      setVoiceSupported(false);
    }
    return () => window.speechSynthesis && window.speechSynthesis.cancel();
  }, [phase, currentStepId, voiceOn]);

  const result = useMemo(() => {
    if (phase !== "result" || !roomType || !municipality) return null;
    const muni = MUNICIPALITIES.find((m) => m.id === municipality);
    const { items: computedItems, flags } = COMPUTE[roomType](answers, rates);
    const extraAsItems = extraItems.map((f) => ({ cat: "Added extra", item: `${f.label} — Labour & Supply`, cost: f.value * (f.qty || 1), note: "Added manually to this estimate." }));
    const items = [...computedItems, ...extraAsItems];
    const adjusted = items.map((it) => ({
      ...it,
      cost: it.cost * muni.mult,
    }));
    const byCategory = {};
    adjusted.forEach((it) => {
      if (!byCategory[it.cat]) byCategory[it.cat] = 0;
      byCategory[it.cat] += it.cost;
    });
    const chartData = Object.entries(byCategory)
      .map(([name, cost]) => ({ name, cost: Math.round(cost) }))
      .sort((a, b) => b.cost - a.cost);
    const subtotal = adjusted.reduce((s, it) => s + it.cost, 0);
    const hst = subtotal * 0.13;
    const total = subtotal + hst;
    const days = estimateDays(roomType, chartData, answers);
    const phases = buildPhases(chartData);
    const materialsMap = {};
    items.forEach((it) => {
      if (it.buys) {
        const key = it.buys.name;
        if (!materialsMap[key]) materialsMap[key] = { name: key, low: 0, high: 0 };
        materialsMap[key].low += it.buys.low;
        materialsMap[key].high += it.buys.high;
      }
    });
    const materialsToBuy = Object.values(materialsMap);
    const materialsLow = materialsToBuy.reduce((s, m) => s + m.low, 0);
    const materialsHigh = materialsToBuy.reduce((s, m) => s + m.high, 0);
    const materialsLowWithHst = materialsLow * 1.13;
    const materialsHighWithHst = materialsHigh * 1.13;
    const sheetsMap = {};
    items.forEach((it) => {
      if (it.sheets) {
        const key = it.sheets.type;
        sheetsMap[key] = (sheetsMap[key] || 0) + it.sheets.count;
      }
    });
    const sheetsNeeded = Object.entries(sheetsMap).map(([type, count]) => ({ type, count }));
    return { items: adjusted, flags, muni, chartData, subtotal, hst, total, days, phases, materialsToBuy, materialsLow, materialsHigh, materialsLowWithHst, materialsHighWithHst, sheetsNeeded };
  }, [phase, roomType, municipality, answers, rates, extraItems]);

  function startFlow(type) {
    setRoomType(type);
    setAnswers({});
    setMunicipality(null);
    setFlowIndex(0);
    setPhase("flow");
  }

  function goNext() {
    if (flowIndex + 1 >= steps.length) {
      setPhase("result");
    } else if (currentStepId === "municipality") {
      // right after the global municipality question, let the person choose how to answer the rest
      setFlowIndex(flowIndex + 1);
      setPhase("choose_mode");
    } else {
      setFlowIndex(flowIndex + 1);
    }
  }
  function goBack() {
    if (flowIndex === 0) {
      setPhase("landing");
      setRoomType(null);
    } else {
      setFlowIndex(flowIndex - 1);
    }
  }

  function startChatMode() {
    setChatError(null);
    const roomLabel = ROOM_TYPES.find((r) => r.id === roomType)?.label || "project";
    setChatMessages([
      { role: "assistant", content: `Let's do this as a quick chat instead. Tell me about your ${roomLabel.toLowerCase()} — size or shape, and anything you already know you want.` },
    ]);
    setPhase("chat");
  }

  async function sendChatMessage() {
    const text = chatInput.trim();
    if (!text || chatLoading) return;
    const history = [...chatMessages, { role: "user", content: text }];
    setChatMessages(history);
    setChatInput("");
    setChatLoading(true);
    setChatError(null);
    try {
      const systemPrompt = buildSystemPrompt(
        ROOM_TYPES.find((r) => r.id === roomType)?.label || "project",
        questions,
        answers
      );
      const parsed = await callEstimatorAssistant(history, systemPrompt);
      if (parsed.answers) setAnswers((prev) => ({ ...prev, ...parsed.answers }));
      setChatMessages((prev) => [...prev, { role: "assistant", content: parsed.reply || "Got it." }]);
      if (parsed.done) {
        setTimeout(() => setPhase("result"), 500);
      }
    } catch (err) {
      setChatError("The assistant hit a snag reading that. You can try rephrasing, or switch to the manual form below.");
    } finally {
      setChatLoading(false);
    }
  }

  function canAdvance() {
    if (currentStepId === "municipality") return !!municipality;
    const q = questions.find((q) => q.id === currentStepId);
    return q.type === "number" ? true : !!answers[q.id];
  }

  /* -------------------------------------------------------------
     LEAD → PROJECT PERSISTENCE
     Stored via window.storage (shared: true) so the same record can
     later show up as a project if it converts. Shared storage means
     anyone with access to this artifact can see these records —
     fine for a working demo, not for real client data.
  ------------------------------------------------------------- */
  function buildEstimateText(items, subtotal, hst, total, label) {
    return [
      `${label} — estimate`,
      new Date().toLocaleString(),
      "",
      ...items.filter((it) => !it.hideFromBreakdown).map((it) => `${it.item}: ${formatCAD(it.cost)}`),
      "",
      `Subtotal: ${formatCAD(subtotal)}`,
      `HST (13%): ${formatCAD(hst)}`,
      `Total: ${formatCAD(total)}`,
    ].join("\n");
  }

  function showEstimateAsText(items, subtotal, hst, total, label) {
    setEstimateTextContent(buildEstimateText(items, subtotal, hst, total, label));
  }

  async function saveEstimateRecord() {
    if (!result) return;
    setSavingEstimate(true);
    const id = `L-${Date.now()}`;
    const record = {
      id,
      createdAt: new Date().toISOString(),
      source: "manual",
      roomType,
      roomTypeId: roomType,
      municipalityId: municipality,
      answers,
      roomLabel: ROOM_TYPES.find((r) => r.id === roomType)?.label || roomType,
      municipality: result.muni.label,
      total: result.total,
      days: result.days,
      items: result.items,
      phases: result.phases,
      clientName: saveClientName || "Untitled",
      address: saveAddress,
      description: saveDescription,
      email: "",
      status: "Saved",
      messages: [],
    };
    try {
      await robustStorageSet(id, JSON.stringify(record));
      await addToEstimateIndex(id);
      setEstimateSaved(true);
      setSaveEstimateError(null);
    } catch (err) {
      setSaveEstimateError(`Couldn't save — ${err && err.message ? err.message : "unknown error"}. Try again in a moment.`);
    } finally {
      setSavingEstimate(false);
    }
  }
  async function saveLead() {
    if (!result) return;
    setLeadSaving(true);
    const id = `L-${Date.now()}`;
    const initialMessage = {
      from: "manager",
      text: "Thanks for the estimate request — we'll be in touch shortly to schedule an on-site visit.",
      at: new Date().toISOString(),
    };
    const lead = {
      id,
      createdAt: new Date().toISOString(),
      roomType,
      roomTypeId: roomType,
      municipalityId: municipality,
      answers,
      roomLabel: ROOM_TYPES.find((r) => r.id === roomType)?.label || roomType,
      municipality: result.muni.label,
      total: result.total,
      days: result.days,
      items: result.items,
      phases: result.phases,
      email,
      clientName: leadClientName || "Untitled",
      address: leadAddress,
      description: leadProjectDesc,
      status: "New",
      messages: [initialMessage],
    };
    try {
      await robustStorageSet(id, JSON.stringify(lead));
      await addToEstimateIndex(id);
      setLeadId(id);
      setLeadThread([initialMessage]);
      setLeadSent(true);
      setLeadSaveError(null);
    } catch (err) {
      setLeadSaveError(`Couldn't send — ${err && err.message ? err.message : "unknown error"}. Try again in a moment.`);
    } finally {
      setLeadSaving(false);
    }
  }

  async function sendThreadMessage() {
    const text = leadThreadInput.trim();
    if (!text || !leadId || leadThreadSending) return;
    setLeadThreadSending(true);
    const msg = { from: "client", text, at: new Date().toISOString() };
    const updated = [...leadThread, msg];
    setLeadThread(updated);
    setLeadThreadInput("");
    try {
      const existing = await robustStorageGet(leadId);
      const lead = existing ? JSON.parse(existing.value) : null;
      if (lead) {
        lead.messages = updated;
        await robustStorageSet(leadId, JSON.stringify(lead));
      }
    } catch (err) {
      // keep the local thread even if the write failed
    } finally {
      setLeadThreadSending(false);
    }
  }

  async function loadProjects() {
    setProjectsLoading(true);
    const debug = { indexKeys: 0, sharedKeys: 0, personalKeys: 0, totalKeys: 0, parsed: 0, parseFailed: 0, error: null };
    try {
      const indexKeys = await getEstimateIndex();
      debug.indexKeys = indexKeys.length;

      let sharedList = null, personalList = null, sharedErr = null, personalErr = null;
      try {
        sharedList = await window.storage.list("L-", true);
      } catch (err) {
        sharedErr = err && err.message ? err.message : String(err);
      }
      try {
        personalList = await window.storage.list("L-", false);
      } catch (err) {
        personalErr = err && err.message ? err.message : String(err);
      }
      debug.sharedKeys = sharedList?.keys?.length ?? 0;
      debug.personalKeys = personalList?.keys?.length ?? 0;
      debug.sharedError = sharedErr;
      debug.personalError = personalErr;
      // Combine our manual index with whatever list() manages to return —
      // list() has been unreliable in some sessions, the index is the source of truth.
      const keys = [...new Set([...indexKeys, ...(sharedList?.keys || []), ...(personalList?.keys || [])])];
      debug.totalKeys = keys.length;
      const records = await Promise.all(
        keys.map(async (k) => {
          try {
            const r = await robustStorageGet(k);
            if (!r) {
              debug.parseFailed++;
              return null;
            }
            debug.parsed++;
            return JSON.parse(r.value);
          } catch {
            debug.parseFailed++;
            return null;
          }
        })
      );
      const clean = records.filter(Boolean).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setProjectsList(clean);
      setProjectsDebug(debug);
    } catch (err) {
      debug.error = err && err.message ? err.message : String(err);
      setProjectsList([]);
      setProjectsDebug(debug);
    } finally {
      setProjectsLoading(false);
    }
  }

  async function updateLeadStatus(id, status) {
    try {
      const existing = await robustStorageGet(id);
      if (!existing) return;
      const lead = JSON.parse(existing.value);
      lead.status = status;
      await robustStorageSet(id, JSON.stringify(lead));
      await addToEstimateIndex(id);
      setProjectsList((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
      if (selectedLead && selectedLead.id === id) setSelectedLead({ ...selectedLead, status });
    } catch (err) {
      // no-op — demo storage may be unavailable
    }
  }

  async function openLeadDetail(id) {
    setSelectedLeadId(id);
    try {
      const existing = await robustStorageGet(id);
      setSelectedLead(existing ? JSON.parse(existing.value) : null);
    } catch (err) {
      setSelectedLead(projectsList.find((p) => p.id === id) || null);
    }
  }

  function editSavedEstimate(record) {
    if (!record.roomTypeId || !record.municipalityId || !record.answers) return;
    setRoomType(record.roomTypeId);
    setMunicipality(record.municipalityId);
    setAnswers(record.answers);
    setPaid(true); // they're already on-site adjusting a sold job — show full detail immediately
    const roomQuestions = QUESTIONS[record.roomTypeId] || [];
    const visibleQuestions = roomQuestions.filter((q) => !q.visibleIf || q.visibleIf(record.answers));
    const stepCount = 1 + visibleQuestions.length; // municipality + questions
    setFlowIndex(Math.max(0, stepCount - 1));
    setSelectedLead(null);
    setSelectedLeadId(null);
    setPhase("flow");
  }

  async function deleteEstimate(id) {
    try {
      await robustStorageDelete(id);
    } catch (err) {
      // key may already be gone — still clean up the local view
    }
    await removeFromEstimateIndex(id);
    setProjectsList((prev) => prev.filter((p) => p.id !== id));
    if (selectedLeadId === id) {
      setSelectedLead(null);
      setSelectedLeadId(null);
    }
  }

  function resetAll() {
    setPhase("landing");
    setRoomType(null);
    setMunicipality(null);
    setAnswers({});
    setShowLead(false);
    setLeadSent(false);
    setLeadClientName("");
    setLeadAddress("");
    setLeadProjectDesc("");
    setLeadSaveError(null);
    setFlowIndex(0);
    setChatMessages([]);
    setChatInput("");
    setChatError(null);
    setPaid(false);
    setQuickCart([]);
    setQuickSearch("");
    setQuickShowLead(false);
    setQuickLeadSent(false);
    setQuickEmail("");
    setQuickSuggestion(null);
    setShowSaveEstimate(false);
    setEstimateSaved(false);
    setSaveEstimateError(null);
    setEstimateTextContent(null);
    setExtraItems([]);
    setShowAddExtra(false);
    setExtraSearch("");
    setSaveClientName("");
    setSaveAddress("");
    setSaveDescription("");
  }

  return (
    <div
      className="min-h-screen relative overflow-hidden"
      style={{
        background: `linear-gradient(180deg, #E0F2FE 0%, ${CREAM} 45%, #FFFFFF 100%)`,
        color: INK,
        fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Manrope:wght@700;800&display=swap');
        @keyframes drift-a { 0%,100% { transform: translate(0,0); } 50% { transform: translate(26px,-16px); } }
        @keyframes drift-b { 0%,100% { transform: translate(0,0); } 50% { transform: translate(-32px,12px); } }
        @keyframes drift-c { 0%,100% { transform: translate(0,0); } 50% { transform: translate(20px,18px); } }
        .cloud-a { animation: drift-a 26s ease-in-out infinite; }
        .cloud-b { animation: drift-b 34s ease-in-out infinite; }
        .cloud-c { animation: drift-c 22s ease-in-out infinite; }
        @media print {
          .no-print { display: none !important; }
        }
      `}</style>

      {/* decorative sky band — bounded to the top of the page, sits behind the nav/hero, never overlaps content further down */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 400, overflow: "hidden", pointerEvents: "none", zIndex: -1 }} aria-hidden="true">
        <div className="cloud-a" style={{ position: "absolute", top: 30, left: "6%", width: 170, height: 66, background: "white", opacity: 0.8, borderRadius: 999, filter: "blur(18px)" }} />
        <div className="cloud-b" style={{ position: "absolute", top: 70, right: "8%", width: 210, height: 78, background: "white", opacity: 0.7, borderRadius: 999, filter: "blur(22px)" }} />
        <div className="cloud-c" style={{ position: "absolute", top: 10, left: "42%", width: 130, height: 52, background: "white", opacity: 0.65, borderRadius: 999, filter: "blur(16px)" }} />
        <svg viewBox="0 0 1200 260" preserveAspectRatio="xMidYMax slice" style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: 230 }}>
          <defs>
            <linearGradient id="skylineFade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={MIST} stopOpacity="0" />
              <stop offset="100%" stopColor={MIST} stopOpacity="0.35" />
            </linearGradient>
          </defs>
          <g fill="url(#skylineFade)">
            <rect x="0" y="140" width="90" height="120" />
            <rect x="100" y="90" width="70" height="170" />
            <rect x="180" y="150" width="110" height="110" />
            <rect x="310" y="60" width="60" height="200" />
            <rect x="380" y="170" width="140" height="90" />
            <rect x="540" y="40" width="80" height="220" />
            <rect x="630" y="120" width="100" height="140" />
            <rect x="740" y="95" width="65" height="165" />
            <rect x="815" y="155" width="130" height="105" />
            <rect x="960" y="70" width="75" height="190" />
            <rect x="1045" y="130" width="155" height="130" />
            <rect x="590" y="10" width="6" height="34" />
            <rect x="337" y="28" width="6" height="34" />
          </g>
        </svg>
      </div>

      <div className="relative" style={{ zIndex: 1 }}>
      {/* Nav */}
      <div className="max-w-4xl mx-auto px-6 pt-5 flex items-center justify-between">
        <button onClick={resetAll} className="flex items-center gap-2 text-2xl" style={{ fontFamily: DISPLAY_FONT, fontWeight: 800 }}>
          <MapPin size={24} style={{ color: WINE }} />
          Niagara Reno Estimator
        </button>
        {phase === "landing" && (
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <button
              onClick={() => setPhase("my_rates")}
              className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full border transition-colors bg-white hover:bg-[#EFF6FF]"
              style={{ borderColor: "#DCEAFB", color: GREEN }}
            >
              <Settings size={14} /> My Prices
            </button>
            <button
              onClick={() => {
                setPhase("saved_estimates");
                loadProjects();
              }}
              className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full border transition-colors bg-white hover:bg-[#EFF6FF]"
              style={{ borderColor: "#DCEAFB", color: INK }}
            >
              <Briefcase size={14} /> Saved Estimates
            </button>
          </div>
        )}
        {phase !== "landing" && (
          <span className="text-xs uppercase tracking-wide" style={{ color: "#64748B" }}>
            {phase === "flow" && `Step ${flowIndex + 1} of ${steps.length}`}
            {phase === "choose_mode" && "Almost there"}
            {phase === "chat" && "Chatting"}
            {phase === "result" && "Estimate"}
            {phase === "quickjob" && "Select jobs"}
            {phase === "my_rates" && "My Prices"}
            {phase === "saved_estimates" && "Saved Estimates"}
          </span>
        )}
      </div>

      {/* progress bar */}
      {(phase === "flow" || phase === "choose_mode" || phase === "chat") && (
        <div className="max-w-4xl mx-auto px-6 mt-4">
          <div className="h-1.5 rounded-full bg-white overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${((flowIndex + 1) / steps.length) * 100}%`, backgroundColor: WINE }}
            />
          </div>
          {phase === "flow" && voiceSupported && (
            <button
              onClick={() => setVoiceOn((v) => !v)}
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium"
              style={{ color: voiceOn ? WINE : "#64748B" }}
            >
              {voiceOn ? <Volume2 size={14} /> : <VolumeX size={14} />}
              {voiceOn ? "Questions read aloud" : "Voice off"}
            </button>
          )}
        </div>
      )}

      <div className="max-w-4xl mx-auto px-6 pb-24">
        {/* ---------------- LANDING ---------------- */}
        {phase === "landing" && (
          <div>
            <div className="pt-8 pb-5">
              <p className="text-xl sm:text-2xl font-semibold whitespace-nowrap" style={{ fontFamily: DISPLAY_FONT, color: INK }}>
                Pick a project, get a real price.
              </p>
              <p className="mt-2 max-w-md text-sm font-medium" style={{ color: WINE }}>
                Current Niagara Region pricing — our team is ready to do the work at the price you see here.
              </p>
            </div>

            <div className="flex justify-center">
              <button
                onClick={() => setPhase("quickjob")}
                className="relative text-left rounded-lg overflow-hidden border-2 transition-transform hover:scale-[1.02] w-full sm:w-1/3"
                style={{ borderColor: "#DCEAFB", height: 132 }}
              >
                <div
                  className="absolute inset-0"
                  style={{ background: `linear-gradient(135deg, #0F172A 0%, #334155 100%)` }}
                />
                <Wrench size={92} strokeWidth={1.25} className="absolute -right-3 -bottom-3 opacity-25" style={{ color: "#FFFFFF" }} />
                <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(0,0,0,0) 30%, rgba(0,0,0,0.55) 100%)" }} />
                <div className="relative h-full flex flex-col justify-end p-3">
                  <p className="font-semibold text-white leading-tight text-lg">Select jobs yourself</p>
                  <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.85)" }}>Search and stack up any jobs — build your own price.</p>
                </div>
              </button>
            </div>

            <p className="text-sm font-semibold mt-6 mb-4" style={{ color: "#475569" }}>What are you renovating?</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {ROOM_TYPES.map((t, i) => {
                const [c1, c2] = t.accent || [WINE, INK];
                const illustration = ROOM_ILLUSTRATIONS[t.id];
                return (
                  <button
                    key={t.id}
                    onClick={() => startFlow(t.id)}
                    className="relative text-left rounded-lg overflow-hidden border-2 transition-transform hover:scale-[1.02]"
                    style={{ borderColor: "#DCEAFB", height: 132 }}
                  >
                    <div
                      className="absolute inset-0"
                      style={{ background: `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)` }}
                    />
                    {illustration && (
                      <div className="absolute inset-0 flex items-center justify-center opacity-40 px-6 pb-6 pt-2">
                        {illustration}
                      </div>
                    )}
                    <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(0,0,0,0) 30%, rgba(0,0,0,0.55) 100%)" }} />
                    <div className="relative h-full flex flex-col justify-end p-3">
                      <p className="font-semibold text-white leading-tight text-lg">{t.label}</p>
                      <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.85)" }}>{t.blurb}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ---------------- QUICK JOB (search & price individual jobs) ---------------- */}
        {phase === "quickjob" && (
          <div className="pt-8">
            <button onClick={() => setPhase("landing")} className="inline-flex items-center gap-1 text-sm mb-4" style={{ color: "#475569" }}>
              <ChevronLeft size={16} /> Back
            </button>
            <h1 className="text-3xl sm:text-4xl leading-tight" style={{ fontFamily: DISPLAY_FONT, fontWeight: 800, letterSpacing: "-0.02em" }}>
              Select jobs yourself
            </h1>
            <p className="mt-3 max-w-lg text-sm" style={{ color: "#475569" }}>
              Search and add any job — framing, drywall, a door, a toilet — set the quantity, and stack up as many as you need to build your own estimate.
            </p>

            <div className="mt-5 flex items-center gap-2 bg-white rounded-lg border shadow-lg px-3 py-2.5" style={{ borderColor: "#DCEAFB" }}>
              <Search size={16} style={{ color: "#64748B" }} />
              <input
                type="text"
                value={quickSearch}
                onChange={(e) => setQuickSearch(e.target.value)}
                placeholder="Search a job — e.g. door, toilet, framing…"
                className="flex-1 text-sm focus:outline-none"
              />
            </div>

            {quickResults.length > 0 && (
              <div className="mt-2 bg-white rounded-xl border shadow-lg overflow-hidden" style={{ borderColor: "#DCEAFB" }}>
                {quickResults.map((j) => (
                  <button
                    key={`${j.room}-${j.key}`}
                    onClick={() => addToCart(j)}
                    className="w-full flex items-center justify-between px-4 py-3 border-t text-left hover:bg-[#EFF6FF] transition-colors"
                    style={{ borderColor: "#E6F0FC" }}
                  >
                    <span>
                      <span className="text-sm">{j.label}</span>
                      <span className="text-xs ml-2" style={{ color: "#64748B" }}>{ROOM_LABELS[j.room]} · {j.unit}</span>
                    </span>
                    <span className="inline-flex items-center gap-1 text-sm font-medium" style={{ color: WINE }}>
                      <Plus size={14} /> {formatCAD(j.value)}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {quickCart.length > 0 ? (
              <div className="mt-6 bg-white rounded-xl border shadow-lg overflow-hidden" style={{ borderColor: "#DCEAFB" }}>
                <p className="font-medium text-sm p-5 pb-0 flex items-center gap-2"><ShoppingCart size={16} /> Selected jobs</p>
                <div className="mt-3">
                  {quickCart.map((c) => (
                    <div key={`${c.room}-${c.key}`} className="flex items-center justify-between gap-3 px-5 py-3 border-t" style={{ borderColor: "#E6F0FC" }}>
                      <div className="flex-1">
                        <p className="text-sm">{c.label}</p>
                        <p className="text-xs" style={{ color: "#64748B" }}>{ROOM_LABELS[c.room]} · {formatCAD(c.value)} {c.unit}</p>
                      </div>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        value={c.qty === 0 ? "" : c.qty}
                        onChange={(e) => updateCartQty(c.room, c.key, e.target.value === "" ? 0 : Number(e.target.value))}
                        className="w-20 border rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2"
                        style={{ borderColor: "#DCEAFB" }}
                      />
                      <span className="text-sm font-medium w-24 text-right">{formatCAD(c.value * (c.qty || 0))}</span>
                      <button onClick={() => removeFromCart(c.room, c.key)} className="p-1.5 rounded-lg hover:bg-[#FFF7ED]" style={{ color: AMBER }}>
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="border-t" style={{ borderColor: "#E6F0FC" }}>
                  <div className="flex items-center justify-between px-5 py-2.5 text-sm">
                    <span style={{ color: "#475569" }}>Subtotal</span>
                    <span className="font-medium">{formatCAD(quickSubtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between px-5 py-2.5 text-sm border-t" style={{ borderColor: "#E6F0FC" }}>
                    <span style={{ color: "#475569" }}>HST (13%)</span>
                    <span className="font-medium">{formatCAD(quickHst)}</span>
                  </div>
                  <div className="flex items-center justify-between px-5 py-3.5 border-t" style={{ borderColor: "#E6F0FC", backgroundColor: "#EFF6FF" }}>
                    <span className="font-medium">Total</span>
                    <span className="text-xl" style={{ fontFamily: DISPLAY_FONT, fontWeight: 800 }}>{formatCAD(quickTotal)}</span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="mt-8 text-sm text-center" style={{ color: "#64748B" }}>Search above and add jobs to build a price.</p>
            )}

            {quickSuggestion && (
              <div className="mt-3 flex items-center justify-between gap-3 bg-white border rounded-xl p-4 shadow-lg" style={{ borderColor: "#DCEAFB" }}>
                <div className="min-w-0">
                  <p className="text-sm font-medium">Usually needed together</p>
                  <p className="text-xs truncate" style={{ color: "#64748B" }}>
                    {quickSuggestion.label} — {formatCAD(quickSuggestion.value)} {quickSuggestion.unit}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={acceptSuggestion} className="inline-flex items-center gap-1 text-white px-3 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: WINE }}>
                    <Plus size={14} /> Add
                  </button>
                  <button onClick={() => setQuickSuggestion(null)} className="p-2 rounded-lg" style={{ color: "#64748B" }}>
                    <X size={14} />
                  </button>
                </div>
              </div>
            )}

            {quickCart.length > 0 && !estimateSaved && (
              <div className="mt-4 bg-white rounded-xl border shadow-lg p-4" style={{ borderColor: "#DCEAFB" }}>
                {!showSaveEstimate ? (
                  <button
                    onClick={() => setShowSaveEstimate(true)}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium border-2 transition-colors hover:bg-[#EFF6FF]"
                    style={{ borderColor: "#DCEAFB", color: WINE }}
                  >
                    <Save size={16} /> Save this estimate
                  </button>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Save this estimate</p>
                    <input
                      type="text"
                      placeholder="Client name"
                      value={saveClientName}
                      onChange={(e) => setSaveClientName(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
                      style={{ borderColor: "#DCEAFB" }}
                    />
                    <input
                      type="text"
                      placeholder="Address"
                      value={saveAddress}
                      onChange={(e) => setSaveAddress(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
                      style={{ borderColor: "#DCEAFB" }}
                    />
                    <textarea
                      placeholder="Short project description"
                      value={saveDescription}
                      onChange={(e) => setSaveDescription(e.target.value)}
                      rows={2}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 resize-none"
                      style={{ borderColor: "#DCEAFB" }}
                    />
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={saveQuickEstimateRecord}
                        disabled={savingEstimate}
                        className="flex-1 inline-flex items-center justify-center gap-2 text-white px-4 py-2.5 rounded-lg text-sm font-medium disabled:opacity-60"
                        style={{ backgroundColor: WINE }}
                      >
                        {savingEstimate ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        Save
                      </button>
                      <button onClick={() => setShowSaveEstimate(false)} className="px-4 py-2.5 rounded-lg text-sm font-medium" style={{ color: "#475569" }}>
                        Cancel
                      </button>
                    </div>
                    {saveEstimateError && (
                      <p className="text-xs flex items-center gap-1.5" style={{ color: AMBER }}>
                        <AlertTriangle size={13} /> {saveEstimateError}
                      </p>
                    )}
                    <button
                      onClick={() => showEstimateAsText(quickCart.map((c) => ({ item: c.label, cost: c.value * (c.qty || 1) })), quickSubtotal, quickHst, quickTotal, "Select jobs yourself")}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-medium border transition-colors hover:bg-[#EFF6FF]"
                      style={{ borderColor: "#DCEAFB", color: "#475569" }}
                    >
                      <RefreshCw size={13} />
                      View as text to copy manually
                    </button>
                  </div>
                )}
              </div>
            )}
            {estimateSaved && (
              <div className="mt-4 border rounded-xl p-4 text-sm flex items-center gap-2" style={{ backgroundColor: "#0EA5E91A", borderColor: "#0EA5E966" }}>
                <CheckCircle2 size={16} style={{ color: GREEN }} />
                <span>Saved{saveClientName ? ` — ${saveClientName}` : ""}. Find it under "Saved Estimates" on the home screen.</span>
              </div>
            )}

            {quickCart.length > 0 && !quickShowLead && !quickLeadSent && (
              <button
                onClick={() => setQuickShowLead(true)}
                className="mt-6 w-full text-white px-6 py-3.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                style={{ backgroundColor: WINE }}
              >
                <Phone size={16} /> Talk to a manager about these jobs
              </button>
            )}
            {quickShowLead && !quickLeadSent && (
              <div className="mt-6 bg-white border rounded-xl p-5 shadow-lg space-y-2" style={{ borderColor: "#DCEAFB" }}>
                <p className="font-medium text-sm mb-1">Where should we follow up?</p>
                <input
                  type="text"
                  placeholder="Your name"
                  value={leadClientName}
                  onChange={(e) => setLeadClientName(e.target.value)}
                  className="w-full border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2"
                  style={{ borderColor: "#DCEAFB" }}
                />
                <input
                  type="text"
                  placeholder="Project address"
                  value={leadAddress}
                  onChange={(e) => setLeadAddress(e.target.value)}
                  className="w-full border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2"
                  style={{ borderColor: "#DCEAFB" }}
                />
                <textarea
                  placeholder="Anything else we should know? (optional)"
                  value={leadProjectDesc}
                  onChange={(e) => setLeadProjectDesc(e.target.value)}
                  rows={2}
                  className="w-full border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 resize-none"
                  style={{ borderColor: "#DCEAFB" }}
                />
                <input
                  type="email"
                  placeholder="you@email.com"
                  value={quickEmail}
                  onChange={(e) => setQuickEmail(e.target.value)}
                  className="w-full border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2"
                  style={{ borderColor: "#DCEAFB" }}
                />
                <button
                  disabled={!quickEmail.includes("@") || leadSaving}
                  onClick={saveQuickLead}
                  className="w-full inline-flex items-center justify-center gap-2 text-white px-5 py-2.5 rounded-lg text-sm font-medium disabled:opacity-30 transition-colors"
                  style={{ backgroundColor: INK }}
                >
                  {leadSaving ? <Loader2 size={14} className="animate-spin" /> : null}
                  Send it
                </button>
                {leadSaveError && (
                  <p className="text-xs flex items-center gap-1.5" style={{ color: AMBER }}>
                    <AlertTriangle size={13} /> {leadSaveError}
                  </p>
                )}
              </div>
            )}
            {quickLeadSent && (
              <div className="mt-6 border rounded-xl p-5 text-sm flex items-start gap-2" style={{ backgroundColor: "#0EA5E91A", borderColor: "#0EA5E966" }}>
                <CheckCircle2 size={16} style={{ color: GREEN }} className="shrink-0 mt-0.5" />
                <span>A manager will follow up at {quickEmail} to schedule this in.</span>
              </div>
            )}
          </div>
        )}

        {/* ---------------- SAVED ESTIMATES ---------------- */}
        {phase === "saved_estimates" && (
          <div className="pt-8">
            {selectedLead ? (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <button onClick={() => { setSelectedLead(null); setSelectedLeadId(null); setConfirmDeleteId(null); }} className="inline-flex items-center gap-1 text-sm" style={{ color: "#475569" }}>
                    <ChevronLeft size={16} /> Back to list
                  </button>
                  {confirmDeleteId === selectedLead.id ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { deleteEstimate(selectedLead.id); setConfirmDeleteId(null); }}
                        className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full text-white"
                        style={{ backgroundColor: AMBER }}
                      >
                        <Trash2 size={14} /> Confirm delete
                      </button>
                      <button onClick={() => setConfirmDeleteId(null)} className="text-sm" style={{ color: "#475569" }}>
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(selectedLead.id)}
                      className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full border transition-colors hover:bg-[#FFF7ED]"
                      style={{ borderColor: "#FDBA74", color: AMBER }}
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                  )}
                </div>
                <h1 className="text-2xl leading-tight" style={{ fontFamily: DISPLAY_FONT, fontWeight: 800 }}>
                  {selectedLead.clientName || "Untitled"}
                </h1>
                {selectedLead.answers && selectedLead.roomTypeId && (
                  <button
                    onClick={() => editSavedEstimate(selectedLead)}
                    className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full border transition-colors hover:bg-[#EFF6FF]"
                    style={{ borderColor: "#DCEAFB", color: WINE }}
                  >
                    <RotateCcw size={14} /> Edit this estimate
                  </button>
                )}
                <p className="text-sm mt-1" style={{ color: "#64748B" }}>{selectedLead.address}</p>
                <p className="text-sm mt-2" style={{ color: "#475569" }}>{selectedLead.description}</p>
                <div className="mt-4 bg-white rounded-xl border shadow-lg p-5" style={{ borderColor: "#DCEAFB" }}>
                  <p className="text-xs uppercase tracking-wide" style={{ color: "#64748B" }}>
                    {selectedLead.roomLabel} · {selectedLead.municipality} · {new Date(selectedLead.createdAt).toLocaleDateString()}
                  </p>
                  <p className="text-3xl mt-1" style={{ fontFamily: DISPLAY_FONT, fontWeight: 800 }}>{formatCAD(selectedLead.total)}</p>
                  <p className="text-xs mt-1" style={{ color: "#64748B" }}>~{selectedLead.days} working days</p>
                </div>
                <div className="mt-4 bg-white rounded-xl border shadow-lg overflow-hidden" style={{ borderColor: "#DCEAFB" }}>
                  <p className="font-medium text-sm p-5 pb-0">Line items</p>
                  <table className="w-full text-sm mt-3">
                    <tbody>
                      {(selectedLead.items || []).map((it, i) => (
                        <tr key={i} className="border-t" style={{ borderColor: "#E6F0FC" }}>
                          <td className="py-2.5 px-5" style={{ color: "#475569" }}>{it.item}</td>
                          <td className="py-2.5 px-5 text-right font-medium whitespace-nowrap">{formatCAD(it.cost)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {selectedLead.answers && Object.keys(selectedLead.answers).length > 0 && (
                  <div className="mt-4 bg-white rounded-xl border shadow-lg overflow-hidden" style={{ borderColor: "#DCEAFB" }}>
                    <p className="font-medium text-sm p-5 pb-0">What the client entered</p>
                    <p className="text-xs px-5 pt-1" style={{ color: "#64748B" }}>Every answer from the questionnaire — dimensions, counts, framing length, everything — even though this lead didn't pay for the detailed estimate.</p>
                    <table className="w-full text-sm mt-3">
                      <tbody>
                        {Object.entries(selectedLead.answers)
                          .filter(([, v]) => v !== undefined && v !== null && v !== "")
                          .map(([k, v], i) => (
                            <tr key={i} className="border-t" style={{ borderColor: "#E6F0FC" }}>
                              <td className="py-2 px-5" style={{ color: "#64748B" }}>{k}</td>
                              <td className="py-2 px-5 text-right font-medium whitespace-nowrap">{String(v)}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <button onClick={() => setPhase("landing")} className="inline-flex items-center gap-1 text-sm mb-4" style={{ color: "#475569" }}>
                  <ChevronLeft size={16} /> Back
                </button>
                <div className="flex items-center justify-between">
                  <h1 className="text-3xl sm:text-4xl leading-tight" style={{ fontFamily: DISPLAY_FONT, fontWeight: 800, letterSpacing: "-0.02em" }}>
                    Saved Estimates
                  </h1>
                  <button onClick={loadProjects} className="p-2 rounded-lg border bg-white" style={{ borderColor: "#DCEAFB", color: "#475569" }}>
                    <RefreshCw size={16} className={projectsLoading ? "animate-spin" : ""} />
                  </button>
                </div>
                <p className="mt-2 text-sm" style={{ color: "#475569" }}>Every estimate you've saved or that a client sent through "Talk to a manager."</p>

                {projectsLoading && (
                  <div className="mt-8 flex items-center justify-center gap-2 text-sm" style={{ color: "#64748B" }}>
                    <Loader2 size={16} className="animate-spin" /> Loading…
                  </div>
                )}

                {!projectsLoading && projectsList.length === 0 && (
                  <div className="mt-8 text-sm text-center" style={{ color: "#64748B" }}>
                    <p>Nothing saved yet. Generate an estimate and tap "Save this estimate."</p>
                    {projectsDebug && (
                      <div className="mt-4 text-left inline-block bg-white border rounded-lg p-3 text-xs" style={{ borderColor: "#DCEAFB", color: "#94A3B8" }}>
                        <p>Diagnostic: index keys {projectsDebug.indexKeys}, shared keys {projectsDebug.sharedKeys}, personal keys {projectsDebug.personalKeys}, total unique {projectsDebug.totalKeys}, loaded {projectsDebug.parsed}, failed {projectsDebug.parseFailed}</p>
                        {projectsDebug.sharedError && <p>Shared list error: {projectsDebug.sharedError}</p>}
                        {projectsDebug.personalError && <p>Personal list error: {projectsDebug.personalError}</p>}
                        {projectsDebug.error && <p>Error: {projectsDebug.error}</p>}
                      </div>
                    )}
                  </div>
                )}

                {!projectsLoading && projectsList.length > 0 && (
                  <div className="mt-5 bg-white rounded-xl border shadow-lg overflow-hidden" style={{ borderColor: "#DCEAFB" }}>
                    {projectsList.map((p) => (
                      <div key={p.id} className="flex items-center gap-2 border-t" style={{ borderColor: "#E6F0FC" }}>
                        <button
                          onClick={() => openLeadDetail(p.id)}
                          className="flex-1 min-w-0 text-left flex items-center justify-between gap-3 px-5 py-4 hover:bg-[#EFF6FF] transition-colors"
                        >
                          <div className="min-w-0">
                            <p className="font-medium truncate">{p.clientName || "Untitled"}</p>
                            <p className="text-xs truncate" style={{ color: "#64748B" }}>
                              {p.roomLabel} · {p.address || "no address"} · {new Date(p.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-medium whitespace-nowrap">{formatCAD(p.total)}</p>
                            <p className="text-xs" style={{ color: p.status === "New" ? WINE : "#64748B" }}>{p.status}</p>
                          </div>
                        </button>
                        {confirmDeleteId === p.id ? (
                          <div className="flex items-center gap-1 pr-3 shrink-0">
                            <button onClick={() => { deleteEstimate(p.id); setConfirmDeleteId(null); }} className="p-2 rounded-lg text-white" style={{ backgroundColor: AMBER }}>
                              <Trash2 size={14} />
                            </button>
                            <button onClick={() => setConfirmDeleteId(null)} className="p-2" style={{ color: "#64748B" }}>
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => setConfirmDeleteId(p.id)} className="p-2 mr-3 rounded-lg shrink-0 hover:bg-[#FFF7ED]" style={{ color: AMBER }}>
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ---------------- MY PRICES (editable rates) ---------------- */}
        {phase === "my_rates" && (
          <div className="pt-8">
            <button onClick={() => setPhase("landing")} className="inline-flex items-center gap-1 text-sm mb-4" style={{ color: "#475569" }}>
              <ChevronLeft size={16} /> Back
            </button>
            <h1 className="text-3xl sm:text-4xl leading-tight" style={{ fontFamily: DISPLAY_FONT, fontWeight: 800, letterSpacing: "-0.02em" }}>
              My Prices
            </h1>
            <p className="mt-3 max-w-lg text-sm" style={{ color: "#475569" }}>
              These are the exact rates the calculator uses. They start as generic Niagara-area estimates — overwrite any of them with your own numbers and every estimate uses your real pricing from then on. Saved to this installation only.
            </p>

            <div className="mt-5 space-y-3">
              {Object.keys(RATE_META).map((room) => {
                const isOpen = !!expandedRateRooms[room];
                const list = rateDraft[room];
                return (
                  <div key={room} className="bg-white rounded-xl border shadow-lg overflow-hidden" style={{ borderColor: "#DCEAFB" }}>
                    <button
                      onClick={() => setExpandedRateRooms((prev) => ({ ...prev, [room]: !prev[room] }))}
                      className="w-full flex items-center justify-between px-5 py-4 text-left"
                    >
                      <span className="font-medium">{ROOM_LABELS[room]}</span>
                      <span className="text-xs" style={{ color: "#64748B" }}>
                        {list.length} rates {isOpen ? "▲" : "▼"}
                      </span>
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-5 border-t pt-4" style={{ borderColor: "#E6F0FC" }}>
                        <div className="grid sm:grid-cols-2 gap-3">
                          {list.map((f) => (
                            <div key={f.key} className="flex items-end gap-2">
                              <label className="block flex-1">
                                <span className="text-xs flex items-center gap-1" style={{ color: "#64748B" }}>
                                  {f.label} · {f.unit}
                                  {!KNOWN_KEYS[room].has(f.key) && (
                                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium" style={{ backgroundColor: "#0EA5E91A", color: GREEN }}>custom</span>
                                  )}
                                </span>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={f.value === 0 ? "" : f.value}
                                  onChange={(e) => updateRateValue(room, f.key, e.target.value === "" ? 0 : Number(e.target.value))}
                                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
                                  style={{ borderColor: "#DCEAFB" }}
                                />
                              </label>
                              <button
                                onClick={() => deleteRateItem(room, f.key)}
                                title="Delete this position"
                                className="p-2 rounded-lg border transition-colors hover:bg-[#FFF7ED] mb-0.5"
                                style={{ borderColor: "#DCEAFB", color: AMBER }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))}
                        </div>

                        {addingToRoom === room ? (
                          <div className="mt-4 p-3 rounded-lg border grid sm:grid-cols-4 gap-2" style={{ borderColor: "#DCEAFB", backgroundColor: "#EFF6FF" }}>
                            <input
                              placeholder="Job name"
                              value={newItemLabel}
                              onChange={(e) => setNewItemLabel(e.target.value)}
                              className="sm:col-span-2 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
                              style={{ borderColor: "#DCEAFB" }}
                            />
                            <input
                              placeholder="Unit, e.g. $/sq ft"
                              value={newItemUnit}
                              onChange={(e) => setNewItemUnit(e.target.value)}
                              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
                              style={{ borderColor: "#DCEAFB" }}
                            />
                            <input
                              type="number"
                              step="0.01"
                              placeholder="Price"
                              value={newItemValue}
                              onChange={(e) => setNewItemValue(e.target.value)}
                              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
                              style={{ borderColor: "#DCEAFB" }}
                            />
                            <div className="sm:col-span-4 flex gap-2 mt-1">
                              <button
                                onClick={() => {
                                  addRateItem(room, newItemLabel, newItemUnit, newItemValue === "" ? 0 : Number(newItemValue));
                                  setNewItemLabel("");
                                  setNewItemUnit("$ flat");
                                  setNewItemValue("");
                                  setAddingToRoom(null);
                                }}
                                disabled={!newItemLabel.trim()}
                                className="inline-flex items-center gap-1.5 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40"
                                style={{ backgroundColor: WINE }}
                              >
                                <Plus size={14} /> Add
                              </button>
                              <button
                                onClick={() => setAddingToRoom(null)}
                                className="px-4 py-2 rounded-lg text-sm font-medium"
                                style={{ color: "#475569" }}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => setAddingToRoom(room)}
                            className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg border transition-colors hover:bg-[#EFF6FF]"
                            style={{ borderColor: "#DCEAFB", color: GREEN }}
                          >
                            <Plus size={14} /> Add a price position
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-3 mt-6 sticky bottom-4">
              <button
                onClick={saveRates}
                disabled={ratesSaving}
                className="flex-1 inline-flex items-center justify-center gap-2 text-white px-6 py-3 rounded-lg font-medium transition-colors disabled:opacity-60"
                style={{ backgroundColor: WINE }}
              >
                {ratesSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Save my prices
              </button>
              <button
                onClick={resetRates}
                className="inline-flex items-center gap-2 px-4 py-3 rounded-lg font-medium border bg-white transition-colors"
                style={{ borderColor: "#DCEAFB", color: "#475569" }}
              >
                <RotateCcw size={16} /> Reset to defaults
              </button>
            </div>
            {ratesSavedMsg && (
              <div className="mt-3 flex items-center gap-2 text-sm" style={{ color: GREEN }}>
                <CheckCircle2 size={16} /> Saved — new estimates will use these prices.
              </div>
            )}
          </div>
        )}

        {/* ---------------- CHOOSE MODE ---------------- */}
        {phase === "choose_mode" && (
          <div className="pt-8">
            <p className="text-sm font-semibold mb-4" style={{ color: "#475569" }}>
              How do you want to answer the rest?
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              <button
                onClick={startChatMode}
                className="text-left p-5 rounded-lg border-2 bg-white hover:border-[#BFDBFE] transition-colors"
                style={{ borderColor: "#DCEAFB" }}
              >
                <MessageCircle size={22} style={{ color: WINE }} strokeWidth={1.75} />
                <p className="mt-2 font-medium">Chat with the assistant</p>
                <p className="text-xs mt-1" style={{ color: "#64748B" }}>
                  Describe your space in your own words. It'll ask what it needs and can work out square footage for odd-shaped rooms.
                </p>
              </button>
              <button
                onClick={() => setPhase("flow")}
                className="text-left p-5 rounded-lg border-2 bg-white hover:border-[#BFDBFE] transition-colors"
                style={{ borderColor: "#DCEAFB" }}
              >
                <Keyboard size={22} style={{ color: GREEN }} strokeWidth={1.75} />
                <p className="mt-2 font-medium">Fill in the form myself</p>
                <p className="text-xs mt-1" style={{ color: "#64748B" }}>
                  Quick multiple-choice and slider questions, one at a time.
                </p>
              </button>
            </div>
          </div>
        )}

        {/* ---------------- CHAT ---------------- */}
        {phase === "chat" && (
          <div className="pt-8">
            <div className="bg-white rounded-xl border shadow-lg flex flex-col" style={{ borderColor: "#DCEAFB", height: "60vh" }}>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {chatMessages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className="max-w-[80%] rounded-lg px-4 py-2.5 text-sm"
                      style={
                        m.role === "user"
                          ? { backgroundColor: INK, color: "white" }
                          : { backgroundColor: "#EFF6FF", color: INK }
                      }
                    >
                      {m.content}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="rounded-lg px-4 py-2.5 text-sm flex items-center gap-2" style={{ backgroundColor: "#EFF6FF", color: "#64748B" }}>
                      <Loader2 size={14} className="animate-spin" /> thinking
                    </div>
                  </div>
                )}
                {chatError && (
                  <div className="flex items-start gap-2 text-sm px-1" style={{ color: AMBER }}>
                    <AlertTriangle size={16} className="shrink-0 mt-0.5" /> {chatError}
                  </div>
                )}
                {micError && (
                  <div className="flex items-start gap-2 text-sm px-1" style={{ color: AMBER }}>
                    <AlertTriangle size={16} className="shrink-0 mt-0.5" /> {micError}
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
              <div className="border-t p-3 flex gap-2" style={{ borderColor: "#E6F0FC" }}>
                {micSupported && (
                  <button
                    onClick={toggleMic}
                    disabled={chatLoading}
                    title={listening ? "Stop recording" : "Speak instead of typing"}
                    className="px-3 py-2 rounded-lg border transition-colors disabled:opacity-30"
                    style={{
                      borderColor: listening ? "#DC2626" : "#DCEAFB",
                      backgroundColor: listening ? "#FEF2F2" : "white",
                      color: listening ? "#DC2626" : "#475569",
                    }}
                  >
                    {listening ? <Mic size={16} className="animate-pulse" /> : <Mic size={16} />}
                  </button>
                )}
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendChatMessage()}
                  placeholder={listening ? "Listening…" : "Type your answer…"}
                  disabled={chatLoading}
                  className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
                  style={{ borderColor: listening ? "#DC2626" : "#DCEAFB" }}
                />
                <button
                  onClick={sendChatMessage}
                  disabled={chatLoading || !chatInput.trim()}
                  className="px-4 py-2 rounded-lg text-white disabled:opacity-30"
                  style={{ backgroundColor: WINE }}
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between mt-4">
              <span className="text-xs" style={{ color: "#64748B" }}>
                {Object.keys(answers).filter((k) => questions.some((q) => q.id === k)).length} of {questions.length} fields confirmed
              </span>
              <button onClick={() => setPhase("flow")} className="text-sm underline" style={{ color: "#475569" }}>
                Switch to the form instead
              </button>
            </div>
          </div>
        )}

        {/* ---------------- FLOW: municipality / questions ---------------- */}
        {phase === "flow" && (
          <div className="pt-8">
            {currentStepId === "municipality" && (
              <div>
                <p className="text-sm font-semibold mb-4" style={{ color: "#475569" }}>Which municipality?</p>
                <div className="grid grid-cols-2 gap-2">
                  {MUNICIPALITIES.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setMunicipality(m.id)}
                      className="p-3 rounded-lg border-2 text-sm font-medium bg-white transition-colors"
                      style={{ borderColor: municipality === m.id ? WINE : "#DCEAFB", backgroundColor: municipality === m.id ? "#2563EB0D" : "white" }}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {questions.map((q) => {
              if (q.id !== currentStepId) return null;
              return (
                <div key={q.id}>
                  <p className="text-sm font-semibold mb-4" style={{ color: "#475569" }}>{q.label}</p>
                  {q.type === "number" && (
                    <div className="flex items-center gap-4">
                      <input
                        type="range"
                        min={q.min} max={q.max} step={q.step}
                        value={answers[q.id] ?? q.default}
                        onChange={(e) => setAnswers({ ...answers, [q.id]: Number(e.target.value) })}
                        className="flex-1"
                        style={{ accentColor: WINE }}
                      />
                      <span className="text-2xl w-28 text-right" style={{ fontFamily: DISPLAY_FONT, fontWeight: 800 }}>
                        {answers[q.id] ?? q.default} <span className="text-sm font-sans" style={{ color: "#64748B" }}>{q.unit}</span>
                      </span>
                    </div>
                  )}
                  {q.type === "select" && (
                    <div className="grid grid-cols-2 gap-2">
                      {q.options.map((opt) => (
                        <button
                          key={opt}
                          onClick={() => setAnswers({ ...answers, [q.id]: opt })}
                          className="p-3 rounded-lg border-2 text-sm font-medium bg-white transition-colors text-left"
                          style={{ borderColor: answers[q.id] === opt ? WINE : "#DCEAFB", backgroundColor: answers[q.id] === opt ? "#2563EB0D" : "white" }}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            <div className="flex gap-3 mt-8">
              <button onClick={goBack} className="px-6 py-3 rounded-lg font-medium hover:bg-[#DBEAFE] transition-colors" style={{ color: "#475569" }}>
                <span className="inline-flex items-center gap-1"><ChevronLeft size={16} />Back</span>
              </button>
              <button
                disabled={!canAdvance()}
                onClick={goNext}
                className="flex-1 inline-flex items-center justify-center gap-2 text-white px-6 py-3 rounded-lg font-medium disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                style={{ backgroundColor: INK }}
              >
                {flowIndex + 1 >= steps.length ? "See estimate" : "Continue"} <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* ---------------- RESULT ---------------- */}
        {phase === "result" && result && (
          <div className="pt-8">
            <div className="flex items-center justify-between mb-3 no-print">
              <button
                onClick={() => { setPhase("flow"); setFlowIndex(steps.length - 1); }}
                className="inline-flex items-center gap-1 text-sm font-medium"
                style={{ color: "#475569" }}
              >
                <ChevronLeft size={16} /> Back
              </button>
              <button onClick={resetAll} className="text-xs underline" style={{ color: "#94A3B8" }}>
                Start a new estimate
              </button>
            </div>
            <div className="bg-white rounded-xl border shadow-lg p-6 sm:p-8 relative overflow-hidden" style={{ borderColor: "#DCEAFB" }}>
              <div className="absolute top-0 left-0 right-0 h-1.5" style={{ background: `linear-gradient(90deg, ${GREEN}, ${MIST}, ${WINE})` }} />
              <p className="text-xs uppercase tracking-wide mt-2" style={{ color: "#64748B" }}>
                {ROOM_TYPES.find((r) => r.id === roomType)?.label} · {result.muni.label}
              </p>
              <p className="text-4xl sm:text-5xl mt-2" style={{ fontFamily: DISPLAY_FONT, fontWeight: 800, letterSpacing: "-0.02em" }}>
                {formatCAD(result.subtotal)}
              </p>
              <div className="flex items-center gap-3 mt-2 text-xs" style={{ color: "#64748B" }}>
                <span>+ HST (13%) {formatCAD(result.hst)}</span>
                <span>= {formatCAD(result.total)} total</span>
              </div>
              <p className="text-sm mt-3" style={{ color: "#475569" }}>
                A firm working estimate for this project. Final pricing depends on the finishes you choose.
              </p>
              <div className="flex items-start gap-2 mt-3 pt-3 text-xs border-t" style={{ color: "#64748B", borderColor: "#E6F0FC" }}>
                <Info size={13} style={{ color: GREEN }} className="shrink-0 mt-0.5" />
                <p>Includes labour, consumables, disposal, and HST. Excludes permits, fixtures, and appliances.</p>
              </div>
              {result.items.filter((it) => !it.hideFromBreakdown).length > 0 && (
                <div className="mt-4 pt-4 border-t" style={{ borderColor: "#E6F0FC" }}>
                  <p className="text-xs font-medium mb-2" style={{ color: "#475569" }}>What's included in this estimate:</p>
                  <ul className="text-sm grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                    {result.items.filter((it) => !it.hideFromBreakdown).map((it, i) => (
                      <li key={i} className="flex items-start gap-1.5" style={{ color: "#334155" }}>
                        <span style={{ color: GREEN }}>•</span>
                        <span>{it.item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Save estimate — for the admin's own record-keeping, separate from client lead capture */}
            {!estimateSaved ? (
              <div className="mt-4 bg-white rounded-xl border shadow-lg p-4 no-print" style={{ borderColor: "#DCEAFB" }}>
                {!showSaveEstimate ? (
                  <button
                    onClick={() => setShowSaveEstimate(true)}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium border-2 transition-colors hover:bg-[#EFF6FF]"
                    style={{ borderColor: "#DCEAFB", color: WINE }}
                  >
                    <Save size={16} /> Save this estimate
                  </button>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Save this estimate</p>
                    <input
                      type="text"
                      placeholder="Client name"
                      value={saveClientName}
                      onChange={(e) => setSaveClientName(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
                      style={{ borderColor: "#DCEAFB" }}
                    />
                    <input
                      type="text"
                      placeholder="Address"
                      value={saveAddress}
                      onChange={(e) => setSaveAddress(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
                      style={{ borderColor: "#DCEAFB" }}
                    />
                    <textarea
                      placeholder="Short project description"
                      value={saveDescription}
                      onChange={(e) => setSaveDescription(e.target.value)}
                      rows={2}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 resize-none"
                      style={{ borderColor: "#DCEAFB" }}
                    />
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={saveEstimateRecord}
                        disabled={savingEstimate}
                        className="flex-1 inline-flex items-center justify-center gap-2 text-white px-4 py-2.5 rounded-lg text-sm font-medium disabled:opacity-60"
                        style={{ backgroundColor: WINE }}
                      >
                        {savingEstimate ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        Save
                      </button>
                      <button onClick={() => setShowSaveEstimate(false)} className="px-4 py-2.5 rounded-lg text-sm font-medium" style={{ color: "#475569" }}>
                        Cancel
                      </button>
                    </div>
                    {saveEstimateError && (
                      <p className="text-xs flex items-center gap-1.5" style={{ color: AMBER }}>
                        <AlertTriangle size={13} /> {saveEstimateError}
                      </p>
                    )}
                    <button
                      onClick={() => showEstimateAsText(result.items, result.subtotal, result.hst, result.total, ROOM_TYPES.find((r) => r.id === roomType)?.label || "Estimate")}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-medium border transition-colors hover:bg-[#EFF6FF]"
                      style={{ borderColor: "#DCEAFB", color: "#475569" }}
                    >
                      <RefreshCw size={13} />
                      View as text to copy manually
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-4 border rounded-xl p-4 text-sm flex items-center gap-2 no-print" style={{ backgroundColor: "#0EA5E91A", borderColor: "#0EA5E966" }}>
                <CheckCircle2 size={16} style={{ color: GREEN }} />
                <span>Saved{saveClientName ? ` — ${saveClientName}` : ""}. Find it later under "Saved Estimates" on the home screen.</span>
              </div>
            )}

            {/* category chart */}
            <div className="mt-6 bg-white rounded-xl border shadow-lg p-5" style={{ borderColor: "#DCEAFB" }}>
              <p className="font-medium text-sm mb-3">Where the money goes</p>
              <ResponsiveContainer width="100%" height={Math.max(180, result.chartData.length * 44)}>
                <BarChart data={result.chartData} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#DBEAFE" horizontal={false} />
                  <XAxis type="number" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: "#64748B" }} />
                  <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 12, fill: "#0F172A" }} />
                  <Tooltip formatter={(v) => formatCAD(v)} contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: "#DCEAFB" }} />
                  <Bar dataKey="cost" radius={[0, 4, 4, 0]}>
                    {result.chartData.map((_, i) => (
                      <Cell key={i} fill={i % 2 === 0 ? WINE : GREEN} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* ---------------- PAID CONTENT: full breakdown ---------------- */}
            {paid ? (
              <>
                {/* line item table */}
                <div className="mt-6 bg-white rounded-xl border shadow-lg overflow-hidden" style={{ borderColor: "#DCEAFB" }}>
                  <div className="flex items-center justify-between p-5 pb-0">
                    <p className="font-medium text-sm">Line-item breakdown</p>
                    <span className="text-xs" style={{ color: "#64748B" }}>What's included, spelled out</span>
                  </div>
                  <table className="w-full text-sm mt-3">
                    <tbody>
                      {result.items.filter((it) => !it.hideFromBreakdown).map((it, i) => (
                        <tr key={i} className="border-t align-top" style={{ borderColor: "#E6F0FC" }}>
                          <td className="py-3 px-5">
                            <p style={{ color: INK }}>{it.item}</p>
                            {it.note && <p className="text-xs mt-1" style={{ color: "#64748B" }}>{it.note}</p>}
                          </td>
                          <td className="py-3 px-5 text-right font-medium whitespace-nowrap">
                            {formatCAD(it.cost)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="border-t p-3" style={{ borderColor: "#E6F0FC" }}>
                    {!showAddExtra ? (
                      <button
                        onClick={() => setShowAddExtra(true)}
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors hover:bg-[#EFF6FF]"
                        style={{ borderColor: "#DCEAFB", color: WINE }}
                      >
                        <Plus size={15} /> Add another job to this estimate
                      </button>
                    ) : (
                      <div>
                        <div className="flex items-center gap-2">
                          <input
                            autoFocus
                            value={extraSearch}
                            onChange={(e) => setExtraSearch(e.target.value)}
                            placeholder="Search for a job, e.g. cabinet, door, tile…"
                            className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
                            style={{ borderColor: "#DCEAFB" }}
                          />
                          <button onClick={() => { setShowAddExtra(false); setExtraSearch(""); }} className="p-2 rounded-lg hover:bg-[#EFF6FF]">
                            <X size={16} style={{ color: "#64748B" }} />
                          </button>
                        </div>
                        {extraSearch.trim() && (
                          <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border" style={{ borderColor: "#E6F0FC" }}>
                            {allJobs
                              .filter((f) => fuzzyWordMatch(extraSearch, f.label))
                              .slice(0, 8)
                              .map((f, i) => (
                                <button
                                  key={i}
                                  onClick={() => {
                                    setExtraItems((prev) => [...prev, { ...f, qty: 1 }]);
                                    setExtraSearch("");
                                    setShowAddExtra(false);
                                  }}
                                  className="w-full text-left px-3 py-2 text-sm border-t first:border-t-0 hover:bg-[#EFF6FF] flex items-center justify-between gap-2"
                                  style={{ borderColor: "#E6F0FC" }}
                                >
                                  <span>{f.label} <span style={{ color: "#94A3B8" }}>({ROOM_LABELS[f.room] || f.room})</span></span>
                                  <span className="font-medium whitespace-nowrap">{formatCAD(f.value)}</span>
                                </button>
                              ))}
                            {allJobs.filter((f) => fuzzyWordMatch(extraSearch, f.label)).length === 0 && (
                              <p className="px-3 py-2 text-sm" style={{ color: "#94A3B8" }}>No matches — try a different word.</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    {extraItems.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {extraItems.map((f, i) => (
                          <div key={i} className="flex items-center justify-between text-xs px-2 py-1.5 rounded" style={{ backgroundColor: "#F8FBFF" }}>
                            <span style={{ color: "#475569" }}>+ {f.label}</span>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{formatCAD(f.value * (f.qty || 1))}</span>
                              <button onClick={() => setExtraItems((prev) => prev.filter((_, idx) => idx !== i))}>
                                <X size={13} style={{ color: "#94A3B8" }} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="border-t" style={{ borderColor: "#E6F0FC" }}>
                    <div className="flex items-center justify-between px-5 py-2.5 text-sm">
                      <span style={{ color: "#475569" }}>Subtotal</span>
                      <span className="font-medium">{formatCAD(result.subtotal)}</span>
                    </div>
                    <div className="flex items-center justify-between px-5 py-2.5 text-sm border-t" style={{ borderColor: "#E6F0FC" }}>
                      <span style={{ color: "#475569" }}>HST (13%)</span>
                      <span className="font-medium">{formatCAD(result.hst)}</span>
                    </div>
                    <div className="flex items-center justify-between px-5 py-3.5 border-t" style={{ borderColor: "#E6F0FC", backgroundColor: "#EFF6FF" }}>
                      <span className="font-medium">Total</span>
                      <span className="text-lg" style={{ fontFamily: DISPLAY_FONT, fontWeight: 800 }}>{formatCAD(result.total)}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-start gap-3 text-sm px-1" style={{ color: "#475569" }}>
                  <Info size={16} style={{ color: GREEN }} className="shrink-0 mt-0.5" />
                  <p>Anything marked as an "allowance" above is a placeholder for a choice you haven't made yet — the real number depends on the finish level you pick.</p>
                </div>

                {result.materialsToBuy.length > 0 && (
                  <div className="mt-6 bg-white rounded-xl border shadow-lg overflow-hidden" style={{ borderColor: "#DCEAFB" }}>
                    <div className="p-5 pb-0">
                      <p className="font-medium text-sm">Materials you'll still need to buy</p>
                      <p className="text-xs mt-1" style={{ color: "#64748B" }}>Not included in the labour above — rough retail ranges so you can budget for them.</p>
                    </div>
                    <table className="w-full text-sm mt-3">
                      <tbody>
                        {result.materialsToBuy.map((m, i) => (
                          <tr key={i} className="border-t" style={{ borderColor: "#E6F0FC" }}>
                            <td className="py-2.5 px-5" style={{ color: "#475569" }}>{m.name}</td>
                            <td className="py-2.5 px-5 text-right font-medium whitespace-nowrap">{m.low === m.high ? formatCAD(m.low) : `${formatCAD(m.low)}–${formatCAD(m.high)}`}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="flex items-center justify-between px-5 py-3.5 border-t" style={{ borderColor: "#E6F0FC", backgroundColor: "#FFF7ED" }}>
                      <span className="font-medium text-sm">Estimated materials budget (before HST)</span>
                      <span className="font-medium">{formatCAD(result.materialsLow)}–{formatCAD(result.materialsHigh)}</span>
                    </div>
                    <div className="flex items-center justify-between px-5 py-2.5 border-t text-sm" style={{ borderColor: "#E6F0FC" }}>
                      <span style={{ color: "#475569" }}>+ HST (13%) on materials</span>
                      <span className="font-medium">{formatCAD(result.materialsLowWithHst - result.materialsLow)}–{formatCAD(result.materialsHighWithHst - result.materialsHigh)}</span>
                    </div>
                    <div className="flex items-center justify-between px-5 py-3 border-t" style={{ borderColor: "#E6F0FC" }}>
                      <span className="text-sm" style={{ color: "#475569" }}>Labour total + materials budget (incl. HST on both)</span>
                      <span className="font-medium">{formatCAD(result.total + result.materialsLowWithHst)}–{formatCAD(result.total + result.materialsHighWithHst)}</span>
                    </div>
                  </div>
                )}

                {result.sheetsNeeded.length > 0 && (
                  <div className="mt-4 bg-white rounded-xl border shadow-lg overflow-hidden" style={{ borderColor: "#DCEAFB" }}>
                    <div className="p-5 pb-0">
                      <p className="font-medium text-sm">Drywall sheets needed</p>
                      <p className="text-xs mt-1" style={{ color: "#64748B" }}>Standard 4×8 ft sheets, rounded up — for ordering material.</p>
                    </div>
                    <table className="w-full text-sm mt-3">
                      <tbody>
                        {result.sheetsNeeded.map((s, i) => (
                          <tr key={i} className="border-t" style={{ borderColor: "#E6F0FC" }}>
                            <td className="py-2.5 px-5" style={{ color: "#475569" }}>{s.type}</td>
                            <td className="py-2.5 px-5 text-right font-medium whitespace-nowrap">{s.count} sheets</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* timeline */}
                <div className="mt-6 bg-white rounded-xl border shadow-lg p-5 no-print" style={{ borderColor: "#DCEAFB" }}>
                  <div className="flex items-center gap-2 mb-1">
                    <CalendarDays size={18} style={{ color: WINE }} />
                    <p className="font-medium text-sm">Roughly {result.days} working {result.days === 1 ? "day" : "days"}</p>
                  </div>
                  <p className="text-xs mb-4" style={{ color: "#64748B" }}>A typical crew sequence for this scope — real scheduling depends on material lead times and permit turnaround.</p>
                  <div className="space-y-3">
                    {result.phases.map((p, i) => (
                      <div key={i} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium text-white shrink-0" style={{ backgroundColor: i % 2 === 0 ? WINE : GREEN }}>
                            {i + 1}
                          </div>
                          {i < result.phases.length - 1 && <div className="w-px flex-1 my-1" style={{ backgroundColor: "#DCEAFB" }} />}
                        </div>
                        <div className="pb-3">
                          <p className="text-sm font-medium">{p.title}</p>
                          <p className="text-xs mt-0.5" style={{ color: "#64748B" }}>{p.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {result.flags.length > 0 && (
                  <div className="mt-6 border rounded-xl p-5" style={{ backgroundColor: "#FFF7ED", borderColor: "#FDBA74" }}>
                    <div className="flex items-start gap-3">
                      <AlertTriangle size={20} style={{ color: AMBER }} className="shrink-0 mt-0.5" strokeWidth={1.75} />
                      <div>
                        <p className="font-medium text-sm mb-2">Worth knowing before you budget</p>
                        <ul className="space-y-1.5">
                          {result.flags.map((f, i) => (
                            <li key={i} className="text-sm flex gap-2" style={{ color: "#475569" }}>
                              <span style={{ color: AMBER }}>—</span>{f}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                <button
                  onClick={() => window.print()}
                  className="mt-6 w-full border-2 px-6 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 bg-white hover:bg-[#EFF6FF] no-print"
                  style={{ borderColor: "#DCEAFB", color: INK }}
                >
                  <Download size={16} /> Download PDF estimate
                </button>
                <p className="text-xs text-center mt-2 no-print" style={{ color: "#64748B" }}>Opens your browser's print dialog — choose "Save as PDF."</p>
              </>
            ) : (
              /* ---------------- FREE TIER: paywall teaser ---------------- */
              <div className="mt-6 relative rounded-xl border shadow-lg overflow-hidden" style={{ borderColor: "#DCEAFB" }}>
                <div className="p-5 blur-sm select-none pointer-events-none" aria-hidden="true">
                  <p className="font-medium text-sm mb-3">Line-item breakdown</p>
                  {result.items.slice(0, 4).map((it, i) => (
                    <div key={i} className="flex justify-between py-2 border-t text-sm" style={{ borderColor: "#E6F0FC" }}>
                      <span>{it.item}</span>
                      <span>{formatCAD(it.cost)}</span>
                    </div>
                  ))}
                </div>
                <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                  <div className="text-center max-w-sm px-6 py-6">
                    <Lock size={22} style={{ color: WINE }} className="mx-auto mb-3" strokeWidth={1.75} />
                    <p className="text-xl" style={{ fontFamily: DISPLAY_FONT, fontWeight: 800 }}>Unlock the full estimate</p>
                    <p className="text-sm mt-2" style={{ color: "#475569" }}>
                      Line-by-line materials and labour, a day-by-day work plan, and a downloadable PDF you can compare against any contractor's quote.
                    </p>
                    <button
                      onClick={() => setPaid(true)}
                      className="mt-4 inline-flex items-center gap-2 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                      style={{ backgroundColor: WINE }}
                    >
                      Unlock for $18 CAD
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ---------------- ALWAYS VISIBLE: talk to a manager / request an on-site visit ---------------- */}
            {!showLead && !leadSent && (
              <button
                onClick={() => setShowLead(true)}
                className="mt-6 w-full text-white px-6 py-3.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 no-print"
                style={{ backgroundColor: WINE }}
              >
                <Phone size={16} /> Talk to a manager / request an on-site visit
              </button>
            )}

            {showLead && !leadSent && (
              <div className="mt-6 bg-white border rounded-xl p-5 shadow-lg space-y-2" style={{ borderColor: "#DCEAFB" }}>
                <p className="font-medium text-sm mb-1">Where should we follow up?</p>
                <input
                  type="text"
                  placeholder="Your name"
                  value={leadClientName}
                  onChange={(e) => setLeadClientName(e.target.value)}
                  className="w-full border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2"
                  style={{ borderColor: "#DCEAFB" }}
                />
                <input
                  type="text"
                  placeholder="Project address"
                  value={leadAddress}
                  onChange={(e) => setLeadAddress(e.target.value)}
                  className="w-full border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2"
                  style={{ borderColor: "#DCEAFB" }}
                />
                <textarea
                  placeholder="Anything else we should know? (optional)"
                  value={leadProjectDesc}
                  onChange={(e) => setLeadProjectDesc(e.target.value)}
                  rows={2}
                  className="w-full border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 resize-none"
                  style={{ borderColor: "#DCEAFB" }}
                />
                <input
                  type="email"
                  placeholder="you@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2"
                  style={{ borderColor: "#DCEAFB" }}
                />
                <button
                  disabled={!email.includes("@") || leadSaving}
                  onClick={saveLead}
                  className="w-full inline-flex items-center justify-center gap-2 text-white px-5 py-2.5 rounded-lg text-sm font-medium disabled:opacity-30 transition-colors"
                  style={{ backgroundColor: INK }}
                >
                  {leadSaving ? <Loader2 size={14} className="animate-spin" /> : null}
                  Send it
                </button>
                {leadSaveError && (
                  <p className="text-xs flex items-center gap-1.5" style={{ color: AMBER }}>
                    <AlertTriangle size={13} /> {leadSaveError}
                  </p>
                )}
              </div>
            )}

            {leadSent && (
              <div className="mt-6 border rounded-xl p-5 text-sm flex items-start gap-2" style={{ backgroundColor: "#0EA5E91A", borderColor: "#0EA5E966" }}>
                <CheckCircle2 size={16} style={{ color: GREEN }} className="shrink-0 mt-0.5" />
                <span>A manager will follow up at {email} to arrange an on-site visit.</span>
              </div>
            )}

            <div className="flex gap-4 mt-6 no-print">
              <button onClick={() => { setPhase("flow"); setFlowIndex(steps.length - 1); }} className="text-sm underline" style={{ color: "#475569" }}>
                Edit answers
              </button>
              <button onClick={resetAll} className="text-sm underline" style={{ color: "#475569" }}>
                Start a new estimate
              </button>
            </div>
          </div>
        )}
      </div>

      {estimateTextContent !== null && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ backgroundColor: "rgba(15,23,42,0.5)" }}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-5" onClick={(e) => e.stopPropagation()}>
            <p className="font-medium text-sm mb-1">Tap inside the box, then select all and copy</p>
            <p className="text-xs mb-3" style={{ color: "#64748B" }}>Tap and hold inside the text, choose "Select All," then "Copy." Paste it into Notes, a text, or an email — this doesn't depend on any saving feature working.</p>
            <textarea
              readOnly
              value={estimateTextContent}
              onFocus={(e) => e.target.select()}
              rows={12}
              className="w-full border rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2"
              style={{ borderColor: "#DCEAFB" }}
            />
            <button
              onClick={() => setEstimateTextContent(null)}
              className="w-full mt-3 text-white px-4 py-2.5 rounded-lg text-sm font-medium"
              style={{ backgroundColor: WINE }}
            >
              Done
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
