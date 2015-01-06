var com = require('../com')
var util = require('../../lib/util')
var markdown = require('../../lib/markdown')

exports.newad = function(state, el, e) {
  var form = el.parentNode.parentNode
  form.classList.add('opened')
}

exports.cancelAdvert = function(state, el, e) {
  var form = el.parentNode.parentNode.parentNode
  form.reset()
  form.querySelector('.preview').innerHTML = ''
  form.classList.remove('opened')
}

exports.submit = function(state, el, e) {
  var form = (el.tagName == 'FORM') ? el : el.form
  var text = form.text.value

  state.apis.feed.postAdvert(text, function (err) {
    if (err) swal('Error While Publishing', err.message, 'error')
    else {
      swal('Your Ad Has Been Published', null, 'success')
      form.reset()
      form.querySelector('.preview').innerHTML = ''
      form.classList.remove('opened')
      state.sync()
    }
  })
}

exports.preview = function(state, el, e) {
  var form = (el.tagName == 'FORM') ? el : el.form
  var text = form.text.value

  var previewEl = form.querySelector('.preview')
  previewEl.innerHTML = markdown.block(util.escapePlain(text), state.names)
}