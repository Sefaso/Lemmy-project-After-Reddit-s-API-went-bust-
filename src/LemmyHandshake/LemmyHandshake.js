let LEMMY_INSTANCE = "https://lemmy.world"; // Source
let jwtToken = null; // Verification token
const USER_AGENT = "MyRedditLike/1.0"; // Dummy, as Lemmy needs none for display only

// ---------- CORE FETCH ---------- (The basis for every other kind fetch request)
async function lemmyFetch(
  endpoint, // For in-site routing (Is determined by what is entered on every fetch)
  params = {}, // Parameters placeholder
  method = 'GET', // HTML method (GET is the default, but can change)
  body = null // The body is determined by the response (For POST/PUT)
) {
  // MANUAL QUERY STRING CONSTRUCTION (Preserves number types)
  const queryString = new URLSearchParams(params).toString();
  const url = `${LEMMY_INSTANCE}/api/v3${endpoint}${queryString ? "?" + queryString : ""}`; // url assembling

  const headers = { // For specification of request
    "User-Agent": USER_AGENT, //Identification for authorization and session
    "Content-Type": "application/json",
  };

  if (jwtToken) { //If there is a token, this carries it
    headers["Authorization"] = `Bearer ${jwtToken}`;
  }

  const options = { method, headers }; // Object is created with the request's specs
  if (body) { //If there is a body
    options.body = JSON.stringify(body); // The body is formatted into JSON for the site's understanding
  }

  const response = await fetch(url, options); // The actual request is made

  if (!response.ok) { // If the response isn't correct
    const errorText = await response.text(); // Grabs error
    throw new Error(`API error ${response.status}: ${errorText}`); // Puts error on console
  }

  if (response.status === 204) { //If resonse is empty (usually for DELETE)
    return null;
  }

  return response.json(); // Successful case, response is given
}

// ---------- AUTH ----------
export function setLemmyInstance(instance) { // To modify the url preset (To alter the source) with a provided one
  LEMMY_INSTANCE = instance;
}

export function setAuthToken(token) { // To assign a provided token
  jwtToken = token;
}

export function getAuthToken() { // To retrieve token
  return jwtToken;
}

export async function login(username, password) { // To login
  try {
    /* In optimal conditions, it should direct to login, 
    and provide the proper verb, the username, and password */
    const data = await lemmyFetch('/user/login', {}, 'POST', {
      username_or_email: username,
      password: password,
    });
    if (data.jwt) { // If there's a token in the response...
      jwtToken = data.jwt; //...the local token becomes the one in the response
      return { success: true, token: data.jwt };
    }
    return { success: false, error: 'No JWT returned' }; //If no token is provided, an error message is created
  } catch (error) {// In case of regular error
    return { success: false, error: error.message };
  }
}

export async function logout() { //To logout
  jwtToken = null; // Token is removed
  return { success: true };
}

// ---------- HELPERS ----------
function isImageUrl(url) { // To check if the entered url is an image
  if (!url) return false; // Auto-trigger if there's nothing
  const extensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
  if (extensions.some(ext => url.toLowerCase().includes(ext))) return true; // This returns boolean is anything is found

  return false; // Default case in case of negative
}

function isVideoUrl(url) { // To check if the entered url is a video
  if (!url) return false; // Auto-trigger if there's nothing
  const urlLower = url.toLowerCase();
  const videoExtensions = ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.ogv'];
  const videoDomains = ['youtube.com', 'youtu.be', 'vimeo.com'];

  //If any of this triggers, the video condition is confirmed with a boolean
  if (videoExtensions.some(ext => urlLower.includes(ext))) return true;
  if (videoDomains.some(domain => urlLower.includes(domain))) return true;
  if (urlLower.includes('/pictrs/') && (urlLower.includes('.mp4') || urlLower.includes('.webm'))) return true; // Lemmy video specific

  return false; // Default case in case of negative
}

function formatDate(dateString) { // Date formatting
  return Math.floor(new Date(dateString).getTime() / 1000);
}

