var mercury     = require('mercury')
var h           = require('mercury').h
var valueEvents = require('../value-events')
var widgets     = require('../widgets')
var comren      = require('../common-render')
var util        = require('../util')
var publishForm = require('./publish-form').publishForm

// helpers to lookup messages
function lookup(messages, messageMap, entry) {
  var msgi  = messageMap[entry.id]
  return (typeof msgi != 'undefined') ? messages[messages.length - msgi - 1] : null
}
function lookupAll(messages, messageMap, index) {
  if (!index || !index.length) return []
  return index.map(lookup.bind(null, messages, messageMap))
}

// feed message renderer
// - `msg`: message object to render
// - `feedView`: app state object
// - `events`: app state object
// - `user`: app state object
// - `nicknameMap`: app state object
// - `isTopRender`: bool, is the message the topmost being rendered now, regardless of its position in the thread?
var message = exports.message = function(msg, feedView, events, user, nicknameMap, isTopRender) {
  var publishFormMap = feedView.publishFormMap
  var publishForms = feedView.publishForms

  // main content
  var main
  switch (msg.isViewRaw ? 'raw' : msg.content.type) {
    case 'init': main = messageEvent(msg, 'account-created', 'account created', nicknameMap, user, events); break
    case 'profile': main = messageEvent(msg, 'account-change', 'is now known as ' + msg.content.nickname, nicknameMap, user, events); break
    case 'follow': main = messageFollow(msg, nicknameMap, user, events); break
    case 'post':
      var parentMsg = (isTopRender && msg.repliesToLink) ? lookup(feedView.messages, feedView.messageMap, { id: msg.repliesToLink.msg }) : null
      if (msg.content.postType == 'action')
        main = messageEvent(msg, (msg.repliesToLink) ? 'reaction' : 'action', msg.content.text, nicknameMap, user, events)
      else
        main = messageText(msg, user, events, parentMsg, feedView.messages, feedView.messageMap, feedView.replies[msg.id], feedView.rebroadcasts[msg.id], nicknameMap)
      break
    case 'pub': main = messageEvent(msg, 'pub', 'announced a public server at '+msg.content.address.host, nicknameMap, user, events); break
    default:
      // unknown type
      main = messageRaw(msg, user, events, parentMsg, feedView.messages, feedView.messageMap, feedView.replies[msg.id], feedView.rebroadcasts[msg.id], nicknameMap)
  }

  // reply/react form
  if (typeof publishFormMap[msg.id] != 'undefined') {
    var i = publishFormMap[msg.id]
    main = h('div', [main, h('.message-reply', publishForm(publishForms[i], events, user, nicknameMap))])
  }

  // known type? render with view raw toggle
  var isKnown = ~['init','profile','follow','post','pub'].indexOf(msg.content.type)
  return h('.message-wrapper', [
    (isKnown) ?
      h('a.glyphicon.glyphicon-cog.text-muted', {href:'javascript:undefined', title: 'View Raw', 'ev-click': valueEvents.click(events.toggleViewRaw, { id: msg.id })}) :
      '',
    main
  ])
}

// message text-content renderer
var messageText = exports.messageText = function(msg, user, events, parentMsg, messages, messageMap, replies, rebroadcasts, nicknameMap) {
  var content = new widgets.Markdown(msg.content.text, { nicknames: nicknameMap })
  return renderMsgShell(content, msg, user, events, parentMsg, messages, messageMap, replies, rebroadcasts, nicknameMap)
}

// message gui-content renderer
var messageGui = exports.messageGui = function(msg, user, events, parentMsg, messages, messageMap, replies, rebroadcasts, nicknameMap) {
  var content
  if (msg.isRunning) {
    content = h('.gui-post-wrapper.gui-running', [
      new widgets.IframeSandbox(msg.content.text, msg.id, replies, events.onGuipostReply)
    ])
  } else {
    content = h('.gui-post-wrapper', [
      h('.gui-post-runbtn', {'ev-click': valueEvents.click(events.runMsgGui, { id: msg.id, run: true })}),
      h('pre.gui-post', h('code',msg.content.text))
    ])
  }

  // body
  return renderMsgShell(content, msg, user, events, parentMsg, messages, messageMap, replies, rebroadcasts, nicknameMap)
}

