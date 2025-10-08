// Import InstantSearch.js
import { liteClient as algoliasearch } from 'algoliasearch/lite';
import instantsearch from 'instantsearch.js';
import { 
  searchBox, 
  hits, 
  refinementList,
  rangeInput,
  pagination,
  configure,
  stats,
  clearRefinements,
  frequentlyBoughtTogether,
  trendingItems
} from 'instantsearch.js/es/widgets';
import aa from 'search-insights';

// User identification for personalization
const USER_TOKEN = 'user1';

aa("init", {
  appId: "LZ4JITGAIZ",
  apiKey: "6f8fdc3eb1aa521ea16808eb351f85d5",
});

// Set user token for personalization
aa('setUserToken', USER_TOKEN);

// Store query ID and position for analytics
let currentQueryID = '';
let hitPositions = new Map();

function castBadges(hit, html) {
  if (!hit.cast) return '';
  return hit.cast.map(castMember =>
    html`<span class="badge">${castMember.name}</span>`
  );
}

function hitTemplate(hit, { html, components, sendEvent }) {
  if (hit.__queryID) {
    currentQueryID = hit.__queryID;
  }

  if (typeof hit.__position === 'number') {
    hitPositions.set(hit.objectID, hit.__position);
  }

  // Extract year from release_date
  const year = hit.release_date ? new Date(hit.release_date).getFullYear() : 'N/A';

  return (html`
    <div class="hit" data-hit-data="${JSON.stringify(hit)}" data-object-id="${hit.objectID}">
      <div class="hit-image">
        <img src="${hit.poster_path}" alt="${hit.title}" />
      </div>
      <div class="hit-content">
        <div class="movie-name">
          ${components.Highlight({ attribute: 'title', hit })}
        </div>
        <div class="movie-metadata">
          <span class="movie-year">${year}</span>
          ${hit.vote_average ? html`<span class="movie-rating">⭐ ${hit.vote_average.toFixed(1)}</span>` : ''}
        </div>
        <div class="movie-description">
          ${hit.overview}
        </div>
        <div class="movie-cast">
          <h4 class="cast-text">CAST</h4>
          <div class="cast-badge">${castBadges(hit, html)}</div>
        </div>
        <div class="hit-actions">
          <button
            class="add-to-cart-btn"
            onClick=${() => {
              sendEvent("conversion", hit, "Added To Cart", {
                eventSubtype: "addToCart",
                objectData: [{
                  discount: hit.discount || 0,
                  price: 20,
                  quantity: 1,
                }],
                value: 20,
                currency: "USD",
              });
              handleAddToCart(hit);
            }}
          >
            Add to cart
          </button>
        </div>
      </div>
    </div>
  `)
}

// Recommendation item template (for Algolia Recommend widgets)
function recommendationItemTemplate(hit, { html }) {
  return html`
    <div class="recommendation-card">
      <img src="${hit.poster_path}" alt="${hit.title}" />
      <div class="recommendation-info">
        <div class="recommendation-title">${hit.title}</div>
        ${hit.vote_average ? html`<div class="recommendation-rating">⭐ ${hit.vote_average.toFixed(1)}</div>` : ''}
      </div>
      <button
        class="recommendation-add-btn"
        onclick="handleRecommendationClick('${hit.objectID}')"
      >
        Add to Cart
      </button>
    </div>
  `;
}

// Handle add to cart
function handleAddToCart(hit) {
  const objectID = hit.objectID;
  
  // Send Algolia Insights conversion event
  if (currentQueryID) {
    aa('convertedObjectIDsAfterSearch', {
      index: 'algolia_movie_sample_dataset',
      eventName: 'Product Added to Cart',
      queryID: currentQueryID,
      objectIDs: [objectID],
      userToken: USER_TOKEN
    });
  }

  // Store purchase history for custom display
  const purchaseHistory = JSON.parse(localStorage.getItem('purchaseHistory') || '[]');
  const purchase = {
    objectID: objectID,
    title: hit.title,
    image: hit.poster_path,
    timestamp: Date.now()
  };
  
  // Add to beginning and keep last 10
  purchaseHistory.unshift(purchase);
  localStorage.setItem('purchaseHistory', JSON.stringify(purchaseHistory.slice(0, 10)));

  // Visual feedback
  const button = event.target;
  const originalText = button.textContent;
  button.textContent = '✓ Added!';
  button.disabled = true;
  button.style.backgroundColor = '#28a745';

  setTimeout(() => {
    button.textContent = originalText;
    button.disabled = false;
    button.style.backgroundColor = '';
  }, 2000);

  // Refresh custom purchase history display
  displayCustomPurchaseHistory();
}

