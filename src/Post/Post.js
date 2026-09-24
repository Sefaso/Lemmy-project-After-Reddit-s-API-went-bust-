import { useEffect, useState } from "react"; // React
import { useParams, Link } from "react-router-dom"; // DOM manipulation
import { useSelector, useDispatch } from "react-redux"; // Redux
import {
  selectPost,
  selectComments,
  selectPostStatus,
  selectPostError,
  fetchPostThunk,
  votePostThunk,
  voteCommentThunk,
  createCommentThunk,
  clearPost,
  selectVotingStatus,
  selectCommentCreationStatus
} from "./PostSlice"; // Import from PostSlice
import "./Post.css";

function Post() {
  const { postId } = useParams(); // id is taken from parameters in url
  const dispatch = useDispatch(); // For redux-related effect triggering

  // Redux state shorteners
  const post = useSelector(selectPost);
  const comments = useSelector(selectComments);
  const status = useSelector(selectPostStatus);
  const error = useSelector(selectPostError);
  const votingStatus = useSelector(selectVotingStatus);
  const commentCreationStatus = useSelector(selectCommentCreationStatus);

  // Local state for comment input
  const [newComment, setNewComment] = useState(''); // Fore head comments
  const [replyText, setReplyText] = useState(''); //For replies
  const [replyTo, setReplyTo] = useState(null);

  useEffect(() => { // Fetch post on mount and when postId changes
    if (postId) dispatch(fetchPostThunk(Number(postId))); //Retrieves post by postId
    return () => dispatch(clearPost()); // Clears the singular post page in memory when another is visited
  }, [postId, dispatch]);

  // Format score (1100 to 1.1K, 1100000 to 1.1M)
  const formatScore = (score) => {
    if (!score && score !== 0) return 0;
    if (score >= 1000000) return `${(score / 1000000).toFixed(1)}M`;
    if (score >= 1000) return `${(score / 1000).toFixed(1)}K`;
    return score;
  };

  // Format date
  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Convert URLs in text to clickable links
  const linkify = (text) => {
    if (!text) return '';
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.replace(urlRegex, (url) => {
      return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
    });
  };

  // Handle post voting
  const handlePostVote = (voteType) => {
    if (!post) return;
    const currentVote = post.my_vote || 0;
    const newVote = currentVote === voteType ? 0 : voteType;
    dispatch(votePostThunk({ postId: post.id, voteType: newVote }));
  };

  // Handle comment voting
  const handleCommentVote = (commentId, voteType) => {
    dispatch(voteCommentThunk({ commentId, voteType }));
  };

  // Handle comment submission
  const handleCommentSubmit = (e) => {
    e.preventDefault();
    if (!newComment.trim()) return; // Uses comment-specific state

    dispatch(createCommentThunk({
      postId: post.id,
      content: newComment,
      parentId: replyTo
    })).then(() => {
      setNewComment('');
      setReplyTo(null);
    });
  };

  // Handle reply submission (NEW)
  const handleReplySubmit = (e) => {
    e.preventDefault();
    if (!replyText.trim()) return; // Uses reply-specific state

    dispatch(createCommentThunk({
      postId: post.id,
      content: replyText,
      parentId: replyTo
    })).then(() => {
      setReplyText('');
      setReplyTo(null);
    });
  };

  // Recursive comment renderer
  const renderComments = (commentList, depth = 0) => {
    if (!commentList || commentList.length === 0) { // In case there's no comments
      return <p className="no-comments">No comments yet. Be the first!</p>;
    }

    return commentList.map((comment) => ( // For each comment
      <div
        key={comment.id}
        className={`comment depth-${Math.min(depth, 5)}`} // Sets replies' depth to maximum of 5 levels
        style={{ marginLeft: depth > 0 ? '20px' : '0' }} // Add 20px of left margin on each level down
      >
        <div className="comment-header">
          <strong>{comment.author}</strong>
          <span className="comment-date"> | {formatDate(comment.created_utc)}</span>
          {comment.edited && <span className="comment-edited"> (edited)</span>}
        </div>

        <div
          className="comment-body"
          dangerouslySetInnerHTML={{ __html: linkify(comment.body || '') }} //Weird syntax to warn of XSS attack
        // innerHTML -> dangerouslySetInnerHTML /  el.innerHTML: ... -> dangerouslySetInnerHTML={{__html: ...}}
        />

        <div className="comment-actions">
          <button //Upvote
            className={`vote-btn UP ${comment.my_vote === 1 ? 'voted-up' : ''}`}
            onClick={() => handleCommentVote(comment.id, 1)}
            disabled={votingStatus === 'loading'}>
            ▲
          </button>
          <span className="score">{formatScore(comment.score)}</span> {/*Post score*/}
          <button //Downvote
            className={`vote-btn DWN ${comment.my_vote === -1 ? 'voted-down' : ''}`}
            onClick={() => handleCommentVote(comment.id, -1)}
            disabled={votingStatus === 'loading'}>
            ▼
          </button>

          <button //Reply
            className="reply-btn"
            onClick={() => setReplyTo(replyTo === comment.id ? null : comment.id)}>
            REPLY
          </button>
        </div>

        {/* Reply space for this comment */}
        {replyTo === comment.id && (
          <form className="reply-form" onSubmit={handleReplySubmit}>
            <textarea // Space for comment
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)} // Uses reply method
              placeholder="Write a reply..."
              rows={2}
            />
            <div className="reply-actions">
              <button type="submit" disabled={commentCreationStatus === 'loading'}> {/*Engaging of button depend on the replay not being blank*/}
                {commentCreationStatus === 'loading' ? 'Posting...' : 'Reply'} {/*Reply button*/}
              </button>
              <button type="button" onClick={() => {
                setReplyTo(null);
                setReplyText('');
              }}>
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Render nested replies */}
        {comment.replies && comment.replies.length > 0 && (
          <div className="replies">
            {renderComments(comment.replies, depth + 1)} {/*Recursivity for comments*/}
          </div>
        )}
      </div>
    ));
  };

  // Loading state
  if (status === 'loading') {
    return <div className="status loading">Loading post...</div>;
  }

  // Error state
  if (status === 'failed') {
    return <div className="status error">Error: {error}</div>;
  }

  // No post found
  if (!post) {
    return <div className="status not-found">Post not found</div>;
  }

  return ( // RENDER
    <div className="post-container">
      <div className="post-breadcrumb"> {/* Community link */}
        <Link to={`/${post.subreddit}`} className="community-link">
          /{post.subreddit}
        </Link>
      </div>

      {/* Post title */}
      <h1 className="post-title">{post.title}</h1>

      {/* Post metadata */}
      <div className="post-meta">
        <span className="post-author">by {post.author}</span>
        |
        <span className="post-date">{formatDate(post.created_utc)}</span>
        {post.edited && <span className="edited">(edited)</span>}
        {post.nsfw && <span className="nsfw-tag">🔞</span>}
      </div>

      {/* Post content */}
      <div className="post-content">
        {/* Text body */}
        {post.selftext && (
          <div className="post-body" dangerouslySetInnerHTML={{ __html: linkify(post.selftext) }} />
        )}

        {/* Image */}
        {post.is_image && post.url && (
          <img className="post-media" src={post.url} alt={post.title} />
        )}

        {/* YouTube/Vimeo embed */}
        {post.embed_video_url && (
          <iframe
            src={post.embed_video_url}
            title={post.title}
            className="post-media"
            allowFullScreen
          />
        )}

        {/* Link */}
        {post.url && !post.is_image && !post.embed_video_url && (
          <a href={post.url} target="_blank" rel="noopener noreferrer" className="post-link">
            {post.url}
          </a>
        )}
      </div>

      {/* Post voting */}
      <div className="post-voting">
        <button //Upvote
          className={`vote-btn UP ${post.my_vote === 1 ? 'voted-up' : ''}`}
          onClick={() => handlePostVote(1)}
          disabled={votingStatus === 'loading'}>
          ▲
        </button>
        <span className="score">{formatScore(post.score)}</span>
        <button //Downvote
          className={`vote-btn DWN ${post.my_vote === -1 ? 'voted-down' : ''}`}
          onClick={() => handlePostVote(-1)}
          disabled={votingStatus === 'loading'}>
          ▼
        </button>
      </div>
      <p>Simulated voting. Retrieval-only API link so far.</p>

      {/* Comments section */}
      <div className="comments-section">
        <h3>Comments ({post.num_comments || 0})</h3> {/*Counter*/}

        {/* New comment form */}
        <form className="new-comment-form" onSubmit={handleCommentSubmit}>
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)} // Uses comment method
            placeholder="What are your thoughts?"
            rows={3}
            disabled={commentCreationStatus === 'loading'} />

          <button type="submit" disabled={commentCreationStatus === 'loading'}> {/*Publish button*/}
            {commentCreationStatus === 'loading' ? 'Posting...' : 'Post Comment'}
          </button>
        </form>

        {/* Comments list */}
        <div className="comments-list">
          {renderComments(comments)} {/*Rendering of included comments*/}
        </div>
      </div>
    </div>
  );
}

export default Post;