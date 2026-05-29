# Timespace (タイムスペース) — 仕様書

## 1. コンセプト

「時間に奥行きを与える」アプリ。同じ円形 UI が時間階層を持ち、ズームすることで上下に移動できる。

時間は2つの軸を持つ:

- **横軸（時間スケール / クロノス）**: 10年 → 1年 → 1ヶ月 → 1週間 → 1日
- **奥行き軸（タスクの分解 / カイロス）**: 1日の中のタスク → さらに細分化したサブタスク → 孫タスク… 無限階層

時間スケールでズームアウトすると人生の俯瞰、ズームインすると今この瞬間に向かう。

## 2. 主要機能（MVP）

### 2.1 円形カレンダー UI（カイロス時間カレンダー）

- 円を時間枠で分割（1日なら24スライス、1週間なら7スライス…）
- スライスをタップしてタスクを登録
- 登録したタスクをタップで「奥行き」に潜れる（=サブタスクを持つ新しい円が開く）
- 上向きの階層ズーム: 10年 ← 1年 ← 1ヶ月 ← 1週間 ← **1日** ← (タスクの奥行き)
- パンくず表示で現在位置がわかる

### 2.2 タスク

フィールド:

- `title` 件名
- `start_at` / `end_at` 時間枠
- `parent_id` 親タスク（NULL なら最上位）
- `recurrence_rule` 繰り返し設定（RFC 5545 RRULE）
- `notification_minutes_before` 通知タイミング
- `notes` メモ
- `color` 表示色

### 2.3 ローカル通知

`expo-notifications` で実装。タスクの `notification_minutes_before` に従ってスケジュール。

### 2.4 未来逆算ロードマップ（Goals）

別エンティティで、目標を階層分解して最終的に日々のタスクへ落とし込む。

- 例: 「40歳までに1億円貯金」→「年間850万貯金」→「月70万貯金」→「日2.3万貯金」→「今日の節約タスク」
- 例: 「キャバ嬢の月売上500万」→「日売上20万」→「指名4組」→「夕方A様にLINEする」

ゴール木の葉に **task をリンクできる** 構造。

### 2.5 習慣シミュレーション (Phase 2)

タスクの繰り返し設定から、1ヶ月後・1年後・10年後の累積値を予測表示。

## 3. データモデル

### tasks

```
id              uuid (PK)
user_id         uuid (FK auth.users)
parent_id       uuid (FK tasks.id, nullable)
title           text
start_at        timestamptz
end_at          timestamptz
notes           text
color           text (hex)
recurrence_rule text (RRULE, nullable)
notification_minutes_before int (nullable)
depth           int (DBトリガで自動計算)
sort_order      int
created_at      timestamptz
updated_at      timestamptz
```

### goals

```
id               uuid (PK)
user_id          uuid (FK auth.users)
parent_id        uuid (FK goals.id, nullable)
title            text
target_value     numeric
unit             text
target_date      date
current_value    numeric
strategy_type    text (savings/habit/skill/custom)
linked_task_id   uuid (FK tasks.id, nullable)
notes            text
created_at       timestamptz
updated_at       timestamptz
```

### profiles

```
id          uuid (PK, FK auth.users)
display_name text
timezone    text (デフォルト Asia/Tokyo)
created_at  timestamptz
```

## 4. 画面構成

- **Today**: デフォルト画面。1日の円形カレンダー
- **Zoom**: 上下ズーム遷移（同じ画面で状態のみ変化）
- **Task Detail**: タスク登録/編集モーダル
- **Goals**: ロードマップツリー
- **Settings**: 通知、タイムゾーン、サインアウト

## 5. 技術スタック

- React Native + Expo (SDK 51+)
- TypeScript
- expo-router (ファイルベースルーティング)
- Supabase (Auth + Postgres + Realtime)
- Reanimated 3 + Gesture Handler (円のジェスチャー操作)
- React Native SVG (円形 UI レンダリング)
- expo-notifications (ローカル通知)
- date-fns + date-fns-tz (時間計算)
- Zustand (クライアント状態管理)

## 6. ディレクトリ構成

```
timespace/
├── app/                    # expo-router screens
│   ├── _layout.tsx
│   ├── index.tsx           # Today (default)
│   ├── task/[id].tsx       # Task detail
│   ├── goals/index.tsx
│   └── settings.tsx
├── components/
│   ├── CircularCalendar.tsx
│   ├── TaskSlice.tsx
│   ├── TaskFormModal.tsx
│   └── ZoomControls.tsx
├── lib/
│   ├── supabase.ts
│   ├── notifications.ts
│   ├── time.ts             # スケール変換・角度計算
│   └── store.ts            # Zustand
├── supabase/
│   └── migrations/
└── docs/
```

## 7. デプロイ運用

- Claude が GitHub にコードを push
- ローカルで `eas build --profile development --platform ios` または `npx expo run:ios`
- Supabase は GUI 管理（マイグレーションは SQL ファイルで管理）

## 8. MVP の完成定義

- [ ] サインアップ/サインイン (Supabase Auth)
- [ ] 1日の円形カレンダー表示
- [ ] スライスをタップしてタスク登録
- [ ] 階層ズーム（10年〜1日）
- [ ] タスクの奥行きズーム
- [ ] ローカル通知
- [ ] 繰り返し設定
- [ ] Goal 作成と階層分解
- [ ] Goal の葉に task をリンク
