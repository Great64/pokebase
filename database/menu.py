import mysql.connector
from mysql.connector import Error
from prettytable import PrettyTable
import seed4


def create_connection():
    try:
        return mysql.connector.connect(
            host='localhost',
            user='root',
            password='MyNewPass1!',
            database='pokebase'
        )
    except Error as e:
        print(f"Error: {e}")
        return None


def drop_tables(connection):
    tables = [
        'card_subtype', 'subtype', 'card_type', 'pokedex', 'pokedex_card', 'price_tracker',
        'card', 'card_set', 'legality', 'type', 'rarity', 'supertype'
    ]
    try:
        print("Starting to drop tables...")  # Debugging output
        cursor = connection.cursor()
        for table in tables:
            print(f"Attempting to drop table: {table}")  # Debugging output
            cursor.execute(f"DROP TABLE IF EXISTS {table}")
        connection.commit()
        print("All tables dropped successfully.")  # Debugging output
    except Error as e:
        print(f"Error while dropping tables: {e}")  # Debugging output
    finally:
        cursor.close()
        print("Cursor closed after dropping tables.")  # Debugging output


def create_tables(connection):
    schema = """
    CREATE DATABASE IF NOT EXISTS PokeBase;
    USE PokeBase;
    CREATE TABLE legality (
      legality_id BIGINT AUTO_INCREMENT PRIMARY KEY,
      unlimited BOOLEAN,
      standard BOOLEAN,
      expanded BOOLEAN
    );
    CREATE TABLE supertype (
      supertype_id INT PRIMARY KEY,
      supertype VARCHAR(50) NOT NULL
    );
    CREATE TABLE rarity (
      rarity_id INT PRIMARY KEY,
      rarity VARCHAR(50) NOT NULL
    );
    CREATE TABLE type (
      type_id INT PRIMARY KEY,
      type VARCHAR(50) NOT NULL
    );
    CREATE TABLE card_set (
      set_id VARCHAR(100) PRIMARY KEY,
      set_name VARCHAR(150) NOT NULL,
      series VARCHAR(150) NOT NULL,
      printed_total INT NOT NULL,
      total INT NOT NULL,
      ptcgo_code VARCHAR(50),
      release_date DATE NOT NULL,
      updated_at DATE NOT NULL,
      symbol_img VARCHAR(200) NOT NULL,
      logo_img VARCHAR(200) NOT NULL,
      legality_id BIGINT NOT NULL,
      CONSTRAINT fk_legality
        FOREIGN KEY(legality_id)
          REFERENCES legality(legality_id)
    );
    CREATE TABLE card (
      card_id VARCHAR(50) PRIMARY KEY,
      card_name VARCHAR(100) NOT NULL,
      number VARCHAR(50) NOT NULL,
      artist VARCHAR(100),
      small_img VARCHAR(200) NOT NULL,
      large_img VARCHAR(200) NOT NULL,
      supertype_id INT NOT NULL,
      set_id VARCHAR(100) NOT NULL,
      rarity_id INT,
      hp INT,
      flavor_text VARCHAR(500),
      CONSTRAINT fk_supertype
        FOREIGN KEY(supertype_id)
          REFERENCES supertype(supertype_id),
      CONSTRAINT fk_set
        FOREIGN KEY(set_id)
          REFERENCES card_set(set_id),  
      CONSTRAINT fk_rarity
        FOREIGN KEY(rarity_id)
          REFERENCES rarity(rarity_id)  
    );
    CREATE TABLE pokedex (
      pokedex_id INT PRIMARY KEY,
      pokedex_region VARCHAR(50) NOT NULL
    );
    CREATE TABLE pokedex_card (
      card_id VARCHAR(50) NOT NULL REFERENCES card(card_id),
      pokedex_id INT NOT NULL REFERENCES pokedex(pokedex_id),
      PRIMARY KEY (card_id, pokedex_id)
    );
    CREATE TABLE price_tracker (
      price_tracker_id BIGINT AUTO_INCREMENT PRIMARY KEY,
      url VARCHAR(200) NOT NULL,
      updated_at DATE NOT NULL,
      card_type VARCHAR(200) NOT NULL,
      low_price DECIMAL(12, 2), 
      mid_price DECIMAL(12, 2), 
      high_price DECIMAL(12, 2), 
      market_price DECIMAL(12, 2), 
      card_id VARCHAR(50) NOT NULL,
      CONSTRAINT fk_card
        FOREIGN KEY(card_id)
          REFERENCES card(card_id)
    );
    CREATE TABLE card_type (
      card_type_id BIGINT AUTO_INCREMENT PRIMARY KEY,
      type_id INT,
      card_id VARCHAR(50) NOT NULL,
      CONSTRAINT fk_type_id 
        FOREIGN KEY(type_id)
          REFERENCES `type`(type_id),
      CONSTRAINT fk_card_id
        FOREIGN KEY(card_id)
          REFERENCES card(card_id)
    );
    CREATE TABLE subtype (
      subtype_id INT AUTO_INCREMENT PRIMARY KEY,
      subtype_name VARCHAR(100) UNIQUE NOT NULL
    );
    CREATE TABLE card_subtype (
      card_id VARCHAR(50) NOT NULL,
      subtype_id INT NOT NULL,
      PRIMARY KEY (card_id, subtype_id),
      FOREIGN KEY (card_id) REFERENCES card(card_id),
      FOREIGN KEY (subtype_id) REFERENCES subtype(subtype_id)
    );"""
    # Split schema into individual CREATE statements and execute
    cursor = connection.cursor()
    for statement in schema.split(';'):
        if statement.strip():
            cursor.execute(statement)
    connection.commit()
    cursor.close()
    print("Tables created.")


