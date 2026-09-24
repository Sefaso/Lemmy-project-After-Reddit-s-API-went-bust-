// store.js - Redux store configuration

import { configureStore } from '@reduxjs/toolkit';
import feedReducer from '../Feed/FeedSlice';
import postReducer from '../Post/PostSlice';

export const store = configureStore({
  reducer: {
    feed: feedReducer,
    post: postReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

export default store;