import mysql.connector
from mysql.connector import Error
import requests
from datetime import datetime
from dateutil import parser


def create_connection():
    try:
        connection = mysql.connector.connect(
            host='localhost',
            user='root',
            password='MyNewPass1!',
            database='pokebase'
        )
        return connection
    except Error as e:
        print(f"Error connecting to MySQL: {e}")
        return None


def fetch_api_data(url):
    # Replace with API key if needed
    headers = {"X-Api-Key": ""}
    response = requests.get(url, headers=headers)
    if response.status_code != 200:
        print(
            f"Failed to fetch data from {url}: {response.status_code} - {response.text}")
        return None
    return response.json()


def populate_supertypes(connection):
    supertypes = [
        (1, 'Pokémon'),
        (2, 'Trainer'),
        (3, 'Energy')
    ]
    cursor = connection.cursor()
    for st_id, st_name in supertypes:
        cursor.execute(
            "INSERT IGNORE INTO supertype (supertype_id, supertype) VALUES (%s, %s)", (st_id, st_name))
    connection.commit()
    cursor.close()
    print("Populated supertypes")


def populate_types(connection):
    url = 'https://api.pokemontcg.io/v2/types'
    data = fetch_api_data(url)
    if not data:
        return
    types_list = data['data']
    sorted_types = sorted(types_list)
    cursor = connection.cursor()
    for type_id, type_name in enumerate(sorted_types, start=1):
        cursor.execute(
            "INSERT IGNORE INTO type (type_id, type) VALUES (%s, %s)", (type_id, type_name))
    connection.commit()
    cursor.close()
    print(f"Populated {len(sorted_types)} types")


def populate_rarities(connection):
    url = 'https://api.pokemontcg.io/v2/rarities'
    response = requests.get(url)
    if response.status_code != 200:
        print("Failed to fetch rarities")
        return
    rarities_list = response.json()['data']
    sorted_rarities = sorted(rarities_list)
    cursor = connection.cursor()
    for rarity_id, rarity_name in enumerate(sorted_rarities, start=1):
        cursor.execute(
            "INSERT IGNORE INTO rarity (rarity_id, rarity) VALUES (%s, %s)", (rarity_id, rarity_name))
    connection.commit()
    cursor.close()
    print(f"Populated {len(sorted_rarities)} rarities")


def parse_date(date_str):
    try:
        return parser.parse(date_str).date() if date_str else None
    except ValueError as e:
        print(f"Date parsing error: {e}")
        return None


