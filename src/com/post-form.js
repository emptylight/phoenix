var h = require('hyperscript')
var suggestBox = require('suggest-box')
var util = require('../lib/util')
var markdown = require('../lib/markdown')

module.exports = function (app, parent) {

  // markup

  var textarea = h('textarea.form-control', { name: 'text', rows: 6, onblur: preview })
  suggestBox(textarea, app.suggestOptions) // decorate with suggestbox 

  var preview = h('.preview')
  var form = h('form.post-form' + ((!!parent) ? '.reply-form' : ''), { onsubmit: post },
    h('p', textarea),
    h('p.post-form-btns', h('button.btn.btn-primary.pull-right', 'Post'), h('button.btn.btn-primary', { onclick: cancel }, 'Cancel')),
    h('.preview-wrapper.panel.panel-default',
      h('.panel-heading', h('small', 'Preview:')),
      h('.panel-body', preview)
    )
  )

  // handlers

  function preview (e) {
    preview.innerHTML = markdown.block(util.escapePlain(textarea.value), app.api.getNames())
  }

  function post (e) {
    e.preventDefault()

    // prep text
    var text = textarea.value
    text = replaceMentions(text)

    // post
    if (parent) app.api.postReply(text, parent, done)
    else app.api.postText(text, done)
      
    function done (err) {
      if (err) swal('Error While Publishing', err.message, 'error')
      else {
        if (parent)
          app.refreshPage()
        else
          window.location.hash = '#/'
      }
    }
  }

  // find any mentions and replace the nicknames with ids
  var mentionRegex = /(\s|>|^)@([^\s^<]+)/g;
  function replaceMentions(str) {
    return str.replace(mentionRegex, function(full, $1, $2) {
      var id = app.api.getIdByName($2)
      if (!id) return full
      return ($1||'') + '@' + id
    })
  }

  function cancel (e) {
    e.preventDefault()
    if (parent)
      form.parentNode.removeChild(form)
    else
      window.location.hash = '#/'
  }

  return form
}