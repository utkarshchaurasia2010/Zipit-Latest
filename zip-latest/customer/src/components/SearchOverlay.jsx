import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { ChevronLeft, Mic, X, Heart, Search, SearchX } from 'lucide-react';
import { db } from '../services/db';
import { useToast } from '../context/ToastContext';
import { useWishlist } from '../context/WishlistContext';
import { getProductDeliveryTime } from '../utils/time';
import './SearchOverlay.css';

// --- Fuzzy matching helpers ---

// Levenshtein distance between two strings
const levenshtein = (a, b) => {
  const alen = a.length;
  const blen = b.length;
  if (!alen) return blen;
  if (!blen) return alen;
  const matrix = [];
  for (let i = 0; i <= blen; i++) matrix[i] = [i];
  for (let j = 0; j <= alen; j++) matrix[0][j] = j;
  for (let i = 1; i <= blen; i++) {
    for (let j = 1; j <= alen; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,     // deletion
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j - 1] + 1  // substitution
        );
      }
    }
  }
  return matrix[blen][alen];
};

// Check if query fuzzy-matches any word within a product's searchable text
const fuzzyMatch = (productName, query) => {
  const q = query.toLowerCase().trim();
  if (!q) return false;
  const text = productName.toLowerCase();
  
  // Direct substring match first (fast path)
  if (text.includes(q)) return true;
  
  // Fuzzy match against each word in the product name
  const words = text.split(/\s+/);
  const queryWords = q.split(/\s+/);

  return queryWords.every(qWord => {
    if (qWord.length <= 2) return text.includes(qWord); // skip fuzzy for very short words
    return words.some(word => {
      if (word.includes(qWord)) return true;
      // Allow 1 error per 4 characters of the query word
      const allowedDist = Math.max(1, Math.floor(qWord.length / 4));
      return levenshtein(word, qWord) <= allowedDist;
    });
  });
};

// --- Hindi / Hinglish Transliteration & Vocabulary Dictionary ---
const HINDI_TRANSLITERATION_MAP = {
  // Common grocery nouns (Devanagari -> English search term)
  'आलू': 'potato aloo',
  'आलु': 'potato aloo',
  'aaloo': 'potato aloo',
  'aalu': 'potato aloo',
  'प्याज': 'onion pyaaz',
  'प्यास': 'onion pyaaz',
  'pyaaz': 'onion pyaaz',
  'pyaz': 'onion pyaaz',
  'टमाटर': 'tomato',
  'tamatar': 'tomato',
  'मिर्च': 'chilli mirch',
  'हरी मिर्च': 'chilli mirch',
  'mirch': 'chilli mirch',
  'धनिया': 'corriander dhaniya',
  'dhaniya': 'corriander dhaniya',
  'दूध': 'milk',
  'doodh': 'milk',
  'दही': 'curd',
  'dahi': 'curd',
  'मक्खन': 'butter',
  'ब्रेड': 'bread',
  'अंडा': 'egg',
  'अंडे': 'egg',
  'अण्ड': 'egg',
  'ande': 'egg',
  'अट्ठा': 'atta',
  'आटा': 'atta',
  'chawal': 'rice',
  'चावल': 'rice',
  'दाल': 'dal',
  'daal': 'dal',
  'तेल': 'oil',
  'कुर्की': 'kurkure',
  'कुरकुरे': 'kurkure',
  'चिप्स': 'chips',
  'बिस्कुट': 'biscuits',
  'बिस्किट': 'biscuits',
  'चॉकलेट': 'chocolate',
  'चाय': 'tea',
  'कॉफी': 'coffee',
  'नमक': 'salt',
  'चीनी': 'sugar',
  'मैगी': 'maggi',
  'साबुन': 'soap',
  'सर्फ': 'surf',

  // Quantity numbers
  'एक': 1, 'do': 2, 'दो': 2, 'teen': 3, 'तीन': 3, 'char': 4, 'चार': 4, 'panch': 5, 'पांच': 5, 'paanch': 5,
  'आधा': 1, // half

  // Metric units (ignore in name matching)
  'किलो': '', 'kilo': '', 'kg': '', 'ग्राम': '', 'gram': '', 'gm': '', 'लीटर': '', 'litre': '', 'ltr': '',
  'पैकेट': '', 'packet': '', 'pack': '', 'डिब्बा': '',

  // Action / intent phrases
  'ऐड': 'add', 'एड': 'add', 'डाल': 'add', 'डालो': 'add', 'दीजिए': 'add', 'दे': 'add', 'दो': 2,
  'कर दो': 'add', 'करदो': 'add', 'कर दीजिए': 'add', 'रख दो': 'add', 'chahiye': 'add', 'चाहिए': 'add',
  'mangwa do': 'add', 'मंगवा दो': 'add', 'भेज दो': 'add'
};

