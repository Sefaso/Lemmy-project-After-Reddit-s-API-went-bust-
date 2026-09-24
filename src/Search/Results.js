import { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Link, useLocation /*useLocation reads URL*/ } from 'react-router-dom';
import {
  fetchSearchThunk,
  selectSearchResults,
  selectSearchStatus,
  selectSearchError,
  selectNextPageToken
} from './SearchSlice';
import './Results.css';

//Necessary to take terms from Search.js-created URL
//Reads the whole URL
function useQuery() {
  return new URLSearchParams(useLocation().search);
}

function SearchResults() {
  const dispatch = useDispatch();
  //Shortens useQuery
  const query = useQuery();
  //Isolates term from URL
  const searchTerm = query.get('q');
  const results = useSelector(selectSearchResults);
  const nextPageToken = useSelector(selectNextPageToken);
  const status = useSelector(selectSearchStatus);
  const error = useSelector(selectSearchError);

  /*Makes the fetch request taking the term from the URL with the help of useQuery*/
  useEffect(() => {
    if (searchTerm) {
      dispatch(fetchSearchThunk({ searchTerm, token: null }));
    }
  }, [dispatch, searchTerm]);

  //Inifnite scroll handler
  useEffect(() => {
    //Placeholder for the result of clearTimeout within handleScroll
    let timeout;
    const handleScroll = () => {
      //Creates a slight delay for optimal loading
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        //Check if user is arriving page bottom
        const nearBottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 800;
        //Checks what is the nextPageToken id user is close to bottom and initial load was gotten
        if (nearBottom && status !== 'loading' && nextPageToken) {
          //Fetches further posts using the nexPageToken at hand. Fetch updates token
          dispatch(fetchSearchThunk({ searchTerm: searchTerm, token: nextPageToken }));
        }
      }, 1); // debounce by 0.001s
    };
    //Creates handleScroll-linked scroll listener
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [dispatch, searchTerm, nextPageToken, status]);

  //Non-successful state handlers
  if (status === 'loading' && results.length === 0) {
    return <p className='status'>Loading posts...</p>;
  };//This one checks if the feed length is 0, and if not, adds without replacing
  if (status === 'failed') return <p className='status'>Error: {error}</p>;

  //Upvote appearance handler
  const upvoteFormatter = (total) => {
    if (total >= 1000000) {
      return `${(total / 1000000).toFixed(1)}m`;
    } else if (total >= 1000) {
      return `${(total / 1000).toFixed(1)}k`;
    } else {
      return total;
    }
  };

  return (
    <div className="results">
      {results.map((post) => {
        //Creates 2 constants for mapping behavior depending on type
        const videoUrl = post.media?.reddit_video?.fallback_url;
        const imageUrl = post.preview?.images?.[0]?.source?.url?.replace(/&amp;/g, '&');

        return (
          <div>
            <div key={post.id} className='container'>
              {/*This is the array's element's subreddit with a link to it*/}
              <p>
                <Link to={`/r/${post.subreddit}`}>
                  r/{post.subreddit}
                </Link>
              </p>
              {/*In here it creates the title and a link to the post's page*/}
              <h2><Link
                to={`/r/${post.subreddit}/comments/${post.id}/${encodeURIComponent(post.title)}`}>{post.title}
              </Link>
              </h2>
              <p>by: {post.author}</p>
              {/*In here is chosses between a video or image rendering,
            depending on kind, using the previoudly define behavior constants*/}
              {
                post.is_video && videoUrl ? (<><video className='media' src={videoUrl} autoPlay controls loop />
                  <p className='disclaimer'>Videos won't have audio due to API limitation</p></>) : //<-Video
                  imageUrl ? (<img className='media' src={imageUrl} alt={post.title} />) : //<-Image
                    null //<-Nothing
              }
              <div className='buttons'>
                <img className='upvote' src='/Upvote.png' alt="Up arrow"/>
                <h3>{upvoteFormatter(post.score)}</h3>
                <Link to={`/r/${post.subreddit}/comments/${post.id}/${encodeURIComponent(post.title)}`}>
                  <img className='comment' src='/Comment.png' alt="Speech bubble"/>
                </Link>
              </div>
            </div>
          </div>
        );

      })}
    </div>
  );
};

export default SearchResults;