(ns chlorine.core
  (:require [chlorine.utils :as aux]
            [schema.core :as s]
            [chlorine.ui.connection :as conn]
            [chlorine.repl :as repl]
            [chlorine.features.refresh :as refresh]
            [chlorine.configs :as configs]
            [clojure.string :as str]
            [repl-tooling.editor-integration.renderer.console :as console]))

(def config (configs/get-configs))

(def commands
  (fn []
    (clj->js {:connect-socket-repl conn/connect-socket!
              :connect-nrepl conn/connect-nrepl!
              :clear-inline-results repl/clear-inline!
              :clear-console console/clear

              :inspect-block repl/inspect-block!
              :inspect-top-block repl/inspect-top-block!

              :refresh-namespaces refresh/run-refresh!
              :toggle-refresh-mode refresh/toggle-refresh})))

(def aux #js {:reload aux/reload-subscriptions!
              :connect_static repl/connect-static!
              :observe_config configs/observe-configs!
              :get_disposable (fn [] @aux/subscriptions)})

#_#_
(defn- ^:dev/before-load before []
  (let [main (.. js/atom -packages (getActivePackage "chlorine") -mainModule)]
    (.deactivate main)))

(defn- ^:dev/before-load after []
  (let [main (.. js/atom -packages (getActivePackage "chlorine") -mainModule)]
    (.activate main)
    (.. js/atom -notifications (addSuccess "Reloaded Chlorine"))
    (println "Reloaded")))