// ---------- MAP SINGLE POST ----------
function mapLemmyPost(postView) { // To map posts from feed
  const post = postView.post;
  const creator = postView.creator;
  const counts = postView.counts;
  const community = postView.community;

  const isVideo = isVideoUrl(post.url); // Uses video helper 
  const isImage = isImageUrl(post.url); // Uses image helper

  let embedVideoUrl = null;
  if (post.url) { // If the post includes an external site's url
    if (post.url.includes('youtube.com/watch')) { // In case of Youtube standard
      const urlParams = new URLSearchParams(new URL(post.url).search); // Takes full url
      const videoId = urlParams.get('v'); // Extract specfifics, by going off YT's url structure
      if (videoId) embedVideoUrl = `https://www.youtube.com/embed/${videoId}`; //Inject specifics into generic template
    } else if (post.url.includes('youtu.be/')) { // In case of Youtube compact
      const videoId = post.url.split('youtu.be/')[1]?.split('?')[0]; // Extract specfifics, by going off YT's url structure
      if (videoId) embedVideoUrl = `https://www.youtube.com/embed/${videoId}`; //Inject specifics into generic template
    } else if (post.url.includes('vimeo.com/')) { // In case of Vimeo
      const videoId = post.url.split('vimeo.com/')[1]?.split('/')[0]; //Extracts specifics, going by vimeo structure
      if (videoId) embedVideoUrl = `https://player.vimeo.com/video/${videoId}`; //Inject specifics into generic template
    }
  }

  const isLemmyVideo = post.url && post.url.includes('/pictrs/') && isVideo; //For through-Lemmy-uploaded videos

  return {
    id: post.id,
    title: post.name,
    author: creator.name,
    score: counts.score,
    num_comments: counts.comments,
    created_utc: formatDate(post.published),
    edited: post.updated ? formatDate(post.updated) : null,
    selftext: post.body || "", // For post's text, if any
    url: post.url || "",
    domain: post.url ? new URL(post.url).hostname : null,
    subreddit: community.name,
    subreddit_title: community.title,
    subreddit_id: community.id,
    thumbnail: post.thumbnail_url || post.url || "",
    is_image: isImage,
    is_video: isVideo,
    is_lemmy_video: isLemmyVideo, // Lemmy owned video
    embed_video_url: embedVideoUrl || post.embed_video_url || null, //Integrates video after classification
    nsfw: post.nsfw || false,
    my_vote: postView.my_vote || 0,
  };
}

// ---------- MAP COMMENT ----------
function mapLemmyComment(commentView) {
  return {
    id: commentView.comment.id,
    author: commentView.creator.name,
    body: commentView.comment.content, //Actual comment
    score: commentView.counts.score,
    created_utc: formatDate(commentView.comment.published),
    edited: commentView.comment.updated ? formatDate(commentView.comment.updated) : null,
    replies: commentView.replies?.comments?.map(mapLemmyComment) || [],
    parent_id: commentView.comment.parent_id || null, //Initial comment id (For replies)
    my_vote: commentView.my_vote || 0,
  };
}

// ---------- FEED ----------
export async function fetchLemmyFeed(
  accessToken = null, // Token if one is provided, null as default (not logged-in)
  feedType = "All", // Community classification
  sort = "Hot", // Votes classification
  page = 1,
) {
  if (accessToken) jwtToken = accessToken; // If a token is provided, it becoems the session's one

  const params = { // Parameters object for the fetch request
    type_: feedType,
    sort: sort,
    page: page,
    limit: 25,
  };

  const data = await lemmyFetch("/post/list", params); // Makes the request through the basic fetch
  const posts = data.posts.map((postView) => { //For each post in response
    return mapLemmyPost(postView); // Process post
  });

  const nextPageToken = data.next_page || null; // Lemmy returns 'next_page' as a number (If there's a next) or null

  return { posts, nextPageToken }; // Posts load and page tracker
}

// ---------- COMMUNITY POSTS ----------
export async function fetchCommunityPosts(
  accessToken = null,
  communityName, // To determine community
  sort = "Hot", // Vote amount-arranger
  page = 1,
) {
  if (accessToken) jwtToken = accessToken; // If a token exists and is provided, it becomes the current one

  // Get community ID first
  const communityData = await lemmyFetch("/community", { name: communityName }); // Stores the desired community load
  const communityId = communityData.community_view.community.id; // Gets the community id from load

  const params = {
    community_id: communityId, // The machine understands id not name, which is why we retrieved it (I think, otherwise why store it?)
    sort: sort, // Makes request go by established 
    page: page,
    limit: 25,
  };

  const data = await lemmyFetch("/post/list", params); // Makes request
  const posts = data.posts.map(mapLemmyPost); // Displays, just like main feed
  const nextPageToken = data.next_page || null; // For infinite scroll (As far as possible)

  return { posts, nextPageToken, community: communityData.community_view }; // Returns the community feed
}

