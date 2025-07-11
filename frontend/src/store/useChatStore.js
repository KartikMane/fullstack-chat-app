import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";

export const useChatStore = create((set, get) => ({
  messages: [],
  users: [],
  selectedUser: null,
  isUsersLoading: false,
  isMessagesLoading: false,
  unreadMessages: {}, // Track unread counts by userId

  getUsers: async () => {
    set({ isUsersLoading: true });
    try {
      const res = await axiosInstance.get("/messages/users");
      set({ users: res.data });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to fetch users");
    } finally {
      set({ isUsersLoading: false });
    }
  },

  getMessages: async (userId) => {
    set({ isMessagesLoading: true });
    try {
      const res = await axiosInstance.get(`/messages/${userId}`);
      set({ messages: res.data });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to fetch messages");
    } finally {
      set({ isMessagesLoading: false });
    }
  },

  sendMessage: async (messageData) => {
    const { selectedUser, messages } = get();
    try {
      const res = await axiosInstance.post(`/messages/send/${selectedUser._id}`, messageData);
      set({ messages: [...messages, res.data] });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to send message");
    }
  },

  subscribeToMessages: () => {
    const { selectedUser, users, unreadMessages } = get();
    if (!selectedUser) return;

    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    socket.on("newMessage", (newMessage) => {
      // Message from currently selected user - append directly
      if (newMessage.senderId === selectedUser._id) {
        set({
          messages: [...get().messages, newMessage],
        });
      } else {
        // Message from other user - increase unread count
        set({
          unreadMessages: {
            ...unreadMessages,
            [newMessage.senderId]: (unreadMessages[newMessage.senderId] || 0) + 1,
          },
        });
      }

      // Move user with new message to top of users list
      const updatedUsers = [...users];
      const idx = updatedUsers.findIndex(u => u._id === newMessage.senderId);
      if (idx > -1) {
        const [user] = updatedUsers.splice(idx, 1);
        updatedUsers.unshift(user);
        set({ users: updatedUsers });
      }
    });
  },

  unsubscribeToMessages: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;
    socket.off("newMessage");
  },

  setSelectedUser: (user) => {
    set(state => {
      // Clear unread count for selected user
      const newUnread = { ...state.unreadMessages };
      if (user?._id && newUnread[user._id]) {
        delete newUnread[user._id];
      }
      return { selectedUser: user, unreadMessages: newUnread };
    });
  },
}));
