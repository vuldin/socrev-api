const WPAPI = require('wpapi')
const request = require('superagent')
const { JSDOM } = require('jsdom')
const CircularJSON = require('circular-json')
const parse5 = require('parse5')
const constants = require('./constants')
const cache = require('./cache')
const postMod = require('./postMod')

const { cmsApiUrl, cmsApiUser, cmsApiPassword } = constants
const cachelife = 0 // unlimited

module.exports = (app, checkJwt, checkScopes) => {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
  WPAPI.discover(cmsApiUrl).then(wp => {
    wp.auth({
      username: cmsApiUser,
      password: cmsApiPassword,
      auth: true
    })
    app.get('/posts', cache.cache(cachelife), async (req, res) => {
      let page = req.query.page
      try {
        let post = []
        let sticky = []
        if (page) {
          posts = await wp.posts().sticky(false).page(+page).perPage(12)
        } else {
          let [stickyres, postsres] = await Promise.all([
            wp.posts().sticky(true),
            wp.posts().sticky(false).perPage(12)
          ])
          sticky = stickyres
          posts = postsres
          posts.unshift(sticky[0])
        }

        // replace featured_media id with url
        const getFeatureSrcRequests = posts.map(
          p => new Promise(resolve => postMod.getFeatureSrc(p, wp, resolve))
        )
        posts = await Promise.all(getFeatureSrcRequests)

        // some posts have featured_media set to 0
        // this needs to be changed to first img/figure

        const modFigureRequests = posts.map(
          p => new Promise(resolve => postMod.modFigure(p, resolve))
        )
        posts = await Promise.all(modFigureRequests)
        /*
        // first step is changing all images to figures
        const imgToFigureRequests = posts.map(
          p => new Promise(resolve => postMod.imgToFigure(p, resolve))
        )
        posts = await Promise.all(imgToFigureRequests)
        */

        // TODO for all paragraphs, pull feature tags from childNodes and insert as sibling

        // handle featured_media that has val of 0
        const handleNoFeatureRequests = posts.map(
          p => new Promise(resolve => postMod.handleNoFeature(p, resolve))
        )
        posts = await Promise.all(handleNoFeatureRequests)

        // remove repeated images from content
        const removeRepeatImageRequests = posts.map(
          p => new Promise(resolve => postMod.removeRepeatImage(p, resolve))
        )
        posts = await Promise.all(removeRepeatImageRequests)

        res.json(posts)
      } catch (e) {
        res.status(404).send('error from wordpress')
      }
    })
    app.get('/posts/:slug', cache.cache(cachelife), async (req, res) => {
      try {
        let post = await wp.posts().slug(req.params.slug)
        post = post[0]
        res.json(post)
      } catch (e) {
        res.status(404).send('error from wordpress')
      }
    })
    app.get('/media/:id', cache.cache(cachelife), async (req, res) => {
      try {
        let m = await wp.media().id(req.params.id)
        res.json(m)
      } catch (e) {
        res.status(404).send('error from wordpress')
      }
    })
    app.get('/clear', (req, res) => {
      cache.clear()
      res.send('cache cleared')
    })
  })
}
