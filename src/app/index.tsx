import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
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

export default function LoginScreen() {
  // Initialize router and state variables for email, password, visibility, pending actions, and messages
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [pendingAction, setPendingAction] = useState<'sign-in'  | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  // Function to handle user sign-in
  const signIn = async () => {
  setErrorMessage('');
  setInfoMessage('');

  //trim the email and convert it to lowercase for consistency
  const trimmedEmail = email.trim().toLowerCase();


  // Validate that both email and password are provided
  if (!trimmedEmail || !password) {
    setErrorMessage('Enter your email and password to continue.');
    return;
  }
  
  setPendingAction('sign-in');
  try {
    //fetching data from the 'users' table in Supabase where the email matches the trimmed email
    const { data: user, error } = await supabase //allows the to query the 'users' table in Supabase for a user with the provided email
      .from('users')
      .select('*')
      .eq('email', trimmedEmail)
      .maybeSingle();//expecting either a single user object or null if no match is found

    //if there's an error or no user is found, display an error message
    if (error || !user) {
      setErrorMessage('Invalid email or password.');
      return;
    }

    // 2. Check stored password_hash against user input
    if (user.password_hash !== password) {
      setErrorMessage('Invalid email or password.');
      return;
    }

    // 3. Login successful!
    router.replace({
    pathname: '/home',//redirects the user to the home page after successful login
    params: { userId: user.id },//record the user id 
});
  //error handling
  } catch (err) {
    setErrorMessage('Unable to sign in right now. Check your connection and try again.');
  } finally {
    setPendingAction(null);
  }
};
  const isPending = pendingAction !== null;

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
            {/*header login page*/}
            <View style={styles.brand}>
              <Image
                source={require('../../assets/headerIcon/skillSwap.png')}
                style={styles.logo}
                resizeMode="contain"
                accessibilityLabel="SkillSwap"
              />
              <Text style={styles.brandCaption}>A COMMUNITY THAT LEARNS TOGETHER</Text>
            </View>

            <View style={styles.card}>
              {/* Login form with email and password fields, sign-in button, and guest access option */}
              <Text style={styles.eyebrow}>YOUR NEXT SKILL STARTS HERE</Text>
              <Text style={styles.title}>Welcome back</Text>
              <Text style={styles.subtitle}>Sign in to pick up where you left off.</Text>

              <View style={styles.field}>
                <Text style={styles.label}>Email address</Text>
                {/* email input field with validation and accessibility features */}
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
                  returnKeyType="next"
                />
              </View>

              <View style={styles.field}>
                <View style={styles.passwordLabelRow}>
                  <Text style={styles.label}>Password</Text>
                  {/* set the password to hide or show */}
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}
                    onPress={() => setPasswordVisible((visible) => !visible)}
                    disabled={isPending}
                  >
                    <Text style={styles.showPassword}>{passwordVisible ? 'Hide' : 'Show'}</Text>
                  </TouchableOpacity>
                </View>
                {/* password input field with validation and accessibility features */}
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  style={styles.input}
                  placeholder="Enter your password"
                  placeholderTextColor="#A5A3B2"
                  secureTextEntry={!passwordVisible}
                  autoCapitalize="none"
                  autoComplete="current-password"
                  textContentType="password"
                  accessibilityLabel="Password"
                  returnKeyType="go"
                  onSubmitEditing={signIn}
                />
              </View>


              {errorMessage ? (
                <Text accessibilityRole="alert" style={styles.errorMessage}>
                  {errorMessage}
                </Text>
              ) : null}
              {infoMessage ? (
                <Text accessibilityLiveRegion="polite" style={styles.infoMessage}>
                  {infoMessage}
                </Text>
              ) : null}
            {/* sign in button */}
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Sign in"
                onPress={signIn}
                disabled={isPending}
                style={[styles.signInButton, isPending && styles.disabledButton]}
              >
                {pendingAction === 'sign-in' ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.signInText}>Sign in</Text>
                )}
              </TouchableOpacity>
              {/*Register button */}
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Register for SkillSwap"
                onPress={() => router.push('/register')}
                disabled={isPending}
                style={styles.registerButton}
              >
                <Text style={styles.registerText}>Create an account</Text>
              </TouchableOpacity>
            </View>
            {/* allow user to explore the app as a guest without signing in */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>Just looking around?</Text>
              <TouchableOpacity
                accessibilityRole="button"
                onPress={() => router.replace('/home')}
                disabled={isPending}
                style={styles.guestButton}
              >
                <Text style={styles.guestText}>Explore as a guest</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
//styles for the login page
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F1E8',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: 32,
  },
  content: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  brand: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logo: {
    width: 176,
    height: 80,
  },
  brandCaption: {
    marginTop: 2,
    color: '#C45A42',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.8,
  },
  card: {
    padding: 24,
    backgroundColor: '#FFFCF6',
    borderWidth: 1,
    borderColor: '#EAE3D8',
    borderRadius: 22,
  },
  eyebrow: {
    color: '#C45A42',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  title: {
    marginTop: 8,
    color: '#203A33',
    fontSize: 30,
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 6,
    marginBottom: 24,
    color: '#70776F',
    fontSize: 14,
    lineHeight: 20,
  },
  field: {
    marginBottom: 17,
  },
  label: {
    marginBottom: 8,
    color: '#29483F',
    fontSize: 13,
    fontWeight: '700',
  },
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
  passwordLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  showPassword: {
    marginBottom: 8,
    color: '#245748',
    fontSize: 12,
    fontWeight: '700',
  },
  forgotButton: {
    alignSelf: 'flex-end',
    paddingVertical: 3,
    marginTop: -6,
    marginBottom: 16,
  },
  forgotText: {
    color: '#245748',
    fontSize: 12,
    fontWeight: '700',
  },
  errorMessage: {
    marginBottom: 14,
    color: '#B4233A',
    fontSize: 13,
    lineHeight: 19,
  },
  infoMessage: {
    marginBottom: 14,
    color: '#456B59',
    fontSize: 13,
    lineHeight: 19,
  },
  signInButton: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E76F51',
    borderRadius: 12,
  },
  disabledButton: {
    opacity: 0.7,
  },
  signInText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  footer: {
    alignItems: 'center',
    marginTop: 22,
  },
  footerText: {
    color: '#70776F',
    fontSize: 13,
  },
  guestButton: {
    padding: 8,
  },
  guestText: {
    color: '#245748',
    fontSize: 14,
    fontWeight: '800',
  },
  registerButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#245748',
    borderRadius: 12,
  },
  registerText: {
    color: '#245748',
    fontSize: 14,
    fontWeight: '800',
  },
});
