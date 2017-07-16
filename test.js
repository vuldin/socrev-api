const WPAPI = require('wpapi')
const apiPromise = WPAPI.discover('https://wp.socialistrevolution.org/wp-json').then(site => {
  return site.auth({
    username: 'sradmin',
    password: '@3HvQ,({4u?2Zx7XH2fm'
  })
})
apiPromise.then(async site => {
  let posts = await wp.posts()
  console.log(posts)
})
