import { ReportProblemScreen } from '@/components/complaints/ReportProblemScreen';
import { useScreenBack } from '@/components/ui/ScreenHeader';
import { useLocalSearchParams } from 'expo-router';

/** "Report a problem" on one of the passenger's own bookings (from Booking Details). */
export default function PassengerReportProblemScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId?: string }>();
  const goBack = useScreenBack();
  return <ReportProblemScreen bookingId={bookingId ?? ''} role="passenger" onBack={goBack} />;
}
