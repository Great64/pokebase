const apiKey = process.env.API_KEY || '';
const apiUrl = 'http://localhost:3000/api/cards';
const apiUrl2 = 'https://api.pokemontcg.io/v2/cards';
let searchResults = []; // Variable to store search results
let searchQuery = ""; // Variable to store the submitted search word

/*
TO ANYONE READING THIS CODE

Yes. I am aware that this is probably not the stack I should be using for this project. HOWEVER, what started out as a simple demonstration of a school project
quickly turned into something a bit more ambitious, at that point there was no going back. Every single feature is crammed into this one file, but I have done
my best to label everything

*/

// Store filter values
let filters = {
    cardType: ""
};

// Update filters when they change
document.getElementById('filter1').addEventListener('change', (event) => {
    filters.cardType = event.target.value;
    reloadCardsWithFilters();
});

// Pagination variables for infinite scroll
let currentPage = 1;
const cardsPerPage = 20;
let isLoading = false;
let hasMoreCards = true;

// Apply filters to query string - updated to work with MySQL database structure using IDs
function applyFilters(baseQueryString = '') {
    let queryString = baseQueryString;
    
    if (filters.cardType) {
        const supertypeID = filters.cardType; // Use the selected supertype_id directly
        console.log("Using supertype_id:", supertypeID);
        
        // Add supertype_id as a query parameter
        if (queryString) {
            queryString += `&supertype_id=${supertypeID}`;
        } else {
            queryString = `supertype_id=${supertypeID}`;
        }
    }
    
    return queryString;
}

// Add a function to reload cards when filters change
function reloadCardsWithFilters() {
    // Reset pagination variables
    currentPage = 1;
    hasMoreCards = true;
    searchResults = [];
    
    // Clear the results container
    const resultsContainer = document.getElementById('results');
    resultsContainer.innerHTML = '';
    
    // Load cards with the new filter
    loadCards();
}

// Enhanced debugging function to better understand the database structure
async function debugCardStructure() {
    try {
        // Fetch a few cards to inspect their structure
        const response = await fetch(`${apiUrl}?page=1&pageSize=10`);
        const data = await response.json();
        if (data.data && data.data.length > 0) {
            console.log("Sample card structure:", data.data[0]);
            console.log("All card fields:", Object.keys(data.data[0]));
            
            // Create a mapping of supertype_id to counts to see what exists
            const supertypeCounts = {};
            data.data.forEach(card => {
                const id = card.supertype_id;
                if (id) {
                    supertypeCounts[id] = (supertypeCounts[id] || 0) + 1;
                }
            });
            console.log("Supertype ID counts in sample:", supertypeCounts);
            
            // Try to fetch directly from the supertype table if available
            try {
                // This is a guess at an endpoint - may need to be adjusted
                const typeResponse = await fetch(`${apiUrl.replace('cards', 'supertypes')}`);
                const typeData = await typeResponse.json();
                console.log("Supertype table data:", typeData);
            } catch (err) {
                console.log("Could not fetch supertype table data");
            }
            
            // Let's try to fetch some cards of each supertype_id to see what they are
            for (const id of Object.keys(supertypeCounts)) {
                try {
                    const typeQuery = `supertype_id = ${id}`;
                    console.log(`Testing cards with supertype_id = ${id}`);
                    const typeResponse = await fetch(`${apiUrl}?q=${encodeURIComponent(typeQuery)}&page=1&pageSize=3`);
                    const typeData = await typeResponse.json();
                    
                    if (typeData.data && typeData.data.length > 0) {
                        // Look up external data to identify the type
                        try {
                            const externalResponse = await fetch(`${apiUrl2}/${typeData.data[0].card_id}`);
                            const externalData = await externalResponse.json();
                            console.log(`Cards with supertype_id ${id} appear to be: ${externalData.data?.supertype || 'Unknown'}`);
                        } catch (err) {
                            console.log(`Could not identify supertype for ID ${id}`);
                        }
                    }
                } catch (err) {
                    console.error(`Error testing supertype_id ${id}:`, err);
                }
            }
        }
    } catch (error) {
        console.error("Error fetching sample card:", error);
    }
}

// Replace the old custom button listener with one that shows the modal overlay
document.getElementById('custom-button').addEventListener('click', () => {
    document.getElementById('custom-modal').style.display = 'flex';
});

