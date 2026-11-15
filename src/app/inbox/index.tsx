import { InboxScreen } from '@/components/inbox/InboxScreen';
import { router } from 'expo-router';

/** Driver Profile → Messages from TriGo (passengers have it as the Notifications tab). */
export default function InboxRoute() {
  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  return <InboxScreen onBack={goBack} />;
}
