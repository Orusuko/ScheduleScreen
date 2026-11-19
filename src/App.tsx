import { useEffect, useState } from 'react'
import { BottomNav, type Tab } from './components/BottomNav'
import { ShareImport, base64ToBytes } from './services/native/plugins'
import { HomeScreen } from './screens/HomeScreen'
import { ImportScreen } from './screens/ImportScreen'
import { PermissionsScreen } from './screens/PermissionsScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { useStore } from './store/Store'

export function App() {
  const { data } = useStore()
  const [tab, setTab] = useState<Tab>('home')
  const [sharedPdf, setSharedPdf] = useState<Uint8Array | null>(null)

  useEffect(() => {
    let remove = () => {}
    const pull = async () => {
      const result = await ShareImport.consume()
      if (!result.base64) return
      setSharedPdf(base64ToBytes(result.base64))
      setTab('import')
    }
    void pull()
    void ShareImport.addListener('pdfReceived', () => {
      void pull()
    }).then((handle) => {
      remove = () => {
        void handle.remove()
      }
    })
    return () => remove()
  }, [])

  if (!data.permissionsIntroSeen) return <PermissionsScreen />

  return (
    <div className="app">
      {tab === 'home' && <HomeScreen onImport={() => setTab('import')} onSettings={() => setTab('settings')} />}
      {tab === 'import' && <ImportScreen sharedPdf={sharedPdf} onConsumed={() => setSharedPdf(null)} />}
      {tab === 'settings' && <SettingsScreen />}
      <BottomNav tab={tab} onChange={setTab} />
    </div>
  )
}
