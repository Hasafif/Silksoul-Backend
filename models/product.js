var mongoose = require("mongoose");
const { Schema } = mongoose;


// Product Purchase subdocument schema
const productPurchaseSchema = new Schema({
  product: { 
    type: Schema.Types.ObjectId, 
    ref: "Product", 
    required: true 
  },
  quantity: { 
    type: Number, 
    required: true, 
    min: 1 
  },
  priceAtPurchase: { 
    type: Number, 
    required: true 
  },
  subtotal: { 
    type: Number, 
    required: true 
  }
}, { _id: false });

const orderSchema = new mongoose.Schema({
  items: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    quantity: Number,
    price: Number,
    name: String,
    customSizeData:{
 bust: { type: Number},
    waist: { type: Number },
    hips: { type: Number},
    shoulders: { type: Number},
    bustPoint: { type: Number},
    waistPoint: { type: Number},
    nippleToNipple: { type: Number},
    armRound: { type: Number},
    wrist: { type: Number},
    armHole: { type: Number},
    sleeveLength: { type: Number },
    fullLength: { type: Number },
    fullTailLength: { type: Number },
    additionalNotes: String,
  },
    selectedSize: String,
    selectedColor: String
  }],
  totalAmount: Number,
  currency:String,
  customerInfo: {
    email: String,
    firstName: String,
    lastName: String,
    phone: String
  },
  shippingAddress: {
    address: String,
    city: String,
    state: String,
    zipCode: String,
    country: String
  },
  actualShippingAddress: Object, // From Stripe if different
  paymentStatus: { 
    type: String, 
    enum: ['pending', 'paid', 'failed', 'cancelled'],
    default: 'pending' 
  },
  sessionId: String, // Stripe session ID
  paymentIntentId: String, // Stripe payment intent ID
  stripeCustomerId: String, // Stripe customer ID
  createdAt: { type: Date, default: Date.now },
  paidAt: Date,
  cancelledAt: Date
});
// Product Schema with working middleware
const productSchema = new Schema(
  {
    name_english: { type: String, required: true },
    name_arabic: { type: String, required: true },
    images: [{ type: String, required: true }],
    images_ids: [{type:String, required: true}],
    price: { type: Number, required: true },
    description_english: { type: String },
    description_arabic: { type: String },
    sizes:[{type: String}],
    quantities: [{ type: Number, required: true }],
    quantity: { type: Number, required: true },
    color:{type:String,required:true},
    categoryName_english: { type: String, required: true },
    categoryName_arabic: { type: String, required: true },
    category: { type: Schema.Types.ObjectId, ref: "ProductCategory", required: true },
    reviews: [{ type: Schema.Types.ObjectId, ref: "Review" }],
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  }
);
// AUTO-SYNC: Add product to category when created
productSchema.post('save', async function(doc, next) {
  try {
    // Only for new products (not updates)
    console.log('save')
    console.log(doc.category)
    //if (this.isNew) {
      console.log('save')
      await mongoose.model('ProductCategory').findByIdAndUpdate(
        doc.category,
        { $addToSet: { products: doc._id } }
      );
   // }
    next();
  } catch (error) {
    console.error('Error adding product to category:', error);
    next(error);
  }
});

// AUTO-SYNC: Handle category change when product is updated
productSchema.pre('findOneAndUpdate', async function(next) {
  try {
    // Get the original document before update
    this._originalDoc = await this.model.findOne(this.getQuery());
    next();
    console.log('done')
  } catch (error) {
    next(error);
     console.log('error')
  }
});

