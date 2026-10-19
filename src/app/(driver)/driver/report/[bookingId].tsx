import { ReportProblemScreen } from '@/components/complaints/ReportProblemScreen';
import { router, useLocalSearchParams } from 'expo-router';

function goBack() {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace('/driver/trips');
  }
}

/** "Report a problem" on a trip the driver was assigned to (from the Trip screen). */
export default function DriverReportProblemScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId?: string }>();
  return <ReportProblemScreen bookingId={bookingId ?? ''} role="driver" onBack={goBack} />;
}