// Number word mapping for Hindi/English quantities
const parseQuantityWord = (word) => {
  const clean = word.toLowerCase().trim();
  const map = {
    '1': 1, 'one': 1, 'ek': 1, 'aik': 1, 'एक': 1,
    '2': 2, 'two': 2, 'do': 2, 'दो': 2,
    '3': 3, 'three': 3, 'teen': 3, 'tin': 3, 'तीन': 3,
    '4': 4, 'four': 4, 'char': 4, 'chaar': 4, 'चार': 4,
    '5': 5, 'five': 5, 'paanch': 5, 'panch': 5, 'पांच': 5
  };
  return map[clean] || 1;
};

// Hindi/Hinglish conversational multi-item parser
const parseNaturalLanguageCartCommand = (text) => {
  let raw = text.toLowerCase().trim();

  // Normalize Hindi / Hinglish intent words (Devanagari characters are non-ASCII so \b cannot be used directly)
  const hasAddIntent = /(add|daal|daalo|karo|kardo|bhej|bhejo|chahiye|mangwao|pack|packet|kg|kilo|litre|ऐड|एड|डाल|डालो|करदो|कर दो|चाहिए|मंगवा|भेज)/i.test(raw);

  // Normalize Devanagari numerals and common conjunctions
  let normalized = raw
    .replace(/aur/gi, ' aur ')
    .replace(/और/g, ' aur ')
    .replace(/तथा/g, ' aur ')
    .replace(/एवं/g, ' aur ')
    .replace(/and/gi, ' aur ')
    .replace(/,/g, ' aur ');

  // Split multiple items separated by conjunctions
  const segments = normalized.split(/\s+aur\s+/i).map(s => s.trim()).filter(Boolean);

  const items = [];
  for (const seg of segments) {
    // Strip command phrases in both English and Devanagari
    let cleanSeg = seg.replace(/(add karo|add kar do|add kardo|add kar|daal do|daaldo|daalo|le aao|lao|chahiye|karo|please|kripya|ऐड कर दो|ऐड करदो|डाल दो|डालदो|कर दो|करदो|चाहिए|लाओ)/gi, '').trim();

    const tokens = cleanSeg.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) continue;

    let qty = 1;
    let queryWords = [];

    for (const token of tokens) {
      // Check if it's a number/quantity
      const parsedQty = parseQuantityWord(token);
      if (parsedQty > 1 || (tokens.length > 1 && ['1','ek','one','एक'].includes(token))) {
        qty = parsedQty;
        continue;
      }

      // Check if token is a metric unit to discard (kg, kilo, packet, etc.)
      if (['kg', 'kilo', 'किलो', 'gram', 'gm', 'ग्राम', 'litre', 'ltr', 'लीटर', 'pack', 'packet', 'पैकेट', 'डिब्बा'].includes(token.toLowerCase())) {
        continue;
      }

      // Check if word maps to English product search keyword (e.g. आलू -> potato aloo)
      const mapped = HINDI_TRANSLITERATION_MAP[token] || HINDI_TRANSLITERATION_MAP[token.toLowerCase()];
      if (mapped !== undefined) {
        if (mapped !== 'add' && mapped !== '') {
          queryWords.push(mapped);
        }
      } else {
        queryWords.push(token);
      }
    }

    const itemName = queryWords.join(' ').trim();
    if (itemName) {
      items.push({ name: itemName, original: cleanSeg, qty, hasAddIntent });
    }
  }

  return { isCommand: hasAddIntent && items.length > 0, items };
};

