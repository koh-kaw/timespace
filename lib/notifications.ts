import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function requestNotificationPermission(): Promise<boolean> {
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

export async function scheduleTaskNotification(
  taskId: string,
  title: string,
  fireAt: Date
): Promise<string | null> {
  if (fireAt.getTime() <= Date.now()) return null;

  const id = await Notifications.scheduleNotificationAsync({
    identifier: `task:${taskId}`,
    content: {
      title: 'Timespace',
      body: title,
      data: { taskId },
    },
    trigger: { date: fireAt },
  });
  return id;
}

export async function cancelTaskNotification(taskId: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(`task:${taskId}`);
  } catch {
    // Already cancelled or never scheduled.
  }
}

export async function setupAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Timespace',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#7F77DD',
  });
}
