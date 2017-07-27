const WPAPI = require('wpapi')
const request = require('superagent')
const constants = require('./constants')
const cache = require('./cache')

const { cmsApiUrl, cmsApiUser, cmsApiPassword } = constants

module.exports = (app, checkJwt, checkScopes) => {
  // allow self-signed certificate on wordpress site
  //process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
  WPAPI.discover(cmsApiUrl).then(wp => {
    wp.auth({
      username: cmsApiUser,
      password: cmsApiPassword,
      auth: true
    })
    app.get('/posts', cache.cache())
    app.get('/posts/:slug', cache.cache())
    app.get('/categories', cache.cache())
    /*
    app.get('/media/:id', cache.cache(cachelife), async (req, res) => {
      try {
        let m = await wp.media().id(req.params.id)
        res.json(m)
      } catch (e) {
        res.status(404).send('error from wordpress')
      }
    })
    */
    app.get('/clear', (req, res) => {
      cache.clear()
      res.send('cache cleared')
    })
  })
}
