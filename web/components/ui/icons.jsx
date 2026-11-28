import {
  ArrowDown, ArrowRight, ArrowUp, ArrowUpDown, Bell, Building2, Calendar, Camera, Car, Check, ChevronDown,
  ChevronLeft, ChevronRight, ChevronUp, CircleAlert, CircleCheck, ClipboardCheck, Clock, FileText, Globe, Headset,
  Heart, House, Inbox, Info, Laptop, Layers, LayoutDashboard, Leaf, LoaderCircle, LocateFixed, LogOut, Mail,
  Map as MapIcon, MapPin, Megaphone, Menu, Monitor, Moon, Mountain, Phone, Plus, RefreshCw, Route, Search,
  Settings, ShieldCheck, Star, Sun, TrendingDown, TrendingUp, TriangleAlert, User, Users, Wallet, Wifi, X,
} from 'lucide-react';

/**
 * Central icon registry (Lucide). New screens use <UiIcon name="..."/>.
 *
 * The first block maps every name of the legacy components/Icon.jsx, so existing screens can move over
 * later by changing one import. Legacy Icon.jsx is NOT replaced in Phase 1 (approved screens keep their look).
 * Brand artwork (logo mark, launch screen, cab vehicle art) stays as images/SVG and is not part of this set.
 */
export const ICONS = {
  // legacy names
  car: Car, map: MapIcon, mountain: Mountain, home: House, user: User, search: Search, arrow: ArrowRight,
  wifi: Wifi, leaf: Leaf, people: Users, desk: Laptop, shield: ShieldCheck, house: House, globe: Globe,
  calendar: Calendar, route: Route, star: Star, support: Headset, bell: Bell, doc: FileText, heart: Heart,
  pin: MapPin, plus: Plus, check: Check, alert: TriangleAlert, layers: Layers, camera: Camera, logout: LogOut,
  phone: Phone, mail: Mail, locate: LocateFixed, sun: Sun,
  // new names
  moon: Moon, monitor: Monitor, x: X, info: Info, menu: Menu, inbox: Inbox, dashboard: LayoutDashboard,
  approvals: ClipboardCheck, clock: Clock, wallet: Wallet, megaphone: Megaphone, building: Building2,
  settings: Settings, refresh: RefreshCw, loader: LoaderCircle, 'circle-check': CircleCheck, 'circle-alert': CircleAlert,
  'chevron-down': ChevronDown, 'chevron-up': ChevronUp, 'chevron-left': ChevronLeft, 'chevron-right': ChevronRight,
  'sort': ArrowUpDown, 'sort-asc': ArrowUp, 'sort-desc': ArrowDown, 'trend-up': TrendingUp, 'trend-down': TrendingDown,
};

export const ICON_NAMES = Object.freeze(Object.keys(ICONS));

/** Decorative by default (aria-hidden). Pass `title` to make it an image with a text alternative. */
export function UiIcon({ name, size = 18, strokeWidth = 1.8, title, className, ...rest }) {
  const Glyph = ICONS[name];
  if (!Glyph) return null;
  const a11y = title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': 'true' };
  return <Glyph size={size} strokeWidth={strokeWidth} focusable="false" className={className} {...a11y} {...rest} />;
}
