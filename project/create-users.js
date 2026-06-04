require('dotenv').config({ path: './.env' });
const User = require('./backend/models/User');

async function createDefaultUsers() {
  try {
    // Create costing user
    const costingUser = await User.create('costing', 'costing123', 'costing');
    console.log('Created costing user:', costingUser);

    // Create stores user
    const storesUser = await User.create('stores', 'stores123', 'stores');
    console.log('Created stores user:', storesUser);

    console.log('Default users created successfully');
  } catch (error) {
    console.error('Error creating users:', error);
  } finally {
    process.exit();
  }
}

createDefaultUsers();