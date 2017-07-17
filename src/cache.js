const mcache = require('memory-cache')

let pageKeys = []

module.exports = {
  cache: duration => {
    return (req, res, next) => {
      let url = req.url
      let originalUrl = req.originalUrl
      let slug = req.params.slug
      let allowSet = true
      let key = '__express__' + originalUrl || url
      //if (url.match(/\/posts\/[a-z-0-9]*$/g)) {
      if (url.match(/\/posts\/[a-z0-9]+([-.]?[a-z0-9])*/g)) {
        // TODO test new slug regex http://regexr.com/
        // this new regex may not be correct if it must match both /posts and /posts/slug
        allowSet = false
        key = '__express__/posts'
      }
      if (url === '/posts') {
        // change key for /posts to /posts?page=1
        key = '__express__/posts?page=1'
      }
      if (key.includes('__express__/posts?page=')) {
        // is page request, add key to pageKeys
        pageKeys.push(key)
      }
      let cachedBody = []
      if (key === '__express__/posts') {
        pageKeys.forEach(k => (cachedBody = cachedBody.concat(mcache.get(k))))
      } else cachedBody = mcache.get(key)
      if (cachedBody) {
        if (slug) {
          const post = cachedBody.find(d => d.slug === slug)
          res.json(post)
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
  },
  clear: () => mcache.clear()
}
