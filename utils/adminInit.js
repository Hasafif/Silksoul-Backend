const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Import your schemas
const { roleSchema, userSchema } = require('../models/user');

// Create models
const Role = mongoose.model('Role', roleSchema);
const User = mongoose.model('User', userSchema);

/**
 * Initialize admin user on application startup
 */
async function initializeAdminUser() {
  try {
    console.log('Checking for admin user...');
    
    // First, ensure admin role exists
    let adminRole = await Role.findOne({ name: 'admin' });
    
    if (!adminRole) {
      adminRole = new Role({ 
        name: 'admin', 
        users: [] 
      });
      await adminRole.save();
      console.log('✓ Admin role created');
    }

    // Check if any user with admin role exists
    let adminUser = await User.findOne({ role: adminRole._id });
    
    const defaultPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);
    
    if (!adminUser) {
      // Create new admin user
      adminUser = new User({
        name: 'Administrator',
        username: process.env.ADMIN_USERNAME || 'admin',
        email: process.env.ADMIN_EMAIL || 'admin@example.com',
        password: hashedPassword,
        role: adminRole._id
      });
      
      await adminUser.save();
      
      // Add user to role's users array
      adminRole.users.push(adminUser._id);
      await adminRole.save();
      
      console.log('✓ Admin user created successfully');
      console.log(`  Username: ${adminUser.username}`);
      console.log(`  Email: ${adminUser.email}`);
      console.log(`  Password: ${defaultPassword} (Please change this!)`);
      
    } else {
      // Update existing admin user's password
      adminUser.password = hashedPassword;
      await adminUser.save();
      
      console.log('✓ Admin user password updated');
      console.log(`  Username: ${adminUser.username}`);
      console.log(`  Email: ${adminUser.email}`);
    }
    
    return { success: true, adminUser };
    
  } catch (error) {
    console.error('✗ Error initializing admin user:', error);
    return { success: false, error };
  }
}

/**
 * Check if admin user exists
 */
async function checkAdminExists() {
  try {
    const adminRole = await Role.findOne({ name: 'admin' });
    if (!adminRole) return false;
    
    const adminUser = await User.findOne({ role: adminRole._id });
    return !!adminUser;
  } catch (error) {
    console.error('Error checking admin existence:', error);
    return false;
  }
}

module.exports = {
  initializeAdminUser,
  checkAdminExists
};