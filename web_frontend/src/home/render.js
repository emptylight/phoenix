var mercury     = require('mercury')
var h           = require('mercury').h
var util        = require('../../../lib/util')
var valueEvents = require('../lib/value-events')
var widgets     = require('../lib/widgets')
var comren      = require('../lib/common-render')
var com         = require('../lib/com')
var widgets     = require('../lib/widgets')

module.exports = render

// Layout
// ======

function render(state) {
  var page
  if (state.route == 'network') {
    page = networkPage(state)
  } else if (state.route.indexOf('profile/') === 0) {
    var profid = state.route.slice(8)
    page = profilePage(state, profid)
  } else if (state.route.indexOf('msg/') === 0) {
    var msgid = state.route.slice(4)
    page = messagePage(state, msgid)
  } else {
    page = feedPage(state)
  }

  return h('.homeapp', { 'style': { 'visibility': 'hidden' } }, [
    stylesheet('/css/home.css'),
    mercury.partial(com.suggestBox, state.suggestBox),
    mercury.partial(header, state.events, state.user.idStr),
    mercury.partial(comren.connStatus, state.events, state.conn),
    h('.container-fluid', page)
  ])
}

function header(events, uId) {
  return h('.nav.navbar.navbar-default', [
    h('.container-fluid', [
      h('.navbar-header', h('a.navbar-brand', { href: '#/' }, 'phoenix')),
      h('ul.nav.navbar-nav', [
        h('li', a('#/', 'latest')),
        h('li', a('#/profile/' + uId, 'profile')),
        h('li', a('#/network', 'network'))
      ]),
      h('ul.nav.navbar-nav.navbar-right', [
        h('li', a('#', 'your intro token', { 'ev-click': valueEvents.click(events.showIntroToken, { id: uId }, { preventDefault: true }) }))
      ])
    ])
  ])
}

// Feed Page
// =========

function feedPage(state) {
  var events = state.feed.filter(function(msg) { return msg.type != 'text' && !msg.message.repliesTo })
  var texts = state.feed.filter(function(msg) { return msg.type == 'text' })
  return h('.feed-page.row', comren.columns({
    left: [comren.feed(state, events, state.pagination)],
    main: [comren.publishForm(state.publishForms[0], state.events, state.user, state.nicknameMap), comren.feed(state, texts, state.pagination)],
    right: [feedControls(state), mercury.partial(notifications, state.nicknameMap, state.events, state.notifications)]
  }, [['left', 3], ['main', 5], ['right', 4]]))
}

function feedControls(state) {
  var events = state.events
  var lastSync = state.lastSync
  return h('.feed-ctrls', [
    h('p', 'Last synced '+((lastSync) ? util.prettydate(lastSync, true) : '---')),
    h('p', [
      comren.syncButton(events, state.isSyncing),
      ' ',
      h('button.btn.btn-default', {'ev-click': events.addFeed}, 'Add feed...')
    ])
  ])
}

function notifications(nicknameMap, events, notes) {
  return h('table.table.table-hover.notifications', h('tbody', notes.map(notification.bind(null, nicknameMap, events)).reverse()))
}

function notification(nicknameMap, events, note) {
  return h('tr', { 'ev-click': valueEvents.click(events.openMsg, { idStr: note.msgIdStr }, { preventDefault: true }) }, [
    h('td', note.authorNickname),
    h('td', new widgets.Markdown(note.msgText, { inline: true, nicknames: nicknameMap }))
  ])
}



// Profile Page
// ============

function profilePage(state, profid) {
  var profi = state.profileMap[profid]
  var profile = (typeof profi != 'undefined') ? state.profiles[profi] : undefined
  if (!profile) {
    return h('.profile-page.row', [
      h('.col-xs-7', [comren.notfound('that user')])
    ])
  }
  return h('.profile-page.row', comren.columns({
    gutter: [],
    main: [comren.feed(state, profile.feed, state.pagination, true)],
    side: [mercury.partial(profileControls, state.events, profile)]
  }, [['gutter', 1], ['main', 6], ['side', 3]]))
}

function profileControls(events, profile) {
  var followBtn = (profile.isFollowing) ?
    h('button.btn.btn-default', {'ev-click': valueEvents.click(events.unfollow,  { id: profile.idStr })}, 'Unfollow') :
    h('button.btn.btn-default', {'ev-click': valueEvents.click(events.follow,  { id: profile.idStr })}, 'Follow')
  return h('.profile-ctrls', [
    h('.panel.panel-default', h('.panel-body', h('h2', [profile.nickname, ' ', h('small', 'joined '+profile.joinDate)]))),
    h('p', followBtn),
    h('p', a('#', 'Intro Token', { 'ev-click': valueEvents.click(events.showIntroToken, { id: profile.idStr }, { preventDefault: true }) }))
  ])
}

// Message Page
// ============

function messagePage(state, msgid) {
  // lookup the main message
  var msgi = state.messageMap[msgid]
  var msg = (typeof msgi != 'undefined') ? state.feed[state.feed.length - msgi - 1] : undefined
  if (!msg) {
    return h('.message-page.row', [
      h('.col-xs-7', [comren.notfound('that message')])
    ])
  }

  // render
  return h('.message-page.row', comren.columns({
    left: [],
    main: comren.msgThread(state, msg)
  }, [['left', 1], ['main', 6]]))
}

// Network Page
// ============

function networkPage(state) {
  return h('.network-page.row', comren.columns({
    gutter: [],
    col1: h('.panel.panel-default', [
      h('.panel-heading', h('h3.panel-title', [
        'Following',
        h('button.btn.btn-default.btn-xs.pull-right', {'ev-click': state.events.addFeed}, 'add')
      ])),
      h('.panel-body', profileLinks(state.events, state.profiles.filter(isFollowing)))
    ]),
    col2: h('.panel.panel-default', [
      h('.panel-heading', h('h3.panel-title', 'Followers')),
      h('.panel-body', '')
    ]),
    col3: h('.panel.panel-default', [
      h('.panel-heading', h('h3.panel-title', [
        'Known Servers',
        h('button.btn.btn-default.btn-xs.pull-right', {'ev-click': state.events.addServer}, 'add')
      ])),
      h('.panel-body', serverLinks(state.events, state.servers))
    ])
  }, [['gutter', 1], ['col1', 2], ['col2', 2], ['col3', 2]]))
}

function isFollowing(p) { return p.isFollowing }

function serverLinks(events, servers) {
  return h('.servers', servers.map(serverLink.bind(null, events)))
}

function serverLink(events, server) {
  return h('h3', [
    a(server.url, server.hostname),
    h('button.btn.btn-default.btn-xs.pull-right', {'ev-click': valueEvents.click(events.removeServer, { hostname: server.hostname, port: server.port })}, 'remove')
  ])
}

function profileLinks(events, profiles) {
  return profiles.map(profileLink.bind(null, events))
}

function profileLink(events, profile) {
  return h('h3', [
    a('/#/profile/'+profile.idStr, profile.nickname || '???'),
    h('button.btn.btn-default.btn-xs.pull-right', {'ev-click': valueEvents.click(events.unfollow, { id: profile.id })}, 'remove')
  ])
}

// Helpers
// =======

function stylesheet(href) {
  return h('link', { rel: 'stylesheet', href: href })
}
function a(href, text, opts) {
  opts = opts || {}
  opts.href = href
  return h('a', opts, text)
}
function img(src) {
  return h('img', { src: src })
}