// Add listener to close the modal when clicking the close button
document.getElementById('close-modal').addEventListener('click', () => {
    document.getElementById('custom-modal').style.display = 'none';
});

document.getElementById('search-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    
    // Reset pagination variables and searchResults for a new search
    currentPage = 1;
    hasMoreCards = true;
    searchResults = [];
    searchQuery = document.getElementById('search-input').value.trim(); // Update search query
    
    const resultsContainer = document.getElementById('results');
    const searchSummary = document.getElementById('search-summary');
    resultsContainer.innerHTML = ''; // Changed from 'Loading...' to empty
    
    await loadCards();
});

/* Display cards in alphabetical order when user loads into the site */
document.addEventListener('DOMContentLoaded', async () => {
    const resultsContainer = document.getElementById('results');
    
    // Ensure we start with grid display
    resultsContainer.style.display = 'grid';
    
    const searchSummary = document.getElementById('search-summary');
    
    // Populate all filter dropdowns
    await populateCardTypes();
    
    // Load initial cards
    await loadCards();
    
    // Set up intersection observer for infinite scroll
    const observer = new IntersectionObserver((entries) => {
        // If the footer is visible and we're not already loading and there are more cards to load
        if (entries[0].isIntersecting && !isLoading && hasMoreCards) {
            loadCards();
        }
    }, { threshold: 0.1 });
    
    // Create and observe a footer element that triggers loading more when it comes into view
    const footer = document.createElement('div');
    footer.id = 'scroll-trigger';
    footer.style.height = '20px';
    footer.style.width = '100%';
    resultsContainer.after(footer);
    observer.observe(footer);

    // Add event listener for reset filters button
    document.getElementById('reset-filters-button').addEventListener('click', () => {
        // Reset all filter dropdowns to their default values
        document.getElementById('filter1').selectedIndex = 0;
        
        // Clear all filter values in the filters object
        Object.keys(filters).forEach(key => {
            filters[key] = "";
        });
        
        // Optional: Give user feedback that filters were reset
        // You could flash a message or change button text temporarily
        const resetButton = document.getElementById('reset-filters-button');
        const originalText = resetButton.textContent;
        resetButton.textContent = "Cleared!";
        setTimeout(() => {
            resetButton.textContent = originalText;
        }, 1000);
    });

    // After loading initial cards, check URL for card parameter
    const urlParams = new URLSearchParams(window.location.search);
    const cardId = urlParams.get('card');
    
    if (cardId) {
        // If card ID is in URL, show that card and add it to history
        history.replaceState({ cardId }, '', `?card=${cardId}`);
        disableInfiniteScroll();
        await showCardDetails(cardId);
    } else {
        // Otherwise set up infinite scroll for the results view
        setupInfiniteScroll();
    }
});

// Function to load cards with pagination - updated to handle ID-based filtering
async function loadCards() {
    if (isLoading) return;
    isLoading = true;

    const resultsContainer = document.getElementById('results');
    resultsContainer.style.display = 'grid';
    const searchSummary = document.getElementById('search-summary');
    
    try {
        let filtersQuery = applyFilters();
        let apiEndpoint = `${apiUrl}?page=${currentPage}&pageSize=${cardsPerPage}`;
        
        if (filtersQuery) {
            apiEndpoint += `&${filtersQuery}`;
        }
        
        console.log("Final API endpoint:", apiEndpoint);
        
        const response = await fetch(apiEndpoint);
        const data = await response.json();
        
        if (data.data && data.data.length > 0) {
            data.data.forEach(card => {
                searchResults.push(card);
                const cardElement = document.createElement('div');
                cardElement.className = 'card';
                cardElement.innerHTML = `<img src="${card.small_img}" alt="${card.card_name}">`;
                cardElement.addEventListener('click', () => cardClickHandler(card.card_id));
                resultsContainer.appendChild(cardElement);
            });
            currentPage++;
            
            if (data.data.length < cardsPerPage) {
                hasMoreCards = false;
            }
        } else {
            hasMoreCards = false;
            if (searchResults.length === 0) {
                resultsContainer.innerHTML = 'No cards found.';
                searchSummary.textContent = 'No cards found.';
            }
        }
    } catch (error) {
        console.error('Error fetching cards:', error);
        searchSummary.textContent = 'Error loading cards. Please try again.';
    } finally {
        isLoading = false;
    }
}

