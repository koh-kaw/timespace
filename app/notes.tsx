import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, TextInput,
  FlatList, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SpaceBackground } from '../components/SpaceBackground';
import { supabase } from '../lib/supabase';
import { useSessionStore } from '../lib/store';

type Note = {
  id: string;
  title: string;
  body: string;
  created_at: string;
  updated_at: string;
};

// ─── Note list screen ────────────────────────────────────────
function NoteList({ onSelect, onNew }: { onSelect: (n: Note) => void; onNew: () => void }) {
  const userId = useSessionStore(s => s.userId);
  const [notes, setNotes] = useState<Note[]>([]);

  const load = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });
    if (data) setNotes(data as Note[]);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const deleteNote = async (id: string) => {
    Alert.alert('削除', 'このメモを削除しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      { text: '削除', style: 'destructive', onPress: async () => {
        await supabase.from('notes').delete().eq('id', id);
        load();
      }},
    ]);
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={s.header}>
        <Text style={s.headerTitle}>メモ</Text>
        <Pressable onPress={onNew} style={s.newBtn}>
          <Text style={s.newBtnText}>＋</Text>
        </Pressable>
      </View>
      {notes.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyIcon}>📝</Text>
          <Text style={s.emptyText}>メモがありません</Text>
          <Pressable onPress={onNew} style={s.emptyBtn}>
            <Text style={s.emptyBtnText}>最初のメモを作成</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={notes}
          keyExtractor={n => n.id}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          renderItem={({ item }) => (
            <Pressable onPress={() => onSelect(item)} onLongPress={() => deleteNote(item.id)}
              style={s.noteCard}>
              <Text style={s.noteTitle} numberOfLines={1}>
                {item.title || '無題'}
              </Text>
              <Text style={s.noteBody} numberOfLines={2}>
                {item.body || '内容なし'}
              </Text>
              <Text style={s.noteDate}>
                {new Date(item.updated_at).toLocaleDateString('ja-JP')} {new Date(item.updated_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

// ─── Note editor ─────────────────────────────────────────────
function NoteEditor({ note, userId, onBack, onSaved }: {
  note: Note | null; userId: string; onBack: () => void; onSaved: () => void;
}) {
  const [title, setTitle] = useState(note?.title ?? '');
  const [body, setBody] = useState(note?.body ?? '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!title.trim() && !body.trim()) { onBack(); return; }
    setSaving(true);
    try {
      if (note) {
        await supabase.from('notes').update({
          title: title.trim(), body: body.trim(),
          updated_at: new Date().toISOString(),
        }).eq('id', note.id);
      } else {
        await supabase.from('notes').insert({
          user_id: userId, title: title.trim(), body: body.trim(),
          created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        });
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.editorHeader}>
        <Pressable onPress={save} style={s.backBtn}>
          <Text style={s.backBtnText}>‹ 完了</Text>
        </Pressable>
        <Text style={s.editorStatus}>{saving ? '保存中…' : ''}</Text>
      </View>
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="タイトル"
        placeholderTextColor="rgba(255,255,255,0.2)"
        style={s.titleInput}
        autoFocus={!note}
        returnKeyType="next"
      />
      <View style={s.divider} />
      <TextInput
        value={body}
        onChangeText={setBody}
        placeholder="メモを入力…"
        placeholderTextColor="rgba(255,255,255,0.2)"
        style={s.bodyInput}
        multiline
        textAlignVertical="top"
      />
    </KeyboardAvoidingView>
  );
}

// ─── Page ─────────────────────────────────────────────────────
export default function NotesPage() {
  const userId = useSessionStore(s => s.userId);
  const [view, setView] = useState<'list' | 'edit'>('list');
  const [editing, setEditing] = useState<Note | null>(null);
  const [refresh, setRefresh] = useState(0);

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <SpaceBackground />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        {view === 'list' ? (
          <NoteList
            key={refresh}
            onSelect={n => { setEditing(n); setView('edit'); }}
            onNew={() => { setEditing(null); setView('edit'); }}
          />
        ) : (
          <NoteEditor
            note={editing}
            userId={userId ?? ''}
            onBack={() => setView('list')}
            onSaved={() => { setRefresh(r => r + 1); setView('list'); }}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12,
    borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.08)' },
  headerTitle: { fontSize: 20, fontWeight: '300', color: '#fff', letterSpacing: 1 },
  newBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(232,197,106,0.2)',
    borderWidth: 0.5, borderColor: 'rgba(232,197,106,0.5)', alignItems: 'center', justifyContent: 'center' },
  newBtnText: { fontSize: 20, color: '#E8C56A', lineHeight: 22 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: 15, color: 'rgba(255,255,255,0.3)', fontWeight: '300' },
  emptyBtn: { marginTop: 8, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20,
    backgroundColor: 'rgba(232,197,106,0.15)', borderWidth: 0.5, borderColor: 'rgba(232,197,106,0.4)' },
  emptyBtnText: { color: '#E8C56A', fontSize: 14, fontWeight: '400' },

  noteCard: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14,
    padding: 16, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)' },
  noteTitle: { fontSize: 15, fontWeight: '500', color: 'rgba(255,255,255,0.88)', marginBottom: 6 },
  noteBody: { fontSize: 13, color: 'rgba(255,255,255,0.4)', lineHeight: 18, marginBottom: 10 },
  noteDate: { fontSize: 10, color: 'rgba(255,255,255,0.2)', letterSpacing: 0.5 },

  editorHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.08)' },
  backBtn: { padding: 4 },
  backBtnText: { fontSize: 16, color: '#E8C56A', fontWeight: '400' },
  editorStatus: { fontSize: 12, color: 'rgba(255,255,255,0.3)' },

  titleInput: { fontSize: 22, fontWeight: '500', color: 'rgba(255,255,255,0.88)',
    paddingHorizontal: 20, paddingVertical: 14 },
  divider: { height: 0.5, backgroundColor: 'rgba(255,255,255,0.08)', marginHorizontal: 20 },
  bodyInput: { flex: 1, fontSize: 15, color: 'rgba(255,255,255,0.75)',
    paddingHorizontal: 20, paddingTop: 14, lineHeight: 24, fontWeight: '300' },
});
