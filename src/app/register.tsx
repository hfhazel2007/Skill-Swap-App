import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';

export default function RegisterScreen() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [pending, setPending] = useState(false);

  const register = async () => {
    setErrorMessage('');
    const normalizedFullName = fullName.trim().replace(/\s+/g, ' ');
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedFullName || !normalizedEmail || !password || !confirmPassword) {
      setErrorMessage('Complete all fields to create your account.');
      return;
    }
    if (password.length < 6) {
      setErrorMessage('Your password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setPending(true);
    try {
      const { error } = await supabase.from('users').insert({
        full_name: normalizedFullName,
        email: normalizedEmail,
        password_hash: password,
      });

      if (error) {
        setErrorMessage(
          error.code === '23505'
            ? 'An account with this email already exists.'
            : 'Unable to create your account right now. Please try again.',
        );
        return;
      }

      router.replace('/');
    } catch {
      setErrorMessage('Unable to create your account right now. Check your connection and try again.');
    } finally {
      setPending(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Back to sign in"
              onPress={() => router.back()}
              style={styles.backButton}
              disabled={pending}
            >
              <Text style={styles.backText}>‹ Back to sign in</Text>
            </TouchableOpacity>

            <View style={styles.card}>
              <Text style={styles.eyebrow}>JOIN THE COMMUNITY</Text>
              <Text style={styles.title}>Create your account</Text>
              <Text style={styles.subtitle}>Start learning, teaching, and swapping skills.</Text>

              <Text style={styles.label}>Full name</Text>
              <TextInput
                value={fullName}
                onChangeText={setFullName}
                style={styles.input}
                placeholder="Your full name"
                placeholderTextColor="#A5A3B2"
                autoCapitalize="words"
                autoCorrect={false}
                autoComplete="name"
                textContentType="name"
                accessibilityLabel="Full name"
                returnKeyType="next"
              />

              <Text style={styles.label}>Email address</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor="#A5A3B2"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                accessibilityLabel="Email address"
              />

              <Text style={styles.label}>Password</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                style={styles.input}
                placeholder="At least 6 characters"
                placeholderTextColor="#A5A3B2"
                secureTextEntry
                autoCapitalize="none"
                autoComplete="new-password"
                textContentType="newPassword"
                accessibilityLabel="Password"
              />

              <Text style={styles.label}>Confirm password</Text>
              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                style={styles.input}
                placeholder="Re-enter your password"
                placeholderTextColor="#A5A3B2"
                secureTextEntry
                autoCapitalize="none"
                autoComplete="new-password"
                textContentType="newPassword"
                accessibilityLabel="Confirm password"
                onSubmitEditing={register}
              />

              {errorMessage ? (
                <Text accessibilityRole="alert" style={styles.errorMessage}>{errorMessage}</Text>
              ) : null}

              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Create account"
                onPress={register}
                disabled={pending}
                style={[styles.registerButton, pending && styles.disabledButton]}
              >
                {pending ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.registerText}>Create account</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F5F1E8' },
  keyboardView: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 22 },
  content: { width: '100%', maxWidth: 440, alignSelf: 'center' },
  backButton: { alignSelf: 'flex-start', paddingVertical: 12, marginBottom: 8 },
  backText: { color: '#245748', fontSize: 14, fontWeight: '800' },
  card: {
    padding: 24,
    backgroundColor: '#FFFCF6',
    borderWidth: 1,
    borderColor: '#EAE3D8',
    borderRadius: 22,
  },
  eyebrow: { color: '#C45A42', fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  title: { marginTop: 8, color: '#203A33', fontSize: 30, fontWeight: '800' },
  subtitle: { marginTop: 6, marginBottom: 24, color: '#70776F', fontSize: 14, lineHeight: 20 },
  label: { marginTop: 12, marginBottom: 8, color: '#29483F', fontSize: 13, fontWeight: '700' },
  input: {
    minHeight: 52,
    paddingHorizontal: 14,
    color: '#203A33',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#DDD6CA',
    borderRadius: 12,
    backgroundColor: '#FBF8F1',
  },
  errorMessage: { marginTop: 14, color: '#B4233A', fontSize: 13, lineHeight: 19 },
  registerButton: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
    backgroundColor: '#E76F51',
    borderRadius: 12,
  },
  disabledButton: { opacity: 0.7 },
  registerText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
});