var messageRaw = exports.messageRaw = function(msg, user, events, parentMsg, messages, messageMap, replies, rebroadcasts, nicknameMap) {
  var json = util.escapePlain(JSON.stringify(msg.content, null, 2))

  // turn feed references into links
  json = json.replace(/\"feed\": \"([^\"]+)\"/g, function($0, $1) {
    var nick = nicknameMap[$1] || $1
    return '"feed": "<a class="user-link" href="/#/profile/'+$1+'">'+nick+'</a>"'
  })

  // turn message references into links
  json = json.replace(/\"msg\": \"([^\"]+)\"/g, function($0, $1) {
    return '"msg": "<a href="/#/msg/'+$1+'">'+$1+'</a>"'
  })

  var content = h('.phoenix-raw', { innerHTML: json })
  return renderMsgShell(content, msg, user, events, parentMsg, messages, messageMap, replies, rebroadcasts, nicknameMap)
}

// renders message with the header and footer
function renderMsgShell(content, msg, user, events, parentMsg, messages, messageMap, replies, rebroadcasts, nicknameMap) {
  replies = lookupAll(messages, messageMap, replies)
  rebroadcasts = lookupAll(messages, messageMap, rebroadcasts)

  var replyStr = renderMsgReplies(msg, replies)
  var reactionsStr = renderMsgReactions(replies, nicknameMap, user, events)
  var rebroadcastsStr = renderMsgRebroadcasts(rebroadcasts, nicknameMap, user, events)

  var parentHeader
  if (parentMsg) {
    var parentMsgLabel
    if (parentMsg.content.text)
      parentMsgLabel = new widgets.Markdown(comren.firstWords(parentMsg.content.text, 5), { nicknames: nicknameMap, inline: true })
    else
      parentMsgLabel = (parentMsg.id)
    parentHeader = h('.panel-heading', [
      're: ', comren.a('#/msg/'+parentMsg.id, parentMsgLabel)
    ])
  }

  return h('.panel.panel-default', [
    parentHeader,
    h('.panel-body', [
      renderMsgHeader(msg, user, events, nicknameMap),
      content,
      (events.replyToMsg && events.reactToMsg && events.shareMsg)
          ? (h('p', [
            h('small.message-ctrls', [
              replyStr,
              h('span.pull-right', [
                comren.jsa(comren.icon('comment'), events.replyToMsg, { msg: msg }, { title: 'Reply' }),
                ' ',
                comren.jsa(comren.icon('retweet'), events.shareMsg, { msg: msg }, { title: 'Share' })
              ])
            ]),
          ]))
          : ''
    ]),
    (reactionsStr.length || rebroadcastsStr.length)
      ? h('.panel-footer', h('small', [reactionsStr, ' ', rebroadcastsStr]))
      : ''
  ])
}

// message header
function renderMsgHeader(msg, user, events, nicknameMap) {
  var stopBtnStr = (msg.isRunning) ? comren.jsa(comren.icon('remove'), events.runMsgGui, { id: msg.id, run: false }, { className: 'text-danger pull-right', title: 'Close GUI' }) : ''

  if (msg.rebroadcastsLink) {
    // duplicated message
    return h('p', [
      comren.userlink(author, nicknameMap[msg.rebroadcastsLink.feed], user, events),
      h('small.message-ctrls', [
        ' - ',
        util.prettydate(new Date(msg.rebroadcastsLink.timestamp||0), true)
      ]),
      h('span.repliesto', [' shared by ', comren.userlink(msg.author, nicknameMap[msg.author], user, events)]),
      stopBtnStr
    ])
  }

  // normal message
  return h('p', [
    comren.userlink(msg.author, nicknameMap[msg.author], user, events),
    ' ', h('span', { innerHTML: comren.toEmoji(msg.author.slice(0,16), 12) }),
    h('small.message-ctrls', [
      ' - ',
      comren.a('#/msg/'+msg.id, util.prettydate(new Date(msg.timestamp), true), { title: 'View message thread' })
    ]),
    stopBtnStr
  ])
}

