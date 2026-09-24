import { createSlice, createAsyncThunk } from "@reduxjs/toolkit"; // For Redux usage
import { fetchLemmyFeed, fetchCommunityPosts } from "../LemmyHandshake/LemmyHandshake.js"; // Needed imports

// Thunk: Fetch feed posts (All/Local/Subscribed or community-specific)
export const fetchFeedThunk = createAsyncThunk( //Thunk (Initial render funtion handler) is created by redux
  "feed/fetchFeed",
  async ({ feedType = "All", sort = "Hot", page = 1, communityName = null }) => { // Payload creator
    let feed;
    if (communityName) { // If there is a community
      feed = await fetchCommunityPosts(null, communityName, sort, page); // Request by community
    } else {
      feed = await fetchLemmyFeed(null, feedType, sort, page); // If not, generic request
    }
    return feed; // Returns payload
  }
);

const feedSlice = createSlice({ // Feed state handler (state and methods)
  name: "feed",
  initialState: { // Global feed state
    posts: [],              // Array of post objects
    nextPage: null,         // Next page number (null = no more pages)
    status: "idle",         // 'idle' | 'loading' | 'succeeded' | 'failed'
    error: null,            // Error message if fetch fails
    currentFeedType: "All", // 'All' | 'Local' | 'Subscribed'
    currentSort: "Hot",     // 'Hot' | 'Active' | 'New' | 'TopDay'
    currentCommunity: null, // Community name if viewing a community page
    currentPage: 1,         // Current page number
    hasMore: true,          // Whether there are more posts to load
  },
  reducers: { // State-hadling methods
    resetFeed: (state) => { // Reset feed to empty state
      state.posts = [];
      state.nextPage = null;
      state.status = "idle";
      state.error = null;
      state.currentPage = 1;
      state.hasMore = true;
    },
    setFeedType: (state, action) => { // Set current feed type
      state.currentFeedType = action.payload;
      state.currentCommunity = null;
      state.currentPage = 1;
      state.hasMore = true;
    },
    setSort: (state, action) => { // Set current sort method
      state.currentSort = action.payload;
      state.currentPage = 1;
      state.hasMore = true;
    },
    // Set current community
    setCurrentCommunity: (state, action) => {
      state.currentCommunity = action.payload;
      state.currentPage = 1;
      state.hasMore = true;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchFeedThunk.pending, (state) => { // Rendering is ongoing
        state.status = "loading";
        state.error = null;
      })
      .addCase(fetchFeedThunk.fulfilled, (state, action) => { // Rendering is succesful
        state.status = "succeeded";
        
        if (action.meta.arg.page === 1) { // If page 1, replace feed; otherwise append for infinite scroll
          state.posts = action.payload.posts;
        } else { // Avoid duplicates by checking existing IDs
          const existingIds = new Set(state.posts.map(p => p.id));
          const newPosts = action.payload.posts.filter(p => !existingIds.has(p.id));
          state.posts.push(...newPosts);
        }
        
        // SAFELY store the next page number
        // Lemmy returns 'next_page' as a number or null
        let nextPageNum = null;
        if (action.payload.nextPageToken !== null && action.payload.nextPageToken !== undefined) {
          const parsed = parseInt(action.payload.nextPageToken, 10); // Ensure it's a valid number
          if (!isNaN(parsed) && parsed > 0) { // Once confirmed, it gets stored
            nextPageNum = parsed;
          }
        }
        
        state.nextPage = nextPageNum; // Next page setter
        state.hasMore = nextPageNum !== null; // Confirm is there is more
        state.currentPage = action.meta.arg.page; // Current page
        
        console.log('📊 Pagination state:', { // Console pagination tracker
          nextPageToken: action.payload.nextPageToken,
          nextPageNum: nextPageNum,
          hasMore: state.hasMore,
          currentPage: state.currentPage
        });
      })
      
      .addCase(fetchFeedThunk.rejected, (state, action) => { // Rendering is a failure
        state.status = "failed";
        state.error = action.error.message;
        state.hasMore = false; // Stop trying to load more on error
      });
  },
});

// State selectors exports
export const selectFeed = (state) => state.feed.posts;
export const selectFeedStatus = (state) => state.feed.status;
export const selectFeedError = (state) => state.feed.error;
export const selectNextPage = (state) => state.feed.nextPage;
export const selectCurrentFeedType = (state) => state.feed.currentFeedType;
export const selectCurrentSort = (state) => state.feed.currentSort;
export const selectCurrentCommunity = (state) => state.feed.currentCommunity;
export const selectCurrentPage = (state) => state.feed.currentPage;
export const selectHasMore = (state) => state.feed.hasMore;

// "Compressed" methods into one feed manipulator
export const { resetFeed, setFeedType, setSort, setCurrentCommunity } = feedSlice.actions;

export default feedSlice.reducer; // Exports feed state handler