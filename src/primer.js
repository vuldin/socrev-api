const WPAPI = require('wpapi')
const _ = require('lodash')
const constants = require('./constants')
const cache = require('./cache')
const postMod = require('./postMod')
const DOMParser = require('xmldom').DOMParser
const moment = require('moment')

const { cmsApiUrl, cmsApiUser, cmsApiPassword } = constants

const decodeString = string => {
  const dom = new DOMParser().parseFromString(
    `<body>${string}</body>`,
    'text/html'
  )
  return dom.documentElement.firstChild.nodeValue
}

const handlePostMod = async (wp, p, cats) => {
  p = await postMod.getFeatureSrc(p, wp)
  p = await postMod.modCategories(p, cats)
  p = await postMod.modFigure(p)
  //p = await postMod.imgToFigure(p)
  p = await postMod.handleNoFeature(p)
  p = await postMod.removeRepeatImage(p)
  p = await postMod.removeExcerptImage(p)
  p = await postMod.removeExcerptMarkup(p)
  const idstr = `  ${p.id}: `.padEnd(8)
  console.log(`${idstr}${p.slug}`)
  return p
}
const handleCategories = async wp => {
  // categories
  let cats = await wp.categories().perPage(100)
  let parents = []
  let subs = []
  cats.forEach(c => {
    let result = {
      name: decodeString(c.name),
      id: c.id,
      parent: c.parent
    }
    if (c.parent === 0) {
      //console.log(`${c.name}`)
      parents.push(result)
    } else subs.push(result)
  })
  parents.filter(p => p.name !== 'Uncategorized').forEach(p => {
    p.children = subs.filter(s => s.parent === p.id)
    const idstr = `${p.id}: `.padEnd(5)
    console.log(`${idstr}${p.name}`)
    p.children.forEach(c => {
      const cidstr = `  ${c.id}: `.padEnd(7)
      console.log(`${cidstr}${c.name}`)
    })
  })
  //cache.primeCats(parents)
  cache.put('cats', parents)
  return cats
}

module.exports = {
  prime: () => {
    return new Promise((resolve, reject) => {
      WPAPI.discover(cmsApiUrl).then(async wp => {
        wp.auth({
          username: cmsApiUser,
          password: cmsApiPassword,
          auth: true
        })

        let cats = await handleCategories(wp)
        /*
        const handlePostMod = async (p, cats) => {
          p = await postMod.getFeatureSrc(p, wp)
          p = await postMod.modCategories(p, cats)
          p = await postMod.modFigure(p)
          //p = await postMod.imgToFigure(p)
          p = await postMod.handleNoFeature(p)
          p = await postMod.removeRepeatImage(p)
          p = await postMod.removeExcerptImage(p)
          p = await postMod.removeExcerptMarkup(p)
          const idstr = `  ${p.id}: `.padEnd(8)
          console.log(`${idstr}${p.slug}`)
          return p
        }

        // categories
        let cats = await wp.categories().perPage(100)
        let parents = []
        let subs = []
        cats.forEach(c => {
          let result = {
            name: decodeString(c.name),
            id: c.id,
            parent: c.parent
          }
          if (c.parent === 0) {
            //console.log(`${c.name}`)
            parents.push(result)
          } else subs.push(result)
        })
        parents.filter(p => p.name !== 'Uncategorized').forEach(p => {
          p.children = subs.filter(s => s.parent === p.id)
          const idstr = `${p.id}: `.padEnd(5)
          console.log(`${idstr}${p.name}`)
          p.children.forEach(c => {
            const cidstr = `  ${c.id}: `.padEnd(7)
            console.log(`${cidstr}${c.name}`)
          })
        })
        //cache.primeCats(parents)
        cache.put('cats', parents)
        */

        let reqCount = 0
        let allPosts = []
        const getAll = request => {
          reqCount++
          //process.stdout.write(`pages: ${reqCount}\r`)
          console.log(`page: ${reqCount}`)
          return request.then(async response => {
            let posts = await Promise.all(
              response.map(
                p =>
                  new Promise(async (resolve, reject) => {
                    p = await handlePostMod(wp, p, cats)
                    resolve(p)
                  })
              )
            )
            allPosts = allPosts.concat(posts)

            //if (reqCount < 1) {
            if (response._paging && response._paging.next) {
              //console.log('looping getAll')
              await getAll(response._paging.next)
            } else {
              //console.log('leaving getAll')
              return
            }
          })
        }
        await getAll(wp.posts())
        //await getAll(wp.posts().page(169))
        //cache.primePosts(allPosts)
        cache.put('posts', allPosts)
        /*
        //let post = await wp.posts().id(2653)
        //let post = await wp.posts().id(1980)
        post = await handlePostMod(post, cats)
        console.log(post)
        */
        console.log('SUCCESS: ready for requests')
        resolve()
      })
    })
  },
  refresh: async () => {
    const wp = await WPAPI.discover(cmsApiUrl)
    wp.auth({
      username: cmsApiUser,
      password: cmsApiPassword,
      auth: true
    })
    let moreMods = true
    let cats = await handleCategories(wp)

    const handlePostRefresh = async page => {
      console.log('getting modified posts')
      const modPosts = await wp
        .posts()
        .orderby('modified')
        .page(page)
        .perPage(1)
      console.log(`modPosts ${modPosts.length}`)
      let cachedPosts = cache.get('posts')
      console.log(`cachedPosts ${cachedPosts.length}`)
      let didUpdate = false

      for (let i = 0; moreMods && i < modPosts.length; i++) {
        let p = modPosts[i]
        const datePattern = 'YYYY-MM-DDTHH:mm:ss'
        let modDate = moment(p.modified, datePattern)
        const idstr = `  ${p.id}: `.padEnd(8)
        console.log(`${idstr}${p.modified} ${p.slug}`)
        const cPostIndex = cachedPosts.findIndex(cPost => cPost.id === p.id)
        if (cPostIndex > -1) {
          let cPost = cachedPosts[cPostIndex]
          let cachedDate = moment(cPost.modified, datePattern)
          if (modDate.isAfter(cachedDate)) {
            didUpdate = true
            console.log(`    UPDATED`)
            p = await handlePostMod(wp, p, cats)
            cachedPosts[cPostIndex] = p
          } else {
            moreMods = false
            console.log(`    NOT UPDATED`)
          }
        } else {
          //moreMods = false
          console.log(`    NOT FOUND`)
          didUpdate = true
          p = await handlePostMod(wp, p, cats)
          cachedPosts[cPostIndex] = p
        }
      }
      if (didUpdate) {
        console.log('updating cache')
        cache.put('posts', cachedPosts)
      } else console.log('no updates')
    }
    for (let i = 1; moreMods; i++) {
      await handlePostRefresh(i)
    }
  }
}
