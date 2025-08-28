var mongoose = require("mongoose");
var { orderSchema, productSchema, productCategorySchema } = require("../../models/product");
var cloudinary = require('cloudinary');
const fs = require("fs");
// Configuration
cloudinary.config({ 
    cloud_name: process.env.CLOUD_NAME, 
    api_key: process.env.CLOUDINARY_API_KEY, 
    api_secret: process.env.CLOUDINARY_API_SECRET // Replace with your actual API secret
});

const Order = mongoose.model("Order", orderSchema);
const ProductCategory = mongoose.model("ProductCategory", productCategorySchema);
const Product = mongoose.model("Product", productSchema);

// Helper function to upload images to Cloudinary
async function uploadImagesToCloudinary(images) {
  const uploadPromises = images.map(async (image, index) => {
    try {
      // If image is a file path or base64 string
      const uploadResult = await cloudinary.uploader.upload(image.path, {
        folder: 'products', // Organize images in a products folder
        public_id: `product_${Date.now()}_${index}`, // Unique identifier
        resource_type: 'image',
       // quality: 'auto', // Automatic quality optimization
       // fetch_format: 'auto' // Automatic format optimization
      });
      //console.log(uploadResult)
        // Delete the local file after successful upload
      try {
        await new Promise((resolve, reject) => {
          fs.unlink(image.path, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        console.log(`Successfully deleted local file: ${image.path}`);
      } catch (deleteError) {
        console.warn(`Warning: Could not delete local file ${image.path}:`, deleteError.message);
        // Don't throw here - the upload was successful, file deletion is cleanup
      }
      return {
        url: uploadResult.secure_url,
        public_id: uploadResult.public_id,
        width: uploadResult.width,
        height: uploadResult.height
      };
    } catch (error) {
      console.error(`Error uploading image ${index}:`, error);
      throw new Error(`Failed to upload image ${index}: ${error.message}`);
    }
  });

  return Promise.all(uploadPromises);
}

// Helper function to delete images from Cloudinary
async function deleteImagesFromCloudinary(publicIds) {
  if (!publicIds || publicIds.length === 0) return;
  
  try {
    const deletePromises = publicIds.map(publicId => 
      cloudinary.uploader.destroy(publicId)
    );
    await Promise.all(deletePromises);
  } catch (error) {
    console.error('Error deleting images from Cloudinary:', error);
  }
}

// Product Category Management =======================================================
async function listProductCategory(req, res, next) {
  res.json(await ProductCategory.find({}));
}

async function createProductCategory(req, res, next) {
  try {
let uploadedImages = [];
    //console.log(req.body.images)
    // Upload images to Cloudinary if provided
    if (req.file) {
      console.log(req.file)
      uploadedImages = await uploadImagesToCloudinary([req.file]);
    }
   console.log(uploadedImages)
   
   const image = uploadedImages[0].url;
    const image_id = uploadedImages[0].public_id;
   
  const newProductCategory = new ProductCategory({
    name_english: req.body.name_english,
    name_arabic: req.body.name_arabic,
    image:image,
    image_id:image_id
  });
  newProductCategory.save();
  res.send(newProductCategory);
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ error: error.message });
  }
  
}

async function updateProductCategory(req, res, next) {
  try {
let updatedImages = [];
    const existingCategory = await ProductCategory.findById(req.body.id);
    if (!existingCategory) {
      return res.status(404).json({ error: 'Product not found' });
    }
    console.log(req.file)
    // If new images are provided, upload them and delete old ones
    if (req.file) {
      // Delete old images from Cloudinary
      if (existingCategory.image) {
        const oldPublicId = existingCategory.image_id;
        await deleteImagesFromCloudinary([oldPublicId]);
      }
      
      // Upload new images
      updatedImages = await uploadImagesToCloudinary([req.file]);
    }
let image = req.body.existingImage;
     console.log(image)
     let image_id = req.body.existingImage_id;

    console.log(image_id);
    console.log(updatedImages.length)
    if (updatedImages.length>0) {
      image = updatedImages[0].url;
      image_id = updatedImages[0].public_id;
    }
  res.json(
    await ProductCategory.findByIdAndUpdate(
      req.body.id,
      {
        name_english: req.body.name_english,
         name_arabic: req.body.name_arabic,
         image: image,
         image_id:image_id
      },
      {
        new: true,
      }
    )
  );
  } catch (error) {
      console.error('Error updating category:', error);
    res.status(500).json({ error: error.message });
  }
  
}

async function showProductCategory(req, res, next) {
  res.json(await ProductCategory.findById(req.query.id).populate("products"));
}

async function deleteProductCategory(req, res, next) {
  try {
    const categoryId = req.query.id;
    
    // Optional: Manual cleanup as fallback
    const category = await ProductCategory.findById(categoryId);
    if (category && category.products.length > 0) {
      console.log(`Manually cleaning up ${category.products.length} products`);
      await Product.deleteMany(
        { category: categoryId },
      );
    }
    
    const deletedCategory = await ProductCategory.findByIdAndDelete(categoryId);
    res.json(deletedCategory);
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ error: error.message });
  }
}

