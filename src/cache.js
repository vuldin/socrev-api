const mcache = require('memory-cache')

module.exports = {
  put: (str, obj) => {
    return mcache.put(str, obj)
  },
  get: str => {
    return mcache.get(str)
  },
  cache: duration => {
    return (req, res, next) => {
      let url = req.url
      if (url.includes('posts')) {
        const key = 'posts'
        const slug = req.params.slug
        const page = parseInt(req.query.page)
        const cat = parseInt(req.query.category)
        let result = mcache.get('posts')
        if (slug) {
          result = result.find(d => d.slug === slug)
          //if (result) console.log(`cached post ${result.slug}`)
        } else {
          //console.log(`cached posts length: ${result.length}`)
          if (cat) {
            result = result.filter(d => {
              let isOfCategory = false
              if (d.categories.find(c => c.id === cat) !== undefined)
                isOfCategory = true
              return isOfCategory
            })
          }
          if (page) {
            //console.log(`page ${page}`)
            // requests without a category are for the front page
            // this returns 13 on a page1 front page request
            // and return 12 for a page1 category/search request, and all other pages
            let firstPageSize = 13
            if (cat) firstPageSize = 12
            if (page === 1) {
              result = result.slice(0, 0 + firstPageSize)
            } else {
              const offset = firstPageSize + 12 * (page - 2)
              result = result.slice(offset, offset + 12)
            }
          }
        }
        //result = result.slice(0, 100) // limit return to 100 posts
        res.json(result)
      }
      if (url.includes('categories')) {
        const cats = mcache.get('cats')
        //console.log(`cached categories ${cats.length}`)
        res.json(cats)
      }
      return next()
    }
  },
  clear: () => mcache.clear()
}