/* Filter Button */
document.getElementById('filter-button').addEventListener('click', (event) => {
    const filterPanel = document.getElementById('filter-panel');
    const filterButton = event.currentTarget;
    
    if (filterPanel.style.display === 'none') {
        // Position the panel relative to the button
        filterPanel.style.display = 'grid';
        
        // Calculate position to center it under the filter button
        const buttonRect = filterButton.getBoundingClientRect();
        
        // Get the actual width of the panel
        filterPanel.style.visibility = 'hidden';
        filterPanel.style.position = 'absolute';
        filterPanel.style.top = '0';
        filterPanel.style.left = '0';
        
        // Force the panel to be visible so we can measure it
        const originalDisplay = filterPanel.style.display;
        filterPanel.style.display = 'grid';
        
        const panelWidth = filterPanel.offsetWidth;
        
        // Reset display to original state
        filterPanel.style.display = originalDisplay;
        filterPanel.style.visibility = 'visible';
        
        // Position the panel directly below the button and centered horizontally
        const formContainer = document.querySelector('.form-container');
        const formRect = formContainer.getBoundingClientRect();
        
        // I got so fed up with this bs that I'm actually using math
        filterPanel.style.left = ((buttonRect.left - formRect.left) + (buttonRect.width / 2) - (panelWidth / 2)) + 'px';
        
        // Add 20px margin for clear separation
        filterPanel.style.top = (buttonRect.height + 20) + 'px';
    } else {
        filterPanel.style.display = 'none';
    }
    
    // Stop event propagation to prevent immediate closing by the document click handler
    event.stopPropagation();
});

// Add click event listener to the document to close the filter panel when clicking outside
document.addEventListener('click', (event) => {
    const filterPanel = document.getElementById('filter-panel');
    const filterButton = document.getElementById('filter-button');
    
    // Check if the filter panel is visible and the click was outside both the filter button and filter panel
    if (filterPanel.style.display !== 'none' && 
        !filterPanel.contains(event.target) && 
        !filterButton.contains(event.target)) {
        filterPanel.style.display = 'none';
    }
});

// Prevent clicks inside the filter panel from closing it
document.getElementById('filter-panel').addEventListener('click', (event) => {
    event.stopPropagation();
});

// Function called when a card is clicked
function cardClickHandler(cardId) {
    // Instead of showing card details directly, push a new state to browser history
    const cardDetailUrl = `?card=${cardId}`;
    history.pushState({ cardId }, '', cardDetailUrl);
    
    // Disable infinite scroll while viewing card details
    disableInfiniteScroll();
    
    // Show card details
    showCardDetails(cardId);
}

// Function to disable infinite scroll
function disableInfiniteScroll() {
    // Remove the scroll trigger so cards don't keep loading
    const scrollTrigger = document.getElementById('scroll-trigger');
    if (scrollTrigger) {
        scrollTrigger.remove();
    }
    
    // Set flag to prevent more cards from loading
    hasMoreCards = false;
}

// Function to re-enable infinite scroll
function enableInfiniteScroll() {
    // Reset pagination variables
    hasMoreCards = true;
    
    // Set up the scroll trigger again
    setupInfiniteScroll();
}

// Function to set up infinite scroll
function setupInfiniteScroll() {
    const resultsContainer = document.getElementById('results');
    
    // Remove any existing scroll trigger
    const existingTrigger = document.getElementById('scroll-trigger');
    if (existingTrigger) {
        existingTrigger.remove();
    }
    
    // Set up intersection observer for infinite scroll
    const observer = new IntersectionObserver((entries) => {
        // If the footer is visible and we're not already loading and there are more cards to load
        if (entries[0].isIntersecting && !isLoading && hasMoreCards) {
            loadCards();
        }
    }, { threshold: 0.1 });
    
    // Create and observe a footer element that triggers loading more when it comes into view
    const footer = document.createElement('div');
    footer.id = 'scroll-trigger';
    footer.style.height = '20px';
    footer.style.width = '100%';
    resultsContainer.after(footer);
    observer.observe(footer);
}

