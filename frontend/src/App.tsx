import { useState } from 'react';
import { PlayerList } from './components/PlayerList';
import { AuctionRoom } from './components/MockAuction/AuctionRoom';

type View = 'rankings' | 'auction';

function App() {
  const [view, setView] = useState<View>('rankings');

  if (view === 'auction') {
    return <AuctionRoom onBack={() => setView('rankings')} />;
  }
  return <PlayerList onMockAuction={() => setView('auction')} />;
}

export default App;
