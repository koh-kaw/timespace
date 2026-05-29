import React from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useSessionStore } from '../lib/store';

export default function Settings() {
  const router = useRouter();
  const userId = useSessionStore((s) => s.userId);

  const signOut = async () => {
    Alert.alert('サインアウト', '本当にサインアウトしますか？', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: 'サインアウト',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          router.replace('/signin');
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>アカウント</Text>
        <Text style={styles.value}>{userId ? `User ID: ${userId.slice(0, 8)}…` : '未サインイン'}</Text>
      </View>

      <View style={styles.section}>
        <Pressable onPress={signOut} style={styles.dangerBtn}>
          <Text style={styles.dangerBtnText}>サインアウト</Text>
        </Pressable>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Timespace v0.1.0</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFF' },
  section: { padding: 16, borderBottomWidth: 0.5, borderBottomColor: '#D3D1C7' },
  sectionTitle: { fontSize: 12, color: '#888780', marginBottom: 6, textTransform: 'uppercase' },
  value: { fontSize: 14, color: '#2C2C2A' },
  dangerBtn: { paddingVertical: 12, alignItems: 'center', backgroundColor: '#FCEBEB', borderRadius: 8 },
  dangerBtnText: { color: '#A32D2D', fontWeight: '500' },
  footer: { padding: 16, alignItems: 'center' },
  footerText: { color: '#888780', fontSize: 12 },
});
