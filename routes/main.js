var express = require("express");
var router = express.Router();
var {
  showSite, // Retrieve website information

  listAllCategories, // Retrieve all product categories
  listRecentProducts, // Retrieve recently created products
  listRecentShops, // Retrieve recently created shops
  listProductsByCategory,
  showCategory, // Retrieve one single product category
  showShop, // Retrieve one single shop
  showProduct, // Retrieve one single product

  addProductReview, // Add review to a product
  removeProductReview,
  getProduct, //  Remove product review
  getCategory
} = require("../controllers/index");

router.get("/site", showSite);

router.get("/category/all", listAllCategories);
router.get("/product/recent", listRecentProducts);
router.get("/product/category", listProductsByCategory);
router.get("/product", getProduct);
router.get("/category", getCategory);
router.get("/shop/recent", listRecentShops);

router.get("/category/show", showCategory);
router.get("/shop/show", showShop);
router.get("/product/show", showProduct);

router.get("/product/review/add", addProductReview);
router.get("/product/review/remove", removeProductReview);

module.exports = router;
