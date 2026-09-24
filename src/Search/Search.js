import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector, } from 'react-redux';
import {
  selectSearchTerm,
  setSearchTerm
} from './SearchSlice.js';
import './Search.css';

function SearchBar() {
  const navigate = useNavigate(); //Needed for method to "summon" what's called through it
  const dispatch = useDispatch();
  const searchTerm = useSelector(selectSearchTerm);

  const handleChange = (event) => {
    dispatch(setSearchTerm(event.target.value));
  };

  const handleSubmit = (event) => {
    event.preventDefault(); // Prevents page reload
    if (searchTerm.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchTerm.trim())}`);
      //Formulates URL and goes to it, Results.js takes care of the rest
    }
  };

  const handleEnter = (entry) => {
    if (entry.key === 'Enter') {
      if (searchTerm.trim()) {
        navigate(`/search?q=${encodeURIComponent(searchTerm.trim())}`);
        //Formulates URL and goes to it, Results.js takes care of the rest
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className='SearchBar'>
      <input
        type="text"
        placeholder='Look something up'
        value={searchTerm}
        onChange={handleChange}
        onKeyDown={handleEnter}
        onFocus={(click) => click.target.placeholder = ''}
        onBlur={(clickOff) => clickOff.target.placeholder = 'Look something up'}
      />
      <button type="submit"><img className='symbol' src='/Search.png' alt="Magnifying glass"/></button>
    </form>
  );
}

export default SearchBar;