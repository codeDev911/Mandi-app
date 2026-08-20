import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mandibolli.commission',
  appName: 'Mandi Bolli',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;

