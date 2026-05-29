# Timespace

時間に奥行きを与えるカイロス時間カレンダー。React Native + Expo + Supabase。

## セットアップ

### 1. 依存関係インストール

```bash
npm install
```

### 2. Supabase プロジェクト作成

1. https://supabase.com で新規プロジェクトを作成
2. SQL Editor で `supabase/migrations/20260528000000_init.sql` を実行
3. Project Settings → API から URL と anon key をコピー

### 3. 環境変数

`.env.example` を `.env` にコピーして値を埋める:

```
EXPO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

### 4. iOS にビルド

```bash
# Expo Dev Client が必要（expo-notifications がネイティブモジュールのため）
npx expo prebuild --platform ios
npx expo run:ios
```

または EAS Build:

```bash
npm install -g eas-cli
eas login
eas build --profile development --platform ios
```

## ディレクトリ構成

```
app/                    expo-router screens
  _layout.tsx
  index.tsx             メインの円形カレンダー
  signin.tsx
  goals/index.tsx
  settings.tsx
components/
  CircularCalendar.tsx  SVG円形ピザUI
  TaskFormModal.tsx     タスク登録/編集
  ZoomControls.tsx      ズーム階層ヘッダ
lib/
  supabase.ts           Supabaseクライアント＋型
  time.ts               時間スケール・角度計算
  tasks.ts              タスクCRUD
  goals.ts              ゴールCRUD＋ツリー構築
  notifications.ts      ローカル通知
  store.ts              Zustand状態管理
supabase/migrations/
  20260528000000_init.sql
docs/
  SPEC.md               全体仕様書
```

## 主要機能

- 1日24時間の円形カレンダー（デフォルト表示）
- 10年・1年・1ヶ月・1週間・1日の階層ズーム
- タスクをタップして「奥行き」へドリルイン（無限階層）
- 件名・メモ・通知・繰り返し設定
- ローカル通知
- 未来逆算ロードマップ（Goal の木構造）

## 開発ノート

- `expo-notifications` は Expo Go では動かないため、Dev Client または `expo run:ios` でビルドが必要
- Supabase RLS が有効。すべてのテーブルは `auth.uid()` で自分のデータのみアクセス可
- タスクの `depth` は DB トリガで自動計算

## 次のマイルストーン

- [ ] 繰り返しタスクの展開ロジック（RRULE → 表示インスタンス）
- [ ] 習慣シミュレーション（1ヶ月/1年/10年後の予測）
- [ ] ゴール → タスク自動分解の提案
- [ ] ジェスチャでのズーム（ピンチイン/アウト）
- [ ] ダークモード
