const WPAPI = require('wpapi')
const request = require('superagent')
const { JSDOM } = require('jsdom')
const mcache = require('memory-cache')
const CircularJSON = require('circular-json')
const store = require('./store')

const { cmsApiUrl, cmsApiUser, cmsApiPassword } = store
const cachelife = undefined //1000 * 60 * 20 // 20 min cache
const cache = duration => {
  return (req, res, next) => {
    let url = req.url
    let originalUrl = req.originalUrl
    let allowSet = true
    let key = '__express__' + originalUrl || url
    if (req.url.match(/\/posts\/[0-9]*$/g)) {
      allowSet = false
      key = '__express__/posts'
    }
    let cachedBody = mcache.get(key)
    if (cachedBody) {
      let id = parseInt(req.params.id)
      if (id) {
        res.json(cachedBody.find(d => d.id === id))
      } else res.json(cachedBody)
      return
    } else {
      if (allowSet) {
        res.sendResponse = res.json
        res.json = body => {
          if (duration) mcache.put(key, body, duration)
          else mcache.put(key, body)
          res.sendResponse(body)
        }
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
          wp.posts().sticky(false).page(page).perPage(12)
        ])
        posts.unshift(sticky[0])
        // retrieve featured media if it exists
        // otherwise use the first image in content
        let fmids = Array.from(posts, p => p.featured_media)
        console.log(fmids)
        //let m = await wp.media().id(3255)
        //console.log(m)
        /*
        fmids.forEach(async id => {
          let m = await wp.media().id(fmids.shift())
          console.log(m)
        })
        */
        /*
        let fmedia = await fmids.map(async mid => {
          let m = await wp.media().id(mid)
          return m
        })
        console.log(fmedia)
        */
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
    app.get('/media/:id', cache(cachelife), async (req, res) => {
      try {
        let m = await wp.media().id(req.params.id)
        res.json(m)
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
