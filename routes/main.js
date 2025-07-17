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
const {
  createCheckoutSession,
  handlePaymentSuccess,
  getCheckoutSession,
  getUserOrders,
  cancelOrder,
  handleWebhook,
  getOrder
} = require('../controllers/payment');
//const authMiddleware = require('../middleware/auth');
//router.post('/webhook',express.raw({type: 'application/json'}),handleWebhook);
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


router.post('/create-checkout-session', createCheckoutSession);
router.get('/payment-success', handlePaymentSuccess);
router.get('/checkout-session/:sessionId', getCheckoutSession);
router.get('/orders/user', getUserOrders);
router.put('/orders/:id/cancel', cancelOrder);

router.get('/orders/:id', getOrder);
module.exports = router;
