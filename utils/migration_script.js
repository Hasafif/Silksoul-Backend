// migration-script.js

const mongoose = require('mongoose');

var { productSchema,orderSchema } = require("../models/product");


const Product = mongoose.model("Product", productSchema);
const Order = mongoose.model("Order", orderSchema);
// Give your migration a unique name
const MIGRATION_NAME = '2025-08-27-add-product-color-variants';
  // Define a simple model for our migrations collection
const Migration = mongoose.model('Migration', new mongoose.Schema({ name: String, executedAt: Date }));
const migrate = async () => {


  // 1. CHECK IF MIGRATION HAS ALREADY RUN
  const existingMigration = await Migration.findOne({ name: MIGRATION_NAME });

  if (existingMigration) {
    console.log(`Migration '${MIGRATION_NAME}' has already been executed. Skipping.`);
    return;
  }

  console.log(`Running migration: '${MIGRATION_NAME}'...`);

  // 2. FIND PRODUCTS TO MIGRATE
  const oldProducts = await Product.find({ colors: { $exists: false } });

  if (oldProducts.length === 0) {
    console.log('No products found needing migration.');
  } else {
    console.log(`Found ${oldProducts.length} products to migrate...`);
    for (const product of oldProducts) {
      const newColorsArray = [{
        color: 'Default',
        colorDeg: product.color || '#000000',
        images: product.images || [],
        images_ids: product.images_ids || [],
      }];
      
      await Product.updateOne(
        { _id: product._id },
        {
          $set: { colors: newColorsArray },
          $unset: { color: '', images: '', images_ids: '' },
        }
      );
    }
    console.log(`Successfully migrated ${oldProducts.length} products.`);
  }

  // 3. RECORD THE MIGRATION AS COMPLETED
  await new Migration({ name: MIGRATION_NAME, executedAt: new Date() }).save();
  console.log(`Migration '${MIGRATION_NAME}' successfully recorded.`);
  
  
};
// --- Main Migration Function ---
const migrateOrders = async () => {


  // Give your migration a unique name
  const MIGRATION_NAME = '2025-08-28-migrate-orders-selected-color';

  try {
    //const Migration = mongoose.model('Migration', new mongoose.Schema({ name: String, executedAt: Date }));

    // 1. CHECK IF MIGRATION HAS ALREADY RUN to prevent re-running
    const existingMigration = await Migration.findOne({ name: MIGRATION_NAME });
    if (existingMigration) {
      console.log(`Migration '${MIGRATION_NAME}' has already been executed. Skipping.`);
      return;
    }

    console.log(`Running migration: '${MIGRATION_NAME}'...`);

    // 2. FIND ORDERS TO MIGRATE
    // Find all orders that have at least one item where `selectedColor` is a string.
    const oldOrders = await Order.find({ 'items.selectedColor': { $type: 'string' } });

    if (oldOrders.length === 0) {
      console.log('No orders found needing migration.');
    } else {
      console.log(`Found ${oldOrders.length} orders to migrate...`);
      let migratedCount = 0;

      // 3. LOOP THROUGH EACH ORDER AND TRANSFORM ITS ITEMS
      for (const order of oldOrders) {
        let needsUpdate = false;
        order.items.forEach(item => {
          // Check if this specific item needs to be converted
          if (item.selectedColor && typeof item.selectedColor === 'string') {
            const colorHexString = item.selectedColor;
            
            // Transform the string into the new object structure
            item.selectedColor = {
              color: 'Default', // Assign a default name as we can't know the original
              colorDeg: colorHexString,
              images: [], // Images weren't stored in old orders, so we default to an empty array
              images_ids: []
            };
            needsUpdate = true;
          }
        });

        // 4. SAVE THE UPDATED ORDER
        if (needsUpdate) {
          await order.save();
          migratedCount++;
        }
      }
      console.log(`Successfully migrated ${migratedCount} orders.`);
    }

    // 5. RECORD THE MIGRATION AS COMPLETED
    await new Migration({ name: MIGRATION_NAME, executedAt: new Date() }).save();
    console.log(`Migration '${MIGRATION_NAME}' successfully recorded.`);

  } catch (error) {
    console.error('An error occurred during migration:', error);
  } 
};
module.exports = {
 migrate,
 migrateOrders
};