// Handle recommendation click
window.handleRecommendationClick = function(objectID) {
  aa('convertedObjectIDs', {
    index: 'algolia_movie_sample_dataset',
    eventName: 'Recommendation Added to Cart',
    objectIDs: [objectID],
    userToken: USER_TOKEN
  });

  alert('Item added to cart from recommendations!');
  
  // Update purchase history
  const purchaseHistory = JSON.parse(localStorage.getItem('purchaseHistory') || '[]');
  const item = purchaseHistory.find(p => p.objectID === objectID);
  if (item) {
    const filtered = purchaseHistory.filter(p => p.objectID !== objectID);
    filtered.unshift({ ...item, timestamp: Date.now() });
    localStorage.setItem('purchaseHistory', JSON.stringify(filtered));
  }
  
  displayCustomPurchaseHistory();
}

// Display custom purchase history
function displayCustomPurchaseHistory() {
  const purchaseHistory = JSON.parse(localStorage.getItem('purchaseHistory') || '[]');
  const container = document.getElementById('custom-purchase-history');
  
  if (!container) return;
  
  if (purchaseHistory.length === 0) {
    container.innerHTML = '<p class="no-recommendations">No recent purchases yet. Add items to cart to see your history!</p>';
    return;
  }

  const recentPurchases = purchaseHistory.slice(0, 4);
  
  container.innerHTML = `
    <h3>Your Recent Purchases</h3>
    <div class="custom-recommendations-grid">
      ${recentPurchases.map(item => `
        <div class="recommendation-card">
          <img src="${item.image}" alt="${item.title}" />
          <div class="recommendation-info">
            <div class="recommendation-title">${item.title}</div>
          </div>
          <button class="recommendation-add-btn" onclick="handleRecommendationClick('${item.objectID}')">
            Buy Again
          </button>
        </div>
      `).join('')}
    </div>
  `;
}

// Initialize search client
const searchClient = algoliasearch('LZ4JITGAIZ', 'a178b54077599b2374f21cd1a8979331');

// Render the InstantSearch.js wrapper
const search = instantsearch({
  indexName: 'algolia_movie_sample_dataset',
  searchClient,
  insights: true,
  routing: true,
});

search.addWidgets([
  // Configure for personalization
  configure({
    userToken: USER_TOKEN,
    enablePersonalization: true,
    hitsPerPage: 10,
  }),

  // Search box
  searchBox({
    container: "#searchbox",
    placeholder: 'Search for movies...',
    showReset: true,
    showSubmit: true,
    showLoadingIndicator: true,
  }),

  // Search stats
  stats({
    container: '#stats',
    templates: {
      text: `
        {{#hasNoResults}}No results{{/hasNoResults}}
        {{#hasOneResult}}1 result{{/hasOneResult}}
        {{#hasManyResults}}{{#helpers.formatNumber}}{{nbHits}}{{/helpers.formatNumber}} results{{/hasManyResults}}
        found in {{processingTimeMS}}ms
      `,
    },
  }),

  // Clear refinements button
  clearRefinements({
    container: '#clear-refinements',
    templates: {
      resetLabel: 'Clear all filters',
    },
  }),

  // Genre filter (refinement list)
  // NOTE: You must add 'genres' as a facet in your Algolia dashboard:
  // Dashboard → Index → Configuration → Facets → Add 'genres' as "searchable" or "filter only"
  refinementList({
    container: '#genre-list',
    attribute: 'genres',
    limit: 5,
    showMore: true,
    showMoreLimit: 30,
    sortBy: ['name:asc'],
  }),

  // Rating filter - Algolia's native range input
  // NOTE: You must add 'vote_average' as an attribute for faceting in Algolia dashboard
  rangeInput({
    container: '#rating-range',
    attribute: 'vote_average',
    templates: {
      separatorText: 'to',
      submitText: 'Filter',
    },
    precision: 1,
  }),

  // Hits
  hits({
    container: "#hits",
    templates: {
      empty: 'No results found for "{{query}}". Try a different search term.',
      item: hitTemplate,
    },
  }),

  // Pagination
  pagination({
    container: '#pagination',
    padding: 2,
    showFirst: true,
    showLast: true,
    showPrevious: true,
    showNext: true,
    templates: {
      first: '«',
      last: '»',
      previous: '‹',
      next: '›',
    },
  }),

  // Note: Algolia Recommend widgets (trendingItems, frequentlyBoughtTogether) 
  // require Algolia Recommend to be enabled in your account.
  // Uncomment below once you have it set up:
  
  // trendingItems({
  //   container: '#trending-items',
  //   recommendClient: searchClient,
  //   indexName: 'algolia_movie_sample_dataset',
  //   maxRecommendations: 8,
  //   templates: {
  //     header: '<h3>🔥 Trending Movies</h3>',
  //     item: recommendationItemTemplate,
  //   },
  // }),
]);

// Start search
search.start();

// Display custom purchase history on page load
displayCustomPurchaseHistory();

console.log('Search initialized with user token:', USER_TOKEN);