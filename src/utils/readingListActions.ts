import { readingList, saveReadingList } from '@/store/store';
import type { ReadingItem, ReadingStatus } from '@/types';

export const addReadingItem = (title: string, url?: string) => {
  if (!title.trim()) return;

  const item: ReadingItem = {
    id: Date.now(),
    title: title.trim(),
    url: url?.trim(),
    status: 'unread',
    createdAt: Date.now(),
  };

  readingList.value = [...readingList.value, item];
  saveReadingList();
};

export const deleteReadingItem = (id: number) => {
  readingList.value = readingList.value.filter(item => item.id !== id);
  saveReadingList();
};

export const updateReadingStatus = (id: number, status: ReadingStatus) => {
  const item = readingList.value.find(r => r.id === id);
  if (item) {
    item.status = status;
    if (status === 'read') {
      item.readAt = Date.now();
    }
    readingList.value = [...readingList.value];
    saveReadingList();
  }
};

export const markAsRead = (id: number) => {
  updateReadingStatus(id, 'read');
};

export const markAsUnread = (id: number) => {
  updateReadingStatus(id, 'unread');
};
