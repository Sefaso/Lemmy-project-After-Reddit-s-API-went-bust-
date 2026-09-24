import {
  useEffect,
  useCallback, //For memoizationized rendering (Limiting the rendering to the changed element)
  useRef // Creates a mutable object that persists across renders
} from "react"; // React
import {
  useParams, //Parameter taker from url
  Link, // Internal hyperlink of sorts
  useLocation
} from "react-router-dom"; // DOM manipulation
import { useSelector, useDispatch } from "react-redux"; // Redux receiver
import {
  fetchFeedThunk,
  selectFeed,
  selectFeedStatus,
  selectFeedError,
  selectNextPage,
  selectCurrentFeedType,
  selectCurrentSort,
  selectCurrentCommunity, // ?
  selectHasMore,
  resetFeed,
  setFeedType,
  setSort,
  setCurrentCommunity,
} from "./FeedSlice"; // Import from FeedSlice
import { votePostThunk } from "../Post/PostSlice"; //For voting
import "./Feed.css"; // Appearance

function Feed() { // Component
  const { subreddit } = useParams(); // Subreddit is taken from parameters in url
  const dispatch = useDispatch(); // For redux-related effect triggering
  const location = useLocation(); // url reader

  // Redux state shorteners
  const posts = useSelector(selectFeed);
  const status = useSelector(selectFeedStatus); // Fetch retrieveing status (Laoding, success, failure)
  const error = useSelector(selectFeedError);
  const nextPage = useSelector(selectNextPage);
  const hasMore = useSelector(selectHasMore);
  const currentFeedType = useSelector(selectCurrentFeedType);
  const currentSort = useSelector(selectCurrentSort);

  // Ref to prevent multiple simultaneous fetches
  const fetchingRef = useRef(false);
  /* Without useRef:
  User scrolls fast → triggers 5 fetches at once → bad!

  With useRef:
  1st scroll → fetch starts → fetchingRef.current = true
  2nd scroll → checks fetchingRef.current → true → SKIP!
  3rd scroll → checks fetchingRef.current → true → SKIP!
  Fetch completes → fetchingRef.current = false
  4th scroll → checks fetchingRef.current → false → FETCH!*/

  // Determine feed type from URL
  const getFeedType = useCallback(() => {
    if (subreddit) return "All"; // If there's a subreddit
    if (location.pathname === "/" || location.pathname === "/all") return "All"; // No subreddit default
    if (location.pathname === "/local") return "Local"; // In case of "local"
    if (location.pathname === "/subscribed") return "Subscribed"; // In case of "subscribed"
    return "All"; // Guide to "All" if nothing triggers
  }, [subreddit, location.pathname]); //Dependency array

  // Get community name from URL params
  const getCommunityName = useCallback(() => {
    if (subreddit) return subreddit.replace(/^r\//, '');
    return null;
  }, [subreddit]);

  // Fetch posts with current settings
  const fetchPosts = useCallback((page = 1, reset = true) => {
    // Prevent duplicate fetches
    if (fetchingRef.current) {
      console.log('⏳ Already fetching, skipping...');
      return;
    }

    // Ensure page is a valid number
    const validPage = Number(page);
    if (isNaN(validPage) || validPage < 1) {
      console.error('❌ Invalid page number:', page);
      return;
    }

    const feedType = getFeedType(); // Gets feed
    const communityName = getCommunityName(); // Gets community

    fetchingRef.current = true; //Why I need clarification on const fetchingRef = useRef(false);

    if (reset) dispatch(resetFeed()); // If there's an order to reset
    if (communityName) dispatch(setCurrentCommunity(communityName)); // Set current community to the one we're currently viewing

    console.log('🔄 Fetching page:', validPage); // For console debugging, displaying page number

    dispatch(fetchFeedThunk({ // Asks for feed
      feedType: feedType,
      sort: currentSort,
      page: validPage,
      communityName: communityName,
    })).finally(() => {
      fetchingRef.current = false; // Triggers a fetch. Check on const fetchingRef = useRef(false); above
    });
  }, [dispatch, getFeedType, getCommunityName, currentSort]); // Dependency array

  // Initial load - runs when URL changes
  useEffect(() => {
    fetchingRef.current = false; // Triggers initial fetch. Check on const fetchingRef = useRef(false); above
    fetchPosts(1, true);
  }, [subreddit, location.pathname, fetchPosts]);


  useEffect(() => { // Auto-effect
    let timeout;
    const handleScroll = () => {  // Infinite scroll - loads more when near bottom
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        // Get scroll position
        const scrollTop = window.scrollY || document.documentElement.scrollTop; // How much you've scrolled from the top
        const windowHeight = window.innerHeight; // What can be seen at any given moment by the user
        const documentHeight = document.documentElement.scrollHeight; // Total height of page - the entire feed length
        const scrollPercentage = (scrollTop + windowHeight) / documentHeight; // Calculation of exploration progress

        // Load more when 80% scrolled
        const shouldLoad = scrollPercentage > 0.8;

        // Check if we should load more
        const isLoading = status === "loading";
        const hasNextPage = nextPage !== null && nextPage !== undefined && !isNaN(nextPage) && nextPage > 0; // There is an non-invalid answer on nextPage
        const isFetching = fetchingRef.current; // Check is there an ongoing fetch. Check const fetchingRef = useRef(false); above

        // Debug logging for page loading and exploration
        console.log('📊 Scroll check:', {
          scrollPercentage: (scrollPercentage * 100).toFixed(1) + '%',
          shouldLoad,
          status,
          nextPage,
          hasNextPage,
          isLoading,
          isFetching,
          postsCount: posts.length,
          hasMore
        });

        // Only load if: past 80%, not loading, has next page, not currently fetching
        if (shouldLoad && !isLoading && hasNextPage && !isFetching && hasMore) { // When exploring and needing to load further, it isn't loading starting page, has a nextPage, isn't actively fetching, and there's more posts to get
          const pageToFetch = Number(nextPage);
          if (!isNaN(pageToFetch) && pageToFetch > 0) {
            console.log('🔄 Loading more posts - page:', pageToFetch);
            fetchPosts(pageToFetch, false);
          } else {
            console.warn('⚠️ Invalid nextPage value:', nextPage); // In case nextPage is not a Number over 0
          }
        }
      }, 200);
    };

    window.addEventListener("scroll", handleScroll); // The windows answers to handleScroll
    return () => {
      window.removeEventListener("scroll", handleScroll); // Ends the executing process
      clearTimeout(timeout); // Cleans the 0.2 secs delay handleScroll needs
    };
  }, [status, nextPage, fetchPosts, posts.length, hasMore]); // Dependency array

  // Handle feed type change (All/Local/Subscribed)
  const handleFeedTypeChange = (type) => {
    fetchingRef.current = false; // Triggers fetch. Check on const fetchingRef = useRef(false); above
    dispatch(setFeedType(type)); // Type is changed, by what is entered
    window.location.href = type === "All" ? "/" : `/${type.toLowerCase()}`; // Changes url by input
  };

  // Handle sort change
  const handleSortChange = (sort) => {
    fetchingRef.current = false; // Again, a need for explanation on const fetchingRef = useRef(false);
    dispatch(setSort(sort)); // Sort is changed, by what is entered
    fetchPosts(1, true); // Goes to 1st page and resets 
  };

  // Handle post voting
  const handlePostVote = (voteType, post) => {
    if (!post) return;
    const currentVote = post.my_vote || 0;
    const newVote = currentVote === voteType ? 0 : voteType;
    dispatch(votePostThunk({ postId: post.id, voteType: newVote }));
  };


  // This formats the upvote count (1.000 -> 1.0K)
  const formatScore = (score) => {
    if (!score && score !== 0) return 0;
    if (score >= 1000000) return `${(score / 1000000).toFixed(1)}M`;
    if (score >= 1000) return `${(score / 1000).toFixed(1)}K`;
    return score;
  };

  // Loading state (Rendering of the loading screen. Won't actually last enough to be seen)
  if (status === "loading" && posts.length === 0) {
    return <div className="status">Loading posts...</div>;
  }

  // Error state (Rendering of the error screen. What will appear in case of error)
  if (status === "failed") {
    return <div className="status error">Error: {error}</div>;
  }

  // No posts despite successful fetch
  if (!posts || posts.length === 0) {
    if (subreddit) { // If there is a specific community
      return (
        <div>
          <div className="community-header">
            <h2>/{subreddit}</h2>
            <p>No posts found in this community</p>
          </div>
          <div className="status">No posts found</div>
        </div>
      );
    }
    return <div className="status not-found">No posts found</div>;
  }

  // Get unique communities to explore by sampling from the recovered posts on the main feed
  const uniqueCommunities = [...new Set(posts.map(p => p.subreddit))].sort();

  return ( // RENDER
    <div>
      {/* Community header */}
      {subreddit && (
        <div className="community-header">
          <h2>/{subreddit}</h2>
          <p>{posts.length} posts</p>
        </div>
      )}

      {/* Feed controls */}
      <div className="feed-controls">
        <div className="feed-types">
          <button className={!subreddit && currentFeedType === "All" ? "active" : ""} onClick={() => handleFeedTypeChange("All")}>
            All
          </button>
          <button
            className={!subreddit && currentFeedType === "Local" ? "active" : ""}
            onClick={() => handleFeedTypeChange("Local")}>
            Local
          </button>
          <button
            className={!subreddit && currentFeedType === "Subscribed" ? "active" : ""}
            onClick={() => handleFeedTypeChange("Subscribed")}>
            Subscribed
          </button>
        </div>

        <div className="sort-options">
          <button className={currentSort === "Hot" ? "active" : ""} onClick={() => handleSortChange("Hot")}>
            Hot
          </button>
          <button className={currentSort === "Active" ? "active" : ""} onClick={() => handleSortChange("Active")}>
            Active
          </button>
          <button className={currentSort === "New" ? "active" : ""} onClick={() => handleSortChange("New")}>
            New
          </button>
          <button className={currentSort === "TopDay" ? "active" : ""} onClick={() => handleSortChange("TopDay")}>
            Top
          </button>
        </div>
      </div>

      {/* Community explorer - only on home page */}
      {location.pathname === "/" && uniqueCommunities.length > 0 && (
        <div className="subreddits">
          <h2>Explore communities:</h2>
          <ul>
            {/*Extracts first 20 unique communities*/}
            {uniqueCommunities.slice(0, 20).map((sub) => (
              <li key={sub}>
                <Link to={`/${sub}`}>/{sub}</Link>
                {/*Creates a link for each*/}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Post list */}
      <div className="feed">
        {posts.map((post) => {  // For each post
          // Determine media content for display
          let mediaContent = null;

          // Lemmy-hosted videos force download - show as link
          // Integrated player would be better, not to download videos
          if (post.is_lemmy_video && post.url) {
            mediaContent = (
              <a href={post.url} target="_blank" rel="noopener noreferrer" className="video-link">
                📹 Click to view video (opens in new tab)
              </a>
            );
          }

          // YouTube/Vimeo embeds
          else if (post.is_video && post.embed_video_url) {
            mediaContent = (
              <iframe
                // iframe since it's an outside video
                src={post.embed_video_url}
                title={post.title}
                className="media-iframe"
                allowFullScreen
              />
            );
          }

          // Regular video with fallback
          else if (post.is_video && post.url) {
            mediaContent = (
              <video
                className="media-video"
                src={post.url}
                controls
                autoPlay
                loop
                playsInline
                preload="metadata"
                onError={(e) => {
                  e.target.style.display = 'none';
                  const fallback = document.createElement('a');
                  fallback.href = post.url;
                  fallback.target = '_blank';
                  fallback.rel = 'noopener noreferrer';
                  fallback.className = 'video-fallback-link';
                  fallback.textContent = '📹 Click to view video (opens in new tab)';
                  e.target.parentNode.appendChild(fallback);
                }}
              />
            );
          }

          // Images
          else if (post.is_image && post.url) {
            mediaContent = (
              <img
                className="media-image"
                src={post.url}
                alt={post.title}
                loading="lazy"
                onError={(e) => e.target.style.display = 'none'}
              />
            );
          }

          // Link previews
          // If this is for web articles, it's currently displaying nothing
          else if (post.url && !post.is_image && !post.is_video) {
            mediaContent = (
              <a href={post.url} target="_blank" rel="noopener noreferrer" className="link-preview">
                <div className="link-card">
                  <span className="link-url">{post.domain || post.url}</span>
                </div>
              </a>
            );
          }

          return (
            <div key={post.id} className="post-card">
              <div className="post-container">
                {/* Community link */}
                <div className="subreddit-link">
                  <Link to={`/${post.subreddit}`}>/{post.subreddit}</Link>
                  {post.nsfw && <span className="nsfw-tag">🔞</span>}
                </div>

                {/* Post title - links to detail page */}
                <h2>
                  <Link to={`/post/${post.id}`}>{post.title}</Link>
                </h2>

                {/* Author and date */}
                <div className="feedpost-meta">
                  by {post.author} | {new Date(post.created_utc * 1000).toLocaleDateString()}
                </div>

                {/* Text preview (only if no media) */}
                {post.selftext && !post.url && (
                  <div className="feedpost-text-preview">
                    {post.selftext.length > 300 ? post.selftext.substring(0, 300) + '...' : post.selftext}
                  </div>
                )}

                {/* Media content */}
                {mediaContent && <div className="media-wrapper">{mediaContent}</div>}

                {/* Actions: votes and comments */}
                <div className="post-actions">
                  <button
                    className={`vote-btn UP ${post.my_vote === 1 ? 'voted-up' : ''}`}
                    onClick={() => handlePostVote(1, post)}>
                    ▲
                  </button>
                  <span className="score">{formatScore(post.score)}</span>
                  <button
                    className={`vote-btn DWN ${post.my_vote === -1 ? 'voted-down' : ''}`}
                    onClick={() => handlePostVote(-1, post)}>
                    ▼
                  </button>
                  <Link to={`/post/${post.id}`} className="comments-link">
                    💬 {post.num_comments}
                  </Link>
                </div>
                <p>Simulated voting. Retrieval-only API link so far.</p>
              </div>
            </div>
          );
        })}

        {/* Loading more indicator */}
        {status === "loading" && posts.length > 0 && (
          <div className="status loading-more">Loading more...</div>
        )}

        {/* End of feed message - only show when we've loaded posts and there's no next page */}
        {!hasMore && posts.length > 0 && status !== "loading" && (
          <div className="status end-of-feed">You've reached the end</div>
        )}
      </div>
    </div>
  );
}

export default Feed;