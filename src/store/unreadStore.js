import { create } from 'zustand';

const useUnreadStore = create((set) => ({
    unreadRooms: new Map(), // roomId -> count
    unreadChats: new Map(), // chatId -> count
    
    incrementUnread: (id, isRoom = true) => set((state) => {
        const map = isRoom ? new Map(state.unreadRooms) : new Map(state.unreadChats);
        map.set(id, (map.get(id) || 0) + 1);
        return isRoom ? { unreadRooms: map } : { unreadChats: map };
    }),

    clearUnread: (id, isRoom = true) => set((state) => {
        const map = isRoom ? new Map(state.unreadRooms) : new Map(state.unreadChats);
        map.delete(id);
        return isRoom ? { unreadRooms: map } : { unreadChats: map };
    }),

    getUnreadCount: (id, isRoom = true) => {
        const state = useUnreadStore.getState();
        const map = isRoom ? state.unreadRooms : state.unreadChats;
        return map.get(id) || 0;
    }
}));

export default useUnreadStore;
