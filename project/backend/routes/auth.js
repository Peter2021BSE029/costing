const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const pool = require('../server').pool;

const router = express.Router();

// Records a successful login so the dashboard can show real usage stats
// (how often the system is used, when it was last used). Never blocks or
// fails the login itself if this insert has trouble.
async function recordLoginEvent(userId) {
  try {
    await pool.query('INSERT INTO login_events (user_id) VALUES ($1)', [userId]);
  } catch (error) {
    console.error('Failed to record login event:', error.message);
  }
}

function getJwtSecret() {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is required');
  }
  return process.env.JWT_SECRET;
}

// Login endpoint
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = await User.findByUsername(username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValidPassword = await User.verifyPassword(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    await recordLoginEvent(user.id);

    // Create JWT token
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      getJwtSecret(),
      { expiresIn: '8h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  let jwtSecret;
  try {
    jwtSecret = getJwtSecret();
  } catch (error) {
    console.error('Auth configuration error:', error.message);
    return res.status(500).json({ error: 'Authentication is not configured' });
  }

  jwt.verify(token, jwtSecret, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Protected route example - get current user
router.get('/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

// Issues a renewed token for an already-valid session, so a user who stays
// active in the wizard doesn't get logged out mid-session when the token
// would otherwise expire.
router.post('/refresh', authenticateToken, (req, res) => {
  const token = jwt.sign(
    { id: req.user.id, username: req.user.username, role: req.user.role },
    getJwtSecret(),
    { expiresIn: '8h' }
  );

  res.json({ token });
});

module.exports = { router, authenticateToken };
