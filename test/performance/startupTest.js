/* global describe, it, beforeEach, afterEach */

const Immutable = require('immutable')
const Brave = require('../lib/brave')
const profilerUtil = require('../lib/profilerUtil')
const {urlInput} = require('../lib/selectors')
const {topSites} = require('../../app/common/data/topSites')

describe('Performance startup', function () {
  Brave.beforeAllServerSetup(this)

  function * setup () {
    yield Brave.startApp()
    Brave.addCommands()
    yield Brave.app.client
      .waitForUrl(Brave.newTabUrl)
      .waitForBrowserWindow()
  }

  function * restart () {
    yield Brave.stopApp(false)
    // XXX Wait for Brave to fully shutdown and free up inspect port 9222
    yield Brave.app.client.pause(1000)
    yield setup()
  }

  beforeEach(function * () {
    this.url = Brave.server.url('page1.html')
    yield setup()
  })

  afterEach(function * () {
    yield Brave.stopApp()
  })

  function * runStory () {
    yield Brave.app.client
      .waitForBrowserWindow()
      .waitForUrl(Brave.newTabUrl)
      .windowByUrl(Brave.browserWindowUrl)
      .ipcSend('shortcut-focus-url')
      .waitForVisible(urlInput)
      .waitForElementFocus(urlInput)
    for (let i = 0; i < this.url.length; i++) {
      yield Brave.app.client
        .keys(this.url[i])
        .pause(30)
    }
    yield Brave.app.client
      .keys(Brave.keys.ENTER)
      .waitForUrl(this.url)
  }

  function * addTopSites (client) {
    const siteDetails = topSites.map(etld => {
      return {
        location: `https://www.${etld}`,
        title: etld,
        parentFolderId: 0
      }
    })
    const sites = Immutable.fromJS(siteDetails)
    yield client
      .addBookmarks(sites)
  }

  it('fresh', function * () {
    yield restart()
    yield profilerUtil.startProfiler(this)
    yield runStory.call(this)
    yield profilerUtil.stopProfiler(this, 'fresh-')
  })

  it('with topsites', function * () {
    yield addTopSites(Brave.app.client)
    yield restart()
    yield profilerUtil.startProfiler(this)
    yield runStory.call(this)
    yield profilerUtil.stopProfiler(this, 'with-topsites-')
  })
})
