import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const submit = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('入力エラー', 'メールアドレスとパスワードを入力してください');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        Alert.alert('登録', 'メールを確認してアカウントを有効化してください');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace('/');
      }
    } catch (err: any) {
      Alert.alert('エラー', err?.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.body}>
        <Text style={styles.title}>Timespace</Text>
        <Text style={styles.subtitle}>時間に奥行きを</Text>

        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="email@example.com"
          autoCapitalize="none"
          keyboardType="email-address"
          style={styles.input}
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="パスワード"
          secureTextEntry
          style={styles.input}
        />

        <Pressable onPress={submit} style={styles.primaryBtn} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.primaryBtnText}>
              {mode === 'signup' ? '新規登録' : 'サインイン'}
            </Text>
          )}
        </Pressable>

        <Pressable onPress={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
          <Text style={styles.switch}>
            {mode === 'signin' ? '新規登録はこちら' : 'サインインに戻る'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  body: { flex: 1, padding: 24, justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '500', textAlign: 'center', color: '#2C2C2A' },
  subtitle: { fontSize: 14, textAlign: 'center', color: '#888780', marginBottom: 32 },
  input: {
    borderWidth: 0.5,
    borderColor: '#D3D1C7',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 12,
  },
  primaryBtn: {
    backgroundColor: '#7F77DD',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryBtnText: { color: '#FFF', fontWeight: '500', fontSize: 15 },
  switch: { textAlign: 'center', color: '#7F77DD', marginTop: 16, fontSize: 13 },
});
