// App.js - Main app with routing
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import Feed from '../Feed/Feed';
import Post from '../Post/Post';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <header className="App-header">
          <h1>
            <Link to="/">
            <img className="logo" src="/logo512.png" alt="logo"/>
            </Link>
          </h1>
        </header>
        
        <main>
          <Routes>
            <Route path="/" element={<Feed />} />
            <Route path="/all" element={<Feed />} />
            <Route path="/local" element={<Feed />} />
            <Route path="/subscribed" element={<Feed />} />
            <Route path="/:subreddit" element={<Feed />} />
            <Route path="/post/:postId" element={<Post />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;