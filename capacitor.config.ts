import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.santaanita.ordendesalidas',
  appName: 'Orden de Salidas',
  webDir: 'dist',
  android: {
    backgroundColor: '#7C3AED',
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_salidas',
      iconColor: '#7C3AED',
    },
  },
}

export default config
