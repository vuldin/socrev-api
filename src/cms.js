const request = require('superagent')
const store = require('./store')
const { wpUrl } = store

module.exports = (app, checkJwt, checkScopes) => {
  app.get('/posts', async (req, res) => {
    const postsRes = await request.get(`${wpUrl}/posts`)
    let posts = JSON.parse(postsRes.text)
    res.json(posts)
  })

  app.get('/users', checkJwt, checkScopes, async (req, res) => {
    const usersRes = await request.get(`${wpUrl}/users`)
    let users = JSON.parse(usersRes.text)
    res.json(users)
  })

  app.get('/categories', async (req, res) => {
    const categoriesRes = await request.get(`${wpUrl}/categories`)
    console.log(categoriesRes)
    let categories = JSON.parse(categoriesRes.text)
    res.json(categories)
  })
}
