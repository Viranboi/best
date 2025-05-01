const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const path = require('path');
const app = express();
const port = 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Set EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files (if needed)
app.use(express.static(path.join(__dirname, 'public')));

// MySQL connection
const db = mysql.createConnection({
    host: 'mysql',
    user: 'root',
    password: '0852369147@Viran',
    database: 'moviesdb'
});

db.connect((err) => {
    if (err) throw err;
    console.log('✅ MySQL Connected...');
});

// Home page - List all movie categories with their respective movies (including search functionality)
app.get('/', (req, res) => {
    const searchQuery = req.query.search || '';

    // Search Results promise
    const searchResultsPromise = new Promise((resolve, reject) => {
        if (searchQuery) {
            const sql = 'SELECT * FROM movies WHERE name LIKE ?';
            db.query(sql, [`%${searchQuery}%`], (err, results) => {
                if (err) return reject(err);
                resolve(results); // Resolving search results
            });
        } else {
            resolve([]); // No search query, resolve with empty array
        }
    });

    // Fetch the latest movie
    const latestMovieSql = 'SELECT * FROM movies ORDER BY id DESC LIMIT 1';
    db.query(latestMovieSql, (err, latestMovieResult) => {
        if (err) throw err;
        const latestMovie = latestMovieResult[0];

        // Fetch categories
        const sql = 'SELECT DISTINCT category FROM movies';
        db.query(sql, (err, categories) => {
            if (err) throw err;

            // Fetch movies by category
            const categoryMoviesPromises = categories.map((category) => {
                return new Promise((resolve, reject) => {
                    const movieSql = 'SELECT * FROM movies WHERE category = ?';
                    db.query(movieSql, [category.category], (err, movies) => {
                        if (err) return reject(err);
                        resolve({ category: category.category, movies: movies });
                    });
                });
            });

            // Wait for all category and search results
            Promise.all(categoryMoviesPromises)
                .then((categoryMovies) => {
                    searchResultsPromise
                        .then((searchResults) => {
                            // Render the view with the necessary data
                            res.render('index', {
                                categoryData: categoryMovies,
                                searchQuery,
                                searchResults,
                                latestMovie
                            });
                        })
                        .catch(() => {
                            res.status(500).send('Error fetching search results');
                        });
                })
                .catch(() => {
                    res.status(500).send('Error fetching movie data');
                });
        });
    });
});

// Movies by category - A new route to handle category-based pages
app.get('/category/:name', (req, res) => {
    const categoryName = req.params.name;

    const movieSql = 'SELECT * FROM movies WHERE category = ?';
    const latestMovieSql = 'SELECT * FROM movies ORDER BY id DESC LIMIT 1';

    db.query(movieSql, [categoryName], (err, movies) => {
        if (err) throw err;

        db.query(latestMovieSql, (err, latestMovieResult) => {
            if (err) throw err;
            const latestMovie = latestMovieResult[0];

            res.render('category', {
                categoryName,
                movies,
                latestMovie
            });
        });
    });
});

// Movie details page
app.get('/movie/:id', (req, res) => {
    const movieId = req.params.id;

    const movieSql = 'SELECT * FROM movies WHERE id = ?';
    const commentSql = 'SELECT * FROM comments WHERE movie_id = ? ORDER BY id DESC';

    db.query(movieSql, [movieId], (err, movieResult) => {
        if (err) throw err;
        if (movieResult.length === 0) {
            return res.status(404).send('Movie not found');
        }
        const movie = movieResult[0];

        db.query(commentSql, [movieId], (err, commentsResult) => {
            if (err) throw err;
            res.render('movie', { movie, comments: commentsResult });
        });
    });
});

// Post comment
app.post('/movie/:id/comment', (req, res) => {
    const movieId = req.params.id;
    const { username, comment } = req.body;
    const sql = 'INSERT INTO comments (movie_id, username, comment) VALUES (?, ?, ?)';

    db.query(sql, [movieId, username, comment], (err) => {
        if (err) throw err;
        res.redirect(`/movie/${movieId}`);
    });
});

// Admin Panel - List all movies
app.get('/admin', (req, res) => {
    const sql = 'SELECT * FROM movies ORDER BY id DESC';
    db.query(sql, (err, results) => {
        if (err) throw err;
        res.render('admin', { movies: results });
    });
});

// Handle adding a new movie
app.post('/admin/add', (req, res) => {
    const { name, thumbnail, description, category, link } = req.body;
    const sql = 'INSERT INTO movies (name, thumbnail, description, category, link) VALUES (?, ?, ?, ?, ?)';

    db.query(sql, [name, thumbnail, description, category, link], (err) => {
        if (err) throw err;
        res.redirect('/admin');
    });
});

// Render edit page
app.get('/edit/:id', (req, res) => {
    const movieId = req.params.id;
    const sql = 'SELECT * FROM movies WHERE id = ?';
    db.query(sql, [movieId], (err, results) => {
        if (err) throw err;
        if (results.length === 0) {
            return res.status(404).send('Movie not found');
        }
        res.render('edit', { movie: results[0] });
    });
});

// Handle editing a movie
app.post('/edit/:id', (req, res) => {
    const movieId = req.params.id;
    const { name, thumbnail, description, category, link } = req.body;
    const sql = 'UPDATE movies SET name = ?, thumbnail = ?, description = ?, category = ?, link = ? WHERE id = ?';

    db.query(sql, [name, thumbnail, description, category, link, movieId], (err) => {
        if (err) throw err;
        res.redirect('/admin');
    });
});

// Delete a movie
app.get('/delete/:id', (req, res) => {
    const movieId = req.params.id;
    const sql = 'DELETE FROM movies WHERE id = ?';

    db.query(sql, [movieId], (err) => {
        if (err) throw err;
        res.redirect('/admin');
    });
});

// Server
app.listen(port, () => {
    console.log(`🚀 Server running at http://localhost:${port}`);
});
