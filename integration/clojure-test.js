const assert = require('assert')
const Application = require('spectron').Application
const app = new Application({
  path: '/usr/bin/atom',
  args: ['integration/fixture-app/', '--dev', '--socket-path=/tmp/atom-dev-socket-1.sock', '/tmp/test.clj', '/tmp/test2.cljs']
})

const sendJS = (cmd) =>
  app.client.execute(cmd)

const sendCommand = (cmd) =>
  sendJS(`atom.commands.dispatch(document.activeElement, "${cmd}")`)

const haveSelector = (sel) => app.client.waitForText(sel)

const haveText = (text) =>
  haveSelector(`//div[contains(., '${text}')]`)

const typeCommand = async (cmd) => {
  await sendCommand("vim-mode-plus:activate-insert-mode")
  await app.client.keys("End")
  await app.client.keys(`\n\n${cmd}`)
  await app.client.keys("ArrowLeft")
}

const evalCommand = async (cmd) => {
  await typeCommand(cmd)
  await sendCommand("lazuli:evaluate-block")
}

const gotoTab = async (fileName) => {
  let i
  for(i=0; i < 10; i++) {
    await sendCommand("pane:show-next-item")
    const title = await app.browserWindow.getTitle()
    if(title.match(fileName)) {
      return true
    } else {
      await sendCommand("window:focus-next-pane")
      if(title.match(fileName)) {
        return true
      }
    }
  }
  return false
}

const time = (time) => new Promise(res => {
  setTimeout(() => res(true), time)
})

describe('Atom should open and evaluate code', function () {
  after(() => {
    app.stop()
  })

  this.timeout(30000)

  it('opens an atom window', async () => {
    await app.start()
    assert.ok(await app.browserWindow.isVisible())
  })

  it('connects to editor', async () => {
    assert.ok(await gotoTab('test.clj'))
    await sendCommand("lazuli:connect-clojure-socket-repl")
    await(1000)
    assert.ok(await haveSelector('div*=Connect to Socket REPL'))
    await app.client.execute("document.querySelector('atom-panel input').focus()")
    await app.client.keys("Tab")
    await app.client.keys("3333")
    await app.client.keys("Enter")
    assert.ok(await haveSelector("div.lazuli"))
    assert.ok(await gotoTab('test.clj'))
  })

  describe('when connecting to Clojure', () => {
    it('evaluates code', async () => {
      await time(1000)
      assert.ok(await gotoTab('test.clj'))
      await sendCommand("vim-mode-plus:activate-insert-mode")
      await typeCommand("(ns user.test1)")
      await sendCommand("lazuli:evaluate-top-block")
      assert.ok(await haveSelector('div*=nil'))

      await evalCommand("(str (+ 90 120))")
      await sendCommand("lazuli:evaluate-block")
      assert.ok(await haveSelector(`//div[contains(., '"210"')]`))
    })

    it('goes to definition of var', async () => {
      await typeCommand("defn")
      await sendCommand("lazuli:go-to-var-definition")
      await time(100)
      await gotoTab('core.clj')
      assert.ok(await haveSelector(`//div[contains(., ':arglists')]`))
      await sendCommand('core:close')
    })

    // FIXME: InkTerminal currently is inside a Canvas :(
    it('shows definition of var', async () => {
      await gotoTab('test.clj')
      await sendCommand('lazuli:source-for-var')
      assert.ok(await haveSelector(`//div[contains(., 'fdecl')]`))
    })

    it('breaks evaluation', async () => {
      await sendCommand('inline-results:clear-all')
      await evalCommand(`(Thread/sleep 2000)`)
      await time(400)
      await sendCommand("lazuli:break-evaluation")
      assert.ok(await haveSelector(`//*[contains(., '"Evaluation interrupted"')]`))
    })

    it('shows function doc', async () => {
      await sendCommand('inline-results:clear-all')
      await typeCommand("\n\nstr")
      await sendCommand("lazuli:doc-for-var")
      assert.ok(await haveText("With no args, returns the empty string. With one arg x, returns\n"))
    })

    it('captures exceptions', async () => {
      await evalCommand(`(throw (ex-info "Error Number 1", {}))`)
      assert.ok(await haveSelector(`div.error`))
      assert.ok(await haveSelector(`span*=Error Number 1`))

      await evalCommand(`(ex-info "Error Number 2", {})`)
      assert.ok(await haveText(`Error Number 2`))
    })

    it('allows big strings to be represented', async () => {
      await sendCommand('inline-results:clear-all')
      await evalCommand("(str (range 200))")
      assert.ok(await haveText("29"))
      assert.ok(await haveText("..."))
      // await app.client.click("a*=...")
      // assert.ok(await haveText("52 53 54"))
      await sendCommand('inline-results:clear-all')
    })
  })

  describe('when connecting to ClojureScript inside Clojure', () => {
    it('connects to embedded ClojureScript', async () => {
      await sendCommand('lazuli:clear-console')
      assert.ok(await gotoTab('test2.cljs'))
      await sendCommand('lazuli:connect-embeded-clojurescript-repl')
      assert.ok(await haveText("ClojureScript REPL connected"))
    })

    it('evaluates code', async () => {
      await evalCommand("(ns user.test2)")
      assert.ok(await haveText("nil"))

      await evalCommand("(+ 5 2)")
      assert.ok(await haveText(7))

      await evalCommand("(str (+ 90 120))")
      assert.ok(await haveText(`"210"`))

      await evalCommand("(/ 10 0)")
      assert.ok(await haveText("##Inf"))
    })

    it('shows function doc', async () => {
      await sendCommand('inline-results:clear-all')
      await typeCommand("str")
      await sendCommand("lazuli:doc-for-var")
      assert.ok(await haveText("With no args, returns the empty string"))
    })

    it('captures exceptions', async () => {
      await evalCommand(`(throw (ex-info "Error Number 2", {}))`)
      assert.ok(await haveSelector(`div.error`))
      assert.ok(await haveText(`Error Number 2`))

      await evalCommand(`(throw "Error Number 3")`)
      assert.ok(await haveSelector(`div.error`))
      assert.ok(await haveText(`Error Number 3`))

      await evalCommand(`(ex-info "Error Number 4", {})`)
      assert.ok(await haveSelector(`div.result`))
      assert.ok(await haveText(`Error Number 4`))

      await evalCommand(`(somestrangefn 10)`)
      assert.ok(await haveSelector(`div.error`))
      assert.ok(await haveText(`Error: Cannot read property`))
    })
  })
})
