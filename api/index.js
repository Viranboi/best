const express = require('express');
const path = require('path');
const app = express();

// Set up EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views')); // Correct the path to views

app.get('/', (req, res) => {
  res.render('index');  // Renders index.ejs in the views folder
});

// Export the Express app as a Vercel serverless function
module.exports = (req, res) => {
  app(req, res);  // Call Express app
};