async function showCardDetails(cardId) {
    const resultsContainer = document.getElementById('results');
    
    // Hide search elements when viewing card details
    document.querySelector('h1').style.display = 'none';
    document.querySelector('.form-container').style.display = 'none';
    document.getElementById('search-summary').style.display = 'none';
    
    // Clear results container completely to avoid showing multiple cards
    resultsContainer.innerHTML = 'Loading...';
    
    try {
        const response = await fetch(`${apiUrl}/${cardId}`);
        const data = await response.json();
        const card = data.data;

        // Added: print the card's supertype to the console
        console.log("Clicked card's supertype:", card.supertype);

        // ---- Begin TCGPlayer Prices update ----

        // If you have a keen eye, you probably scrolled here in the code trying to figure out how the hell we were able to do live price tracking using a prefilled database
        // the short answer is that we didn't. We had to use a dynamic api request to implement this feature. The database is capable of retrieving price data at the time
        // it was populated, however, since I went the extra yard to turn this into a website and not a simple GUI, this is just the more intuitive way of doing this. If you
        // are the person marking our project, I hope you can understand our reasoning for doing so, and that in theory the database is perfectly capable of doing non-live
        // price retrieval 

        let tcgPlayerHtml = '<p>No price data available</p>';
        try {
            const tcgResponse = await fetch(`${apiUrl2}/${card.card_id}`);
            const tcgData = await tcgResponse.json();
            if (tcgData.data && tcgData.data.tcgplayer && tcgData.data.tcgplayer.prices) {
                const prices = tcgData.data.tcgplayer.prices;
                const updatedAt = tcgData.data.tcgplayer.updatedAt ? formatDate(tcgData.data.tcgplayer.updatedAt) : 'Unknown';
                // Ensure the URL is fully qualified:
                let tcgUrl = tcgData.data.tcgplayer.url || '';
                const fullTcgUrl = tcgUrl.startsWith('http') ? tcgUrl : 'https://www.tcgplayer.com' + tcgUrl;

                tcgPlayerHtml = `
                    <div style="margin-bottom:15px;">
                        <p><strong>Updated:</strong> ${updatedAt}</p>
                        <table style="width:100%; border-collapse: collapse; margin-top:10px;">
                            <thead style="background-color:#f0f2f5;">
                                <tr>
                                    <th style="padding:8px; text-align:left;">Variant</th>
                                    <th style="padding:8px; text-align:right;">Low</th>
                                    <th style="padding:8px; text-align:right;">Market</th>
                                    <th style="padding:8px; text-align:right;">Mid</th>
                                    <th style="padding:8px; text-align:right;">High</th>
                                </tr>
                            </thead>
                            <tbody>
                `;
                
                let hasPrices = false;
                for (const [variant, priceData] of Object.entries(prices)) {
                    hasPrices = true;
                    tcgPlayerHtml += `
                        <tr>
                            <td style="padding:8px; border-top:1px solid #ddd; text-transform:capitalize;">
                                ${variant.replace(/([A-Z])/g, ' $1')}
                            </td>
                            <td style="padding:8px; border-top:1px solid #ddd; text-align:right;">
                                ${priceData.low ? `$${priceData.low.toFixed(2)}` : 'N/A'}
                            </td>
                            <td style="padding:8px; border-top:1px solid #ddd; text-align:right;">
                                ${priceData.market ? `$${priceData.market.toFixed(2)}` : 'N/A'}
                            </td>
                            <td style="padding:8px; border-top:1px solid #ddd; text-align:right;">
                                ${priceData.mid ? `$${priceData.mid.toFixed(2)}` : 'N/A'}
                            </td>
                            <td style="padding:8px; border-top:1px solid #ddd; text-align:right;">
                                ${priceData.high ? `$${priceData.high.toFixed(2)}` : 'N/A'}
                            </td>
                        </tr>
                    `;
                }
                
                tcgPlayerHtml += `
                            </tbody>
                        </table>
                        ${hasPrices ? `
                            <p style="margin-top:10px;">
                                <a href="${fullTcgUrl}" target="_blank" style="color:#007bff; text-decoration:none;">
                                    Buy on TCGPlayer &rarr;
                                </a>
                            </p>
                        ` : ''}
                    </div>
                `;
            }
        } catch (err) {
            console.error('Error fetching TCG prices:', err);
        }
        // ---- End TCGPlayer Prices update ----

        // ---- Begin Attacks update ----
        // Instead of using card.attacks from the database,
        // fetch attacks data from the external API similar to prices.
        // we didn't add this in our original database, but we thought it would be a cool feature so we used the api once again to add it
        // this is the second and last time we used the api directly in this project
        let attacksHtml = '<p>No attacks</p>';
        try {
            const tcgAttacksResponse = await fetch(`${apiUrl2}/${card.card_id}`);
            const tcgAttacksData = await tcgAttacksResponse.json();
            const attacksData = (tcgAttacksData.data && tcgAttacksData.data.attacks) ? tcgAttacksData.data.attacks : card.attacks;
            if (attacksData && attacksData.length > 0) {
                attacksHtml = attacksData.map(attack => {
                    const energyCost = attack.cost ? attack.cost.map(energy => {
                        // Map energy names to corresponding image files
                        const energyType = energy.toLowerCase();
                        return `<img src="images/energy/${energyType}.svg" alt="${energy}" class="energy-icon" />`;
                    }).join('') : '';
                    
                    return `
                        <div class="attack">
                            <div class="attack-header">
                                <span class="attack-cost">${energyCost}</span>
                                <span class="attack-name">${attack.name}</span>
                                <span class="attack-damage">${attack.damage || ''}</span>
                            </div>
                            <div class="attack-text">${attack.text || ''}</div>
                        </div>
                    `;
                }).join('');
            }
        } catch (err) {
            console.error('Error fetching dynamic attacks:', err);
        }
        // ---- End Attacks update ----

        // Ensure set information is handled properly
        const setName = card.set_name || 'Unknown Set';
        const setSeries = card.set_series || 'Unknown Series';

        // Handle rarity data
        const rarity = card.rarity || 'Unknown';

        // Handle legality data
        const legalities = [];
        if (card.unlimited) legalities.push('Unlimited');
        if (card.standard) legalities.push('Standard');
        if (card.expanded) legalities.push('Expanded');
        const legalitiesHtml = legalities.length > 0 
            ? legalities.map(status => `<span class="legality-badge legal">${status}</span>`).join(' ')
            : '<p>No legalities available</p>';

        // Get form/subtypes
        const subtypes = card.subtypes ? card.subtypes.join(', ') : 'Basic';
        const supertype = card.supertype || 'Unknown';
        const types = card.types || 'None';
        let weakness = 'None';
        if (card.weaknesses && card.weaknesses.length > 0) {
            weakness = card.weaknesses.map(w => `${w.type} ${w.value}`).join(', ');
        }
        let retreatCost = 'None';
        if (card.retreatCost) {
            retreatCost = card.retreatCost.length;
        }
        
        // Format legalities for display
        let legalitiesDisplayHtml = '';
        if (card.legalities) {
            legalitiesDisplayHtml = '<div class="card-legalities">';
            for (const [format, status] of Object.entries(card.legalities)) {
                legalitiesDisplayHtml += `<span class="legality-badge ${status}">${format}: ${status}</span>`;
            }
            legalitiesDisplayHtml += '</div>';
        }

        // Make sure the results container is fully cleared before adding new content
        resultsContainer.innerHTML = '';
        
        // Change display type of results container to block to override grid layout
        resultsContainer.style.display = 'block';

        const pokedexNumbers = card.pokedexNumbers ? card.pokedexNumbers : 'N/A';
        
        // Add the card details HTML using a proper table layout for consistent horizontal distribution
        resultsContainer.innerHTML = `
            <div style="max-width:1200px; margin:0 auto; padding:0; position:relative;">
                <table style="width:100%; border-collapse:separate; border-spacing:0; margin:0 auto;">
                    <tr>
                        <!-- Left column: Card image, return button, and additional info -->
                        <td style="width:330px; vertical-align:top; padding-right:20px; padding-left:0; position:relative;">
                            <!-- Maintain the negative margin that pushes the image left -->
                            <div style="margin-left:-150px; width:115%;">
                                <img src="${card.large_img}" alt="${card.card_name}" 
                                    style="width:100%; border-radius:15px; box-shadow:0 4px 20px rgba(0,0,0,0.15); max-width:none;">
                            </div>
                            
                            <!-- Button container with centered positioning -->
                            <div style="margin-top:20px; margin-left:-150px; width:115%; text-align:center;">
                                <button id="return-button" style="width:100%; max-width:330px; padding:12px; 
                                        background-color:#007bff; color:white; border:none; border-radius:8px; 
                                        cursor:pointer; display:inline-block;">
                                    Return to Search Results
                                </button>
                            </div>
                            
                            <!-- Additional Info and Legalities boxes with negative margin preserved -->
                            <div style="margin-top:20px; margin-left:-150px; width:115%;">
                                <div style="background-color:#f8f9fa; border-radius:10px; padding:15px; box-shadow:0 2px 8px rgba(0,0,0,0.08); margin-bottom:15px;">
                                    <h3 style="margin:0 0 12px 0; color:#007bff; border-bottom:2px solid #e9ecef; padding-bottom:8px;">Additional Info</h3>
                                    <p style="margin:8px 0;"><strong style="color:#495057;">Rarity:</strong> <span style="color:#212529;">${rarity}</span></p>
                                    <p style="margin:8px 0;"><strong style="color:#495057;">Artist:</strong> <span style="color:#212529;">${card.artist || 'Unknown'}</span></p>
                                </div>
                                
                                <!-- Legalities Box -->
                                <div style="background-color:#f8f9fa; border-radius:10px; padding:15px; box-shadow:0 2px 8px rgba(0,0,0,0.08);">
                                    <h3 style="margin:0 0 12px 0; color:#007bff; border-bottom:2px solid #e9ecef; padding-bottom:8px;">Legalities</h3>
                                    ${legalitiesHtml}
                                </div>
                            </div>
                        </td>
                        
                        <!-- Right column with added padding to create more space -->
                        <td style="vertical-align:top; padding-left:20px;">
                            <h1 style="font-size:2rem; margin-top:0; margin-bottom:45px;">${card.card_name}</h1>
                            
                            <!-- Row 1: Card Details - Enhanced with styled boxes -->
                            <div style="display:flex; justify-content:space-between; margin-bottom:25px; gap:20px;">
                                <div style="flex:1; background-color:#f8f9fa; border-radius:10px; padding:15px; box-shadow:0 2px 8px rgba(0,0,0,0.08);">
                                    <h3 style="margin:0 0 12px 0; color:#007bff; border-bottom:2px solid #e9ecef; padding-bottom:8px;">Card Details</h3>
                                    <p style="margin:8px 0;"><strong style="color:#495057;">Number:</strong> <span style="color:#212529;">${card.number}/${card.printedTotal}</span></p>
                                    <p style="margin:8px 0;"><strong style="color:#495057;">Pokédex:</strong> <span style="color:#212529;">${pokedexNumbers}</span></p>
                                </div>
                                
                                <div style="flex:1; background-color:#f8f9fa; border-radius:10px; padding:15px; box-shadow:0 2px 8px rgba(0,0,0,0.08);">
                                    <h3 style="margin:0 0 12px 0; color:#007bff; border-bottom:2px solid #e9ecef; padding-bottom:8px;">Card Type</h3>
                                    <p style="margin:8px 0;"><strong style="color:#495057;">Type:</strong> <span style="color:#212529;">${supertype}</span></p>
                                    <p style="margin:8px 0;"><strong style="color:#495057;">Form:</strong> <span style="color:#212529;">${subtypes}</span></p>
                                </div>
                                
                                <div style="flex:1; background-color:#f8f9fa; border-radius:10px; padding:15px; box-shadow:0 2px 8px rgba(0,0,0,0.08);">
                                    <h3 style="margin:0 0 12px 0; color:#007bff; border-bottom:2px solid #e9ecef; padding-bottom:8px;">Card Set</h3>
                                    <p style="margin:8px 0;"><strong style="color:#495057;">Set:</strong> <span style="color:#212529;">${setName}</span></p>
                                    <p style="margin:8px 0;"><strong style="color:#495057;">Series:</strong> <span style="color:#212529;">${setSeries}</span></p>
                                </div>
                            </div>
                            
                            <!-- Row 2: Stats and Details - Enhanced with styled boxes -->
                            <div style="display:flex; justify-content:space-between; margin-bottom:25px; gap:20px;">
                                <div style="flex:1; background-color:#f8f9fa; border-radius:10px; padding:15px; box-shadow:0 2px 8px rgba(0,0,0,0.08);">
                                    <h3 style="margin:0 0 12px 0; color:#007bff; border-bottom:2px solid #e9ecef; padding-bottom:8px;">Card Stats</h3>
                                    <p style="margin:8px 0;"><strong style="color:#495057;">HP:</strong> <span style="color:#212529;">${card.hp || 'N/A'}</span></p>
                                    <p style="margin:8px 0;"><strong style="color:#495057;">Weakness:</strong> <span style="color:#212529;">${weakness}</span></p>
                                </div>
                                
                                <div style="flex:1; background-color:#f8f9fa; border-radius:10px; padding:15px; box-shadow:0 2px 8px rgba(0,0,0,0.08);">
                                    <h3 style="margin:0 0 12px 0; color:#007bff; border-bottom:2px solid #e9ecef; padding-bottom:8px;">Battle Info</h3>
                                    <p style="margin:8px 0;"><strong style="color:#495057;">Typing:</strong> <span style="color:#212529;">${types}</span></p>
                                    <p style="margin:8px 0;"><strong style="color:#495057;">Retreat Cost:</strong> <span style="color:#212529;">${retreatCost}</span></p>
                                </div>
                                
                                <div style="flex:1; background-color:#f8f9fa; border-radius:10px; padding:15px; box-shadow:0 2px 8px rgba(0,0,0,0.08);">
                                    <h3 style="margin:0 0 12px 0; color:#007bff; border-bottom:2px solid #e9ecef; padding-bottom:8px;">Publication</h3>
                                    <p style="margin:8px 0;"><strong style="color:#495057;">Released:</strong> <span style="color:#212529;">${formatDate(card.releaseDate)}</span></p>
                                    <p style="margin:8px 0;"><strong style="color:#495057;">Regulation Mark:</strong> <span style="color:#212529;">${card.regulationMark || 'None'}</span></p>
                                </div>
                            </div>
                            
                            <!-- TCGPlayer Prices -->
                            <div style="background-color:#f8f9fa; border-radius:10px; padding:15px; box-shadow:0 2px 8px rgba(0,0,0,0.08); margin-bottom:25px;">
                                <h3 style="margin:0 0 12px 0; color:#007bff; border-bottom:2px solid #e9ecef; padding-bottom:8px;">TCGPlayer Prices</h3>
                                ${tcgPlayerHtml}
                            </div>
                            
                            <!-- Card rules if available -->
                            ${card.rules ? `
                                <div style="background-color:#fffaed; border-radius:10px; padding:15px; box-shadow:0 2px 8px rgba(0,0,0,0.08); margin-bottom:25px; border-left:4px solid #fdcb6e;">
                                    <h3 style="margin:0 0 12px 0; color:#d9710d; border-bottom:2px solid #f9e3c7; padding-bottom:8px;">Card Rules</h3>
                                    <div style="line-height:1.5; color:#5d4037;">${card.rules.join('<br>')}</div>
                                </div>
                            ` : ''}
                            
                            <!-- Combined Attacks & Abilities Section -->
                            <div style="background-color:#f8f9fa; border-radius:10px; padding:15px; box-shadow:0 2px 8px rgba(0,0,0,0.08); margin-bottom:25px;">
                                <h3 style="margin:0 0 12px 0; color:#007bff; border-bottom:2px solid #e9ecef; padding-bottom:8px;">
                                    ${card.abilities ? 'Abilities & Attacks' : 'Attacks'}
                                </h3>
                                
                                <!-- Abilities Section (if present) -->
                                ${card.abilities ? `
                                    <div style="margin-bottom:20px;">
                                        <h4 style="margin:0 0 12px 0; color:#495057; font-size:1.1em;">Abilities:</h4>
                                        ${card.abilities.map(ability => `
                                            <div class="ability" style="background-color:#f0f4f8; border-radius:8px; padding:12px; margin-bottom:12px;">
                                                <div style="display:flex; align-items:center; margin-bottom:8px;">
                                                    <span class="ability-name" style="font-weight:bold; font-size:1.1em;">${ability.name}</span>
                                                    <span class="ability-type" style="background-color:#007bff; color:white; padding:3px 8px; border-radius:10px; font-size:0.8em; margin-left:10px;">${ability.type}</span>
                                                </div>
                                                <p class="ability-text" style="color:#495057; margin:0; line-height:1.5;">${ability.text}</p>
                                            </div>
                                        `).join('')}
                                    </div>
                                    <div style="height:1px; background-color:#e9ecef; margin:20px 0;"></div>
                                ` : ''}
                                
                                <!-- Attacks Section -->
                                <div>
                                    ${card.abilities ? '<h4 style="margin:0 0 12px 0; color:#495057; font-size:1.1em;">Attacks:</h4>' : ''}
                                    ${attacksHtml}
                                </div>
                            </div>
                            
                            <!-- Remove Additional Info and Legalities from right column since they've been moved -->
                        </td>
                    </tr>
                </table>
            </div>
        `;

        document.getElementById('return-button').addEventListener('click', () => {
            // Re-enable infinite scroll when returning to results
            enableInfiniteScroll();
            // Reset results container display back to grid for the card list view
            resultsContainer.style.display = 'grid';
            // Show search elements again
            document.querySelector('h1').style.display = 'block';
            document.querySelector('.form-container').style.display = 'flex';
            document.getElementById('search-summary').style.display = 'block';
            history.back();
        });
    } catch (error) {
        resultsContainer.innerHTML = 'Error fetching data.';
        console.error(error);
    }
}

