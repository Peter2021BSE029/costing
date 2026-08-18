const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
});

const bcrypt = require('bcrypt');

class User {
  static async create(username, password, role = 'user', fullName = null) {
    const hashedPassword = await bcrypt.hash(password, 10);
    const query = 'INSERT INTO users (username, password, role, full_name) VALUES ($1, $2, $3, $4) RETURNING id, username, role, full_name';
    const values = [username, hashedPassword, role, fullName];
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  static async findByUsername(username) {
    const query = 'SELECT * FROM users WHERE username = $1';
    const result = await pool.query(query, [username]);
    return result.rows[0];
  }

  static async findAll() {
    const result = await pool.query('SELECT id, username, role, full_name, created_at FROM users ORDER BY username');
    return result.rows;
  }

  static async update(id, { fullName, role }) {
    const result = await pool.query(
      'UPDATE users SET full_name = COALESCE($1, full_name), role = COALESCE($2, role) WHERE id = $3 RETURNING id, username, role, full_name',
      [fullName, role, id]
    );
    return result.rows[0];
  }

  static async updatePassword(id, newPassword) {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const result = await pool.query(
      'UPDATE users SET password = $1 WHERE id = $2 RETURNING id, username',
      [hashedPassword, id]
    );
    return result.rows[0];
  }

  static async remove(id) {
    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
    return result.rows[0];
  }

  static async verifyPassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }
}

module.exports = User;