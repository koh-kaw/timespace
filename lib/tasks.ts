import { supabase, type Task } from './supabase';
import {
  scheduleTaskNotification,
  cancelTaskNotification,
} from './notifications';

export type TaskInput = {
  title: string;
  start_at: Date;
  end_at: Date;
  parent_id?: string | null;
  notes?: string | null;
  color?: string;
  recurrence_rule?: string | null;
  notification_minutes_before?: number | null;
};

export async function fetchTasksInRange(
  userId: string,
  start: Date,
  end: Date,
  parentId: string | null = null
): Promise<Task[]> {
  let q = supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .gte('start_at', start.toISOString())
    .lt('start_at', end.toISOString())
    .order('start_at', { ascending: true });

  q = parentId === null ? q.is('parent_id', null) : q.eq('parent_id', parentId);

  const { data, error } = await q;
  if (error) throw error;
  return data as Task[];
}

/** 繰り返しタスクを指定範囲内に展開する */
export function expandRecurringTasks(tasks: Task[], rangeStart: Date, rangeEnd: Date): Task[] {
  const result: Task[] = [];
  for (const task of tasks) {
    result.push(task);
    if (!task.recurrence_rule) continue;

    const rule = task.recurrence_rule;
    const origStart = new Date(task.start_at);
    const origEnd = new Date(task.end_at);
    const duration = origEnd.getTime() - origStart.getTime();

    // Parse FREQ
    const freqMatch = rule.match(/FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)/);
    if (!freqMatch) continue;
    const freq = freqMatch[1];

    // Parse BYDAY for weekly
    const byDayMatch = rule.match(/BYDAY=([^;]+)/);
    const byDays = byDayMatch ? byDayMatch[1].split(',') : null;
    const dayMap: Record<string, number> = { SU:0, MO:1, TU:2, WE:3, TH:4, FR:5, SA:6 };

    let cursor = new Date(origStart);
    // Advance to next occurrence
    const advance = () => {
      switch(freq) {
        case 'DAILY':  cursor.setDate(cursor.getDate() + 1); break;
        case 'WEEKLY': cursor.setDate(cursor.getDate() + 1); break;
        case 'MONTHLY': cursor.setMonth(cursor.getMonth() + 1); break;
        case 'YEARLY': cursor.setFullYear(cursor.getFullYear() + 1); break;
      }
    };

    advance();
    let safety = 0;
    while (cursor < rangeEnd && safety++ < 400) {
      if (cursor >= rangeStart) {
        // For BYDAY filter (weekly on specific days)
        const dow = ['SU','MO','TU','WE','TH','FR','SA'][cursor.getDay()];
        if (!byDays || byDays.includes(dow)) {
          const newStart = new Date(cursor);
          const newEnd = new Date(cursor.getTime() + duration);
          result.push({
            ...task,
            id: `${task.id}_${cursor.getTime()}`, // virtual id
            start_at: newStart.toISOString(),
            end_at: newEnd.toISOString(),
          });
        }
      }
      advance();
    }
  }
  return result;
}

export async function fetchChildTasks(parentId: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('parent_id', parentId)
    .order('start_at', { ascending: true });
  if (error) throw error;
  return data as Task[];
}

export async function createTask(userId: string, input: TaskInput): Promise<Task> {
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      user_id: userId,
      title: input.title,
      start_at: input.start_at.toISOString(),
      end_at: input.end_at.toISOString(),
      parent_id: input.parent_id ?? null,
      notes: input.notes ?? null,
      color: input.color ?? '#7F77DD',
      recurrence_rule: input.recurrence_rule ?? null,
      notification_minutes_before: input.notification_minutes_before ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  const task = data as Task;

  if (task.notification_minutes_before != null) {
    const fireAt = new Date(
      new Date(task.start_at).getTime() - task.notification_minutes_before * 60_000
    );
    await scheduleTaskNotification(task.id, task.title, fireAt);
  }
  return task;
}

export async function updateTask(
  id: string,
  patch: Partial<TaskInput>
): Promise<Task> {
  const dbPatch: Record<string, unknown> = { ...patch };
  if (patch.start_at) dbPatch.start_at = patch.start_at.toISOString();
  if (patch.end_at) dbPatch.end_at = patch.end_at.toISOString();

  const { data, error } = await supabase
    .from('tasks')
    .update(dbPatch)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  const task = data as Task;

  await cancelTaskNotification(task.id);
  if (task.notification_minutes_before != null) {
    const fireAt = new Date(
      new Date(task.start_at).getTime() - task.notification_minutes_before * 60_000
    );
    await scheduleTaskNotification(task.id, task.title, fireAt);
  }
  return task;
}

export async function deleteTask(id: string): Promise<void> {
  await cancelTaskNotification(id);
  const { error } = await supabase.from('tasks').delete().eq('id', id);
  if (error) throw error;
}