def run_query(connection, query_num):
    queries = {
        # A4 queries
        1: """SELECT 
                c.card_name AS 'Card Name',
                pt.mid_price AS 'Mid Price',
                cs.set_name AS 'Set Name'
            FROM price_tracker pt
            JOIN card c ON pt.card_id = c.card_id
            JOIN card_set cs ON c.set_id = cs.set_id
            WHERE pt.mid_price > (
                SELECT AVG(mid_price) 
                FROM price_tracker
            )
            ORDER BY pt.mid_price DESC;""",
        2: """SELECT 
                set_name AS "Set Name",
                release_date AS "Release Date"
            FROM card_set
            WHERE release_date > '2020-01-01'
            AND legality_id IN (
                SELECT legality_id 
                FROM legality 
                WHERE standard = TRUE
            )
            ORDER BY release_date DESC;""",
        3: """SELECT 
                cs.set_name AS "Set Name",
                c.card_name AS "Card Name",
                pt.mid_price AS "Max Mid Price"
            FROM price_tracker pt
            JOIN card c ON pt.card_id = c.card_id
            JOIN card_set cs ON c.set_id = cs.set_id
            WHERE pt.mid_price = (
                SELECT MAX(pt_inner.mid_price)
                FROM price_tracker pt_inner
                JOIN card c_inner ON pt_inner.card_id = c_inner.card_id
                WHERE c_inner.set_id = cs.set_id
            );""",
        4: """SELECT 
                c.card_name AS "Card Name",
                r.rarity AS "Rarity",
                pt.mid_price AS "Mid Price",
                RANK() OVER (
                    PARTITION BY r.rarity 
                    ORDER BY pt.mid_price DESC
                ) AS "Price Rank"
            FROM price_tracker pt
            JOIN card c ON pt.card_id = c.card_id
            JOIN rarity r ON c.rarity_id = r.rarity_id;""",
        5: """SELECT 
                c.card_name AS "Card Name",
                cs.set_name AS "Set Name",
                cs.release_date AS "Release Date",
                ROW_NUMBER() OVER (
                    PARTITION BY cs.set_id 
                    ORDER BY cs.release_date
                ) AS "Release Order"
            FROM card c
            JOIN card_set cs ON c.set_id = cs.set_id;""",
        6: """SELECT 
                card_name AS "Card Name",
                mid_price AS "Mid Price",
                NTILE(4) OVER (ORDER BY mid_price DESC) AS "Price Tier"
            FROM price_tracker pt
            JOIN card c ON pt.card_id = c.card_id;""",
        7: """SELECT 
                c.card_name AS "Card Name",
                cs.set_name AS "Set Name",
                l.expanded AS "Expanded Legal"
            FROM card c
            JOIN card_set cs ON c.set_id = cs.set_id
            JOIN legality l ON cs.legality_id = l.legality_id
            WHERE l.expanded = TRUE
            ORDER BY cs.set_name;""",
        8: """SELECT 
                t.type AS "Pokémon Type",
                AVG(c.hp) AS "Average HP"
            FROM card c
            JOIN card_type ct ON c.card_id = ct.card_id
            JOIN type t ON ct.type_id = t.type_id
            GROUP BY t.type
            HAVING AVG(c.hp) > 50
            ORDER BY "Average HP" DESC;""",
        9: """SELECT DISTINCT
                c.artist AS "Artist"
            FROM card c
            JOIN card_set cs ON c.set_id = cs.set_id
            WHERE cs.set_name LIKE '%Base%' 
              AND c.artist IS NOT NULL;""",
        10: """SELECT 
                r.rarity AS "Rarity",
                COUNT(c.card_id) AS "Total Cards"
            FROM card c
            JOIN rarity r ON c.rarity_id = r.rarity_id
            JOIN card_set cs ON c.set_id = cs.set_id
            WHERE cs.set_name = 'Evolving Skies'
            GROUP BY r.rarity
            ORDER BY "Total Cards" DESC;""",
        # A5 queries
        11: """SELECT r.rarity, 
                   AVG(pt.market_price) AS avg_market_price,
                   COUNT(*) AS card_count,
                   STDDEV_SAMP(pt.market_price) AS price_stddev
            FROM card c
            JOIN rarity r ON c.rarity_id = r.rarity_id
            JOIN price_tracker pt ON c.card_id = pt.card_id
            GROUP BY r.rarity;""",
        12: """SELECT c.card_id, c.card_name
            FROM card c
            WHERE EXISTS (
                SELECT 1 FROM card_subtype cs WHERE cs.card_id = c.card_id
            );""",
        13: """SELECT c.card_name FROM card c
            JOIN card_set cs ON c.set_id = cs.set_id
            WHERE cs.set_name = 'Base Set'
            UNION
            SELECT c.card_name FROM card c
            JOIN card_set cs ON c.set_id = cs.set_id
            WHERE cs.set_name = 'Jungle';""",
        14: """SELECT cs.set_name, VAR_SAMP(pt.market_price) AS price_variance
            FROM card_set cs
            JOIN card c ON cs.set_id = c.set_id
            JOIN price_tracker pt ON c.card_id = pt.card_id
            GROUP BY cs.set_name;""",
        15: """SELECT cs.set_name, AVG(pt.high_price) AS avg_high_price
            FROM card_set cs
            JOIN card c ON cs.set_id = c.set_id
            JOIN price_tracker pt ON c.card_id = pt.card_id
            GROUP BY cs.set_name
            HAVING avg_high_price > 50;""",
        16: """SELECT cs.set_name FROM card_set cs
            JOIN legality l ON cs.legality_id = l.legality_id
            WHERE l.unlimited = TRUE
            AND cs.legality_id NOT IN (
                SELECT legality_id FROM legality WHERE standard = TRUE
            );""",
        17: """SELECT c.card_id, c.card_name FROM card c
            WHERE EXISTS (
                SELECT 1 FROM card_type ct
                JOIN type t ON ct.type_id = t.type_id
                WHERE ct.card_id = c.card_id AND t.type = 'Fire'
            )
            AND EXISTS (
                SELECT 1 FROM card_type ct
                JOIN type t ON ct.type_id = t.type_id
                WHERE ct.card_id = c.card_id AND t.type = 'Water'
            );""",
        18: """SELECT 
                c.card_id, 
                c.card_name, 
                (SELECT COUNT(*) FROM card_subtype cs WHERE cs.card_id = c.card_id) AS subtype_count
            FROM card c;""",
        19: """SELECT cs.set_name, avg_prices.avg_market_price
            FROM card_set cs
            JOIN (
                SELECT c.set_id, AVG(pt.market_price) AS avg_market_price
                FROM card c
                JOIN price_tracker pt ON c.card_id = pt.card_id
                GROUP BY c.set_id
            ) AS avg_prices ON cs.set_id = avg_prices.set_id;
            """,
        20: """SELECT c.card_id, c.card_name, pt.market_price, cs.set_name
            FROM card c
            JOIN price_tracker pt ON c.card_id = pt.card_id
            JOIN card_set cs ON c.set_id = cs.set_id
            WHERE pt.market_price > (
                SELECT AVG(pt2.market_price)
                FROM price_tracker pt2
                JOIN card c2 ON pt2.card_id = c2.card_id
                WHERE c2.set_id = c.set_id
            );
            """,

    }
    cursor = connection.cursor()
    cursor.execute(queries.get(query_num, "SELECT 1"))
    result = cursor.fetchall()

    # Format output
    table = PrettyTable([i[0] for i in cursor.description])
    for row in result:
        table.add_row(row)
    print(table)
    cursor.close()


