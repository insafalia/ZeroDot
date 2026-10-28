import { Redirect } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAuth } from '@/auth';
import { GlassCard } from '@/components/GlassCard';
import { AppText, GoldButton, Notice, Screen, TextField } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { theme } from '@/theme';

export default function LoginScreen() {
  const { session } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (session) return <Redirect href="/" />;

  async function signIn() {
    setBusy(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (signInError) setError('Email or password is incorrect.');
  }

  return (
    <Screen>
      <View style={styles.center}>
        <AppText style={styles.wordmark}>ZERODOT</AppText>
        <View style={styles.rule} />
        <AppText style={styles.lede}>Private studio book</AppText>
        <GlassCard style={styles.card}>
          {error ? <Notice>{error}</Notice> : null}
          <TextField
            testID="email"
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            placeholder="you@studio.com"
          />
          <TextField
            testID="password"
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            placeholder="Password"
            onSubmitEditing={signIn}
          />
          <GoldButton testID="sign-in" label={busy ? 'Signing in' : 'Enter studio'} onPress={signIn} disabled={busy} />
        </GlassCard>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    justifyContent: 'center',
    minHeight: 520,
    maxWidth: 460,
    width: '100%',
    alignSelf: 'center',
  },
  wordmark: {
    fontFamily: theme.font.bold,
    letterSpacing: 4,
    fontSize: 28,
    textAlign: 'center',
  },
  rule: {
    width: 42,
    height: 2,
    backgroundColor: theme.rose,
    alignSelf: 'center',
    marginTop: 14,
    marginBottom: 10,
  },
  lede: {
    textAlign: 'center',
    color: theme.muted,
    marginBottom: 22,
  },
  card: {
    width: '100%',
  },
});
