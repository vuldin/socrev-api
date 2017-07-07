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
    let slug = req.params.slug
    let allowSet = true
    let key = '__express__' + originalUrl || url
    if (url.match(/\/posts\/[a-z-0-9]*$/g)) {
      allowSet = false
      key = '__express__/posts'
    }
    let cachedBody = mcache.get(key)
    if (cachedBody) {
      if (slug) {
        res.json(cachedBody.find(d => d.slug === slug))
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
        //let fmids = Array.from(posts, p => p.featured_media)
        //console.log(new Date().getTime(), fmids)
        //let m = await wp.media().id(3255)
        let getMedia = async (p, i, resolve) => {
          /*
          if (mid !== 0) {
            //posts[i].featuredMedia = await wp.media().id(mid)
            let media = await wp.media().id(mid)
            posts[i].featuredMedia = media
          } else {
          */
          // use first img/feature as feature
          const handleFeaturedMedia = (node, arr) => {
            if (node.nodeName === 'img') {
              arr.push(node.attrs.find(d => d.name === 'src').value)
            } else {
              if (node.childNodes !== undefined && node.childNodes.length > 0) {
                node.childNodes.forEach(c => handleFeaturedMedia(c, arr))
              }
            }
          }
          // remove style from features
          // replace lone img tags with feature tags
          const imgToFeature = node => {
            let handled = false
            //if (node.nodeName === 'feature') {
            if (node.nodeName === 'figure') {
              handled = true
              let imgNode = node.childNodes.find(d => d.nodeName === 'img')
              let url = imgNode.attrs.find(a => a.name == 'src').value
              if (url !== p.featuredMedia.source_url) {
                return parse5.parseFragment(
                  //`<figure><img src="${url}"/></figure>`
                  `<figure style="background: url(${url});"/>`
                ).childNodes[0]
              }
            }
            if (
              node.nodeName === 'img' &&
              //node.parentNode.nodeName !== 'feature'
              node.parentNode.nodeName !== 'figure'
            ) {
              // lone img tag
              handled = true
              let url = node.attrs.find(a => a.name == 'src').value
              if (url !== p.featuredMedia.source_url) {
                // img is not article's featured image
                return parse5.parseFragment(
                  //`<figure><img src="${url}"/></figure>`
                  `<figure style="background: url(${url});"/>`
                ).childNodes[0]
              }
            }
            if (node.childNodes !== undefined && node.childNodes.length > 0) {
              node.childNodes = node.childNodes
                .map(imgToFeature)
                .filter(d => d !== undefined)
              /*
              let requests = node.childNodes.map((c, i) => {
                return new Promise(resolve => {
                  imgToFeature(c, i, resolve)
                })
              })
              */
            }
            if (!handled) {
              // neither figure nor img, return as-is
              return node
            }
          }
          let node = parse5.parseFragment(p.content.rendered)
          //console.log(parse5.serialize(node))
          let imgs = []
          handleFeaturedMedia(node, imgs)
          p.featuredMedia = {
            source_url: imgs[0]
          }
          node.childNodes = node.childNodes
            .map(imgToFeature)
            .filter(d => d !== undefined)
          // TODO for all paragraphs, pull feature tags from childNodes and insert as sibling
          p.content.rendered = parse5.serialize(node)
          //}
          resolve()
        }
        //let requests = fmids.map((mid, i) => {
        let requests = posts.map((p, i) => {
          return new Promise(resolve => {
            getMedia(p, i, resolve)
          })
        })
        await Promise.all(requests)
        res.json(posts)
      } catch (e) {
        res.status(404).send('error from wordpress')
      }
    })
    app.get('/posts/:slug', cache(cachelife), async (req, res) => {
      try {
        let post = await wp.posts().slug(req.params.slug)
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