def populate_sets(connection):
    page = 1
    while True:
        url = f'https://api.pokemontcg.io/v2/sets?page={page}&pageSize=250'
        data = fetch_api_data(url)
        if not data or not data.get('data'):
            break
        cursor = connection.cursor()
        for set_data in data['data']:
            # Insert legality first
            cursor.execute(
                "INSERT INTO legality (unlimited, standard, expanded) VALUES (%s, %s, %s)",
                (
                    set_data.get('legalities', {}).get(
                        'unlimited', '').lower() == 'legal',
                    set_data.get('legalities', {}).get(
                        'standard', '').lower() == 'legal',
                    set_data.get('legalities', {}).get(
                        'expanded', '').lower() == 'legal'
                )
            )
            legality_id = cursor.lastrowid
            try:
                cursor.execute(
                    """INSERT INTO card_set (set_id, set_name, series, printed_total, total, ptcgo_code, release_date, updated_at, symbol_img, logo_img, legality_id)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                    (
                        set_data['id'],
                        set_data['name'],
                        set_data.get('series', 'Unknown'),
                        set_data.get('printedTotal', 0),
                        set_data.get('total', 0),
                        set_data.get('ptcgoCode'),
                        parse_date(set_data.get('releaseDate')),
                        parse_date(set_data.get('updatedAt', '').split()[0]),
                        set_data['images']['symbol'],
                        set_data['images']['logo'],
                        legality_id
                    )
                )
            except Error as e:
                print(
                    f"Skipping duplicate set {set_data['id']} due to error: {e}")
                connection.rollback()
                continue
        connection.commit()
        print(f"Processed page {page} of sets")
        page += 1
        cursor.close()


def populate_cards(connection):
    page = 1
    while True:
        url = f'https://api.pokemontcg.io/v2/cards?page={page}&pageSize=250'
        response = requests.get(url)
        if response.status_code != 200:
            print(f"Failed to fetch cards page {page}")
            break
        data = response.json()
        cards = data['data']
        if not cards:
            break
        cursor = connection.cursor()
        for card_data in cards:
            try:
                card_id = card_data['id']
                card_name = card_data['name']
                number = card_data['number']
                artist = card_data.get('artist')
                small_img = card_data['images']['small']
                large_img = card_data['images']['large']
                supertype_name = card_data['supertype']
                set_id = card_data['set']['id']
                rarity_name = card_data.get('rarity')
                hp = card_data.get('hp')
                flavor_text = (card_data.get('flavorText') or '')[
                    :500]  # Truncate to 500 chars

                hp = int(hp) if hp and hp.isdigit() else None

                cursor.execute(
                    "SELECT supertype_id FROM supertype WHERE supertype = %s", (supertype_name,))
                supertype_result = cursor.fetchone()
                if not supertype_result:
                    print(
                        f"Supertype {supertype_name} not found for card {card_id}")
                    continue
                supertype_id = supertype_result[0]

                rarity_id = None
                if rarity_name:
                    cursor.execute(
                        "SELECT rarity_id FROM rarity WHERE rarity = %s", (rarity_name,))
                    rarity_result = cursor.fetchone()
                    if rarity_result:
                        rarity_id = rarity_result[0]

                cursor.execute(
                    """INSERT INTO card (card_id, card_name, number, artist, small_img, large_img, supertype_id, set_id, rarity_id, hp, flavor_text)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                    (card_id, card_name, number, artist, small_img, large_img,
                     supertype_id, set_id, rarity_id, hp, flavor_text)
                )

                types = card_data.get('types', [])
                for type_name in types:
                    cursor.execute(
                        "SELECT type_id FROM type WHERE type = %s", (type_name,))
                    type_result = cursor.fetchone()
                    if type_result:
                        type_id = type_result[0]
                        cursor.execute(
                            "INSERT INTO card_type (type_id, card_id) VALUES (%s, %s)", (type_id, card_id))

                subtypes = card_data.get('subtypes', [])
                for subtype_name in subtypes:
                    # Insert into subtype table (ignore duplicates)
                    cursor.execute(
                        "INSERT IGNORE INTO subtype (subtype_name) VALUES (%s)", (
                            subtype_name,)
                    )
                    # Get the subtype_id
                    cursor.execute(
                        "SELECT subtype_id FROM subtype WHERE subtype_name = %s", (
                            subtype_name,)
                    )
                    subtype_id = cursor.fetchone()[0]
                    # Link to card
                    cursor.execute(
                        "INSERT IGNORE INTO card_subtype (card_id, subtype_id) VALUES (%s, %s)",
                        (card_id, subtype_id)
                    )

                    # Process pokedex_numbers
                pokedex_numbers = card_data.get('nationalPokedexNumbers', [])
                for pokedex_id in pokedex_numbers:
                    # Check if pokedex_id exists in the `pokedex` table
                    cursor.execute(
                        "SELECT pokedex_id FROM pokedex WHERE pokedex_id = %s", (
                            pokedex_id,)
                    )
                    if not cursor.fetchone():
                        # Insert into pokedex with a default region (e.g., 'Unknown')
                        cursor.execute(
                            "INSERT INTO pokedex (pokedex_id, pokedex_region) VALUES (%s, %s)",
                            (pokedex_id, 'Unknown')
                        )
                    # Insert into pokedex_card
                    cursor.execute(
                        "INSERT INTO pokedex_card (card_id, pokedex_id) VALUES (%s, %s)",
                        (card_id, pokedex_id)
                    )

            except mysql.connector.Error as e:
                print(f"Error processing card {card_id}: {e}")
                connection.rollback()
        connection.commit()
        print(f"Processed page {page} of cards")
        page += 1
        cursor.close()


def populate_price_tracker(connection):
    page = 1
    while True:
        url = f'https://api.pokemontcg.io/v2/cards?page={page}&pageSize=250'
        response = requests.get(url)
        if response.status_code != 200:
            print(f"Failed to fetch cards page {page} for price tracking")
            break
        data = response.json()
        cards = data.get('data', [])
        if not cards:
            break
        cursor = connection.cursor()
        for card_data in cards:
            card_id = card_data.get('id')
            if not card_id:
                continue
            tcgplayer = card_data.get('tcgplayer')
            if not tcgplayer:
                continue
            prices = tcgplayer.get('prices')
            if not prices:
                continue
            price_url = tcgplayer.get('url', '')  # URL for price details
            updated_at = datetime.today().date()
            for price_type, price_info in prices.items():
                low_price = price_info.get('low')
                mid_price = price_info.get('mid')
                high_price = price_info.get('high')
                market_price = price_info.get('market')
                try:
                    cursor.execute(
                        """INSERT INTO price_tracker (url, updated_at, card_type, low_price, mid_price, high_price, market_price, card_id)
                           VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
                        (price_url, updated_at, price_type, low_price,
                         mid_price, high_price, market_price, card_id)
                    )
                except mysql.connector.Error as e:
                    print(
                        f"Error inserting price data for card {card_id} ({price_type}): {e}")
                    connection.rollback()
        connection.commit()
        print(f"Processed price data for cards page {page}")
        page += 1
        cursor.close()


def main():
    connection = create_connection()
    if not connection:
        return
    try:
        populate_supertypes(connection)
        populate_types(connection)
        populate_rarities(connection)
        populate_sets(connection)
        populate_cards(connection)
        populate_price_tracker(connection)
    except Exception as e:
        print(f"An error occurred: {e}")
    finally:
        connection.close()
        print("Database connection closed")


if __name__ == '__main__':
    main()
