const WPAPI = require('wpapi')
const request = require('superagent')
const { JSDOM } = require('jsdom')
const CircularJSON = require('circular-json')
const parse5 = require('parse5')
const DOMParser = require('xmldom').DOMParser
const constants = require('./constants')
const cache = require('./cache')
const postMod = require('./postMod')

const { cmsApiUrl, cmsApiUser, cmsApiPassword } = constants
const cachelife = 0 // unlimited

const decodeString = string => {
  const dom = new DOMParser().parseFromString(
    `<body>${string}</body>`,
    'text/html'
  )
  return dom.documentElement.firstChild.nodeValue
}

module.exports = (app, checkJwt, checkScopes) => {
  // allow self-signed certificate on wordpress site
  //process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
  WPAPI.discover(cmsApiUrl).then(wp => {
    wp.auth({
      username: cmsApiUser,
      password: cmsApiPassword,
      auth: true
    })
    const handlePostMod = async (p, cats) => {
      p = await postMod.getFeatureSrc(p, wp)

      // categories
      //p = postMod.matchCategories(p, cats)
      let catNames = []
      catNames = p.categories.map(c => {
        let result = []
        result = cats.filter(cat => {
          let result = cat.id === c
          return result
        })
        if (result.length > 0)
          result = {
            name: decodeString(result[0].name),
            isBase: result[0].parent !== 0 ? true : false
          }
        else result = 'Uncategorized'
        return result
      })
      p.categories = catNames

      p = await postMod.modFigure(p)
      //p = await postMod.imgToFigure(p)
      p = await postMod.handleNoFeature(p)
      p = await postMod.removeRepeatImage(p)
      p = await postMod.removeExcerptImage(p)
      p = await postMod.removeExcerptMarkup(p)
      return p
    }
    app.get('/posts', cache.cache(cachelife), async (req, res) => {
      let page = req.query.page
      try {
        let post = []
        let sticky = []
        if (page) {
          posts = await wp.posts().perPage(12).offset(1 + 12 * page - 12)
        } else {
          let [stickyres, postsres] = await Promise.all([
            wp.posts().sticky(true),
            wp.posts().perPage(13)
          ])
          sticky = stickyres
          posts = postsres
          const feature = sticky[0]
          posts = posts.filter(p => p.id !== feature.id)
          posts.unshift(feature)
        }

        // TODO categories are capped here at 100
        let cats = await wp.categories().perPage(100)
        //posts = await Promise.all(posts.map(handlePostMod))
        posts = await Promise.all(
          posts.map(
            p =>
              new Promise(async (resolve, reject) => {
                p = await handlePostMod(p, cats)
                resolve(p)
              })
          )
        )

        res.json(posts)
      } catch (e) {
        res.status(404).send('error from wordpress')
      }
    })
    app.get('/posts/:slug', cache.cache(cachelife), async (req, res) => {
      try {
        let post = await wp.posts().slug(req.params.slug)
        post = post[0]
        let cats = await wp.categories().perPage(100)
        post = await handlePostMod(post, cats)
        res.json(post)
      } catch (e) {
        res.status(404).send('error from wordpress')
      }
    })
    app.get('/categories', cache.cache(cachelife), async (req, res) => {
      try {
        let cats = await wp.categories().perPage(100)
        let parents = []
        let subs = []
        cats.forEach(c => {
          let result = {
            name: decodeString(c.name),
            id: c.id,
            parent: c.parent
          }
          if (c.parent === 0) parents.push(result)
          else subs.push(result)
        })
        parents.forEach(p => {
          p.children = subs.filter(s => s.parent === p.id).map(s => s.name)
          delete p.id
          delete p.parent
        })
        res.json(parents)
      } catch (e) {
        res.status(404).send('error from wordpress', e)
      }
    })
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
