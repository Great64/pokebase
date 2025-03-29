# PokeBase

<a id="readme-top"></a>


<!-- ABOUT THE PROJECT -->
## About The Project

Final assignment for CP363 (Database I), where we took a MySQL database and linked it to a website

<!-- GETTING STARTED -->

### Prerequisites

This guide will help you set up and run the PokeBase website locally.

```
Node.js (v14 or higher)
MySQL (v8.0 recommended)
Python (v3.9 or higher)
```

### Installation

1. Get a free API Key from https://dev.pokemontcg.io
2. Clone the repo
   ```sh
   git clone https://github.com/Great64/pokebase.git
   ```
3. Install NPM packages
   ```sh
   npm install
   ```
4. Setup a MySQL Database
   Install and configure MySQL if you haven't already
   Create a database named pokebase:
   ```
   CREATE DATABASE pokebase;
   ```
   Make sure your MySQL connection details match those in
   ```
   const pool = mysql.createPool({
   host: 'localhost',  
   user: 'root',       // Update if using a different username
   password: 'MyNewPass1!', // Update with your password
   database: 'pokebase',
   waitForConnections: true,
   connectionLimit: 10,
   queueLimit: 0
   });
   ```
5. Install Python Dependencies
   ```
   pip install mysql-connector-python requests prettytable python-dateutil
   ```
6. Make sure your menu.py and ssed4.py details match those in
   ```
   def create_connection():
    try:
        return mysql.connector.connect(
            host='localhost',
            user='root',       // Update if using a different username
            password='MyNewPass1!', // Update with your password
            database='pokebase'
        )
    except Error as e:
        print(f"Error: {e}")
        return None
   ```
7. Include your API key in the .env file
   ```
   API_KEY= // Your api key
   ```

8. Locally host your MySQL server in the backend
   ```
   npm init -y
   ```
   ```
   npm install express cors mysql2
   ```
   ```
   node server.js
   ```

9. Host your front end
   Few ways to do this, my preferred method is using the live server vscode plugin

<p align="right">(<a href="#readme-top">back to top</a>)</p>


<!-- LICENSE -->
## License

Distributed under the project_license. See `LICENSE.txt` for more information.

<p align="right">(<a href="#readme-top">back to top</a>)</p>
