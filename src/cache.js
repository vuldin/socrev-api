const mcache = require('memory-cache')

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
  },
  clear: () => mcache.clear()
}
