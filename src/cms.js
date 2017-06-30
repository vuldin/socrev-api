const WPAPI = require('wpapi')
const request = require('superagent')
const { JSDOM } = require('jsdom')
const mcache = require('memory-cache')
const CircularJSON = require('circular-json')
const store = require('./store')

const { cmsApiUrl, cmsApiUser, cmsApiPassword } = store
const cachelife = 60 * 20 // 20 min cache
const cache = duration => {
  return (req, res, next) => {
    let key = '__express__' + req.originalUrl || req.url
    let cachedBody = mcache.get(key)
    if (cachedBody) {
      res.json(cachedBody)
      return
    } else {
      res.sendResponse = res.json
      res.json = body => {
        mcache.put(key, body, duration * 1000)
        res.sendResponse(body)
      }
      next()
    }
  }
}

module.exports = (app, checkJwt, checkScopes) => {
  WPAPI.discover(cmsApiUrl).then(wp => {
    wp.auth({
      username: cmsApiUser,
      password: cmsApiPassword,
      auth: true
    })
    app.get('/posts', cache(cachelife), async (req, res) => {
      let page = req.query.page
      try {
        let [sticky, posts] = await Promise.all([
          wp.posts().sticky(true),
          wp.posts().page(page).perPage(12)
        ])
        posts.unshift(sticky)
        res.json(posts)
      } catch (e) {
        res.status(404).send('error from wordpress')
      }
    })
    app.get('/posts/:id', cache(cachelife), async (req, res) => {
      try {
        let post = await wp.posts().id(req.params.id)
        res.json(post)
      } catch (e) {
        res.status(404).send('error from wordpress')
      }
    })
    app.get('/clear', (req, res) => {
      mcache.clear()
      res.send('cache cleared')
    })
  })
}
