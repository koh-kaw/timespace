import React from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { SpaceBackground } from '../components/SpaceBackground';
import { supabase } from '../lib/supabase';
import { useSessionStore } from '../lib/store';

export default function Settings() {
  const router = useRouter();
  const userId = useSessionStore((s) => s.userId);

  const signOut = async () => {
    Alert.alert('サインアウト', '本当にサインアウトしますか？', [
      { text: 'キャンセル', style: 'cancel' },
      { text: 'サインアウト', style: 'destructive', onPress: async () => {
        await supabase.auth.signOut(); router.replace('/signin');
      }},
    ]);
  };

  return (
    <View style={styles.container}>
      <SpaceBackground />
      <SafeAreaView style={styles.inner} edges={['bottom']}>
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>アカウント</Text>
          <View style={styles.card}>
            <Text style={styles.cardText}>{userId ? `ID: ${userId.slice(0, 12)}…` : '未サインイン'}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Pressable onPress={signOut} style={styles.dangerBtn}>
            <Text style={styles.dangerBtnText}>サインアウト</Text>
          </Pressable>
        </View>

        <View style={styles.footer}>
          <Text style={styles.version}>Timespace v0.1.0</Text>
          <Text style={styles.tagline}>時間に奥行きを</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  inner: { flex: 1 },
  section: { padding: 20, marginTop: 8 },
  sectionLabel: { fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  card: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14,
    padding: 16, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)' },
  cardText: { color: 'rgba(255,255,255,0.7)', fontSize: 14 },
  dangerBtn: { backgroundColor: 'rgba(255,107,107,0.12)', paddingVertical: 14,
    borderRadius: 14, alignItems: 'center',
    borderWidth: 0.5, borderColor: 'rgba(255,107,107,0.25)' },
  dangerBtnText: { color: '#FF6B6B', fontWeight: '600', fontSize: 15 },
  footer: { position: 'absolute', bottom: 40, left: 0, right: 0, alignItems: 'center' },
  version: { color: 'rgba(255,255,255,0.2)', fontSize: 12 },
  tagline: { color: 'rgba(255,255,255,0.15)', fontSize: 11, marginTop: 4, letterSpacing: 2 },
});
