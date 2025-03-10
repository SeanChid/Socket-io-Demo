import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useUnreadStore = create(
    persist(
        (set, get) => ({
            unreadCounts: {}, // Format: { 'room_123': 5, 'chat_456': 2 }
            
            updateUnreadCounts: (counts) => {
                set({ unreadCounts: counts });
            },

            getUnreadCount: (id, isRoom) => {
                const key = isRoom ? `room_${id}` : `chat_${id}`;
                return get().unreadCounts[key] || 0;
            }
        }),
        {
            name: 'unread-storage',
            getStorage: () => localStorage
        }
    )
);

export default useUnreadStore;
