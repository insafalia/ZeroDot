import { Redirect } from 'expo-router';
import { useAuth } from '@/auth';
import { AppChrome } from '@/components/AppChrome';

export default function MainLayout() {
  const { session } = useAuth();
  if (!session) return <Redirect href="/login" />;
  return <AppChrome />;
}
