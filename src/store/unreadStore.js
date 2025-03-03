import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useUnreadStore = create(
    persist(
        (set, get) => ({
            unreadCounts: {}, // Format: { 'room:123': 5, 'private:456': 2 }
            
            incrementUnread: (id, isRoom) => {
                const key = `${isRoom ? 'room:' : 'private:'}${id}`;
                set((state) => ({
                    unreadCounts: {
                        ...state.unreadCounts,
                        [key]: (state.unreadCounts[key] || 0) + 1
                    }
                }));
            },

            clearUnread: (id, isRoom) => {
                const key = `${isRoom ? 'room:' : 'private:'}${id}`;
                set((state) => ({
                    unreadCounts: {
                        ...state.unreadCounts,
                        [key]: 0
                    }
                }));
            },

            getUnreadCount: (id, isRoom) => {
                const key = `${isRoom ? 'room:' : 'private:'}${id}`;
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