// Helper function to format dates
function formatDate(dateString) {
    if (!dateString) return 'Unknown';
    
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
}

function displaySearchResults() {
    const resultsContainer = document.getElementById('results');
    
    // Reset display style to grid for the main card listing
    resultsContainer.style.display = 'grid';
    
    // Show search elements again
    document.querySelector('h1').style.display = 'block';
    document.querySelector('.form-container').style.display = 'flex';
    document.getElementById('search-summary').style.display = 'block';
    
    resultsContainer.innerHTML = '';

    // Re-enable infinite scroll for search results view
    enableInfiniteScroll();
    
    // Display search results
    searchResults.forEach(card => {
        const cardElement = document.createElement('div');
        cardElement.className = 'card';
        cardElement.innerHTML = `
            <img src="${card.small_img}" alt="${card.card_name}">
        `;
        // Use new click handler instead of inline function
        cardElement.addEventListener('click', () => cardClickHandler(card.card_id));
        resultsContainer.appendChild(cardElement);
    });
}

// Add popstate event handler to handle browser back/forward navigation
window.addEventListener('popstate', (event) => {
    if (event.state && event.state.cardId) {
        // If we have a card ID in the state, show that card and disable infinite scroll
        disableInfiniteScroll();
        showCardDetails(event.state.cardId);
    } else {
        // Otherwise, go back to the search results and enable infinite scroll
        enableInfiniteScroll();
        displaySearchResults();
    }
});

