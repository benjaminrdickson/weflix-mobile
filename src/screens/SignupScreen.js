import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { supabase } from '../lib/supabase';

export default function SignupScreen({ navigation }) {
  const [form, setForm] = useState({
    name: '', username: '', email: '',
    password: '', password_confirmation: '',
  });
  const [loading, setLoading] = useState(false);

  const set = (field) => (value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSignup = async () => {
    if (!form.name || !form.username || !form.email || !form.password || !form.password_confirmation) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }
    if (form.password !== form.password_confirmation) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    const name     = form.name.trim();
    const username = form.username.trim();
    const email    = form.email.trim();

    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email:    email,
        password: form.password,
        options:  { data: { name, username } },
      });
      if (error) throw error;

      // Sign out immediately so user explicitly logs in (preserves current UX)
      await supabase.auth.signOut();
      Alert.alert('Account created!', 'You can now log in.', [
        { text: 'OK', onPress: () => navigation.navigate('Login') },
      ]);
    } catch (err) {
      Alert.alert('Signup Failed', err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#1a1a2e' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Create Account</Text>

        {[
          { field: 'name', placeholder: 'Full Name' },
          { field: 'username', placeholder: 'Username', autoCapitalize: 'none' },
          { field: 'email', placeholder: 'Email', keyboardType: 'email-address', autoCapitalize: 'none' },
          { field: 'password', placeholder: 'Password', secure: true },
          { field: 'password_confirmation', placeholder: 'Confirm Password', secure: true },
        ].map(({ field, placeholder, secure, keyboardType, autoCapitalize }) => (
          <TextInput
            key={field}
            style={styles.input}
            placeholder={placeholder}
            placeholderTextColor="#888"
            value={form[field]}
            onChangeText={set(field)}
            secureTextEntry={secure}
            keyboardType={keyboardType}
            autoCapitalize={autoCapitalize || 'words'}
          />
        ))}

        {loading ? (
          <ActivityIndicator size="large" color="#e94560" style={{ marginTop: 16 }} />
        ) : (
          <TouchableOpacity style={styles.button} onPress={handleSignup}>
            <Text style={styles.buttonText}>Sign Up</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
          <Text style={styles.link}>Already have an account? Log in</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#e94560',
    textAlign: 'center',
    marginBottom: 32,
  },
  input: {
    backgroundColor: '#16213e',
    color: '#fff',
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#0f3460',
  },
  button: {
    backgroundColor: '#e94560',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  link: {
    color: '#e94560',
    textAlign: 'center',
    fontSize: 15,
  },
});
