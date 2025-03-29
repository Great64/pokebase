const express = require('express');
const cors = require('cors'); // Add this line
const app = express();
const port = 3000;
// Change from pg to mysql2
const mysql = require('mysql2/promise');
const { exec } = require('child_process');

// Create a MySQL connection pool
const pool = mysql.createPool({
  host: 'localhost',         // Your MySQL host
  user: 'root',             // Your MySQL username (default is root)
  password: 'MyNewPass1!', // Password you set during MySQL installation
  database: 'pokebase',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

app.use(cors()); // Enable CORS for all routes
app.use(express.json());

// Endpoint to retrieve cards, supports filtering and pagination
app.get('/api/cards', async (req, res) => {
  try {
    const { q, page = 1, pageSize = 20, supertype_id } = req.query; // Add supertype_id to query parameters
    let baseQuery = 'SELECT * FROM card';
    const conditions = [];
    const values = [];
    
    if (q) {
      conditions.push(`card_name LIKE ?`);
      values.push(`%${q}%`);
    }
    
    if (supertype_id) { // Add condition for supertype_id
      conditions.push(`supertype_id = ?`);
      values.push(Number(supertype_id));
    }
    
    if (conditions.length) {
      baseQuery += ' WHERE ' + conditions.join(' AND ');
    }
    
    baseQuery += ` ORDER BY card_name LIMIT ? OFFSET ?`;
    values.push(Number(pageSize), Number((page - 1) * pageSize));
    
    const [rows] = await pool.query(baseQuery, values);
    res.json({ data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch cards' });
  }
});

// Add additional endpoints as required
app.get('/api/cards/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // Join the card table with the card_set, price_tracker, legality, rarity, supertype, type, pokedex_card, and pokedex tables to include additional information
    const query = `
      SELECT 
        card.*, 
        card_set.set_name AS set_name, 
        card_set.series AS set_series, 
        card_set.printed_total AS printedTotal, 
        card_set.release_date AS releaseDate,
        price_tracker.low_price AS lowPrice,
        price_tracker.market_price AS marketPrice,
        price_tracker.high_price AS highPrice,
        legality.unlimited AS unlimited,
        legality.standard AS standard,
        legality.expanded AS expanded,
        rarity.rarity AS rarity,
        supertype.supertype AS supertype,
        type.type AS types,
        pokedex.pokedex_id AS pokedexNumbers
      FROM card
      LEFT JOIN card_set ON card.set_id = card_set.set_id
      LEFT JOIN price_tracker ON card.card_id = price_tracker.card_id
      LEFT JOIN legality ON card_set.legality_id = legality.legality_id
      LEFT JOIN rarity ON card.rarity_id = rarity.rarity_id
      LEFT JOIN supertype ON card.supertype_id = supertype.supertype_id
      LEFT JOIN card_type ON card.card_id = card_type.card_id
      LEFT JOIN type ON card_type.type_id = type.type_id
      LEFT JOIN pokedex_card ON card.card_id = pokedex_card.card_id -- Join with pokedex_card
      LEFT JOIN pokedex ON pokedex_card.pokedex_id = pokedex.pokedex_id -- Join with pokedex
      WHERE card.card_id = ?
    `;
    const [rows] = await pool.query(query, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Card not found' });
    }
    res.json({ data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch card detail' });
  }
});

// Endpoint to retrieve all supertypes
app.get('/api/supertypes', async (req, res) => {
  try {
    const query = 'SELECT * FROM supertype';
    const [rows] = await pool.query(query);
    res.json({ data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch supertypes' });
  }
});

// Endpoint to create tables
app.post('/api/create-tables', async (req, res) => {
  try {
    exec('python c:\\Users\\maxs2\\vsCODE\\Personal\\SQLbullshit\\SQL\\database\\menu.py create', (error, stdout, stderr) => {
      if (error) {
        console.error(`Error creating tables: ${stderr}`);
        return res.status(500).json({ error: 'Failed to create tables.' });
      }
      res.json({ message: stdout.trim() });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create tables.' });
  }
});

// Endpoint to drop tables
app.post('/api/drop-tables', async (req, res) => {
  try {
    console.log("Attempting to drop tables...");

    // Use absolute paths
    const pythonExecutable = 'C:\\Python39\\python.exe'; // Replace with the correct Python path
    const scriptPath = 'c:\\Users\\maxs2\\vsCODE\\Personal\\SQLbullshit\\SQL\\database\\menu.py';

    const command = `"${pythonExecutable}" "${scriptPath}" drop`;

    console.log(`Executing command: ${command}`);

    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing Python script: ${error.message}`);
        console.error(`stderr: ${stderr}`);
        return res.status(500).json({ error: `Failed to execute drop-tables script. Details: ${stderr || error.message}` });
      }
      if (stderr) {
        console.error(`Python script stderr: ${stderr}`);
      }
      console.log(`Python script stdout: ${stdout.trim()}`);
      res.json({ message: stdout.trim() || 'Tables dropped successfully.' });
    });
  } catch (err) {
    console.error(`Unexpected error: ${err.message}`);
    res.status(500).json({ error: 'Failed to drop tables.' });
  }
});

// Endpoint to populate tables
app.post('/api/populate-tables', async (req, res) => {
  try {
    exec('python c:\\Users\\maxs2\\vsCODE\\Personal\\SQLbullshit\\SQL\\database\\menu.py populate', (error, stdout, stderr) => {
      if (error) {
        console.error(`Error populating tables: ${stderr}`);
        return res.status(500).json({ error: 'Failed to populate tables.' });
      }
      res.json({ message: stdout.trim() });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to populate tables.' });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});