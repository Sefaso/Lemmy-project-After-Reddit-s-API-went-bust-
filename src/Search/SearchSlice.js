// searchSlice.js
import { createSlice } from '@reduxjs/toolkit';
import { createAsyncThunk } from '@reduxjs/toolkit';
import { fetchSearchResults } from '../LemmyHandshake/LemmyHandshake.js';

//The AsyncThunk is for status management
export const fetchSearchThunk = createAsyncThunk(
  'search/fetchSearch',
  async ({ searchTerm, token }) => {
    const results = await fetchSearchResults(searchTerm, token);
    return results;
  }
);

const searchSlice = createSlice({
  name: 'search',
  initialState: {
    //In order to handle an user input, the state needs to be provided a placeholder
    term: '',
    results: [],
    nextPageToken: null,
    status: 'idle',
    error: null,
  },

  reducers: {
    setSearchTerm: (state, action) => {
      state.term = action.payload;
      state.nextPageToken = null; // ✅ Reset pagination
    }
  },

  extraReducers: (builder) => {
    builder
      .addCase(fetchSearchThunk.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })

      .addCase(fetchSearchThunk.fulfilled, (state, action) => {
        state.status = 'succeeded';
        if (action.meta.arg.token === null) {
          // Initial load: replace feed
          state.results = action.payload.posts;
        } else {
          // Infinite scroll: append new posts
          const existingIds = new Set(state.results.map(post => post.id));
          const newPosts = action.payload.posts.filter(post => !existingIds.has(post.id));
          state.results.push(...newPosts);
        }
        state.nextPageToken = action.payload.nextPageToken;
      })

      .addCase(fetchSearchThunk.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message;
      });
  },
});

export const { setSearchTerm } = searchSlice.actions;

export const selectSearchTerm = (state) => state.search.term;
export const selectSearchResults = (state) => state.search.results;
export const selectNextPageToken = (state) => state.search.nextPageToken;
export const selectSearchStatus = (state) => state.search.status;
export const selectSearchError = (state) => state.search.error;

export default searchSlice.reducer;