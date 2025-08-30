import { createSlice } from '@reduxjs/toolkit';

const uiSlice = createSlice({
  name: 'ui',
  initialState: {
    activeView: 'onboarding',
    notifications: [],
    sidebarOpen: true,
    theme: 'light'
  },
  reducers: {
    setActiveView: (state, action) => {
      state.activeView = action.payload;
    },
    addNotification: (state, action) => {
      state.notifications.push({
        id: Date.now(),
        ...action.payload
      });
    },
    removeNotification: (state, action) => {
      state.notifications = state.notifications.filter(
        notification => notification.id !== action.payload
      );
    },
    toggleSidebar: (state) => {
      state.sidebarOpen = !state.sidebarOpen;
    },
    setTheme: (state, action) => {
      state.theme = action.payload;
    }
  }
});

export const { 
  setActiveView, 
  addNotification, 
  removeNotification, 
  toggleSidebar, 
  setTheme 
} = uiSlice.actions;
export default uiSlice.reducer;