const WPAPI = require('wpapi')
const request = require('superagent')
const { JSDOM } = require('jsdom')
const CircularJSON = require('circular-json')
const store = require('./store')

const { cmsApiUrl, cmsApiUser, cmsApiPassword } = store
module.exports = (app, checkJwt, checkScopes) => {
  WPAPI.discover(cmsApiUrl).then(wp => {
    wp.auth({
      username: cmsApiUser,
      password: cmsApiPassword,
      auth: true
    })
    app.get('/posts', async (req, res) => {
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
    app.get('/posts/:id', async (req, res) => {
      try {
        let post = await wp.posts().id(req.params.id)
        res.json(post)
      } catch (e) {
        res.status(404).send('error from wordpress')
      }
    })
    app.get('/categories', async (req, res) => {})
  })
}
