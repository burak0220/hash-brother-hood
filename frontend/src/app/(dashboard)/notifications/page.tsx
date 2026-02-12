'use client';
import { useState, useEffect } from 'react';
import Card from '@/components/ui/card';
import Button from '@/components/ui/button';
import { notificationsAPI } from '@/lib/api';
import { timeAgo } from '@/lib/utils';
import toast from 'react-hot-toast';
import type { Notification } from '@/types';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const { data } = await notificationsAPI.list(50);
      setNotifications(data.items);
      setUnreadCount(data.unread_count);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await notificationsAPI.markRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
      toast.success('All marked as read');
    } catch {}
  };

  const handleMarkRead = async (id: number) => {
    try {
      await notificationsAPI.markRead(id);
      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {}
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Notifications</h1>
          <p className="text-dark-400">{unreadCount} unread</p>
        </div>
        {unreadCount > 0 && (
          <Button variant="secondary" size="sm" onClick={handleMarkAllRead}>Mark All Read</Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-dark-400 text-lg">No notifications</p>
          <p className="text-dark-500 text-sm mt-2">You&apos;re all caught up!</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((notif) => (
            <Card
              key={notif.id}
              className={`!p-4 cursor-pointer ${!notif.is_read ? 'border-primary-500/30 bg-primary-900/10' : ''}`}
              hover
            >
              <div className="flex items-start justify-between" onClick={() => !notif.is_read && handleMarkRead(notif.id)}>
                <div className="flex items-start gap-3">
                  {!notif.is_read && <span className="mt-1.5 w-2 h-2 bg-primary-400 rounded-full flex-shrink-0" />}
                  <div>
                    <p className="text-sm font-medium text-white">{notif.title}</p>
                    <p className="text-sm text-dark-400 mt-0.5">{notif.message}</p>
                    <p className="text-xs text-dark-500 mt-1">{timeAgo(notif.created_at)}</p>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