// summary of reactions in the bottom of messages
function renderMsgReplies(msg, replies) {
  var nReplies = (replies) ? replies.filter(function(r) { return r.content.type == 'post' && (r.content.postType == 'text' || r.content.postType == 'gui') }).length : 0
  return (nReplies) ? comren.a('#/msg/'+msg.id, nReplies + ' replies') : ''
}

// list of reactions in the footer of messages
function renderMsgReactions(replies, nicknameMap, user, events) {
  reactionsStr = []
  var reactMap = {}
  // create a map of reaction-text -> author-nicknames
  ;(replies || []).forEach(function(reply) {
    if (reply && reply.content.postType == 'action') {
      var react = ''+reply.content.text
      if (!reactMap[react])
        reactMap[react] = []
      if (notYetAdded(reactMap[react], reply))
        reactMap[react].push({ id: reply.author, nick: nicknameMap[reply.author] })
    }
  })
  function notYetAdded(list, reply) { // helper to remove duplicate reactions by a user
    var nick = nicknameMap[reply.author]
    return list.filter(function(r) { return r.nick == nick }).length === 0
  }
  // render the list of reactions
  for (var react in reactMap) {
    // add separators
    if (reactionsStr.length)
      reactionsStr.push(', ')

    // generate the "bob and N others ___ this" phrase
    var reactors = reactMap[react]
    var str = [comren.userlink(reactors[0].id, reactors[0].nick, user, events)]
    if (reactors.length > 1) {
      var theOthers = reactors.slice(1).map(function(r) { return r.nick })
      str.push(h('a', { href: 'javascript:void()', title: theOthers.join(', ') }, ' and ' + theOthers.length + ' others'))
    }
    str.push(new widgets.Markdown(' ' + react.trim(), { nicknames: nicknameMap, inline: true }))
    str.push(' this')
    reactionsStr.push(str)
  }
  if (reactionsStr.length) reactionsStr.push('.')
  return reactionsStr
}

// list of rebroadcasts in the footer of messages
function renderMsgRebroadcasts(rebroadcasts, nicknameMap, user, events) {
  var rebroadcastsStr = []
  if (rebroadcasts.length) {
    rebroadcasts = onePerAuthor(rebroadcasts)
    rebroadcastsStr.push(comren.userlink(rebroadcasts[0].author, nicknameMap[rebroadcasts[0].author], user, events))
    if (rebroadcasts.length > 1) {
      var theOthers = rebroadcasts.slice(1).map(function(r) { return nicknameMap[r.author] })
      rebroadcastsStr.push(h('a', { href: 'javascript:void()', title: theOthers.join(', ') }, ' and ' + theOthers.length + ' others'))
    }
    rebroadcastsStr.push(' shared this.')
  }
  function onePerAuthor(list) {
    // helper to reduce the list of messages to 1 per author
    var ids = {}
    return list.filter(function(msg) {
      if (!ids[msg.author]) {
        ids[msg.author] = 1
        return true
      }
      return false
    })
  }
  return rebroadcastsStr
}

// message event-content renderer
var messageEvent = exports.messageEvent = function(msg, type, text, nicknameMap, user, events) {
  var parentLink = ''
  if (msg.repliesToLink) {
    var id = msg.repliesToLink.msg
    parentLink = comren.a('#/msg/'+id, id)
  }

  return h('.phoenix-event', [
    h('p.event-body', [
      comren.userlink(msg.author, nicknameMap[msg.author], user, events),
      new widgets.Markdown(' ' + text, { inline: true, nicknames: nicknameMap }),
      ' ',
      parentLink
    ])
  ])
}

var messageFollow = exports.messageFollow = function(msg, nicknameMap, user, events) {
  var target = msg.content.feed
  var targetNickname = nicknameMap[target] || comren.shortString(target)
  var action = (msg.content.rel == 'unfollows') ? ' unfollowed ' : ' followed '

  return h('.phoenix-event', [
    h('p.event-body', [
      comren.userlink(msg.author, nicknameMap[msg.author], user, events),
      action,
      comren.userlink(target, targetNickname, user, events)
    ])
  ])
}