productSchema.post('findOneAndUpdate', async function(doc, next) {
  try {
    if (doc && this._originalDoc) {
      const oldCategoryId = this._originalDoc.category;
      const newCategoryId = doc.category;
      
      // If category changed, update both categories
      if (oldCategoryId && newCategoryId && oldCategoryId.toString() !== newCategoryId.toString()) {
        // Remove from old category
        await mongoose.model('ProductCategory').findByIdAndUpdate(
          oldCategoryId,
          { $pull: { products: doc._id } }
        );
        
        // Add to new category
        await mongoose.model('ProductCategory').findByIdAndUpdate(
          newCategoryId,
          { $addToSet: { products: doc._id } }
        );
      }
    }
    next();
  } catch (error) {
    console.error('Error updating product category sync:', error);
    next(error);
  }
});

// AUTO-SYNC: Remove product from category when deleted
productSchema.pre('findOneAndDelete', async function(next) {
  try {
    // Store the document before deletion
    this._deletedDoc = await this.model.findOne(this.getQuery());
    next();
  } catch (error) {
    next(error);
  }
});

productSchema.post('findOneAndDelete', async function(doc, next) {
  try {
    const deletedDoc = this._deletedDoc || doc;
    if (deletedDoc && deletedDoc.category) {
      await mongoose.model('ProductCategory').findByIdAndUpdate(
        deletedDoc.category,
        { $pull: { products: deletedDoc._id } }
      );
    }
    next();
  } catch (error) {
    console.error('Error removing product from category:', error);
    next(error);
  }
});

// AUTO-SYNC: Handle deleteMany operations
productSchema.pre('deleteMany', async function(next) {
  try {
    // Get all documents that will be deleted
    this._deletedDocs = await this.model.find(this.getQuery());
    next();
  } catch (error) {
    next(error);
  }
});

productSchema.post('deleteMany', async function(result, next) {
  try {
    if (this._deletedDocs && this._deletedDocs.length > 0) {
      // Group by category for efficient updates
      const categoryUpdates = {};
      
      this._deletedDocs.forEach(doc => {
        if (doc.category) {
          if (!categoryUpdates[doc.category]) {
            categoryUpdates[doc.category] = [];
          }
          categoryUpdates[doc.category].push(doc._id);
        }
      });
      
      // Update each category
      for (const [categoryId, productIds] of Object.entries(categoryUpdates)) {
        await mongoose.model('ProductCategory').findByIdAndUpdate(
          categoryId,
          { $pull: { products: { $in: productIds } } }
        );
      }
    }
    next();
  } catch (error) {
    console.error('Error removing products from categories:', error);
    next(error);
  }
});

const productCategorySchema = new Schema(
  {
    name_english: { type: String, required: true },
    name_arabic: { type: String, required: true },
    image:{ type: String, required: true },
    image_id:{ type: String, required: true },
    products: [{ type: Schema.Types.ObjectId, ref: "Product" }],
  },
  {
    timestamps: {
      createdAt: "created_at",
    },
  }
);

// AUTO-SYNC: Clean up products when category is deleted
productCategorySchema.pre('findByIdAndDelete', async function(next) {
  try {
    console.log('Category deletion middleware triggered');
    const category = await this.model.findById(this.getQuery()._id);
    if (category && category.products.length > 0) {
      console.log(`Cleaning up ${category.products.length} products from category ${category._id}`);
      // Remove category reference from all products
      await mongoose.model('Product').updateMany(
        { category: category._id },
        { $unset: { category: 1 } }
      );
    }
    next();
  } catch (error) {
    console.error('Error cleaning up products when deleting category:', error);
    next(error);
  }
});

// Also handle the regular findOneAndDelete in case it's used elsewhere
productCategorySchema.pre('findOneAndDelete', async function(next) {
  try {
    const category = await this.model.findOne(this.getQuery());
    if (category && category.products.length > 0) {
      // Remove category reference from all products
      await mongoose.model('Product').updateMany(
        { category: category._id },
        { $unset: { category: 1 } }
      );
    }
    next();
  } catch (error) {
    console.error('Error cleaning up products when deleting category:', error);
    next(error);
  }
});






module.exports = {
  orderSchema,
  productSchema,
  productCategorySchema,
};