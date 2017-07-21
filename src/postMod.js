const parse5 = require('parse5')

const figure = url => {
  //let result = `<figure style="background: url(${url})"/>`
  let result = `<figure><img src="${url}"/></figure>`
  return result
}

module.exports = {
  getFeatureSrc: async (post, wp) => {
    // replace non-zero feature_media id with object containing source_url
    if (post.featured_media > 0) {
      const m = await wp.media().id(post.featured_media)
      post.featured_media = {
        source_url: m.source_url,
        media_details: m.media_details
      }
    }
    return post
  },
  modFigure: async post => {
    // replace figures with normalized figure
    const node = parse5.parseFragment(post.content.rendered)
    const loop = node => {
      let handled = false
      if (node.nodeName === 'figure') {
        handled = true
        const imgNode = node.childNodes.find(d => d.nodeName === 'img')
        const url = imgNode.attrs.find(a => a.name == 'src').value
        return parse5.parseFragment(figure(url)).childNodes[0]
      }
      if (node.childNodes !== undefined && node.childNodes.length > 0) {
        node.childNodes = node.childNodes.map(loop).filter(d => d !== undefined)
      }
      if (!handled) {
        // neither figure nor img, return as-is
        return node
      }
    }
    node.childNodes = node.childNodes.map(loop).filter(d => d !== undefined)
    post.content.rendered = parse5.serialize(node)
    return post
  },
  imgToFigure: async post => {
    // replace img with normalized figure
    const node = parse5.parseFragment(post.content.rendered)
    const loop = node => {
      let handled = false
      if (node.nodeName === 'img' && node.parentNode.nodeName !== 'figure') {
        handled = true
        const url = node.attrs.find(a => a.name == 'src').value
        return parse5.parseFragment(figure(url)).childNodes[0]
      }
      if (node.childNodes !== undefined && node.childNodes.length > 0) {
        node.childNodes = node.childNodes.map(loop).filter(d => d !== undefined)
      }
      if (!handled) {
        // neither figure nor img, return as-is
        return node
      }
    }
    node.childNodes = node.childNodes.map(loop).filter(d => d !== undefined)
    post.content.rendered = parse5.serialize(node)
    return post
  },
  handleNoFeature: async post => {
    if (post.featured_media === 0) {
      const node = parse5.parseFragment(post.content.rendered)
      const loop = (node, arr) => {
        if (node.nodeName === 'iframe') {
          //if (post.slug === 'new-site') console.log(node.nodeName)
          url = node.attrs.find(a => a.name == 'src').value
          arr.push(url)
        }
        if (node.nodeName === 'figure') {
          const imgNode = node.childNodes.find(d => d.nodeName === 'img')
          let url
          if (imgNode !== undefined) {
            // figure has child img
            url = imgNode.attrs.find(a => a.name == 'src').value
          } else {
            // figure has background style
            url = node.attrs.find(d => d.name === 'style').value
            url = url.replace('background: url(', '')
            url = url.slice(0, -2)
          }
          arr.push(url)
        }
        if (node.nodeName === 'img' && node.parentNode.nodeName !== 'figure') {
          const url = node.attrs.find(a => a.name == 'src').value
          arr.push(url)
        }
        if (node.childNodes !== undefined && node.childNodes.length > 0) {
          node.childNodes.forEach(c => loop(c, arr))
        }
      }
      let imgs = []
      loop(node, imgs)
      if (imgs.length > 0) {
        let media = {
          source_url: imgs[0]
        }
        // TODO handle other video sources and check for video extension
        if (imgs[0].includes('youtube'))
          media = {
            video: true,
            source_url: imgs[0]
          }
        post.featured_media = media
      }
    }
    return post
  },
  removeRepeatImage: async post => {
    const node = parse5.parseFragment(post.content.rendered)
    const loop = node => {
      let handled = false
      if (node.nodeName === 'iframe') {
        const url = node.attrs.find(a => a.name == 'src').value
        let result
        if (url === post.featured_media.source_url) {
          result = '<span/>'
        } else result = node
        return result
      }
      if (node.nodeName === 'figure') {
        handled = true
        const imgNode = node.childNodes.find(d => d.nodeName === 'img')
        const url = imgNode.attrs.find(a => a.name == 'src').value
        let result
        if (url === post.featured_media.source_url) {
          result = '<span/>'
        } else result = node
        return result
      }
      if (node.nodeName === 'img' && node.parentNode.nodeName !== 'figure') {
        handled = true
        const url = node.attrs.find(a => a.name == 'src').value
        let result
        if (url === post.featured_media.source_url) {
          result = '<span/>'
        } else result = node
        return result
      }
      if (node.childNodes !== undefined && node.childNodes.length > 0) {
        node.childNodes = node.childNodes.map(loop).filter(d => d !== undefined)
      }
      if (!handled) {
        // neither figure nor img, return as-is
        return node
      }
    }
    node.childNodes = node.childNodes.map(loop).filter(d => d !== undefined)
    post.content.rendered = parse5.serialize(node)
    return post
  },
  removeExcerptImage: async post => {
    const node = parse5.parseFragment(post.excerpt.rendered)
    const loop = node => {
      let handled = false
      if (node.nodeName === 'figure' || node.nodeName === 'img') {
        handled = true
        return '<span/>'
      }
      if (node.childNodes !== undefined && node.childNodes.length > 0) {
        node.childNodes = node.childNodes.map(loop).filter(d => d !== undefined)
      }
      if (!handled) {
        // neither figure nor img, return as-is
        return node
      }
    }
    node.childNodes = node.childNodes.map(loop).filter(d => d !== undefined)
    post.excerpt.rendered = parse5.serialize(node)
    return post
  },
  removeExcerptMarkup: async post => {
    let node = parse5.parseFragment(post.excerpt.rendered)
    //post.excerpt.rendered = node.childNodes[0].childNodes[0].value
    if (node.childNodes !== undefined && node.childNodes.length > 0)
      node = node.childNodes[0]
    if (node.childNodes !== undefined && node.childNodes.length > 0)
      node = node.childNodes[0]
    if (node.value !== undefined) post.excerpt.rendered = node.value
    return post
  }
}
