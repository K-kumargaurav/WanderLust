/**
 * Wraps an async Express route handler to forward errors to next().
 * Eliminates the need for try/catch in every async controller.
 *
 * @param {Function} fn - Async Express handler (req, res, next) => Promise
 * @returns {Function} Express middleware that catches rejected promises
 *
 * @example
 * router.get('/listings', wrapAsync(async (req, res) => {
 *   const listings = await Listing.find({});
 *   res.render('listings/index', { listings });
 * }));
 */
const wrapAsync = (fn) => {
  return function asyncWrapper(req, res, next) {
    fn(req, res, next).catch(next);
  };
};

module.exports = wrapAsync;
