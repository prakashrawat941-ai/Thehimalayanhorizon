import { DashSkeleton } from '@/components/dash/DashStates';

export default function Loading() {
  return <DashSkeleton rows={6} label="Loading bookings" />;
}