// ---------- SINGLE POST ----------
export async function fetchPostData(accessToken = null, postId) {
  if (accessToken) jwtToken = accessToken; // If a token is provided, it becomes the default

  const numericId = typeof postId === 'string' ? parseInt(postId, 10) : postId; // Take ten digits Id as string and turns into a number, or takes number if provided
  if (isNaN(numericId)) throw new Error('Invalid post ID'); // Error if the id isn't a number

  // 1. Fetch the post (using existing lemmyFetch)
  const postData = await lemmyFetch("/post", { id: numericId }); // Fetch post
  if (!postData || !postData.post_view) throw new Error('Post not found'); // If fetch goes wrong

  const post = mapLemmyPost(postData.post_view); // Render post

  // 2. Fetch comments (Custom direct fetch to guarantee integer post_id)
  const commentsUrl = `${LEMMY_INSTANCE}/api/v3/comment/list?post_id=${numericId}`;

  const commentsResponse = await fetch(commentsUrl, {
    headers: {
      "User-Agent": USER_AGENT,
      "Content-Type": "application/json",
    }
  });

  if (!commentsResponse.ok) {
    const errorText = await commentsResponse.text();
    throw new Error(`API error ${commentsResponse.status}: ${errorText}`);
  }

  const commentsData = await commentsResponse.json();
  const comments = commentsData.comments ? commentsData.comments.map(mapLemmyComment) : []; // Iterate through retrieved comments

  return { post, comments }; // Return post with comments
}

// ---------- VOTING ----------
export async function votePost(postId, voteType) { // Takes post and kind of vote (1, -1, or 0)
  if (!jwtToken) throw new Error('Must be logged in to vote'); // In case no token is in place

  const data = await lemmyFetch('/post/like', {}, 'POST', { // Retrieves post and its likes
    post_id: postId,
    score: voteType,
  });

  return data; // Return result (Calculation is made in server)
}

export async function voteComment(commentId, voteType) { // Takes post and kind of vote (1, -1, or 0)
  if (!jwtToken) throw new Error('Must be logged in to vote'); // In case no token is in place

  const data = await lemmyFetch('/comment/like', {}, 'POST', { // Selects comment and passes like
    comment_id: commentId,
    score: voteType,
  });

  return data; // Return result (Calculation is made in server)
}

// ---------- CREATE COMMENT ----------
export async function createComment(postId, content, parentId = null) {
  if (!jwtToken) throw new Error('Must be logged in to comment'); // In case no token is in place

  const data = await lemmyFetch('/comment', {}, 'POST', { // Request is made, sendign comment specs
    post_id: postId,
    content: content,
    parent_id: parentId, // Parent comment (In case this comments is a reply)
  });

  return data.comment_view; // Server handles the rest
}

// ---------- SEARCH ----------
export async function fetchSearchResults(
  accessToken = null,
  searchTerm,
  page = 1,
) {
  if (accessToken) jwtToken = accessToken; //If there's a token, it becomes the default

  const params = { //Search specs
    q: searchTerm,
    type_: "Posts",
    page: page,
    limit: 25,
  };

  const data = await lemmyFetch("/search", params); // Request is made 
  const posts = data.posts?.map(mapLemmyPost) || []; // Posts are worked
  const nextPageToken = data.next_page || null; // Load tracker is acquired

  return { posts, nextPageToken }; // result is provided
}

// ---------- FETCH COMMUNITY ----------
export async function fetchCommunity(communityName) {
  const data = await lemmyFetch("/community", { name: communityName });  //Searches by name (Contradicts fetchCommunityPosts but alright then)

  return {
    id: data.community_view.community.id,
    name: data.community_view.community.name,
    title: data.community_view.community.title,
    description: data.community_view.community.description || '',
    icon: data.community_view.community.icon || '',
    banner: data.community_view.community.banner || '',
    subscribers: data.community_view.counts.subscribers,
    posts: data.community_view.counts.posts,
    comments: data.community_view.counts.comments, // Total comments on community, not posts
    published: Math.floor(new Date(data.community_view.community.published).getTime() / 1000),
    nsfw: data.community_view.community.nsfw || false,
    is_subscribed: data.community_view.subscribed === 'Subscribed', // User
    is_mod: data.community_view.subscribed === 'Moderator', // User
  };
}