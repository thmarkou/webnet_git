import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/context/AuthContext';
import { GlobalStateProvider } from './src/context/GlobalState';
import { RootNavigator } from './src/navigation';

export default function App() {
  return (
    <AuthProvider>
      <GlobalStateProvider>
        <RootNavigator />
        <StatusBar style="auto" />
      </GlobalStateProvider>
    </AuthProvider>
  );
}