const SearchOverlay = ({ isOpen, onClose, cart, updateCartQty, initialVoiceSearch, onProductClick }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const recognitionRef = useRef(null);
  const { showToast } = useToast();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const location = useLocation();

  // Close SearchOverlay immediately if route changes to /checkout or /payment
  useEffect(() => {
    if (isOpen && (location.pathname === '/checkout' || location.pathname === '/payment')) {
      onClose();
    }
  }, [location.pathname, isOpen, onClose]);

  useEffect(() => {
    const saved = localStorage.getItem('zipit_recent_searches');
    if (saved) {
      try { setRecentSearches(JSON.parse(saved)); } catch (e) {}
    }
  }, []);

  const saveRecentSearch = (term) => {
    if (!term.trim()) return;
    const termLower = term.trim().toLowerCase();
    const filtered = recentSearches.filter(s => s.toLowerCase() !== termLower);
    const newSearches = [term.trim(), ...filtered].slice(0, 8);
    setRecentSearches(newSearches);
    localStorage.setItem('zipit_recent_searches', JSON.stringify(newSearches));
  };

  const removeRecentSearch = (term, e) => {
    e.stopPropagation();
    const newSearches = recentSearches.filter(s => s !== term);
    setRecentSearches(newSearches);
    localStorage.setItem('zipit_recent_searches', JSON.stringify(newSearches));
  };

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setResults([]);
      setActiveFilter('All');
      setIsListening(false);
      setVoiceTranscript('');
      // Restore body scroll
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    } else {
      // Lock body scroll so the page behind doesn't scroll through the overlay
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      if (initialVoiceSearch) {
        setTimeout(() => startVoiceSearch(), 300);
      }
    }
    return () => {
      // Always restore on unmount
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    };
  }, [isOpen, initialVoiceSearch]);

  const handleVoiceIntentProcessing = async (transcriptText) => {
    setVoiceTranscript(transcriptText);
    const parsed = parseNaturalLanguageCartCommand(transcriptText);

    if (parsed.isCommand && updateCartQty) {
      const allProds = await db.products.getAll();
      const addedNames = [];

      for (const itemCmd of parsed.items) {
        const queryTokens = itemCmd.name.toLowerCase().split(/\s+/).filter(Boolean);

        // Find best match in catalog:
        // 1. Direct contains match
        // 2. Token match (e.g. potato or aloo matches "Potato Aloo")
        // 3. Fuzzy match
        const match = allProds.find(p => {
          const pLower = p.name.toLowerCase();
          return pLower.includes(itemCmd.name.toLowerCase());
        }) || allProds.find(p => {
          const pLower = p.name.toLowerCase();
          return queryTokens.some(tok => tok.length >= 3 && pLower.includes(tok));
        }) || allProds.find(p => fuzzyMatch(p.name, itemCmd.name));
        
        if (match && !match.is_out_of_stock && match.stock_count !== 0) {
          updateCartQty(match, itemCmd.qty);
          addedNames.push(`${itemCmd.qty}x ${match.name.split('---')[0].trim()}`);
        }
      }

      if (addedNames.length > 0) {
        showToast(`Added to Cart: ${addedNames.join(', ')}`, 'Success');
        setQuery(parsed.items.map(i => i.name).join(' '));
        return;
      }
    }

    // Default: If not an explicit add command, convert Devanagari query to transliterated English keywords for catalog search
    const transliteratedQuery = transcriptText.split(/\s+/).map(w => {
      const mapped = HINDI_TRANSLITERATION_MAP[w] || HINDI_TRANSLITERATION_MAP[w.toLowerCase()];
      return mapped !== undefined && mapped !== '' && mapped !== 'add' ? mapped : w;
    }).join(' ');

    setQuery(transliteratedQuery);
  };

  const startVoiceSearch = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast('Voice search not supported in this browser.', 'Error');
      return;
    }
    if (isListening) return;

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    // Use hi-IN with automatic bilingual English fallback
    recognition.lang = 'hi-IN';
    recognition.interimResults = false;
    recognition.onstart = () => { setIsListening(true); setVoiceTranscript(''); };
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setIsListening(false);
      handleVoiceIntentProcessing(transcript);
    };
    recognition.onerror = (event) => {
      console.error(event.error);
      setIsListening(false);
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        showToast('Voice search failed. Please try again.', 'Error');
      }
    };
    recognition.onend = () => { setIsListening(false); };
    recognition.start();
  };

  const cancelVoiceSearch = () => {
    if (recognitionRef.current) recognitionRef.current.abort();
    setIsListening(false);
  };

  // Search with fuzzy fallback
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.trim().length > 0) {
        setLoading(true);
        // First try normal DB search (handles exact/partial matches)
        let data = await db.products.search(query.trim());

        // If the DB search returns results, use them directly
        // If not (or very few), apply fuzzy matching against ALL products
        if (data.length === 0) {
          const allProducts = await db.products.getAll();
          data = allProducts.filter(item => fuzzyMatch(item.name, query.trim()));
        } else {
          // Additionally, filter through fuzzy match to widen results on partial matches
          const allProducts = await db.products.getAll();
          const fuzzyExtra = allProducts.filter(item => {
            const alreadyIn = data.some(d => d.id === item.id);
            return !alreadyIn && fuzzyMatch(item.name, query.trim());
          });
          data = [...data, ...fuzzyExtra];
        }

        setResults(data);
        setLoading(false);
      } else {
        setResults([]);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  // Save to history when results load
  useEffect(() => {
    if (query.trim() && !loading && results.length > 0) {
      const historyTimer = setTimeout(() => saveRecentSearch(query), 1500);
      return () => clearTimeout(historyTimer);
    }
  }, [loading, results, query]);

  const getQty = (id) => {
    const item = cart?.find(c => c.id === id);
    return item ? item.qty : 0;
  };

  const handleTagClick = (tag) => setQuery(tag);

  const filteredResults = results;

  if (!isOpen) return null;

  return (
    <div className="search-overlay">
      {isListening && (
        <div className="voice-listening-dialog-overlay">
          <div className="voice-listening-dialog">
            <div className="siri-orb"></div>
            <h3>Listening... / सुन रहे हैं...</h3>
            <p style={{ marginBottom: 4 }}>Speak product names or quantities</p>
            <span style={{ fontSize: '12px', color: 'var(--color-primary)', display: 'block', marginBottom: 16 }}>
              उदा: "2 packet doodh aur bread add karo"
            </span>
            <button className="voice-cancel-btn" onClick={cancelVoiceSearch}>Cancel</button>
          </div>
        </div>
      )}

      <div className="search-overlay-header">
        <div className="search-input-box">
          <button className="search-back-btn" onClick={onClose} aria-label="Go back">
            <ChevronLeft size={26} color="var(--color-text)" strokeWidth={2.6} />
          </button>
          <input
            type="text"
            placeholder="Search for groceries, snacks..."
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <div className="divider"></div>
          <Mic
            size={20}
            color={isListening ? "var(--color-primary)" : "var(--color-text-light)"}
            className={`mic-icon ${isListening ? 'listening' : ''}`}
            onClick={startVoiceSearch}
          />
        </div>
      </div>



      <div className="search-body">
        {!query ? (
          recentSearches.length > 0 ? (
            <div className="recent-searches">
              <h4>Recent Searches</h4>
              <div className="tag-list">
                {recentSearches.map(term => (
                  <span key={term} className="tag" onClick={() => handleTagClick(term)}>
                    {term}
                    <button className="remove-tag-btn" onClick={(e) => removeRecentSearch(term, e)}><X size={12} /></button>
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="empty-search-state" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginTop: '48px', color: 'var(--color-text-light)' }}>
              <Search size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
              <p>Search for your favorite products</p>
            </div>
          )
        ) : loading ? (
          <p className="search-results-text">Searching for "{query}"...</p>
        ) : filteredResults.length === 0 ? (
          <div className="empty-search-state" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginTop: '48px', color: 'var(--color-text-light)' }}>
            <SearchX size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
            <p>No products found for "{query}".</p>
          </div>
        ) : (
          <div className="pinnacle-grid">
            {filteredResults.map(item => {
              const qty = getQty(item.id);
              return (
                <div
                  key={item.id}
                  className="bestseller-card stagger-item"
                  onClick={() => { saveRecentSearch(query); onProductClick && onProductClick(item); }}
                >
                  <div className="bestseller-img-wrapper">
                    <div className="wishlist-btn-corner" onClick={(e) => { e.stopPropagation(); toggleWishlist(item.id); }}>
                      <Heart size={16} fill={isInWishlist(item.id) ? '#e91e63' : 'transparent'} color={isInWishlist(item.id) ? '#e91e63' : 'var(--color-text-light)'} />
                    </div>
                    <div className="bestseller-img">
                      {item.is_out_of_stock || item.stock_count === 0 ? (
                        <div style={{position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'rgba(240, 68, 56, 0.9)', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '800', zIndex: 10, whiteSpace: 'nowrap'}}>OUT OF STOCK</div>
                      ) : item.sticker ? (
                        <div className="wafer-sticker">{item.sticker}</div>
                      ) : null}
                      <img src={item.image_url} alt={item.name} style={{opacity: (item.is_out_of_stock || item.stock_count === 0) ? 0.4 : 1}} />
                    </div>
                    <div className="img-footer-row" onClick={e => e.stopPropagation()}>
                      <span className="item-amount-text">{item.amount}</span>
                      {item.is_out_of_stock || item.stock_count === 0 ? (
                        <button className="add-btn-small" style={{background: '#f2f4f7', color: '#98a2b3', border: '1px solid #e4e7ec'}} disabled>ADD</button>
                      ) : qty === 0 ? (
                        <button className="add-btn-small" onClick={() => { saveRecentSearch(query); updateCartQty(item, 1); }}>ADD</button>
                      ) : (
                        <div className="qty-control">
                          <button onClick={() => updateCartQty(item, -1)}>-</button>
                          <span>{qty}</span>
                          <button onClick={() => updateCartQty(item, 1)}>+</button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="bestseller-info">
                    <div className="item-price">
                      {item.is_wafer ? (
                        <span className="wafer-price-tag">₹{item.price}</span>
                      ) : (
                        <>₹{item.price}</>
                      )}
                    </div>
                    <h3 className="item-name">{item.name}</h3>
                    {item.stock_count > 0 && item.stock_count <= 2 ? (
                      <div style={{color: '#d92d20', fontSize: '10px', fontWeight: 'bold', marginTop: '2px'}}>{item.stock_count} left!</div>
                    ) : item.stock_count > 2 && item.stock_count < 10 ? (
                      <div style={{color: '#f79009', fontSize: '10px', fontWeight: 'bold', marginTop: '2px'}}>Only few left</div>
                    ) : null}
                    <div className="time-tag">⏱ {getProductDeliveryTime(item.name)} MINS</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchOverlay;
