import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, TextInput,
  FlatList, Alert, KeyboardAvoidingView, Platform,
  ScrollView, Modal, Animated, Dimensions, Image,
  ActionSheetIOS,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SpaceBackground } from '../components/SpaceBackground';
import { supabase } from '../lib/supabase';
import { useSessionStore } from '../lib/store';

const { width: SW } = Dimensions.get('window');
const GOLD = '#E8C56A';

type Folder = { id: string; name: string; created_at: string };
type Note = {
  id: string; title: string; body: string;
  folder_id: string | null; image_urls: string[];
  created_at: string; updated_at: string;
};

// ─── Markdown preview renderer ────────────────────────────────
function MarkdownText({ source, style }: { source: string; style?: any }) {
  const lines = source.split('\n');
  return (
    <ScrollView style={{ flex: 1 }}>
      {lines.map((line, i) => {
        if (line.startsWith('### ')) return <Text key={i} style={[styles.mdH3]}>{line.slice(4)}</Text>;
        if (line.startsWith('## '))  return <Text key={i} style={[styles.mdH2]}>{line.slice(3)}</Text>;
        if (line.startsWith('# '))   return <Text key={i} style={[styles.mdH1]}>{line.slice(2)}</Text>;
        if (line.startsWith('> '))   return <View key={i} style={styles.mdQuote}><Text style={styles.mdQuoteText}>{line.slice(2)}</Text></View>;
        if (line.startsWith('- ') || line.startsWith('* ')) return <Text key={i} style={styles.mdLi}>{'  •  '}{line.slice(2)}</Text>;
        if (/^\d+\. /.test(line)) {
          const m = line.match(/^(\d+)\. (.*)/)!;
          return <Text key={i} style={styles.mdLi}>  {m[1]}.  {m[2]}</Text>;
        }
        if (line.startsWith('---') || line.startsWith('===')) return <View key={i} style={styles.mdHr} />;
        if (line === '') return <Text key={i} style={{ height: 8 }} />;
        // inline bold/italic
        const parts = line.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
        return (
          <Text key={i} style={styles.mdP}>
            {parts.map((p, j) => {
              if (p.startsWith('**') && p.endsWith('**')) return <Text key={j} style={styles.mdBold}>{p.slice(2,-2)}</Text>;
              if (p.startsWith('*') && p.endsWith('*')) return <Text key={j} style={styles.mdItalic}>{p.slice(1,-1)}</Text>;
              if (p.startsWith('`') && p.endsWith('`')) return <Text key={j} style={styles.mdCode}>{p.slice(1,-1)}</Text>;
              return p;
            })}
          </Text>
        );
      })}
    </ScrollView>
  );
}

