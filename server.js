const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Set EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// MySQL connection setup using environment variables
const db = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '0852369147@Viran',
    database: process.env.DB_NAME || 'moviesdb',
    port: process.env.DB_PORT || 3306
});

// Connect to MySQL
db.connect((err) => {
    if (err) {
        console.error('❌ MySQL Connection Failed:', err.message);
        process.exit(1);
    } else {
        console.log('✅ MySQL Connected...');
    }
});

// Home page - show categories and search
app.get('/', (req, res) => {
    const searchQuery = req.query.search || '';

    const searchResultsPromise = new Promise((resolve, reject) => {
        if (searchQuery) {
            const sql = 'SELECT * FROM movies WHERE name LIKE ?';
            db.query(sql, [`%${searchQuery}%`], (err, results) => {
                if (err) return reject(err);
                resolve(results);
            });
        } else {
            resolve([]);
        }
    });

    const latestMovieSql = 'SELECT * FROM movies ORDER BY id DESC LIMIT 1';
    db.query(latestMovieSql, (err, latestMovieResult) => {
        if (err) return res.status(500).send('Error fetching latest movie');

        const latestMovie = latestMovieResult[0];

        db.query('SELECT DISTINCT category FROM movies', (err, categories) => {
            if (err) return res.status(500).send('Error fetching categories');

            const categoryMoviesPromises = categories.map((category) => {
                return new Promise((resolve, reject) => {
                    db.query('SELECT * FROM movies WHERE category = ?', [category.category], (err, movies) => {
                        if (err) return reject(err);
                        resolve({ category: category.category, movies });
                    });
                });
            });

            Promise.all(categoryMoviesPromises)
                .then((categoryMovies) => {
                    searchResultsPromise
                        .then((searchResults) => {
                            res.render('index', {
                                categoryData: categoryMovies,
                                searchQuery,
                                searchResults,
                                latestMovie,
                                apiUrl: process.env.BACKEND_API_URL // Pass the API URL to the frontend
                            });
                        })
                        .catch((err) => {
                            console.error(err);
                            res.status(500).send('Error fetching search results');
                        });
                })
                .catch((err) => {
                    console.error(err);
                    res.status(500).send('Error fetching movie data');
                });
        });
    });
});

// Movies by category
app.get('/category/:name', (req, res) => {
    const categoryName = req.params.name;

    db.query('SELECT * FROM movies WHERE category = ?', [categoryName], (err, movies) => {
        if (err) return res.status(500).send('Error fetching movies by category');

        db.query('SELECT * FROM movies ORDER BY id DESC LIMIT 1', (err, latestMovieResult) => {
            if (err) return res.status(500).send('Error fetching latest movie');
            const latestMovie = latestMovieResult[0];
            res.render('category', { categoryName, movies, latestMovie });
        });
    });
});

// Movie details
app.get('/movie/:id', (req, res) => {
    const movieId = req.params.id;

    db.query('SELECT * FROM movies WHERE id = ?', [movieId], (err, movieResult) => {
        if (err) return res.status(500).send('Error fetching movie details');
        if (movieResult.length === 0) return res.status(404).send('Movie not found');

        const movie = movieResult[0];

        db.query('SELECT * FROM comments WHERE movie_id = ? ORDER BY id DESC', [movieId], (err, commentsResult) => {
            if (err) return res.status(500).send('Error fetching comments');
            res.render('movie', { movie, comments: commentsResult });
        });
    });
});

// Post a comment
app.post('/movie/:id/comment', (req, res) => {
    const movieId = req.params.id;
    const { username, comment } = req.body;

    if (!username || !comment) {
        return res.status(400).send('Username and comment are required');
    }

    const sql = 'INSERT INTO comments (movie_id, username, comment) VALUES (?, ?, ?)';

    db.query(sql, [movieId, username, comment], (err) => {
        if (err) return res.status(500).send('Error saving comment');
        res.redirect(`/movie/${movieId}`);
    });
});

// Admin panel
app.get('/admin', (req, res) => {
    db.query('SELECT * FROM movies ORDER BY id DESC', (err, results) => {
        if (err) return res.status(500).send('Error loading admin panel');
        res.render('admin', { movies: results });
    });
});

// Add a new movie
app.post('/admin/add', (req, res) => {
    const { name, thumbnail, description, category, link } = req.body;

    if (!name || !thumbnail || !description || !category || !link) {
        return res.status(400).send('All fields are required');
    }

    const sql = 'INSERT INTO movies (name, thumbnail, description, category, link) VALUES (?, ?, ?, ?, ?)';

    db.query(sql, [name, thumbnail, description, category, link], (err) => {
        if (err) return res.status(500).send('Error adding movie');
        res.redirect('/admin');
    });
});

// Edit movie form
app.get('/edit/:id', (req, res) => {
    const movieId = req.params.id;

    db.query('SELECT * FROM movies WHERE id = ?', [movieId], (err, results) => {
        if (err) return res.status(500).send('Error fetching movie for edit');
        if (results.length === 0) return res.status(404).send('Movie not found');
        res.render('edit', { movie: results[0] });
    });
});

// Update movie
app.post('/edit/:id', (req, res) => {
    const movieId = req.params.id;
    const { name, thumbnail, description, category, link } = req.body;

    const sql = 'UPDATE movies SET name = ?, thumbnail = ?, description = ?, category = ?, link = ? WHERE id = ?';

    db.query(sql, [name, thumbnail, description, category, link, movieId], (err) => {
        if (err) return res.status(500).send('Error updating movie');
        res.redirect('/admin');
    });
});

// Delete movie
app.get('/delete/:id', (req, res) => {
    const movieId = req.params.id;

    db.query('DELETE FROM movies WHERE id = ?', [movieId], (err) => {
        if (err) return res.status(500).send('Error deleting movie');
        res.redirect('/admin');
    });
});

// Start the server
app.listen(port, () => {
    console.log(`🚀 Server running at http://localhost:${port}`);
});
