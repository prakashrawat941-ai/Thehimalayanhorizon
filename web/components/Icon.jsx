import {
  ArrowRight, Bell, CalendarDays, Camera, CarFront, Check, CircleAlert,
  FileText, Globe2, Headphones, Heart, House, Layers3, Leaf, LocateFixed,
  LogOut, Mail, Map, MapPin, Mountain, Navigation, Phone, Plus, Route, Search,
  ShieldCheck, Star, Sun, UserRound, UsersRound, Wifi,
} from 'lucide-react';

// One vocabulary for existing pages; brand marks continue to use image assets.
export const iconComponents = Object.freeze({
  arrow: ArrowRight, bell: Bell, calendar: CalendarDays, camera: Camera,
  car: CarFront, check: Check, alert: CircleAlert, doc: FileText,
  globe: Globe2, support: Headphones, heart: Heart, home: House,
  house: House, layers: Layers3, leaf: Leaf, locate: LocateFixed,
  logout: LogOut, mail: Mail, map: Map, pin: MapPin,
  mountain: Mountain, phone: Phone, route: Route, search: Search, shield: ShieldCheck,
  star: Star, sun: Sun, user: UserRound, people: UsersRound,
  wifi: Wifi, plus: Plus, desk: Navigation,
});

export function Icon({ name, size = 20 }) {
  const Component = iconComponents[name];
  return Component ? (
    <span className="ico" aria-hidden="true">
      <Component size={size} strokeWidth={1.8} />
    </span>
  ) : null;
}
