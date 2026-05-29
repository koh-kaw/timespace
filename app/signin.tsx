import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { SpaceBackground } from '../components/SpaceBackground';
import { supabase } from '../lib/supabase';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const submit = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('入力エラー', 'メールアドレスとパスワードを入力してください'); return;
    }
    setLoading(true);
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        Alert.alert('登録完了', 'サインインしてください');
        setMode('signin');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace('/');
      }
    } catch (err: any) {
      Alert.alert('エラー', err?.message || String(err));
    } finally { setLoading(false); }
  };

  return (
    <View style={styles.container}>
      <SpaceBackground />
      <SafeAreaView style={styles.inner}>
        <View style={styles.body}>
          <View style={styles.logoArea}>
            <Text style={styles.logoText}>✦</Text>
            <Text style={styles.title}>Timespace</Text>
            <Text style={styles.subtitle}>時間に奥行きを</Text>
          </View>

          <View style={styles.form}>
            <TextInput value={email} onChangeText={setEmail}
              placeholder="メールアドレス" placeholderTextColor="rgba(255,255,255,0.3)"
              autoCapitalize="none" keyboardType="email-address" style={styles.input} />
            <TextInput value={password} onChangeText={setPassword}
              placeholder="パスワード" placeholderTextColor="rgba(255,255,255,0.3)"
              secureTextEntry style={styles.input} />

            <Pressable onPress={submit} style={styles.primaryBtn} disabled={loading}>
              {loading
                ? <ActivityIndicator color="#FFF" />
                : <Text style={styles.primaryBtnText}>{mode === 'signup' ? '新規登録' : 'サインイン'}</Text>
              }
            </Pressable>

            <Pressable onPress={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
              <Text style={styles.switchText}>
                {mode === 'signin' ? '新規登録はこちら' : 'サインインに戻る'}
              </Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080714' },
  inner: { flex: 1 },
  body: { flex: 1, paddingHorizontal: 32, justifyContent: 'center' },
  logoArea: { alignItems: 'center', marginBottom: 56 },
  logoText: { fontSize: 48, color: '#8B7FFF', marginBottom: 12 },
  title: { fontSize: 36, fontWeight: '300', color: '#FFFFFF', letterSpacing: 4 },
  subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 6, letterSpacing: 2 },
  form: { gap: 12 },
  input: {
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.15)', borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 15,
    backgroundColor: 'rgba(255,255,255,0.06)', color: '#FFFFFF',
  },
  primaryBtn: {
    backgroundColor: 'rgba(139,127,255,0.8)', paddingVertical: 15,
    borderRadius: 14, alignItems: 'center', marginTop: 8,
    borderWidth: 0.5, borderColor: 'rgba(139,127,255,0.5)',
  },
  primaryBtnText: { color: '#FFF', fontWeight: '600', fontSize: 16, letterSpacing: 0.5 },
  switchText: { textAlign: 'center', color: 'rgba(139,127,255,0.8)', marginTop: 16, fontSize: 13 },
});