// Product Management =======================================================
async function listProduct(req, res, next) {
  try {
res.json(await Product.find({}).populate("category"));
  } catch (error) {
        console.error('Error fetching products:', error);
    res.status(500).json({ error: error.message });
  }
  
}

async function createProduct(req, res, next) {
  try {
   // console.log(req.body);

    // Expecting req.body.colors to be an array of color objects:
    // [{ color: "Red", colorDeg: "#FF0000" }, { color: "Blue", colorDeg: "#0000FF" }]
    const colorsData = req.body.colors || [];
    const files = req.files || []; // flat array of uploaded files
    console.log(colorsData)
    const colors = [];
    console.log(files)
    for (let i = 0; i < colorsData.length; i++) {
      const colorObj = colorsData[i];

      // Filter files for this color based on fieldname convention: "color-0", "color-1", etc.
      const colorFiles = files.filter(f => f.fieldname === `color-${i}`);
      console.log(colorFiles)
      // Upload images for this color
      let uploadedImages = [];
      if (colorFiles.length > 0) {
        uploadedImages = await uploadImagesToCloudinary(colorFiles);
        // console.log(uploadedImages)
    
      }
 console.log(uploadedImages)
    
      const images = uploadedImages.map(img => img.url);
      const images_ids = uploadedImages.map(img => img.public_id);

      colors.push({
        color: colorObj.color,
        colorDeg: colorObj.colorDeg,
        images: images,
        images_ids: images_ids
      });
    }

    // Find category if categoryname is provided
    let category = null;
    if (req.body.categoryname) {
      category = await ProductCategory.findOne({ name_english: req.body.categoryname });
    }

  // This ensures 'sizes' is always an array, even if only one is sent.
const sizes = [].concat(req.body.sizes || []).filter(size => size);

// Do the same for 'quantities' before filtering and mapping.
const quantities = [].concat(req.body.quantities || [])
  .filter(qty => qty)
  .map(Number);

    const newProduct = new Product({
      name_english: req.body.name_english,
      name_arabic: req.body.name_arabic,
      colors: colors,
      price: req.body.price,
      quantity: req.body.quantity,
      sizes: sizes,
      quantities: quantities,
      description_english: req.body.description_english,
      description_arabic: req.body.description_arabic,
      category: category ? category._id : null,
      categoryName_english: req.body.categoryname,
      categoryName_arabic: category ? category.name_arabic : ''
    });
    console.log(newProduct)
    await newProduct.save();

    res.status(201).json({
      success: true,
      message: 'Product created successfully'
    });

  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create product',
      error: error.message
    });
  }
}