// ─── Swipeable note card ──────────────────────────────────────
function SwipeableNoteCard({ note, folders, onPress, onDelete, onMove }: {
  note: Note; folders: Folder[];
  onPress: () => void; onDelete: () => void; onMove: (folderId: string | null) => void;
}) {
  const tx = useRef(new Animated.Value(0)).current;
  const touchStart = useRef<number | null>(null);

  const handleTouchStart = (e: any) => { touchStart.current = e.nativeEvent.pageX; };
  const handleTouchEnd = (e: any) => {
    if (touchStart.current === null) return;
    const dx = e.nativeEvent.pageX - touchStart.current;
    touchStart.current = null;
    if (dx < -60) {
      // Swipe left → delete
      Animated.timing(tx, { toValue: -SW, duration: 220, useNativeDriver: true }).start(() => {
        tx.setValue(0); onDelete();
      });
    } else if (dx > 60) {
      // Swipe right → move to folder
      Animated.spring(tx, { toValue: 0, useNativeDriver: true }).start();
      if (Platform.OS === 'ios' && folders.length > 0) {
        ActionSheetIOS.showActionSheetWithOptions({
          options: ['キャンセル', 'フォルダなし', ...folders.map(f => f.name)],
          cancelButtonIndex: 0,
        }, (idx) => {
          if (idx === 0) return;
          if (idx === 1) onMove(null);
          else onMove(folders[idx - 2].id);
        });
      }
    } else {
      Animated.spring(tx, { toValue: 0, useNativeDriver: true }).start();
    }
  };

  const folderName = folders.find(f => f.id === note.folder_id)?.name;

  return (
    <Animated.View style={{ transform: [{ translateX: tx }] }}>
      {/* Delete hint */}
      <View style={styles.swipeHint}>
        <Text style={styles.swipeHintText}>🗑</Text>
      </View>
      <Pressable
        style={styles.noteCard}
        onPress={onPress}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {folderName && <View style={styles.folderTag}><Text style={styles.folderTagText}>📁 {folderName}</Text></View>}
        <Text style={styles.noteTitle} numberOfLines={1}>{note.title || '無題'}</Text>
        <Text style={styles.noteBody} numberOfLines={2}>{note.body || '内容なし'}</Text>
        <View style={styles.noteFooter}>
          {note.image_urls?.length > 0 && <Text style={styles.noteImg}>🖼 {note.image_urls.length}</Text>}
          <Text style={styles.noteDate}>
            {new Date(note.updated_at).toLocaleDateString('ja-JP')} {new Date(note.updated_at).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'})}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ─── Folder modal ─────────────────────────────────────────────
function FolderModal({ visible, userId, folders, onClose, onRefresh }: {
  visible: boolean; userId: string; folders: Folder[];
  onClose: () => void; onRefresh: () => void;
}) {
  const [name, setName] = useState('');
  const create = async () => {
    if (!name.trim()) return;
    await supabase.from('note_folders').insert({ user_id: userId, name: name.trim() });
    setName(''); onRefresh();
  };
  const del = async (id: string) => {
    await supabase.from('note_folders').delete().eq('id', id);
    onRefresh();
  };
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalBg} onPress={onClose} />
      <View style={styles.modalSheet}>
        <View style={styles.modalHandle} />
        <Text style={styles.modalTitle}>フォルダ管理</Text>
        <View style={styles.folderInputRow}>
          <TextInput value={name} onChangeText={setName} placeholder="新しいフォルダ名"
            placeholderTextColor="rgba(255,255,255,0.2)" style={styles.folderInput} />
          <Pressable onPress={create} style={styles.folderAddBtn}>
            <Text style={{ color: '#000', fontWeight: '600' }}>追加</Text>
          </Pressable>
        </View>
        {folders.map(f => (
          <View key={f.id} style={styles.folderRow}>
            <Text style={styles.folderRowName}>📁 {f.name}</Text>
            <Pressable onPress={() => del(f.id)}><Text style={{ color: '#FF6B6B', fontSize: 18 }}>×</Text></Pressable>
          </View>
        ))}
        <Pressable onPress={onClose} style={styles.modalClose}>
          <Text style={{ color: GOLD }}>閉じる</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

// ─── Note editor ──────────────────────────────────────────────
function NoteEditor({ note, userId, folders, onBack }: {
  note: Note | null; userId: string; folders: Folder[]; onBack: () => void;
}) {
  const [title, setTitle] = useState(note?.title ?? '');
  const [body, setBody] = useState(note?.body ?? '');
  const [preview, setPreview] = useState(false);
  const [imageUrls, setImageUrls] = useState<string[]>(note?.image_urls ?? []);
  const [imageInput, setImageInput] = useState('');
  const [showImageInput, setShowImageInput] = useState(false);
  const saveTimeout = useRef<any>(null);

  const save = useCallback(async (t: string, b: string, imgs: string[]) => {
    if (!t.trim() && !b.trim() && imgs.length === 0) return;
    const payload = { title: t.trim(), body: b.trim(), image_urls: imgs, updated_at: new Date().toISOString() };
    if (note) {
      await supabase.from('notes').update(payload).eq('id', note.id);
    } else {
      await supabase.from('notes').insert({ user_id: userId, ...payload, created_at: new Date().toISOString() });
    }
  }, [note, userId]);

  // Auto-save on change
  const handleChange = (t: string, b: string, imgs: string[]) => {
    clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => save(t, b, imgs), 1200);
  };

  const addImage = () => {
    if (!imageInput.trim()) return;
    const newUrls = [...imageUrls, imageInput.trim()];
    setImageUrls(newUrls);
    setImageInput('');
    setShowImageInput(false);
    handleChange(title, body, newUrls);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Toolbar */}
      <View style={styles.editorToolbar}>
        <Pressable onPress={async () => { await save(title, body, imageUrls); onBack(); }} style={styles.backBtn}>
          <Text style={styles.backBtnText}>‹ 完了</Text>
        </Pressable>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Pressable onPress={() => setShowImageInput(v => !v)}>
            <Text style={{ fontSize: 18, color: 'rgba(255,255,255,0.5)' }}>🖼</Text>
          </Pressable>
          <Pressable onPress={() => setPreview(v => !v)} style={[styles.previewBtn, preview && styles.previewBtnActive]}>
            <Text style={{ fontSize: 11, color: preview ? '#000' : GOLD, fontWeight: '600' }}>
              {preview ? '編集' : 'MD'}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Image URL input */}
      {showImageInput && (
        <View style={styles.imageInputRow}>
          <TextInput value={imageInput} onChangeText={setImageInput}
            placeholder="画像URL を入力" placeholderTextColor="rgba(255,255,255,0.2)"
            style={styles.imageInput} autoCapitalize="none" />
          <Pressable onPress={addImage} style={styles.imageAddBtn}>
            <Text style={{ color: '#000', fontWeight: '600', fontSize: 12 }}>追加</Text>
          </Pressable>
        </View>
      )}

      {/* Images */}
      {imageUrls.length > 0 && (
        <ScrollView horizontal style={styles.imageStrip} contentContainerStyle={{ gap: 8, padding: 8 }}>
          {imageUrls.map((url, i) => (
            <Pressable key={i} onLongPress={() => {
              const u = imageUrls.filter((_, j) => j !== i);
              setImageUrls(u); handleChange(title, body, u);
            }}>
              <Image source={{ uri: url }} style={styles.thumbnail} />
            </Pressable>
          ))}
        </ScrollView>
      )}

      <TextInput value={title} onChangeText={t => { setTitle(t); handleChange(t, body, imageUrls); }}
        placeholder="タイトル" placeholderTextColor="rgba(255,255,255,0.2)"
        style={styles.titleInput} />
      <View style={styles.divider} />

      {preview ? (
        <View style={{ flex: 1, padding: 20 }}>
          <MarkdownText source={body} />
        </View>
      ) : (
        <TextInput value={body} onChangeText={b => { setBody(b); handleChange(title, b, imageUrls); }}
          placeholder={`マークダウンで記入できます\n\n# 見出し1\n## 見出し2\n**太字** *斜体* \`コード\`\n- リスト\n> 引用`}
          placeholderTextColor="rgba(255,255,255,0.15)"
          style={styles.bodyInput} multiline textAlignVertical="top" />
      )}

      {/* MD quick insert bar */}
      {!preview && (
        <ScrollView horizontal style={styles.mdBar} contentContainerStyle={{ gap: 6, padding: 6 }} keyboardShouldPersistTaps="always">
          {[['# ','H1'],['## ','H2'],['**','太'],['*','斜'],['`','コ'],['- ','・'],['> ','引'],['---','─']].map(([insert, label]) => (
            <Pressable key={label} onPress={() => {
              const b2 = body + insert;
              setBody(b2); handleChange(title, b2, imageUrls);
            }} style={styles.mdBarBtn}>
              <Text style={styles.mdBarBtnText}>{label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

// ─── Main page ────────────────────────────────────────────────
export default function NotesPage() {
  const userId = useSessionStore(s => s.userId) ?? '';
  const [notes, setNotes] = useState<Note[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string | null | 'all'>('all');
  const [editing, setEditing] = useState<Note | null | 'new'>('list' as any);
  const [view, setView] = useState<'list' | 'edit'>('list');
  const [showFolders, setShowFolders] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const loadFolders = useCallback(async () => {
    const { data } = await supabase.from('note_folders').select('*').eq('user_id', userId).order('created_at');
    if (data) setFolders(data as Folder[]);
  }, [userId]);

  const loadNotes = useCallback(async () => {
    let q = supabase.from('notes').select('*').eq('user_id', userId).order('updated_at', { ascending: false });
    if (selectedFolder !== 'all') {
      if (selectedFolder === null) q = q.is('folder_id', null);
      else q = q.eq('folder_id', selectedFolder);
    }
    const { data } = await q;
    if (data) setNotes(data as Note[]);
  }, [userId, selectedFolder]);

  useEffect(() => { loadFolders(); }, [loadFolders]);
  useEffect(() => { loadNotes(); }, [loadNotes]);

  const deleteNote = async (id: string) => {
    await supabase.from('notes').delete().eq('id', id);
    loadNotes();
  };

  const moveNote = async (noteId: string, folderId: string | null) => {
    await supabase.from('notes').update({ folder_id: folderId }).eq('id', noteId);
    loadNotes();
  };

  const filteredNotes = notes.filter(n =>
    !searchQuery || n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    n.body.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (view === 'edit') {
    return (
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <SpaceBackground />
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
          <NoteEditor
            note={editing === 'new' ? null : editing as Note}
            userId={userId}
            folders={folders}
            onBack={() => { setView('list'); loadNotes(); }}
          />
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <SpaceBackground />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>メモ</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable onPress={() => setShowFolders(true)} style={styles.iconBtn}>
              <Text style={{ fontSize: 18 }}>📁</Text>
            </Pressable>
            <Pressable onPress={() => { setEditing('new'); setView('edit'); }} style={styles.iconBtn}>
              <Text style={{ fontSize: 20, color: GOLD, lineHeight: 22 }}>＋</Text>
            </Pressable>
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchRow}>
          <TextInput value={searchQuery} onChangeText={setSearchQuery}
            placeholder="🔍  検索…" placeholderTextColor="rgba(255,255,255,0.25)"
            style={styles.searchInput} clearButtonMode="while-editing" />
        </View>

        {/* Folder filter tabs */}
        <ScrollView horizontal style={{ maxHeight: 40 }} contentContainerStyle={styles.folderTabs}
          showsHorizontalScrollIndicator={false}>
          {[{ id: 'all', name: 'すべて' }, { id: null, name: 'フォルダなし' }, ...folders].map(f => (
            <Pressable key={String(f.id)} onPress={() => setSelectedFolder(f.id as any)}
              style={[styles.folderTab, selectedFolder === f.id && styles.folderTabActive]}>
              <Text style={[styles.folderTabText, selectedFolder === f.id && styles.folderTabTextActive]}>
                {f.id !== 'all' && f.id !== null ? '📁 ' : ''}{f.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Notes list */}
        {filteredNotes.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📝</Text>
            <Text style={styles.emptyText}>{searchQuery ? '見つかりません' : 'メモがありません'}</Text>
            {!searchQuery && (
              <Pressable onPress={() => { setEditing('new'); setView('edit'); }} style={styles.emptyBtn}>
                <Text style={styles.emptyBtnText}>最初のメモを作成</Text>
              </Pressable>
            )}
          </View>
        ) : (
          <FlatList
            data={filteredNotes}
            keyExtractor={n => n.id}
            contentContainerStyle={{ padding: 12, gap: 10 }}
            renderItem={({ item }) => (
              <SwipeableNoteCard
                note={item}
                folders={folders}
                onPress={() => { setEditing(item); setView('edit'); }}
                onDelete={() => deleteNote(item.id)}
                onMove={(fid) => moveNote(item.id, fid)}
              />
            )}
          />
        )}

        <FolderModal
          visible={showFolders}
          userId={userId}
          folders={folders}
          onClose={() => setShowFolders(false)}
          onRefresh={() => { loadFolders(); loadNotes(); }}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 10,
    borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.08)' },
  headerTitle: { fontSize: 22, fontWeight: '300', color: '#fff', letterSpacing: 1 },
  iconBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center' },

  searchRow: { paddingHorizontal: 14, paddingVertical: 8 },
  searchInput: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 9, fontSize: 14,
    color: 'rgba(255,255,255,0.8)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)' },

  folderTabs: { paddingHorizontal: 12, gap: 6, paddingBottom: 6 },
  folderTab: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)' },
  folderTabActive: { backgroundColor: 'rgba(232,197,106,0.18)', borderColor: 'rgba(232,197,106,0.5)' },
  folderTabText: { fontSize: 12, color: 'rgba(255,255,255,0.45)', fontWeight: '300' },
  folderTabTextActive: { color: GOLD, fontWeight: '500' },

  swipeHint: { position: 'absolute', right: 16, top: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center', width: 60 },
  swipeHintText: { fontSize: 24 },
  noteCard: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14,
    padding: 14, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)' },
  folderTag: { backgroundColor: 'rgba(232,197,106,0.1)', borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start', marginBottom: 6 },
  folderTagText: { fontSize: 10, color: GOLD },
  noteTitle: { fontSize: 15, fontWeight: '500', color: 'rgba(255,255,255,0.88)', marginBottom: 5 },
  noteBody: { fontSize: 13, color: 'rgba(255,255,255,0.4)', lineHeight: 18, marginBottom: 8 },
  noteFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  noteImg: { fontSize: 11, color: 'rgba(255,255,255,0.3)' },
  noteDate: { fontSize: 10, color: 'rgba(255,255,255,0.2)', letterSpacing: 0.5 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: 15, color: 'rgba(255,255,255,0.3)', fontWeight: '300' },
  emptyBtn: { marginTop: 8, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20,
    backgroundColor: 'rgba(232,197,106,0.15)', borderWidth: 0.5, borderColor: 'rgba(232,197,106,0.4)' },
  emptyBtnText: { color: GOLD, fontSize: 14 },

  // Editor
  editorToolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.08)' },
  backBtn: { padding: 4 },
  backBtnText: { fontSize: 16, color: GOLD },
  previewBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
    borderWidth: 0.5, borderColor: GOLD },
  previewBtnActive: { backgroundColor: GOLD },

  imageInputRow: { flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 6, gap: 8 },
  imageInput: { flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 7, fontSize: 13, color: '#fff',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)' },
  imageAddBtn: { backgroundColor: GOLD, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10 },
  imageStrip: { maxHeight: 90 },
  thumbnail: { width: 76, height: 76, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.1)' },

  titleInput: { fontSize: 22, fontWeight: '500', color: 'rgba(255,255,255,0.88)',
    paddingHorizontal: 20, paddingVertical: 12 },
  divider: { height: 0.5, backgroundColor: 'rgba(255,255,255,0.08)', marginHorizontal: 20 },
  bodyInput: { flex: 1, fontSize: 15, color: 'rgba(255,255,255,0.78)',
    paddingHorizontal: 20, paddingTop: 12, lineHeight: 24, fontWeight: '300' },

  mdBar: { maxHeight: 40, borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)' },
  mdBarBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center' },
  mdBarBtnText: { fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: '500' },

  // Markdown styles
  mdH1: { fontSize: 24, fontWeight: '700', color: '#fff', marginVertical: 8 },
  mdH2: { fontSize: 20, fontWeight: '600', color: 'rgba(255,255,255,0.9)', marginVertical: 6 },
  mdH3: { fontSize: 16, fontWeight: '600', color: GOLD, marginVertical: 4 },
  mdP:  { fontSize: 15, color: 'rgba(255,255,255,0.78)', lineHeight: 24, marginVertical: 2 },
  mdBold: { fontWeight: '700', color: '#fff' },
  mdItalic: { fontStyle: 'italic', color: 'rgba(255,255,255,0.85)' },
  mdCode: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 4, paddingHorizontal: 4,
    fontSize: 13, color: '#34D399' },
  mdLi: { fontSize: 15, color: 'rgba(255,255,255,0.78)', lineHeight: 24, marginVertical: 1 },
  mdQuote: { borderLeftWidth: 3, borderLeftColor: GOLD, paddingLeft: 12, marginVertical: 4 },
  mdQuoteText: { fontSize: 14, color: 'rgba(255,255,255,0.55)', fontStyle: 'italic' },
  mdHr: { height: 0.5, backgroundColor: 'rgba(255,255,255,0.15)', marginVertical: 10 },

  // Folder modal
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  modalSheet: { backgroundColor: '#0a0818', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 40, borderTopWidth: 0.5, borderColor: 'rgba(255,255,255,0.15)' },
  modalHandle: { width: 36, height: 4, backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '500', color: '#fff', marginBottom: 16 },
  folderInputRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  folderInput: { flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, color: '#fff',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)' },
  folderAddBtn: { backgroundColor: GOLD, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10 },
  folderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.07)' },
  folderRowName: { fontSize: 15, color: 'rgba(255,255,255,0.8)' },
  modalClose: { marginTop: 20, alignItems: 'center' },
});
