export const fetchPokemonCard = async (query, apiKey) => {
    const url = `https://api.pokemontcg.io/v2/cards?q=${query}`;
    
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': apiKey,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching Pokémon card data:', error);
        throw error;
    }
};