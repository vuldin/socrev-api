const WPAPI = require('wpapi')
const request = require('superagent')
const { JSDOM } = require('jsdom')
const mcache = require('memory-cache')
const CircularJSON = require('circular-json')
const parse5 = require('parse5')
const store = require('./store')

const { cmsApiUrl, cmsApiUser, cmsApiPassword } = store
//const cachelife = 1000 * 60 * 20 // 20 min
//const cachelife = 1 // none
const cachelife = 0 // unlimited
const cache = duration => {
  return (req, res, next) => {
    let url = req.url
    let originalUrl = req.originalUrl
    let id = parseInt(req.params.id)
    let allowSet = true
    let key = '__express__' + originalUrl || url
    if (url.match(/\/posts\/[0-9]*$/g)) {
      allowSet = false
      key = '__express__/posts'
    }
    let cachedBody = mcache.get(key)
    if (cachedBody) {
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
        let fmids = Array.from(posts, p => p.featured_media)
        //console.log(new Date().getTime(), fmids)
        //let m = await wp.media().id(3255)
        let getMedia = async (mid, i, resolve) => {
          if (mid !== 0) {
            //posts[i].featuredMedia = await wp.media().id(mid)
            let media = await wp.media().id(mid)
            posts[i].featuredMedia = media
          } else {
            // pull media from content
            let handleNodes = node => {
              if (node.nodeName === 'img') {
                posts[i].featuredMedia = {
                  source_url: node.attrs.find(a => a.name === 'src').value
                }
              } else {
                if (
                  node.childNodes !== undefined &&
                  node.childNodes.length > 0
                ) {
                  node.childNodes.forEach(c => handleNodes(c))
                }
              }
            }
            let node = parse5.parseFragment(posts[i].content.rendered)
            handleNodes(node)
          }
          resolve()
        }
        let requests = fmids.map((mid, i) => {
          return new Promise(resolve => {
            getMedia(mid, i, resolve)
          })
        })
        await Promise.all(requests)
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
