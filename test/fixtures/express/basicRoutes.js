const express = require('express');
const app = express();

// Basic CRUD routes
app.get('/users', (req, res) => {
  res.json([]);
});

app.post('/users', (req, res) => {
  res.json({ id: 1 });
});

app.get('/users/:id', (req, res) => {
  res.json({ id: req.params.id });
});

app.put('/users/:id', (req, res) => {
  res.json({ id: req.params.id });
});

app.delete('/users/:id', (req, res) => {
  res.sendStatus(204);
});

// Nested parameter route
app.get('/users/:userId/posts/:postId', (req, res) => {
  res.json({});
});

module.exports = app;
