import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'; // Redux tools
import {
  fetchPostData,
  votePost,
  voteComment,
  createComment
} from '../LemmyHandshake/LemmyHandshake.js'; // Needed imports

// Thunk: Fetch single post with comments
export const fetchPostThunk = createAsyncThunk(
  'post/fetchPost',
  async (postId) => { // Takes post id and...
    const { post, comments } = await fetchPostData(null, postId); // ...requests single post
    return { post, comments }; // Catches fetch result
  }
);

// Thunk: Vote on a post
export const votePostThunk = createAsyncThunk(
  'post/votePost',
  async ({ postId, voteType }, { rejectWithValue }) => { // Sends needed data and retrieves, method does the rest through server
    try {
      const result = await votePost(postId, voteType); // Wait method's response
      return { postId, voteType, newScore: result.post_view.counts.score }; // Surrender result
    } catch (error) { // Error message catcher
      return rejectWithValue(error.message);
    }
  }
);

// Thunk: Vote on a comment
export const voteCommentThunk = createAsyncThunk(
  'post/voteComment',
  async ({ commentId, voteType }, { rejectWithValue }) => { // Sends needed data and retrieves, method does the rest through server
    try {
      const result = await voteComment(commentId, voteType); // Wait method's response
      return { commentId, voteType, newScore: result.comment_view.counts.score }; // Surrender result
    } catch (error) { // Error message catcher
      return rejectWithValue(error.message);
    }
  }
);

// Thunk: Create a new comment
export const createCommentThunk = createAsyncThunk(
  'post/createComment',
  async ({ postId, content, parentId = null }, { rejectWithValue }) => { // Sends needed data and retrieves, method does the rest through server
    try {
      const newComment = await createComment(postId, content, parentId); // Takes comment info and makes request
      return newComment; // Catches result
    } catch (error) { // Error catcher
      return rejectWithValue(error.message);
    }
  }
);

const postSlice = createSlice({
  name: 'post',
  initialState: { // Global post state
    post: null,             // Current post data
    comments: [],           // Comments array (nested)
    status: 'idle',         // 'idle' | 'loading' | 'succeeded' | 'failed'
    error: null,            // Error message
    votingStatus: 'idle',   // For post voting
    commentCreationStatus: 'idle', // For comment posting
  },
  reducers: {
    // Clear post data when navigating away
    clearPost: (state) => {
      state.post = null;
      state.comments = [];
      state.status = 'idle';
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // ----- Fetch Post -----
      .addCase(fetchPostThunk.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchPostThunk.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.post = action.payload.post;
        state.comments = action.payload.comments;
      })
      .addCase(fetchPostThunk.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message;
      })

      // ----- Vote on Post -----
      .addCase(votePostThunk.pending, (state) => {
        state.votingStatus = 'loading';
      })
      .addCase(votePostThunk.fulfilled, (state, action) => {
        state.votingStatus = 'succeeded';
        if (state.post && state.post.id === action.payload.postId) {
          state.post.score = action.payload.newScore; // Adjusts score cache real time for render
          state.post.my_vote = action.payload.voteType;
        }
      })
      .addCase(votePostThunk.rejected, (state, action) => {
        state.votingStatus = 'failed';
        state.error = action.payload;
      })

      // ----- Vote on Comment -----
      .addCase(voteCommentThunk.fulfilled, (state, action) => {
        // Recursively update comment score in nested structure
        const updateCommentScore = (comments) => {
          for (let comment of comments) {
            if (comment.id === action.payload.commentId) {
              comment.score = action.payload.newScore;
              comment.my_vote = action.payload.voteType;
              return true;
            }
            if (comment.replies && comment.replies.length > 0) {
              if (updateCommentScore(comment.replies)) return true;
            }
          }
          return false;
        };
        updateCommentScore(state.comments);
      })
      .addCase(voteCommentThunk.rejected, (state, action) => {
        state.error = action.payload;
      })

      // ----- Create Comment -----
      .addCase(createCommentThunk.pending, (state) => {
        state.commentCreationStatus = 'loading';
      })

      .addCase(createCommentThunk.fulfilled, (state, action) => {
        state.commentCreationStatus = 'succeeded';

        // Get parentId from the thunk arguments (what we sent), not from server response
        const parentId = action.meta.arg.parentId || null;

        // Build new comment object
        const newComment = { // Comment data
          id: action.payload.comment.id,
          author: action.payload.creator.name,
          body: action.payload.comment.content,
          score: action.payload.counts.score,
          created_utc: Math.floor(new Date(action.payload.comment.published).getTime() / 1000),
          replies: [],
          parent_id: parentId,
          my_vote: 0,
        };

        // If top-level comment, add to root; otherwise find parent and add as reply
        if (!newComment.parent_id) { // If there's no parent comment
          state.comments.push(newComment); // Place as a new parent comment
        } else { // If there's a parent comment
          const addReplyToParent = (comments) => {
            for (let comment of comments) { // For each comment under post
              if (comment.id === newComment.parent_id) { // If there's a comment with an id match to the parent id of the new comment
                comment.replies.push(newComment); // New comment gets pushed beneath it as a reply
                return true; //To break
              }
              if (comment.replies && comment.replies.length > 0) { // In case there's a conversation in the replies
                if (addReplyToParent(comment.replies)) return true; // Same logic as main but for comments under parent (recursion)
              }
            }
            return false; // break in case of non-fitting case
          };
          addReplyToParent(state.comments); // Use function above
        }
      })

      .addCase(createCommentThunk.rejected, (state, action) => {
        state.commentCreationStatus = 'failed';
        state.error = action.payload;
      });
  },
});

// State selectors exports
export const selectPost = (state) => state.post.post;
export const selectComments = (state) => state.post.comments;
export const selectPostStatus = (state) => state.post.status;
export const selectPostError = (state) => state.post.error;
export const selectVotingStatus = (state) => state.post.votingStatus;
export const selectCommentCreationStatus = (state) => state.post.commentCreationStatus;

// "Compressed" methods into one feed manipulator
export const { clearPost } = postSlice.actions;

export default postSlice.reducer; //Export post state handler