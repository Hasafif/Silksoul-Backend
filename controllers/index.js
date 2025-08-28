var mongoose = require("mongoose");
var { siteSchema } = require("../models/site");
var { productSchema, productCategorySchema } = require("../models/product");
var { reviewSchema } = require("../models/review");
var { shopSchema } = require("../models/shop");
var { userSchema } = require("../models/user");

//mongoose.connect("mongodb://admin:password@l127.0.0.1:27017/ecommerce");

const Site = mongoose.model("Site", siteSchema);
const User = mongoose.model("User", userSchema);
const Product = mongoose.model("Product", productSchema);
const ProductCategory = mongoose.model(
  "ProductCategory",
  productCategorySchema
);
const Shop = mongoose.model("Shop", shopSchema);
const Review = mongoose.model("Review", reviewSchema);

// Retrieve website information
async function showSite(req, res, next) {
  res.json(await Site.find({}));
}
// Retrieve website information
async function getProduct(req, res, next) {
  try {
res.json(await Product.findById(req.query.productID));
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ error: error.message });
  }
  
}
async function getCategory(req, res, next) {
    try {
  console.log(req.query)
  res.json(await ProductCategory.findById(req.query.categoryID));
  } catch (error) {
    console.error('Error fetching category:', error);
    res.status(500).json({ error: error.message });
  }

}
// Retrieve all product categories
async function listAllCategories(req, res, next) {
 
      try {
  res.json(await ProductCategory.find({}));
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: error.message });
  }
}

// Retrieve recently created products
async function listRecentProducts(req, res, next) {
  res.json(await Product.find({}).sort({ created_at: -1 }).limit(15));
}
async function listProductsByCategory(req, res, next) {
  
     try {
res.json(await Product.find({category:req.query.categoryID}));
  } catch (error) {
    console.error('Error fetching category products:', error);
    res.status(500).json({ error: error.message });
  }
}
async function listProductsByCategoryName(req, res, next) {
  
     try {
res.json(await Product.find({categoryName_english:req.query.categoryName}));
  } catch (error) {
    console.error('Error fetching category products:', error);
    res.status(500).json({ error: error.message });
  }
}
// Retrieve recently created shops
async function listRecentShops(req, res, next) {
  res.json(await Shop.find({}).sort({ created_at: -1 }).limit(15));
}

// Retrieve all product that belongs to the specified category
// async function listCategoryProducts(req, res, next) {
//   const category = await ProductCategory.find({ name: req.query.categoryName });
//   const products = await Product.find({ categories: category })
//     .sort({ created_at: -1 })
//     .limit(15);
//   res.json(products);
// }

// Retrieve all product that belongs to the specified shop
// async function listShopProducts(req, res, next) {
//   const shop = await Shop.findById(req.query.shopID);
//   const products = await Product.find({ shop: shop }).sort({ created_at: -1 });
//   res.json(products);
// }

// Retrieve one single product category
async function showCategory(req, res, next) {
  res.json(await ProductCategory.findById(req.query.categoryID).populate("products"));
}

// Retrieve one single shop
async function showShop(req, res, next) {
  res.json(await Shop.findById(req.query.shopID).populate("products"));
}

// Retrieve one single product
async function showProduct(req, res, next) {
  res.json(await Product.findById(req.query.productID).populate("reviews"));
}

// Add review to a product
async function addProductReview(req, res, next) {
  const product = await Product.findById(req.query.productID);
  const user = await User.findById(req.query.userID);
  const newReview = await new Review({
    rating: req.body.rating,
    content: req.body.content,
    product: product,
    user: user,
  });
  newReview.save();

  // update product
  await Product.findByIdAndUpdate(req.query.productID, {
    $push: { reviews: newReview },
  });

  // update user
  await User.findByIdAndUpdate(req.query.userID, {
    $push: { reviews: newReview },
  });

  res.json(newReview);
}


//  Remove product review
async function removeProductReview(req, res, next) {
  const review = await Review.findByIdAndRemove(req.query.reviewID);

  // update product
  await Product.findByIdAndUpdate(review.product._id, {
    $pull: { reviews: review._id },
  });

  // update user
  await User.findByIdAndUpdate(review.user._id, {
    $pull: { reviews: review._id },
  });

  res.json(newReview);
}

module.exports = {
  showSite,
  listAllCategories,
  listRecentProducts,
  listProductsByCategory,
  listProductsByCategoryName,
  getProduct,
  getCategory,
  listRecentShops,
  showCategory,
  showShop,
  showProduct,
  addProductReview,
  removeProductReview,
};