async function updateProduct(req, res, next) {
  try {
    // 1. PARSE INCOMING DATA
    const { id, name_english, name_arabic, price, sizes, quantities, categoryname, description_english, description_arabic } = req.body;
    
    // Data for color variants will be sent as stringified JSON
    const existingColorsData = JSON.parse(req.body.existingColors || '[]');
    const newColorsData = JSON.parse(req.body.newColors || '[]');
    const files = req.files || [];

    // 2. FIND THE PRODUCT AND CATEGORY
    const productToUpdate = await Product.findById(id);
    if (!productToUpdate) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    const category = await ProductCategory.findOne({ name_english: categoryname });

    // 3. HANDLE IMAGE DELETION
    // Figure out which images were removed by comparing the original list with the list of kept images sent from the frontend
    const originalImageIds = productToUpdate.colors.flatMap(c => c.images_ids);
    const keptImageIds = existingColorsData.flatMap(c => c.images_ids);
    const imageIdsToDelete = originalImageIds.filter(id => !keptImageIds.includes(id));
    
    if (imageIdsToDelete.length > 0) {
      await deleteImagesFromCloudinary(imageIdsToDelete);
    }

    const finalColors = [];

    // 4. PROCESS EXISTING COLORS (add new images to them)
    for (const colorData of existingColorsData) {
      const newFilesForThisColor = files.filter(f => f.fieldname === `existing-color-${colorData._id}`);
      let newUploadedImages = [];
      if (newFilesForThisColor.length > 0) {
        newUploadedImages = await uploadImagesToCloudinary(newFilesForThisColor);
      }
      
      finalColors.push({
        _id: colorData._id,
        color: colorData.color,
        colorDeg: colorData.colorDeg,
        images: [...colorData.images, ...newUploadedImages.map(img => img.url)],
        images_ids: [...colorData.images_ids, ...newUploadedImages.map(img => img.public_id)]
      });
    }

    // 5. PROCESS NEW COLORS (upload their images)
    for (let i = 0; i < newColorsData.length; i++) {
      const newColor = newColorsData[i];
      const filesForThisNewColor = files.filter(f => f.fieldname === `new-color-${i}`);
      let uploadedImages = [];
      if (filesForThisNewColor.length > 0) {
        uploadedImages = await uploadImagesToCloudinary(filesForThisNewColor);
      }
      
      finalColors.push({
        color: newColor.color,
        colorDeg: newColor.colorDeg,
        images: uploadedImages.map(img => img.url),
        images_ids: uploadedImages.map(img => img.public_id)
      });
    }

    // 6. UPDATE AND SAVE THE PRODUCT
    const totalQuantity = [].concat(quantities || []).filter(q => q).map(Number).reduce((sum, qty) => sum + qty, 0);

    productToUpdate.set({
      name_english,
      name_arabic,
      price,
      description_english,
      description_arabic,
      category: category ? category._id : productToUpdate.category,
      categoryName_english: categoryname,
      categoryName_arabic: category ? category.name_arabic : productToUpdate.categoryName_arabic,
      sizes: [].concat(sizes || []).filter(s => s),
      quantities: [].concat(quantities || []).filter(q => q).map(Number),
      quantity: totalQuantity,
      colors: finalColors
    });

    const updatedProduct = await productToUpdate.save();
    res.status(200).json(updatedProduct);

  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ error: error.message });
  }
}
async function showProduct(req, res, next) {
  try {
 res.json(await Product.findById(req.query.productID));
  } catch (error) {
     console.error('Error showing product:', error);
    res.status(500).json({ error: error.message });
  }
 
}

async function deleteProduct(req, res, next) {
  try {
    const productId = req.query.id;
    const product = await Product.findById(productId);
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    // Delete images from Cloudinary
    if (product.images_ids && product.images_ids.length > 0) {
      const publicIds = product.images_ids;
      await deleteImagesFromCloudinary(publicIds);
    }
    
    // Remove product from category's products list
    if (product.category) {
      console.log(`Removing product ${productId} from category ${product.category}`);
      await ProductCategory.findByIdAndUpdate(
        product.category,
        { $pull: { products: productId } }
      );
      console.log(`Product removed from category successfully`);
    }
    
    // Delete the product
    const deletedProduct = await Product.findByIdAndDelete(productId);
    res.json(deletedProduct);
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ error: error.message });
  }
}

// Order Management =======================================================
async function listOrders(req, res, next) {
  try {
    const orders = await Order.find({}).sort({ created_at: -1 });
    
    res.json(orders);
  } catch (error) {
    console.log(error)
    res.status(500).json({ error: error.message });
  }
}

