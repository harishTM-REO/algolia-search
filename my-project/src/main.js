// Import InstantSearch.js
import { liteClient as algoliasearch } from 'algoliasearch/lite';
import instantsearch from 'instantsearch.js';
import { searchBox, hits } from 'instantsearch.js/es/widgets';
import aa from 'search-insights';

aa("init", {
  appId: "LZ4JITGAIZ",
  apiKey: "6f8fdc3eb1aa521ea16808eb351f85d5",
});

// Store query ID and position for analytics
let currentQueryID = '';
let hitPositions = new Map(); // Map to store objectID -> position

function castBadges(hit, html) {
  if (!hit.cast) return '';
  return hit.cast.map(castMember =>
    html`<span class="badge">${castMember.name}</span>`
  );
}

function hitTemplate(hit, { html, components, sendEvent }) {
  // Store the current queryID globally and ensure it exists
  if (hit.__queryID) {
    currentQueryID = hit.__queryID;
  }

  // Store position for this hit (make sure it's a valid number)
  if (typeof hit.__position === 'number') {
    hitPositions.set(hit.objectID, hit.__position);
  }

  return (html`
    <div class="hit" data-hit-data="${JSON.stringify(hit)}" data-object-id="${hit.objectID}">
      <div class="hit-image">
        <img src="${hit.poster_path}" />
      </div>
      <div class="hit-content">
        <div class="movie-name">
          ${components.Highlight({ attribute: 'original_title', hit })}
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
          onClick=${() =>
      sendEvent("conversion", hit, "Added To Cart", {
        eventSubtype: "addToCart",
        // An array of objects representing each item added to the cart
        objectData: [
          {
            // The discount value for this item, if applicable
            discount: hit.discount || 0,
            // The price value for this item (minus the discount)
            price: 20,
            // How many of this item were added
            quantity: 2,
          },
        ],
        // The total value of all items
        value: 20 * 2,
        // The currency code
        currency: "USD",
      })}
        >
          Add to cart
        </button>
        </div>
      </div>
    </div>
  `)
}

// Function to send addedToCartObjectIDsAfterSearch event
function sendAddToCartEvent(objectID) {
  // Check if we have a valid queryID
  if (!currentQueryID) {
    console.warn('No queryID available. Make sure a search was performed first.');
    return;
  }

  // Simple event without positions first
  const eventData = {
    index: 'algolia_movie_sample_dataset',
    queryID: currentQueryID,
    objectIDs: [objectID]
  };

  console.log('Sending add to cart event:', eventData);

  try {
    aa('addedToCartObjectIDsAfterSearch', eventData);
    console.log('Add to cart event sent successfully');
  } catch (error) {
    console.error('Error sending add to cart event:', error);
  }
}

/*
  Initialize the search client
 
  If you're logged into the Algolia dashboard, the following values for
  LZ4JITGAIZ and a178b54077599b2374f21cd1a8979331 are auto-selected from
  the currently selected Algolia application.
*/
const searchClient = algoliasearch('LZ4JITGAIZ', 'a178b54077599b2374f21cd1a8979331');

// Render the InstantSearch.js wrapper
const search = instantsearch({
  indexName: 'algolia_movie_sample_dataset',
  searchClient,
  insights: true,
  clickAnalytics: true,
});

search.addWidgets([
  searchBox({
    container: "#searchbox",
    placeholder: 'Enter a movie name for search'
  }),
  hits({
    container: "#hits",
    templates: {
      empty: 'No results.',
      item: hitTemplate,
    },
  })
]);

function clickHandler(e) {
  // Handle add to cart button clicks
  // if (e.target.classList.contains('add-to-cart-btn')) {
  //   e.stopPropagation(); // Prevent event bubbling

  //   const objectID = e.target.getAttribute('data-object-id');
  //   if (objectID) {
  //     // Send the Algolia Insights event
  //     sendAddToCartEvent(objectID);

  //     // Optional: Add visual feedback
  //     const button = e.target;
  //     const originalText = button.textContent;
  //     button.textContent = 'Added!';
  //     button.disabled = true;

  //     // Reset button after 2 seconds
  //     setTimeout(() => {
  //       button.textContent = originalText;
  //       button.disabled = false;
  //     }, 2000);

  //     // You can also add your cart logic here
  //     addToCartLogic(objectID);
  //   }
  // }

  // Handle general hit clicks (if needed)
  if (e.target.closest('.hit') && !e.target.classList.contains('add-to-cart-btn')) {
    // console.log('Hit clicked (not add to cart)');
  }
}

// Your cart logic function (implement as needed)
function addToCartLogic(objectID) {
  // Get the hit data
  const hitElement = document.querySelector(`[data-object-id="${objectID}"]`);
  if (hitElement) {
    const hitData = JSON.parse(hitElement.getAttribute('data-hit-data'));
    console.log('Adding to cart:', hitData.original_title);

    // Example: Store in localStorage or send to your backend
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    cart.push({
      objectID: objectID,
      title: hitData.original_title,
      image: hitData.poster_path,
      addedAt: new Date().toISOString()
    });
    localStorage.setItem('cart', JSON.stringify(cart));
  }
}

document.querySelector('body').addEventListener('click', (e) => {
  clickHandler(e)
});

search.start();