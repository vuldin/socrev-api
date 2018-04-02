const express = require('express')
const app = express()
const cors = require('cors')
const dotenv = require('dotenv')
const io = require('socket.io-client')
//const mcache = require('memory-cache')

app.use(cors())
dotenv.config()
const port = process.env.PORT
const dbCtrlUrl = process.env.DB_CTRL_URL
let posts = []
let cats = []
let emitInit = true // have data and endpoints been initialized?
const socket = io.connect(dbCtrlUrl, { reconnection: true })

console.log(`waiting to connect to ${dbCtrlUrl}...`)
socket.on('connect', () => {
  console.log('connected to dbCtrl...')
  if (emitInit) {
    // only emit init if we have not already done so at some point
    emitInit = false
    console.log('emitting to init...')
    socket.emit('init', 'msg from api', data => {
      console.log('initial records received from dbCtrl')
      posts = data.posts.filter(d => d.status === 'publish')
      cats = data.cats

      app.get('/posts', cache())
      app.get('/posts/:slug', cache())
      app.get('/categories', cache())

      const server = app.listen(port, () =>
        console.log(`> ready on ${server.address().port}`)
      )
    })
  }
})

const cache = duration => {
  return (req, res, next) => {
    let url = req.url
    if (url.includes('posts')) {
      //const key = 'posts'
      const slug = req.params.slug
      const page = req.query.page !== undefined ? parseInt(req.query.page) : 1
      const cat = req.query.category
      const status =
        req.query.status !== undefined ? req.query.status : 'publish'
      const isCount = req.query.count === 'true'
      //let result = mcache.get('posts')
      let result = posts
      let left = result.length
      if (slug) {
        result = result.find(d => d.slug === slug)
        left = 0
        //if (result) console.log(`cached post ${result.slug}`)
      } else {
        //console.log(`cached posts length: ${result.length}`)
        if (cat) {
          result = result.filter(d => {
            let isOfCategory = false
            if (d.categories.find(c => c.slug === cat) !== undefined)
              isOfCategory = true
            return isOfCategory
          })
          //left = result.length
        }
        if (status) {
          result = result.filter(d => d.status === status)
          //left = result.length
        }
        left = result.length
        if (page) {
          //console.log(`page ${page}`)
          // requests without a category are for the front page
          // this returns 13 on a page1 front page request
          // and return 12 for a page1 category/search request, and all other pages
          let firstPageSize = 13
          if (cat) firstPageSize = 12
          left = left - firstPageSize
          if (page === 1) {
            result = result.slice(0, 0 + firstPageSize)
          } else {
            const offset = firstPageSize + 12 * (page - 2)
            result = result.slice(offset, offset + 12)
            left = left - 12 * (page - 2) - result.length
          }
        }
      }
      //result = result.slice(0, 100) // limit return to 100 posts
      if (left < 0) left = 0
      if (isCount)
        res.json({
          postsLeft: left,
        })
      else res.json(result)
    }
    if (url.includes('categories')) {
      //const cats = mcache.get('cats')
      res.json(cats)
    }
    return next()
  }
}
