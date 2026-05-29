import { supabase, type Goal } from './supabase';

export type GoalInput = {
  title: string;
  parent_id?: string | null;
  target_value?: number | null;
  unit?: string | null;
  target_date?: Date | null;
  current_value?: number;
  strategy_type?: Goal['strategy_type'];
  linked_task_id?: string | null;
  notes?: string | null;
};

export async function fetchGoalTree(userId: string): Promise<Goal[]> {
  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data as Goal[];
}

export async function createGoal(userId: string, input: GoalInput): Promise<Goal> {
  const { data, error } = await supabase
    .from('goals')
    .insert({
      user_id: userId,
      title: input.title,
      parent_id: input.parent_id ?? null,
      target_value: input.target_value ?? null,
      unit: input.unit ?? null,
      target_date: input.target_date ? input.target_date.toISOString().slice(0, 10) : null,
      current_value: input.current_value ?? 0,
      strategy_type: input.strategy_type ?? 'custom',
      linked_task_id: input.linked_task_id ?? null,
      notes: input.notes ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Goal;
}

export async function updateGoal(id: string, patch: Partial<GoalInput>): Promise<Goal> {
  const dbPatch: Record<string, unknown> = { ...patch };
  if (patch.target_date instanceof Date) {
    dbPatch.target_date = patch.target_date.toISOString().slice(0, 10);
  }
  const { data, error } = await supabase
    .from('goals')
    .update(dbPatch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as Goal;
}

export async function deleteGoal(id: string): Promise<void> {
  const { error } = await supabase.from('goals').delete().eq('id', id);
  if (error) throw error;
}

/** Build a tree from flat goal list. */
export function buildGoalTree(goals: Goal[]): GoalNode[] {
  const map = new Map<string, GoalNode>();
  goals.forEach((g) => map.set(g.id, { ...g, children: [] }));
  const roots: GoalNode[] = [];
  map.forEach((node) => {
    if (node.parent_id && map.has(node.parent_id)) {
      map.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

export type GoalNode = Goal & { children: GoalNode[] };