def menu():
    conn = create_connection()
    while True:
        print("\n===== PokeBase Manager =====")
        print("1. Drop Tables")
        print("2. Create Tables")
        print("3. Populate Tables")
        print("4. Run Query")
        print("5. Exit")
        choice = input("Select option: ")

        if choice == '1':
            drop_tables(conn)
        elif choice == '2':
            create_tables(conn)
        elif choice == '3':
            seed4.main()  # Run population script
        elif choice == '4':
            print("\nQueries are:")
            queries = ["Cards with Mid-Price Above Average",
                       "Sets Released After 2020 with Standard Legality",
                       "Highest Priced Card in Each Set",
                       "Rank Cards by Price in Each Rarity",
                       "Number Cards by Release Date in Set",
                       "Price Tier (NTILE)", "Legal Expanded Cards with Details",
                       "Average HP per Type", "Unique Artists in Base Set",
                       "Total Cards per Rarity in a Set",
                       "Average Market Price per Rarity with Statistics",
                       "Cards with Subtypes (EXISTS)",
                       "Union of Card Names from Two Sets",
                       "Variance in Market Prices per Set",
                       "Sets with Average High Price Over $50",
                       "Sets Legal in Unlimited but Not Standard",
                       "Cards with Both Fire and Fighting Types",
                       "Card Subtype Count",
                       "Set Average Prices",
                       "Cards Priced Above Set Average"]

            e = 1
            for i in queries:
                print(f"{e:d} {i}")
                e = e + 1
            qnum = int(input("\nEnter query number (1-20): "))
            run_query(conn, qnum)
        elif choice == '5':
            conn.close()
            print("Exiting.")
            break


if __name__ == '__main__':
    import sys
    try:
        conn = create_connection()
        if conn is None:
            print("Failed to connect to the database. Please check your connection settings.")
            sys.exit(1)

        if len(sys.argv) > 1:
            command = sys.argv[1].lower()
            if command == 'drop':
                print("Executing drop-tables command...")  # Debugging output
                drop_tables(conn)
            elif command == 'create':
                print("Executing create-tables command...")  # Debugging output
                create_tables(conn)
            elif command == 'populate':
                print("Executing populate-tables command...")  # Debugging output
                seed4.main()
            else:
                print(f"Unknown command: {command}")
                sys.exit(1)
        else:
            print("No command provided. Exiting.")
            sys.exit(1)
    except PermissionError as e:
        print(f"Permission error: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        sys.exit(1)
    finally:
        if 'conn' in locals() and conn is not None:
            conn.close()