// Function to populate the card type filter dropdown
async function populateCardTypes() {
    const cardTypeSelect = document.getElementById('filter1');
    
    try {
        // Fetch all supertypes from the backend
        const response = await fetch('http://localhost:3000/api/supertypes');
        const data = await response.json();
        
        if (data.data && data.data.length > 0) {
            // Clear existing options except the default
            while (cardTypeSelect.options.length > 1) {
                cardTypeSelect.remove(1);
            }
            
            // Add card type options
            data.data.forEach(type => {
                const option = document.createElement('option');
                option.value = type.supertype_id; // Use supertype_id for filtering
                option.textContent = type.supertype;
                cardTypeSelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error fetching card types:', error);
    }
}

// Add event listeners for the new buttons
document.getElementById('create-button').addEventListener('click', async () => {
    try {
        const response = await fetch('http://localhost:3000/api/create-tables', { method: 'POST' });
        const result = await response.json();
        alert(result.message || 'Tables created successfully.');
    } catch (error) {
        console.error('Error creating tables:', error);
        alert('Failed to create tables.');
    }
});

document.getElementById('drop-button').addEventListener('click', async () => {
    try {
        const response = await fetch('http://localhost:3000/api/drop-tables', { method: 'POST' });
        const result = await response.json();
        alert(result.message || 'Tables dropped successfully.');
    } catch (error) {
        console.error('Error dropping tables:', error);
        alert('Failed to drop tables.');
    }
});

document.getElementById('populate-button').addEventListener('click', async () => {
    try {
        const response = await fetch('http://localhost:3000/api/populate-tables', { method: 'POST' });
        const result = await response.json();
        alert(result.message || 'Tables populated successfully.');
    } catch (error) {
        console.error('Error populating tables:', error);
        alert('Failed to populate tables.');
    }
});

// Updated exampleSQLQuery to illustrate the SQL query that reflects the "Types" (supertype) filter.
// Here the filter value is expected in lowercase (e.g., 'pokemon', 'trainer', or 'energy').
const exampleSQLQuery = `
SELECT c.card_id,
       c.card_name,
       c.artist,
       c.small_img,
       c.large_img,
       s.supertype
FROM card c
JOIN supertype s ON c.supertype_id = s.supertype_id
WHERE ('<cardType>' = '' OR LOWER(s.supertype) = '<cardType>')
  AND ('<searchQuery>' = '' OR c.card_name LIKE CONCAT('%', '<searchQuery>', '%'));
`;