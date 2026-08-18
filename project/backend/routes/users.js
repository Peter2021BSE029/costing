// User account routes - lets the 'stores' admin account manage named
// accounts for costing agents (so jobs/quotations can be stamped with
// who costed them).
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('./auth');
const User = require('../models/User');

// Only the 'stores' account (the same role already gated to admin.html)
// may create, edit, or remove accounts.
function requireStoresRole(req, res, next) {
  if (req.user.role !== 'stores') {
    return res.status(403).json({ error: 'Only stores accounts can manage users' });
  }
  next();
}

// List all accounts (no password hashes returned)
router.get('/', authenticateToken, requireStoresRole, async (req, res) => {
  try {
    const users = await User.findAll();
    res.json(users);
  } catch (err) {
    console.error('[USERS] List error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Create an account
router.post('/', authenticateToken, requireStoresRole, async (req, res) => {
  const { username, password, role, full_name } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const user = await User.create(username, password, role || 'costing', full_name || null);
    res.json(user);
  } catch (err) {
    console.error('[USERS] Create error:', err.message);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'That username is already taken' });
    }
    res.status(500).json({ error: err.message });
  }
});

// Update an account's full name/role
router.put('/:id', authenticateToken, requireStoresRole, async (req, res) => {
  const { full_name, role } = req.body;

  try {
    const user = await User.update(req.params.id, { fullName: full_name, role });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    console.error('[USERS] Update error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Reset an account's password
router.put('/:id/password', authenticateToken, requireStoresRole, async (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ error: 'A new password is required' });
  }

  try {
    const user = await User.updatePassword(req.params.id, password);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ message: 'Password updated', id: user.id });
  } catch (err) {
    console.error('[USERS] Password update error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Delete an account
router.delete('/:id', authenticateToken, requireStoresRole, async (req, res) => {
  try {
    const user = await User.remove(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ message: 'User deleted successfully', id: user.id });
  } catch (err) {
    console.error('[USERS] Delete error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
