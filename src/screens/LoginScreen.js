import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Modal,
  StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { supabase } from '../lib/supabase';

export default function LoginScreen({ navigation }) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);

  const [resetVisible, setResetVisible]   = useState(false);
  const [resetEmail, setResetEmail]       = useState('');
  const [resetLoading, setResetLoading]   = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch {
      Alert.alert('Login Failed', 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    const trimmed = resetEmail.trim();
    if (!trimmed) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }
    setResetLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(trimmed);
      if (error) throw error;
      setResetVisible(false);
      setResetEmail('');
      Alert.alert(
        'Email sent',
        'Check your inbox for a password reset link. It may take a few minutes to arrive.'
      );
    } catch {
      Alert.alert('Error', 'Could not send reset email. Please try again.');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.logo}>WeFlix</Text>
      <Text style={styles.tagline}>Movies you'll both love</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#8a6a30"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#8a6a30"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      {loading ? (
        <ActivityIndicator size="large" color="#C9A84C" style={{ marginTop: 16 }} />
      ) : (
        <TouchableOpacity style={styles.button} onPress={handleLogin}>
          <Text style={styles.buttonText}>Log In</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity onPress={() => setResetVisible(true)} style={{ marginBottom: 16 }}>
        <Text style={styles.forgotLink}>Forgot Password?</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
        <Text style={styles.link}>Don't have an account? Sign up</Text>
      </TouchableOpacity>

      <Modal visible={resetVisible} transparent animationType="fade">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Reset Password</Text>
            <Text style={styles.modalBody}>
              Enter your email and we'll send you a link to reset your password.
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#8a6a30"
              value={resetEmail}
              onChangeText={setResetEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalCancelBtn]}
                onPress={() => { setResetVisible(false); setResetEmail(''); }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalConfirmBtn]}
                onPress={handleResetPassword}
                disabled={resetLoading}
              >
                {resetLoading
                  ? <ActivityIndicator color="#C9A84C" size="small" />
                  : <Text style={styles.modalConfirmText}>Send</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a0505',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  logo: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#C9A84C',
    textAlign: 'center',
    marginBottom: 8,
  },
  tagline: {
    color: '#8a6a30',
    textAlign: 'center',
    marginBottom: 40,
    fontSize: 16,
  },
  input: {
    backgroundColor: '#8B2A2A',
    color: '#ddc9a8',
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#C9A84C',
  },
  button: {
    backgroundColor: '#8B1A1A',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#C9A84C',
  },
  buttonText: {
    color: '#C9A84C',
    fontSize: 18,
    fontWeight: 'bold',
  },
  forgotLink: {
    color: '#8a6a30',
    textAlign: 'center',
    fontSize: 14,
  },
  link: {
    color: '#C9A84C',
    textAlign: 'center',
    fontSize: 15,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBox: {
    backgroundColor: '#1a0505',
    borderRadius: 16,
    padding: 24,
    width: '88%',
    borderWidth: 1,
    borderColor: '#C9A84C',
  },
  modalTitle: { color: '#C9A84C', fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  modalBody: { color: '#8a6a30', fontSize: 14, lineHeight: 20, marginBottom: 16 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  modalBtn: { flex: 1, borderRadius: 10, padding: 13, alignItems: 'center' },
  modalCancelBtn: { backgroundColor: '#5a2a2a' },
  modalCancelText: { color: '#8a6a30', fontWeight: '600' },
  modalConfirmBtn: { backgroundColor: '#8B1A1A', borderWidth: 1, borderColor: '#C9A84C' },
  modalConfirmText: { color: '#C9A84C', fontWeight: 'bold' },
});
