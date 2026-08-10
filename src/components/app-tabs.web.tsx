import { Tabs, TabSlot } from 'expo-router/ui';

export default function AppTabs() {
  return (
    <Tabs>
      {/* 
        Sadece sayfanın asıl içeriğini (MissionControl vb.) render eder.
        Expo Starter, Docs ve menü butonlarını barındıran beyaz bar tamamen silindi!
      */}
      <TabSlot style={{ height: '100%' }} />
    </Tabs>
  );
}