async function createOrder(req, res, next) {
  try {
    console.log(req.body);
    
    // Validate and process product purchases
    const productPurchases = [];
    let totalAmount = 0;
    
    for (const item of req.body.productPurchases) {
      const product = await Product.findById(item.productId);
      if (!product) {
        return res.status(404).json({ error: `Product not found: ${item.productId}` });
      }
      
      if (product.quantity < item.quantity) {
        return res.status(400).json({ 
          error: `Insufficient stock for ${product.name}. Available: ${product.quantity}, Requested: ${item.quantity}` 
        });
      }
      
      const subtotal = item.quantity * product.price;
      totalAmount += subtotal;
      
      productPurchases.push({
        product: product._id,
        quantity: item.quantity,
        priceAtPurchase: product.price,
        subtotal: subtotal
      });
      
      // Update product stock
      await Product.findByIdAndUpdate(
        product._id,
        { $inc: { quantity: -item.quantity } }
      );
    }
    
    const newOrder = new Order({
      user: req.body.userId,
      productPurchases: productPurchases,
      totalAmount: totalAmount,
      status: req.body.status || 'pending',
      paymentMethod: req.body.paymentMethod,
      shippingAddress: req.body.shippingAddress,
      orderNotes: req.body.orderNotes
    });
    
    await newOrder.save();
    
    // Populate the response
    const populatedOrder = await Order.findById(newOrder._id)
      .populate('productPurchases.product')
      .populate('user', 'name email');
    
    res.status(201).json(populatedOrder);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function updateOrder(req, res, next) {
  try {
    const updateData = {};
    
    if (req.body.status) updateData.status = req.body.status;
    if (req.body.paymentMethod) updateData.paymentMethod = req.body.paymentMethod;
    if (req.body.shippingAddress) updateData.shippingAddress = req.body.shippingAddress;
    if (req.body.orderNotes) updateData.orderNotes = req.body.orderNotes;
    
    const updatedOrder = await Order.findByIdAndUpdate(
      req.query.id,
      updateData,
      { new: true }
    )
    .populate('productPurchases.product')
    .populate('user', 'name email');
    
    if (!updatedOrder) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    res.json(updatedOrder);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function showOrder(req, res, next) {
  try {
    const order = await Order.findById(req.query.id);
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function deleteOrder(req, res, next) {
  try {
    const order = await Order.findById(req.query.orderID);
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    /*let product;
    let inc;
    let quantities;
    let quantity;
    // Restore product quantities if order is cancelled
    if (order.status === 'pending' || order.status === 'processing') {
      for (const it of order.items) {
        product = await Product.findById(
          it.product
        );
        for (const s of product.sizes) {
          if (it.selectedSize==s) {
            inc = s.indexOf()
            console.log(inc);
            quantities = product.quantities;
            quantities[inc] = quantities[inc]+it.quantity;
            quantity = product.quantity+it.quantity;

          }
            await Product.findByIdAndUpdate(
          it.product,{
            quantity:quantity,
            quantities:quantities
          }
        );
        }
      }
    }*/
    
    const deletedOrder = await Order.findByIdAndDelete(req.query.orderID);
    res.json({ message: 'Order deleted successfully', order: deletedOrder });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// USER-SPECIFIC ORDER FUNCTIONS =======================================================

async function listUserOrders(req, res, next) {
  try {
    const orders = await Order.find({ user: req.query.userId })
      .populate('productPurchases.product')
      .sort({ created_at: -1 });
    
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function listOrdersByStatus(req, res, next) {
  try {
    const orders = await Order.find({ status: req.query.status })
      .populate('productPurchases.product')
      .populate('user', 'name email')
      .sort({ created_at: -1 });
    
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// PRODUCT PURCHASE MANAGEMENT =======================================================

async function addProductToOrder(req, res, next) {
  try {
    const order = await Order.findById(req.query.orderId);
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    if (order.status === 'completed' || order.status === 'cancelled') {
      return res.status(400).json({ error: 'Cannot modify completed or cancelled orders' });
    }
    
    const product = await Product.findById(req.body.productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    if (product.quantity < req.body.quantity) {
      return res.status(400).json({ error: 'Insufficient stock' });
    }
    
    const newPurchase = {
      product: product._id,
      quantity: req.body.quantity,
      priceAtPurchase: product.price,
      subtotal: req.body.quantity * product.price
    };
    
    order.productPurchases.push(newPurchase);
    
    // Update product stock
    await Product.findByIdAndUpdate(
      product._id,
      { $inc: { quantity: -req.body.quantity } }
    );
    
    await order.save();
    
    const updatedOrder = await Order.findById(order._id)
      .populate('productPurchases.product');
    
    res.json(updatedOrder);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function updateProductPurchase(req, res, next) {
  try {
    const order = await Order.findById(req.query.orderId);
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    if (order.status === 'completed' || order.status === 'cancelled') {
      return res.status(400).json({ error: 'Cannot modify completed or cancelled orders' });
    }
    
    const purchaseIndex = order.productPurchases.findIndex(
      p => p.product.toString() === req.query.productId
    );
    
    if (purchaseIndex === -1) {
      return res.status(404).json({ error: 'Product not found in order' });
    }
    
    const oldQuantity = order.productPurchases[purchaseIndex].quantity;
    const newQuantity = req.body.quantity;
    const quantityDiff = newQuantity - oldQuantity;
    
    const product = await Product.findById(req.query.productId);
    
    if (quantityDiff > 0 && product.quantity < quantityDiff) {
      return res.status(400).json({ error: 'Insufficient stock for quantity increase' });
    }
    
    // Update the purchase
    order.productPurchases[purchaseIndex].quantity = newQuantity;
    order.productPurchases[purchaseIndex].subtotal = newQuantity * order.productPurchases[purchaseIndex].priceAtPurchase;
    
    // Update product stock
    await Product.findByIdAndUpdate(
      req.query.productId,
      { $inc: { quantity: -quantityDiff } }
    );
    
    await order.save();
    
    const updatedOrder = await Order.findById(order._id)
      .populate('productPurchases.product');
    
    res.json(updatedOrder);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function removeProductFromOrder(req, res, next) {
  try {
    const order = await Order.findById(req.query.orderId);
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    if (order.status === 'completed' || order.status === 'cancelled') {
      return res.status(400).json({ error: 'Cannot modify completed or cancelled orders' });
    }
    
    const purchaseIndex = order.productPurchases.findIndex(
      p => p.product.toString() === req.query.productId
    );
    
    if (purchaseIndex === -1) {
      return res.status(404).json({ error: 'Product not found in order' });
    }
    
    const removedPurchase = order.productPurchases[purchaseIndex];
    
    // Restore product stock
    await Product.findByIdAndUpdate(
      removedPurchase.product,
      { $inc: { quantity: removedPurchase.quantity } }
    );
    
    order.productPurchases.splice(purchaseIndex, 1);
    await order.save();
    
    const updatedOrder = await Order.findById(order._id)
      .populate('productPurchases.product');
    
    res.json(updatedOrder);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// ORDER ANALYTICS =======================================================

async function getOrderStats(req, res, next) {
  try {
    const stats = await Order.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalRevenue: { $sum: '$totalAmount' }
        }
      }
    ]);
    
    const totalOrders = await Order.countDocuments();
    const totalRevenue = await Order.aggregate([
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);
    
    res.json({
      totalOrders,
      totalRevenue: totalRevenue[0]?.total || 0,
      statusBreakdown: stats
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

module.exports = {
  listProductCategory,
  createProductCategory,
  updateProductCategory,
  showProductCategory,
  deleteProductCategory,
  createProduct,
  updateProduct,
  listProduct,
  showProduct,
  deleteProduct,
  // Order CRUD
  listOrders,
  createOrder,
  updateOrder,
  showOrder,
  deleteOrder,
  
  // User-specific orders
  listUserOrders,
  listOrdersByStatus,
  
  // Product Purchase management
  addProductToOrder,
  updateProductPurchase,
  removeProductFromOrder,
  
  // Analytics
  getOrderStats,
  
  // Helper functions (if you want to export them)
  uploadImagesToCloudinary,
  deleteImagesFromCloudinary
};